import { count, isObject, readLines, type ArtifactReading, type LineReading } from './artifact.ts';

/** The running counts of Codex's `total_token_usage` a record is the difference of. */
const COUNTS = ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens'] as const;
type Counts = Record<(typeof COUNTS)[number], number>;

/**
 * A Codex rollout, from its start, to normalised records: one per `token_count` event whose
 * running `total_token_usage` grew, holding the difference from the total before it. A
 * rollout is always read from its start, because a difference needs the total before it and
 * the session's id, `cwd` and provider are in its first record, `session_meta`
 * (`readLines` says how the bytes are read).
 *
 * A record's time is that of the `token_usage_record` Codex writes as the call's response
 * completes, where one is written since the token count before; otherwise the token count's
 * own, which Codex writes only once the turn's pending tools have resolved, up to a minute
 * later.
 *
 * Every count is `calculated`. Codex's `input_tokens` includes the input read from cache, so
 * input not read from cache is `input_tokens − cached_input_tokens`; reasoning is a part of
 * output, as on every harness. Cache creation is not mapped: whether Codex counts it inside
 * `input_tokens` is not known, and counting it twice would be worse than not at all. The
 * model is the one of the turn context in force; the provider is `session_meta`'s. Codex
 * records no branch per call, only the one its session started on (`session_meta.git.branch`),
 * which every record carries as the harness's. It is stored, but attributes nothing: a run's
 * branch comes from its checkout's reflog, or it has none (ADR-0030).
 *
 * A total that decreases is a failure, not a reset, and so is a token count before the
 * session's meta or without a field the difference needs. A count that repeats the total
 * before it, as Codex writes when a turn is aborted, is no new call and gives no record;
 * nor does one with no totals yet. Content, tool input and output are never read.
 *
 * Codex writes no compaction boundary. Its `session_meta` names the session's context window
 * (`context_window.window_id`), and each `compacted` record the window it continues in: one
 * that names another than the window in force gives a compaction marker, calculated and with
 * no trigger; one that follows no named window gives none. What it replaced the history with is never read.
 */
export function readCodex(bytes: Buffer): ArtifactReading {
  let session: CodexSession | null = null;
  let model: string | null = null;
  let previous: Counts = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 };
  // When the response of the call the next token count totals completed, if Codex wrote it.
  let completedAt: unknown = undefined;
  // The context window in force, null until a record names one.
  let contextWindow: string | null = null;

  return readLines(bytes, { offset: 0, line: 0 }, (value): LineReading => {
    const payload = value.payload;
    if (value.type === 'session_meta') {
      session = codexSession(value);
      const window = isObject(payload) && isObject(payload.context_window) ? payload.context_window.window_id : undefined;
      if (typeof window === 'string') contextWindow = window;
      return session ? null : 'a session meta without an id or a cwd';
    }
    if (value.type === 'compacted' && isObject(payload) && typeof payload.window_id === 'string') {
      // With no window known before it, no change is seen: the signal is absent, not guessed.
      if (contextWindow === null || payload.window_id === contextWindow) {
        contextWindow = payload.window_id;
        return null;
      }
      const time = typeof value.timestamp === 'string' ? Date.parse(value.timestamp) : NaN;
      if (Number.isNaN(time)) return 'a compaction without a timestamp';
      if (!Number.isInteger(value.ordinal)) return 'a compaction without an ordinal';
      if (session === null) return 'a compaction before the session meta';
      contextWindow = payload.window_id;
      return {
        harness: 'codex',
        naturalKey: `${session.id}:${String(value.ordinal)}`,
        sessionId: session.id,
        subagentId: null,
        timestamp: new Date(time).toISOString(),
        cwd: session.cwd,
        trigger: null,
        provenance: 'calculated',
      };
    }
    if (value.type === 'turn_context' && isObject(payload)) {
      model = typeof payload.model === 'string' ? payload.model : null;
      // A turn aborted after its usage record wrote no token count: its time is no later call's.
      completedAt = undefined;
      return null;
    }
    if (value.type === 'token_usage_record') {
      completedAt = value.timestamp;
      return null;
    }
    if (value.type !== 'event_msg' || !isObject(payload) || payload.type !== 'token_count' || payload.info == null) return null;

    const total = isObject(payload.info) ? payload.info.total_token_usage : undefined;
    if (!isObject(total) || COUNTS.some((name) => count(total[name]) === null)) return 'a token count without its total';
    // The call's time is when its response completed, the time its OpenTelemetry event has too.
    const stamp = completedAt ?? value.timestamp;
    completedAt = undefined;
    const time = typeof stamp === 'string' ? Date.parse(stamp) : NaN;
    if (Number.isNaN(time)) return 'a token count without a timestamp';
    if (!Number.isInteger(value.ordinal)) return 'a token count without an ordinal';
    if (session === null) return 'a token count before the session meta';

    const current = Object.fromEntries(COUNTS.map((name) => [name, total[name]])) as Counts;
    const difference = Object.fromEntries(COUNTS.map((name) => [name, current[name] - previous[name]])) as Counts;
    if (COUNTS.some((name) => difference[name] < 0)) return 'a total_token_usage that decreases';
    const input = difference.input_tokens - difference.cached_input_tokens;
    if (input < 0) return 'more input read from cache than input';
    previous = current;
    if (COUNTS.every((name) => difference[name] === 0)) return null;

    return {
      harness: 'codex',
      naturalKey: `${session.id}:${String(value.ordinal)}`,
      requestId: null,
      sessionId: session.id,
      timestamp: new Date(time).toISOString(),
      cwd: session.cwd,
      subagentId: null,
      parentSession: null,
      branch: session.branch === null ? null : { name: session.branch, source: 'harness' },
      provider: session.provider,
      model,
      tokens: {
        input,
        cachedInput: difference.cached_input_tokens,
        cacheCreation: null,
        output: difference.output_tokens,
        reasoning: difference.reasoning_output_tokens,
      },
      provenance: 'calculated',
    };
  });
}

type CodexSession = { id: string; cwd: string; provider: string | null; branch: string | null };

/**
 * The session a rollout's `session_meta` record names: its id, the `cwd` it ran in, the
 * provider it states and the branch it started on. Null for any other record, or one without
 * an id or a `cwd`.
 */
export function codexSession(value: Record<string, unknown>): CodexSession | null {
  const payload = value.payload;
  if (value.type !== 'session_meta' || !isObject(payload) || typeof payload.id !== 'string' || typeof payload.cwd !== 'string') return null;
  const repository = payload.git;
  return {
    id: payload.id,
    cwd: payload.cwd,
    provider: typeof payload.model_provider === 'string' ? payload.model_provider : null,
    branch: isObject(repository) && typeof repository.branch === 'string' && repository.branch !== '' ? repository.branch : null,
  };
}
