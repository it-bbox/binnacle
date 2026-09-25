import type { UsageRecord } from '@binnacle/telemetry';

/** Where a reading starts or stopped: a byte offset into the file, and the number of lines before it. */
export type ArtifactPosition = { offset: number; line: number };

export type ArtifactReading = {
  records: UsageRecord[];
  /** After the last line read; the next reading starts here. */
  stop: ArtifactPosition;
  /** The line the reading stopped at because it could not be read, which `stop` is just before. */
  failure: { line: number; reason: string } | null;
};

/**
 * A Claude Code session artifact, from `start`, to normalised records: one per assistant
 * record that carries usage. `bytes` are the file's from `start.offset` on; positions are
 * counted in bytes of the file, whatever a line decodes to.
 *
 * Only complete lines are read, so a line still being written is left for the next reading.
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
  const records: UsageRecord[] = [];
  let { offset, line } = start;
  let from = 0;
  for (let end = bytes.indexOf(NEWLINE); end !== -1; from = end + 1, end = bytes.indexOf(NEWLINE, from)) {
    const raw = bytes.subarray(from, end).toString('utf8');
    const read = raw.trim() === '' ? null : readLine(raw);
    if (typeof read === 'string') return { records, stop: { offset, line }, failure: { line: line + 1, reason: read } };
    if (read) records.push(read);
    offset += end - from + 1;
    line += 1;
  }
  return { records, stop: { offset, line }, failure: null };
}

/** A record, null for a line that carries no usage, or why the line cannot be read. */
function readLine(raw: string): UsageRecord | null | string {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return 'not a JSON line';
  }
  if (!isObject(value)) return 'not a JSON object';
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

const NEWLINE = 0x0a;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);
