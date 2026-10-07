import type { UsageRecord } from '@binnacle/telemetry';
import { count, isObject, readLines, type ArtifactPosition, type ArtifactReading } from './artifact.ts';

/**
 * A Claude Code session artifact, from `start`, to normalised records: one per message that
 * carries usage (`readLines` says how the bytes are read).
 *
 * The reader takes the fields it needs and ignores every other one, content, tool input and
 * tool output included; a line that is not JSON, or an assistant record without a field it
 * needs, stops the reading there. Claude Code repeats a message's record once per content
 * block, and every repeat has the message's id as its natural key. In a main session the
 * repeats carry the same usage. In a subagent's session the earlier ones carry the output
 * counted so far and the last the message's own, so a message is its last record.
 *
 * The last message read may still be being written. Unless `settled` says the file has been
 * idle long enough to be finished, the reading stops before that message's first record,
 * and a later reading takes it whole once a later message has started after it or the file
 * has settled. A stored record is never completed from a later one (ADR-0015).
 *
 * A subagent's session (`<session>/subagents/agent-<id>.jsonl`) is read the same way: each
 * of its records names the subagent, and the session that started it as its own session.
 * The description in the subagent's `.meta.json` is in another file and is never read.
 *
 * Claude Code's own `<synthetic>` messages, written for an API error, are no call to a
 * model and give no record.
 */
export function readClaudeCode(bytes: Buffer, start: ArtifactPosition, settled: boolean): ArtifactReading {
  // Where each message's first record starts, in the order the messages began.
  const starts = new Map<string, ArtifactPosition>();
  const reading = readLines(bytes, start, readRecord, (record, at) => {
    if (!starts.has(record.naturalKey)) starts.set(record.naturalKey, at);
  });
  const records = new Map(reading.records.map((record) => [record.naturalKey, record]));
  const last = [...starts].at(-1);
  if (settled || last === undefined) return { ...reading, records: [...records.values()] };
  // A line that cannot be read is no later message, so it does not finish the one before it either.
  records.delete(last[0]);
  return { ...reading, records: [...records.values()], stop: last[1] };
}

/** A record, null for a line that carries no usage, or why the line cannot be read. */
function readRecord(value: Record<string, unknown>): UsageRecord | null | string {
  if (value.type !== 'assistant') return null;

  const message = value.message;
  if (!isObject(message)) return 'an assistant record without a message';
  if (message.model === '<synthetic>') return null;
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
