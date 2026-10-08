import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import type { UsageRecord } from '@binnacle/telemetry';

/** A conversation as its file under `~/.gemini/antigravity/conversations` gives it: its id, the file's name, and its time. */
export type AntigravityConversation = { id: string; time: number };

/** The key under which Antigravity's window state summarises each conversation. */
const SUMMARIES_KEY = 'antigravityUnifiedStateSync.trajectorySummaries';

/**
 * The trajectory summaries Antigravity keeps in its window state at `path` (`state.vscdb`, VS
 * Code's `ItemTable`), read without writing to it; null when it keeps none. Throws when the
 * database cannot be opened or read.
 */
export function readAntigravityState(path: string): string | null {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const row = db.prepare('select value from ItemTable where key = ?').get(SUMMARIES_KEY) as { value: string | Uint8Array } | undefined;
    if (row === undefined) return null;
    return typeof row.value === 'string' ? row.value : Buffer.from(row.value).toString('utf8');
  } finally {
    db.close();
  }
}

/**
 * Antigravity's sessions to normalised records: one per conversation that has both a file,
 * for its time, and a summary naming its workspace, for its directory. Its conversations are
 * encrypted, so a record says only that a session ran there from that time: no model, no
 * provider and no count, each null (ADR-0007). Its time is Binnacle's reading of the file's,
 * so the record is `calculated`. A conversation with no workspace is no project's. Nothing of a
 * summary but the id and the workspace is kept.
 *
 * `summaries` is the window state's value (`readAntigravityState`). Ticket 06 recorded its
 * shape, not its field numbers: base64 of a protobuf whose entries each hold a conversation id
 * and, nested as base64, a summary with the workspace's `file://` URI. So an entry is searched
 * for the strings it holds, through nested messages and base64, and its id is the one that
 * names a conversation, its directory the first `file://` URI.
 *
 * ponytail: a URI is taken wherever an entry holds one; read the field by its number once the
 * format is confirmed on a working Antigravity.
 */
export function readAntigravity(summaries: string | null, conversations: AntigravityConversation[]): { records: UsageRecord[]; failure: string | null } {
  if (summaries === null) return { records: [], failure: null };
  const text = unquoted(summaries.trim());
  const entries = text !== null && BASE64.test(text) ? fields(Buffer.from(text, 'base64')) : null;
  if (entries === null) return { records: [], failure: 'its trajectory summaries are not base64 of a protobuf' };

  const times = new Map(conversations.map(({ id, time }) => [id, time]));
  const records: UsageRecord[] = [];
  for (const entry of entries) {
    const held: string[] = [];
    strings(entry, 0, held);
    const id = held.find((value) => times.has(value));
    const cwd = held.flatMap(directory)[0];
    if (id === undefined || cwd === undefined || records.some((record) => record.sessionId === id)) continue;
    records.push({
      harness: 'antigravity',
      naturalKey: id,
      requestId: null,
      sessionId: id,
      subagentId: null,
      parentSession: null,
      timestamp: new Date(times.get(id)!).toISOString(),
      cwd,
      branch: null,
      provider: null,
      model: null,
      tokens: { input: null, cachedInput: null, cacheCreation: null, output: null, reasoning: null },
      provenance: 'calculated',
    });
  }
  return { records, failure: null };
}

/** `text`, or the string it holds when VS Code wrote it as JSON; null when that is no JSON string. */
function unquoted(text: string): string | null {
  if (!text.startsWith('"')) return text;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

const BASE64 = /^(?:[A-Za-z0-9+/]{4})+(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** The path a `file://` URI names, as a one-item list; none for any other string. */
function directory(value: string): string[] {
  if (!value.startsWith('file://') || /\s/.test(value)) return [];
  try {
    return [fileURLToPath(value)];
  } catch {
    return [];
  }
}

/** Every string `message` holds, its own and its nested messages', base64 ones decoded, depth first, to a bounded depth. */
function strings(message: Buffer, depth: number, held: string[]): void {
  if (depth > 8) return;
  for (const value of fields(message) ?? []) {
    const text = value.toString('utf8');
    held.push(text);
    strings(value, depth + 1, held);
    if (BASE64.test(text)) strings(Buffer.from(text, 'base64'), depth + 1, held);
  }
}

/** The length-delimited values of a protobuf message, in order; null when `bytes` are not one whole message. */
function fields(bytes: Buffer): Buffer[] | null {
  const values: Buffer[] = [];
  for (let at = 0; at < bytes.length; ) {
    const key = varint(bytes, at);
    if (key === null || key.value < 8) return null;
    at = key.next;
    switch (key.value % 8) {
      case 0: {
        const skipped = varint(bytes, at);
        if (skipped === null) return null;
        at = skipped.next;
        break;
      }
      case 1:
        at += 8;
        break;
      case 5:
        at += 4;
        break;
      case 2: {
        const length = varint(bytes, at);
        if (length === null || length.next + length.value > bytes.length) return null;
        values.push(bytes.subarray(length.next, length.next + length.value));
        at = length.next + length.value;
        break;
      }
      default:
        return null;
    }
    if (at > bytes.length) return null;
  }
  return values;
}

/** The varint at `at`, and where the next value starts; null when none is whole there. */
function varint(bytes: Buffer, at: number): { value: number; next: number } | null {
  let value = 0;
  for (let index = 0; index < 10 && at + index < bytes.length; index++) {
    const byte = bytes[at + index]!;
    value += (byte & 0x7f) * 2 ** (7 * index);
    if (byte < 0x80) return { value, next: at + index + 1 };
  }
  return null;
}
