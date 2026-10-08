/**
 * Antigravity's window state as ticket 06 recorded it (Antigravity 1.23.2): under the key
 * `antigravityUnifiedStateSync.trajectorySummaries` of VS Code's `ItemTable`, base64 of a
 * protobuf whose entries each hold a conversation's id and, as base64 in a nested message, a
 * summary with a short title, a longer string and the workspace's `file://` URI. The sample
 * gave no field numbers, so these are made up, as the reader reads none.
 */

/** A protobuf varint. */
function varint(value: number): Buffer {
  const bytes: number[] = [];
  for (; value > 0x7f; value = Math.floor(value / 128)) bytes.push((value % 128) | 0x80);
  bytes.push(value);
  return Buffer.from(bytes);
}

/** A length-delimited field `number` holding `value`. */
const field = (number: number, value: Buffer | string): Buffer => {
  const bytes = Buffer.from(value);
  return Buffer.concat([varint(number * 8 + 2), varint(bytes.length), bytes]);
};

/** A varint field, which the reader skips. */
const counter = (number: number, value: number): Buffer => Buffer.concat([varint(number * 8), varint(value)]);

/** One conversation's entry: its id, and its summary nested as base64; `workspace` is a `file://` URI, or absent for a conversation with none. */
export function trajectory(id: string, workspace: string | null): Buffer {
  const summary = Buffer.concat([
    field(1, 'MUST-NOT-BE-STORED title'),
    field(2, 'MUST-NOT-BE-STORED longer string'),
    counter(3, 1_791_463_527),
    ...(workspace === null ? [] : [field(9, field(1, workspace))]),
  ]);
  return field(1, Buffer.concat([field(1, id), field(2, field(1, summary.toString('base64')))]));
}

/** The value Antigravity keeps under the key: base64 of its entries. */
export const trajectorySummaries = (entries: Buffer[]): string => Buffer.concat(entries).toString('base64');
