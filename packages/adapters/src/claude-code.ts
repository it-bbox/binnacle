import type { UsageRecord } from '@binnacle/telemetry';
import { count, isObject, readLines, type ArtifactPosition, type ArtifactReading } from './artifact.ts';

/**
 * A Claude Code session artifact, from `start`, to normalised records: one per assistant
 * record that carries usage (`readLines` says how the bytes are read).
 *
 * The reader takes the fields it needs and ignores every other one, content, tool input and
 * tool output included; a line that is not JSON, or an assistant record without a field it
 * needs, stops the reading there. Claude Code repeats a message's record, usage and all,
 * once per content block, and every repeat has the message's id as its natural key: the
 * store keeps the first, so a message counts once.
 *
 * Claude Code's own `<synthetic>` messages, written for an API error, are no call to a
 * model and give no record.
 */
export function readClaudeCode(bytes: Buffer, start: ArtifactPosition): ArtifactReading {
  return readLines(bytes, start, readRecord);
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

  const details = usage.output_tokens_details;
  return {
    harness: 'claude-code',
    naturalKey: message.id,
    sessionId: value.sessionId,
    timestamp: new Date(time).toISOString(),
    cwd: value.cwd,
    branch: typeof value.gitBranch === 'string' && value.gitBranch !== '' ? { name: value.gitBranch, source: 'harness' } : null,
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
