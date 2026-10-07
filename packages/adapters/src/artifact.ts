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
 * The complete lines of a JSON Lines artifact, from `start`, each read by `read` into a
 * record, null for a line that carries none, or why it cannot be read, which stops the
 * reading there. `bytes` are the file's from `start.offset` on; positions are counted in
 * bytes of the file, whatever a line decodes to. A line still being written, with no
 * newline yet, is left for the next reading. `seen`, if given, is told each record with the
 * position of the line it came from.
 */
export function readLines(
  bytes: Buffer,
  start: ArtifactPosition,
  read: (value: Record<string, unknown>) => UsageRecord | null | string,
  seen?: (record: UsageRecord, at: ArtifactPosition) => void,
): ArtifactReading {
  const records: UsageRecord[] = [];
  let { offset, line } = start;
  let from = 0;
  for (let end = bytes.indexOf(NEWLINE); end !== -1; from = end + 1, end = bytes.indexOf(NEWLINE, from)) {
    const raw = bytes.subarray(from, end).toString('utf8');
    const result = raw.trim() === '' ? null : readObject(raw, read);
    if (typeof result === 'string') return { records, stop: { offset, line }, failure: { line: line + 1, reason: result } };
    if (result) {
      records.push(result);
      seen?.(result, { offset, line });
    }
    offset += end - from + 1;
    line += 1;
  }
  return { records, stop: { offset, line }, failure: null };
}

/**
 * `readLines` over an artifact that writes a message's record again as the message grows:
 * every record of a message has its natural key, and the message is its last record.
 *
 * The last message read may still be being written. Unless `settled` says the file has been
 * idle long enough to be finished, the reading stops before that message's first record,
 * and a later reading takes it whole once a later message has started after it or the file
 * has settled. A stored record is never completed from a later one (ADR-0015).
 */
export function readMessages(
  bytes: Buffer,
  start: ArtifactPosition,
  settled: boolean,
  read: (value: Record<string, unknown>) => UsageRecord | null | string,
): ArtifactReading {
  // Where each message's first record starts, in the order the messages began.
  const starts = new Map<string, ArtifactPosition>();
  const reading = readLines(bytes, start, read, (record, at) => {
    if (!starts.has(record.naturalKey)) starts.set(record.naturalKey, at);
  });
  const records = new Map(reading.records.map((record) => [record.naturalKey, record]));
  const last = [...starts].at(-1);
  if (settled || last === undefined) return { ...reading, records: [...records.values()] };
  // A line that cannot be read is no later message, so it does not finish the one before it either.
  records.delete(last[0]);
  return { ...reading, records: [...records.values()], stop: last[1] };
}

function readObject(raw: string, read: (value: Record<string, unknown>) => UsageRecord | null | string): UsageRecord | null | string {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return 'not a JSON line';
  }
  return isObject(value) ? read(value) : 'not a JSON object';
}

const NEWLINE = 0x0a;
/** A token count as a harness reports one: a non-negative integer, or null. */
export const count = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null);
/** A JSON object, as opposed to an array, null or a primitive. */
export const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
