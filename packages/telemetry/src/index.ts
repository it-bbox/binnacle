/**
 * The normalised usage record every harness reader produces, and the pure arithmetic over
 * it. Nothing here does I/O: finding and reading artifacts is the daemon's, parsing them
 * the adapters'.
 */
import { branchTask, type ObservedRun, type TrackerTask } from '@binnacle/core';

/** ADR-0007: a value says where it came from, and nothing is ever invented to fill a gap. */
export type Provenance = 'measured' | 'provider_reported' | 'calculated' | 'estimated';

export type Harness = 'claude-code';

export const TOKEN_FIELDS = ['input', 'cachedInput', 'cacheCreation', 'output', 'reasoning'] as const;
/**
 * `input` is input not read from cache, `cachedInput` input read from cache, and
 * `cacheCreation` input written to it. `reasoning` is a subset of `output` on every
 * harness: it is counted inside it and never added to it (`SUBSET_OF`).
 */
export type TokenField = (typeof TOKEN_FIELDS)[number];
export const SUBSET_OF: Partial<Record<TokenField, TokenField>> = { reasoning: 'output' };

/** One call to a model, as a harness recorded it: metadata and token counts, never content. */
export type UsageRecord = {
  harness: Harness;
  /** Unique within the harness: Claude Code's message id. */
  naturalKey: string;
  sessionId: string;
  timestamp: string;
  cwd: string;
  branch: { name: string; source: 'harness' | 'reflog' } | null;
  /** Null unless the artifact states it: a model name is no proof of who served it (ADR-0004). */
  provider: string | null;
  model: string | null;
  /** Each null when the record does not report it, which is not the same as zero (ADR-0007). */
  tokens: Record<TokenField, number | null>;
  provenance: Provenance;
};

/**
 * A field summed over records: null when none of them reports it, `partial` when only some
 * do. Its provenance is the least direct of the values summed, so a sum of reported values
 * stays reported and one that includes a calculated value is calculated.
 */
export type FieldTotal = { tokens: number | null; partial: boolean; provenance: Provenance | null };
export type Totals = { records: number } & Record<TokenField, FieldTotal>;

const DIRECTNESS: Provenance[] = ['measured', 'provider_reported', 'calculated', 'estimated'];

export function sum(records: Pick<UsageRecord, 'tokens' | 'provenance'>[]): Totals {
  const field = (name: TokenField): FieldTotal => {
    const reporting = records.filter((record) => record.tokens[name] !== null);
    if (reporting.length === 0) return { tokens: null, partial: false, provenance: null };
    return {
      tokens: reporting.reduce((total, record) => total + record.tokens[name]!, 0),
      partial: reporting.length < records.length,
      provenance: DIRECTNESS[Math.max(...reporting.map((record) => DIRECTNESS.indexOf(record.provenance)))]!,
    };
  };
  return { records: records.length, ...(Object.fromEntries(TOKEN_FIELDS.map((name) => [name, field(name)])) as Record<TokenField, FieldTotal>) };
}

/** Every token a total counts once, which orders totals by size: a subset is never added to its superset. */
export const magnitude = (totals: Totals): number =>
  TOKEN_FIELDS.filter((name) => SUBSET_OF[name] === undefined).reduce((total, name) => total + (totals[name].tokens ?? 0), 0);

/** How recent a run's latest record must be for Binnacle to read the run as active. */
export const ACTIVE_WITHIN_MS = 10 * 60_000;

/** A stored record, with its subagent and the checkout its `cwd` lies in, which the daemon knows. */
export type RunRecord = UsageRecord & { subagentId: string | null; checkout: string };

export type RunAttribution<T extends Pick<TrackerTask, 'id' | 'title' | 'ticket'>> = {
  projectPath: string;
  /** The repository's default branch, whose runs are Product work. */
  defaultBranch: string;
  /** The tracker's current Tasks, and whether it is a remote tracker. */
  tasks: T[];
  remote: boolean;
  now: Date;
};

/**
 * Records grouped into observed runs: by harness, session and subagent, in time order, a
 * new run starting wherever the checkout or the branch changes. A run's id is its first
 * record's key, so more records never change it. Its Task is the one its branch maps back
 * to (`branchTask`), none being unassigned; its role follows from the branch. Runs come
 * in the order they started.
 */
export function observedRuns<R extends RunRecord, T extends Pick<TrackerTask, 'id' | 'title' | 'ticket'>>(
  records: R[],
  { projectPath, defaultBranch, tasks, remote, now }: RunAttribution<T>,
): (ObservedRun & { records: R[] })[] {
  const order = (record: R): string[] => [record.harness, record.sessionId, record.subagentId ?? '', record.timestamp, record.naturalKey];
  const sorted = [...records].sort((a, b) => compare(order(a), order(b)));

  const groups: R[][] = [];
  for (const record of sorted) {
    const last = groups.at(-1)?.at(-1);
    const same =
      last !== undefined &&
      last.harness === record.harness &&
      last.sessionId === record.sessionId &&
      last.subagentId === record.subagentId &&
      last.checkout === record.checkout &&
      last.branch?.name === record.branch?.name;
    if (same) groups.at(-1)!.push(record);
    else groups.push([record]);
  }

  const runs = groups.map((group) => {
    const first = group[0]!;
    const latest = group.at(-1)!;
    const branch = first.branch?.name ?? null;
    const task = branch === null ? null : branchTask(branch, tasks, remote);
    return {
      id: `${first.harness}:${first.naturalKey}`,
      projectPath,
      taskId: task?.id ?? null,
      role: branch === defaultBranch ? 'product' : task ? 'implementation' : 'unknown',
      harness: first.harness,
      provider: latest.provider,
      model: latest.model,
      branch,
      branchSource: first.branch?.source ?? null,
      parentRunId: null,
      startedAt: first.timestamp,
      lastActivityAt: latest.timestamp,
      active: { value: now.getTime() - Date.parse(latest.timestamp) <= ACTIVE_WITHIN_MS, provenance: 'calculated' },
      records: group,
    } satisfies ObservedRun & { records: R[] };
  });
  return runs.sort((a, b) => compare([a.startedAt, a.id], [b.startedAt, b.id]));
}

/** Code-unit order, element by element, so the same records give the same runs anywhere. */
function compare(a: string[], b: string[]): number {
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return a[index]! < b[index]! ? -1 : 1;
  return 0;
}
