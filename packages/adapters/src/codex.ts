import type { UsageRecord } from '@binnacle/telemetry';
import { count, isObject, readLines, type ArtifactReading } from './artifact.ts';

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
 * Every count is `calculated`. Codex's `input_tokens` includes the input read from cache, so
 * input not read from cache is `input_tokens − cached_input_tokens`; reasoning is a part of
 * output, as on every harness. Cache creation is not mapped: whether Codex counts it inside
 * `input_tokens` is not known, and counting it twice would be worse than not at all. The
 * model is the one of the turn context in force; the provider is `session_meta`'s. Codex
 * records no branch per call, so the branch is left for the reflog.
 *
 * A total that decreases is a failure, not a reset, and so is a token count before the
 * session's meta or without a field the difference needs. A count that repeats the total
 * before it, as Codex writes when a turn is aborted, is no new call and gives no record;
 * nor does one with no totals yet. Content, tool input and output are never read.
 */
export function readCodex(bytes: Buffer): ArtifactReading {
  let session: { id: string; cwd: string; provider: string | null } | null = null;
  let model: string | null = null;
  let previous: Counts = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 };

  return readLines(bytes, { offset: 0, line: 0 }, (value): UsageRecord | null | string => {
    const payload = value.payload;
    if (value.type === 'session_meta') {
      if (!isObject(payload) || typeof payload.id !== 'string' || typeof payload.cwd !== 'string') return 'a session meta without an id or a cwd';
      session = { id: payload.id, cwd: payload.cwd, provider: typeof payload.model_provider === 'string' ? payload.model_provider : null };
      return null;
    }
    if (value.type === 'turn_context' && isObject(payload)) {
      model = typeof payload.model === 'string' ? payload.model : null;
      return null;
    }
    if (value.type !== 'event_msg' || !isObject(payload) || payload.type !== 'token_count' || payload.info == null) return null;

    const total = isObject(payload.info) ? payload.info.total_token_usage : undefined;
    if (!isObject(total) || COUNTS.some((name) => count(total[name]) === null)) return 'a token count without its total';
    const time = typeof value.timestamp === 'string' ? Date.parse(value.timestamp) : NaN;
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
      sessionId: session.id,
      timestamp: new Date(time).toISOString(),
      cwd: session.cwd,
      branch: null,
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
