import type { Dictionary } from '~/i18n';
import type { Run, Unavailable } from './projects';

/** The parts of the snapshot's `usage` and of `usage.get` the pages render. */

export type FieldTotal = { tokens: number | null; partial: boolean; provenance: string | null };
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
export type Role = 'product' | 'implementation' | 'review' | 'rework' | 'unknown';

export type ProjectUsage = {
  importing: Importing;
  totals: Totals;
  tasks: Limited<{ id: string; title: string | null; totals: Totals }> | Unavailable;
  unassigned: Totals | Unavailable;
  byRole: Record<Role, Totals> | Unavailable;
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
  reworkShare: (Limited<{ id: string; title: string | null; share: number | null }> & { provenance: 'calculated'; mean: number | null }) | Unavailable;
  firstPassAcceptance: (Limited<{ id: string; title: string | null; accepted: boolean }> & { provenance: 'calculated'; share: number | null }) | Unavailable;
  contextGrowth:
    | (Limited<{ id: string; taskId: string | null; role: Role; harness: string; startedAt: string; first: Context; latest: Context; largest: Context }> & { provenance: 'calculated' })
    | Unavailable;
  ponytail:
    | {
        provenance: 'calculated';
        since: { commit: string; at: string } | null;
        before: PonytailSide | null;
        after: PonytailSide | null;
        undated: number;
        reason: string | null;
      }
    | Unavailable;
};

/** The DONE Tasks with runs completed on one side of Ponytail's date, and their mean. */
export type PonytailSide = { tasks: number; mean: Totals | null };

/** What a call read: input, cached input and cache creation together; null when it reports none, partial when only some. */
export type Context = { tokens: number | null; partial: boolean };

/** `usage.get` with a Task: its totals, the same by role, and its runs, newest first. */
export type TaskUsage = {
  importing: Importing;
  totals: Totals;
  byRole: Record<'implementation' | 'review' | 'rework', Totals>;
  /** Why the Task's rework is not read, on GitHub or GitLab; null when it is. */
  reworkUnread: string | null;
  runs: Limited<TaskRun>;
};

/** A run of a Task, as `usage.get` gives it. */
export type TaskRun = Omit<Run, 'taskTitle'> & { startedAt: string; active: { value: boolean }; totals: Totals };

/** What marks a field's total besides its number: partial, and calculated or estimated rather than read (ADR-0007). */
export function marks(field: FieldTotal): ('partial' | 'calculated' | 'estimated')[] {
  const found: ('partial' | 'calculated' | 'estimated')[] = field.partial ? ['partial'] : [];
  if (field.provenance === 'calculated' || field.provenance === 'estimated') found.push(field.provenance);
  return found;
}

/** The token fields in the order the pages show them; reasoning is a part of output, never added to it. */
export const FIELDS = ['input', 'cachedInput', 'cacheCreation', 'output', 'reasoning'] as const;
/** The kinds a widget's *Brief* shows of a token total: input and output (spec, story 21). */
export const BRIEF_FIELDS = ['input', 'output'] as const satisfies readonly Field[];
export type Field = (typeof FIELDS)[number];

/** Totals kind by kind as one line of text, never added together, each marked as `TokenKinds` marks it. */
export function tokensLine(totals: Totals, t: Dictionary, number: (value: number) => string): string {
  if (totals.records === 0) return t.noRecords;
  return FIELDS.map((name) => {
    const field = totals[name];
    const value = field.tokens === null ? t.notReported : number(Math.round(field.tokens));
    const noted = marks(field).map((mark) => t[mark]);
    return `${t[name]} ${value}${noted.length === 0 ? '' : ` (${noted.join(', ')})`}`;
  }).join(' · ');
}
