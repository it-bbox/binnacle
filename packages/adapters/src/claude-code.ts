import type { CompactionMarker, Marker, UsageLimitMarker } from '@binnacle/telemetry';
import { count, isObject, readMessages, type ArtifactPosition, type ArtifactReading, type LineReading } from './artifact.ts';

/**
 * A Claude Code session artifact, from `start`, to normalised records: one per message that
 * carries usage (`readLines` says how the bytes are read, `readMessages` how the last
 * message waits until `settled`).
 *
 * The reader takes the fields it needs and ignores every other one, content, tool input and
 * tool output included; a line that is not JSON, or an assistant record without a field it
 * needs, stops the reading there. Claude Code repeats a message's record once per content
 * block, and every repeat has the message's id as its natural key. In a main session the
 * repeats carry the same usage. In a subagent's session the earlier ones carry the output
 * counted so far and the last the message's own, so a message is its last record.
 *
 * A subagent's session (`<session>/subagents/agent-<id>.jsonl`) is read the same way: each
 * of its records names the subagent, and the session that started it as its own session.
 * The description in the subagent's `.meta.json` is in another file and is never read.
 *
 * Claude Code's own `<synthetic>` messages, written for an API error, are no call to a
 * model and give no record. The one written for `"error":"rate_limit"`, where the session hit a
 * usage limit, gives a usage-limit marker with the limit's type; its message is never read.
 *
 * Each compaction boundary, the `system` record Claude Code writes where it compacted the
 * session, gives a marker with its trigger, `auto` or `manual`; what it dropped and kept is
 * never read.
 */
export function readClaudeCode(bytes: Buffer, start: ArtifactPosition, settled: boolean): ArtifactReading {
  return readMessages(bytes, start, settled, readRecord);
}

/** A record, a compaction or usage-limit marker, null for a line that carries none, or why the line cannot be read. */
function readRecord(value: Record<string, unknown>): LineReading {
  if (value.type === 'system' && value.subtype === 'compact_boundary') return readBoundary(value);
  if (value.type !== 'assistant') return null;

  const message = value.message;
  if (!isObject(message)) return 'an assistant record without a message';
  if (message.model === '<synthetic>') return value.error === 'rate_limit' ? readUsageLimit(value) : null;
  const usage = message.usage;
  const time = typeof value.timestamp === 'string' ? Date.parse(value.timestamp) : NaN;
  if (typeof message.id !== 'string') return 'an assistant record without a message id';
  if (!isObject(usage)) return 'an assistant record without usage';
  if (Number.isNaN(time)) return 'an assistant record without a timestamp';
  if (typeof value.cwd !== 'string') return 'an assistant record without a cwd';
  if (typeof value.sessionId !== 'string') return 'an assistant record without a session id';
  // A subagent's record is a sidechain, and names its subagent.
  const subagentId = value.isSidechain === true ? value.agentId : null;
  if (subagentId !== null && typeof subagentId !== 'string') return 'a subagent record without an agent id';

  const details = usage.output_tokens_details;
  return {
    harness: 'claude-code',
    naturalKey: message.id,
    requestId: typeof value.requestId === 'string' ? value.requestId : null,
    sessionId: value.sessionId,
    subagentId,
    parentSession: subagentId === null ? null : value.sessionId,
    timestamp: new Date(time).toISOString(),
    cwd: value.cwd,
    // Claude Code writes `HEAD` for a detached HEAD, which is no branch.
    branch: typeof value.gitBranch === 'string' && value.gitBranch !== '' && value.gitBranch !== 'HEAD' ? { name: value.gitBranch, source: 'harness' } : null,
    provider: null,
    model: typeof message.model === 'string' ? message.model : null,
    tokens: {
      input: count(usage.input_tokens),
      cachedInput: count(usage.cache_read_input_tokens),
      cacheCreation: count(usage.cache_creation_input_tokens),
      output: count(usage.output_tokens),
      reasoning: isObject(details) ? count(details.thinking_tokens) : null,
    },
    provenance: 'provider_reported',
  };
}

/** A compaction boundary's marker, or why the boundary cannot be read. */
function readBoundary(value: Record<string, unknown>): CompactionMarker | string {
  const place = markerPlace(value, 'compaction boundary');
  if (typeof place === 'string') return place;
  const trigger = isObject(value.compactMetadata) ? value.compactMetadata.trigger : undefined;
  return { ...place, trigger: typeof trigger === 'string' ? trigger : null };
}

/** A usage limit's marker, or why its record cannot be read. */
function readUsageLimit(value: Record<string, unknown>): UsageLimitMarker | string {
  const place = markerPlace(value, 'usage-limit record');
  if (typeof place === 'string') return place;
  const limit = isObject(value.quotaLimits) ? value.quotaLimits.rateLimitType : undefined;
  return { ...place, limit: typeof limit === 'string' ? limit : null };
}

/** What every marker of a line names, or why a line of its `kind` cannot be read. */
function markerPlace(value: Record<string, unknown>, kind: string): Marker | string {
  const time = typeof value.timestamp === 'string' ? Date.parse(value.timestamp) : NaN;
  if (typeof value.uuid !== 'string') return `a ${kind} without a uuid`;
  if (Number.isNaN(time)) return `a ${kind} without a timestamp`;
  if (typeof value.cwd !== 'string') return `a ${kind} without a cwd`;
  if (typeof value.sessionId !== 'string') return `a ${kind} without a session id`;
  const subagentId = value.isSidechain === true ? value.agentId : null;
  if (subagentId !== null && typeof subagentId !== 'string') return `a subagent ${kind} without an agent id`;
  return { harness: 'claude-code', naturalKey: value.uuid, sessionId: value.sessionId, subagentId, timestamp: new Date(time).toISOString(), cwd: value.cwd, provenance: 'provider_reported' };
}
