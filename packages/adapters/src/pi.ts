import type { UsageRecord } from '@binnacle/telemetry';
import { count, isObject, readLines, type ArtifactReading } from './artifact.ts';

/**
 * A pi session file (`<agent dir>/sessions/--<cwd>--/<time>_<id>.jsonl`), from its start, to
 * normalised records: one per entry that carries a call's usage — an assistant message, a
 * tool result whose tool called a model, a `usage` entry such as a cache-warming call, and a
 * compaction's or a branch summary's, the call that wrote the summary: what pi itself totals. A file is always read from its start, because the session's
 * id and `cwd` are on its first line, its header (`readLines` says how the bytes are read).
 * pi appends an entry once, whole, so no entry waits for a later one.
 *
 * pi normalises every provider's usage itself: `input` is what was not read from or written
 * to cache, `cacheRead` and `cacheWrite` apart, and `reasoning`, written only by a provider
 * that reports it, within `output`. They are taken as written, every count `calculated`, as
 * pi derived most of them. A call that failed or was aborted before its provider reported
 * anything is written with zeros pi never received, so its counts are null. Provider and model
 * are the entry's own (ADR-0004), the model the provider answered with where pi wrote it, as pi
 * totals them; a tool result's or a summary's entry names neither. pi writes no branch.
 *
 * A forked or branched session copies the entries before it, ids and timestamps included,
 * so a record's natural key is its entry's id and timestamp: a copied call is the same call,
 * and is counted once, under whichever session was read first. Only ids, timestamps,
 * provider, model and counts are read, never content, thinking or tool calls.
 *
 * ponytail: compactions give no marker, since pi writes no trigger beside them; add one when
 * context pressure needs pi's.
 */
export function readPi(bytes: Buffer): ArtifactReading {
  let session: { id: string; cwd: string } | null = null;
  return readLines(bytes, { offset: 0, line: 0 }, (value): UsageRecord | null | string => {
    if (value.type === 'session') {
      if (session !== null) return null;
      if (typeof value.id !== 'string' || typeof value.cwd !== 'string') return 'a session header without an id or a cwd';
      session = { id: value.id, cwd: value.cwd };
      return null;
    }
    const message = value.type === 'message' && isObject(value.message) && ['assistant', 'toolResult'].includes(value.message.role as string) ? value.message : null;
    // A message's usage, else a usage, compaction or branch summary entry's.
    const call = message ?? (['usage', 'compaction', 'branch_summary'].includes(value.type as string) ? value : null);
    if (call === null || !isObject(call.usage)) return null;

    const time = typeof value.timestamp === 'string' ? Date.parse(value.timestamp) : NaN;
    if (typeof value.id !== 'string') return 'a pi entry with usage but without an id';
    if (Number.isNaN(time)) return 'a pi entry with usage but without a timestamp';
    if (session === null) return 'a pi entry with usage before the session header';

    const usage = call.usage;
    const unreported = (call.stopReason === 'error' || call.stopReason === 'aborted') && usage.totalTokens === 0;
    const tokens = (field: unknown): number | null => (unreported ? null : count(field));
    return {
      harness: 'pi',
      naturalKey: `${value.id}@${value.timestamp as string}`,
      requestId: typeof call.responseId === 'string' ? call.responseId : null,
      sessionId: session.id,
      subagentId: null,
      parentSession: null,
      timestamp: new Date(time).toISOString(),
      cwd: session.cwd,
      branch: null,
      provider: typeof call.provider === 'string' ? call.provider : null,
      model: typeof call.responseModel === 'string' ? call.responseModel : typeof call.model === 'string' ? call.model : null,
      tokens: {
        input: tokens(usage.input),
        cachedInput: tokens(usage.cacheRead),
        cacheCreation: tokens(usage.cacheWrite),
        output: tokens(usage.output),
        reasoning: tokens(usage.reasoning),
      },
      provenance: 'calculated',
    };
  });
}
