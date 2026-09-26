import type { Run, Unavailable } from './projects';

/** The parts of the snapshot's `usage` and of `usage.get` the pages render, and how a total is written. */

type FieldTotal = { tokens: number | null; partial: boolean; provenance: string | null };
export type Totals = { records: number; input: FieldTotal; cachedInput: FieldTotal; cacheCreation: FieldTotal; output: FieldTotal; reasoning: FieldTotal };
type Limited<T> = { items: T[]; remainder: number };
type Importing = { incomplete: boolean; windowStart: string | null };

/** The snapshot's `usage`: today and the last seven days. */
export type SnapshotUsage = {
  importing: Importing;
  today: Totals;
  last7Days: Totals;
  byModel: Limited<{ model: string | null; totals: Totals }>;
  byProvider: Limited<{ provider: string | null; totals: Totals }>;
  harnesses: { harness: string; level: number | null; reason: string | null }[];
};

/** `usage.get` without a Task: everything ingested, over the import window. */
export type ProjectUsage = {
  importing: Importing;
  totals: Totals;
  tasks: Limited<{ id: string; title: string | null; totals: Totals }> | Unavailable;
  unassigned: Totals | Unavailable;
  byRole: Record<'product' | 'implementation' | 'unknown', Totals> | Unavailable;
  derived: Derived;
};

/** `usage.get`'s derived metrics: Binnacle's calculations over the same records, each labelled `calculated`. */
export type Derived = {
  perCompletedTask:
    | (Limited<{ id: string; title: string | null; runs: number; totals: Totals }> & { provenance: 'calculated'; mean: Totals | null; withoutRuns: number })
    | Unavailable;
  runsPerTask:
    | (Limited<{ id: string; title: string | null; runs: number; subagentRuns: number }> & { provenance: 'calculated'; mean: { runs: number; subagentRuns: number } | null })
    | Unavailable;
  weekly: { provenance: 'calculated'; items: { week: string; totals: Totals }[] };
};

/** `usage.get` with a Task: its totals and its runs, newest first. */
export type TaskUsage = { importing: Importing; totals: Totals; runs: Limited<TaskRun> };

/** A run of a Task, as `usage.get` gives it. */
export type TaskRun = Omit<Run, 'taskTitle'> & { startedAt: string; totals: Totals };

/** The token fields in the order the pages show them; reasoning is a part of output, never added to it. */
export const FIELDS = [
  ['input', 'Input'],
  ['cachedInput', 'Cached input'],
  ['cacheCreation', 'Cache creation'],
  ['output', 'Output'],
  ['reasoning', 'of which reasoning'],
] as const;

/**
 * A field's total as a person reads it: `null` is not reported, never zero, and a total that
 * is partial, or that Binnacle calculated or estimated rather than read, says so (ADR-0007).
 */
export function tokens(field: FieldTotal): string {
  if (field.tokens === null) return 'not reported';
  const notes = [field.partial ? 'partial' : null, field.provenance === 'calculated' || field.provenance === 'estimated' ? field.provenance : null].filter((note) => note !== null);
  // Whole tokens: a mean is the only total that has a fraction.
  return `${field.tokens.toLocaleString('en', { maximumFractionDigits: 0 })}${notes.length === 0 ? '' : ` (${notes.join(', ')})`}`;
}

/** Every field in one line, each on its own: fields are never added to one another. */
export const fieldsLine = (totals: Totals): string =>
  totals.records === 0 ? 'no records' : FIELDS.map(([name, label]) => `${label.toLowerCase()} ${tokens(totals[name])}`).join(', ');

/** Where the window `usage.get` answers over starts. */
export const windowLabel = (importing: Importing): string =>
  `over the import window, ${importing.windowStart === null ? 'which takes everything' : `since ${importing.windowStart}`}`;

/** Said wherever the totals are shown while the import still runs. */
export const IMPORTING = 'The import of this project is still running, so these totals may be low.';
