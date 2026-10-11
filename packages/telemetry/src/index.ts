/**
 * The normalised usage record every harness reader produces, and the pure arithmetic over
 * it. Nothing here does I/O: finding and reading artifacts is the daemon's, parsing them
 * the adapters'.
 */
import { branchTask, type ObservedRun, type RunRole, type TrackerTask } from '@binnacle/core';

/** ADR-0007: a value says where it came from, and nothing is ever invented to fill a gap. */
export type Provenance = 'measured' | 'provider_reported' | 'calculated' | 'estimated';

export type Harness = 'claude-code' | 'codex' | 'gemini-cli' | 'opencode' | 'zcode' | 'antigravity' | 'pi';

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
  /** Unique within the harness: Claude Code's and Gemini CLI's message id; Codex's session id and record ordinal; opencode's step part id; ZCode's model usage id; Antigravity's conversation id; pi's entry id and timestamp. */
  naturalKey: string;
  /** The provider's id of the request, where the harness records one: what tells an artifact's call and its OpenTelemetry event to be the same. */
  requestId: string | null;
  /** For a subagent, the session that started it, which Claude Code writes as its session id. */
  sessionId: string;
  /** The subagent whose session this record is from; null in a main session. */
  subagentId: string | null;
  /** The session that started the subagent; null in a main session. */
  parentSession: string | null;
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
 * A compaction a harness's artifact shows in a session: when it happened and what triggered
 * it, never what was dropped or kept. Claude Code writes a compaction boundary, which it
 * reports; Codex writes none, and a change of its context-window identifier is Binnacle's
 * reading of one, so calculated (ADR-0007).
 */
export type CompactionMarker = {
  harness: Harness;
  /** Unique within the harness: Claude Code's boundary uuid; Codex's session id and record ordinal. */
  naturalKey: string;
  sessionId: string;
  /** The subagent whose session compacted; null in a main session. */
  subagentId: string | null;
  timestamp: string;
  cwd: string;
  /** Claude Code's `auto` or `manual`; null where the harness gives none. */
  trigger: string | null;
  provenance: Provenance;
};

/**
 * A usage limit a harness's artifact shows a session hit: when, and which limit the harness
 * names, never its message. Claude Code writes one as a synthetic record with
 * `"error":"rate_limit"`, which it reports; no other harness records one yet.
 */
export type UsageLimitMarker = {
  harness: Harness;
  /** Unique within the harness: Claude Code's record uuid. */
  naturalKey: string;
  sessionId: string;
  /** The subagent whose session hit the limit; null in a main session. */
  subagentId: string | null;
  timestamp: string;
  cwd: string;
  /** Claude Code's `rateLimitType`, such as `five_hour`; null where the harness names none. */
  limit: string | null;
  provenance: Provenance;
};

/**
 * The context a call read: its input, cached input and cache creation together, the counts
 * it reports of them; null when it reports none.
 */
export function callContext(record: Pick<UsageRecord, 'tokens'>): number | null {
  const { input, cachedInput, cacheCreation } = record.tokens;
  return input === null && cachedInput === null && cacheCreation === null ? null : (input ?? 0) + (cachedInput ?? 0) + (cacheCreation ?? 0);
}

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

/**
 * The mean of `totals`, at least one, field by field and by `sum`'s rules: a field's mean is
 * over the totals that report it, null when none does, and partial when only some do or one
 * of them is partial. It is Binnacle's arithmetic, so calculated, or estimated when a value
 * averaged is (ADR-0007). `records` is the mean number of records.
 */
export function mean(totals: Totals[]): Totals {
  const field = (name: TokenField): FieldTotal => {
    const reporting = totals.filter((total) => total[name].tokens !== null);
    if (reporting.length === 0) return { tokens: null, partial: false, provenance: null };
    return {
      tokens: reporting.reduce((all, total) => all + total[name].tokens!, 0) / reporting.length,
      partial: reporting.length < totals.length || reporting.some((total) => total[name].partial),
      provenance: DIRECTNESS[Math.max(DIRECTNESS.indexOf('calculated'), ...reporting.map((total) => DIRECTNESS.indexOf(total[name].provenance!)))]!,
    };
  };
  const records = totals.reduce((all, total) => all + total.records, 0) / totals.length;
  return { records, ...(Object.fromEntries(TOKEN_FIELDS.map((name) => [name, field(name)])) as Record<TokenField, FieldTotal>) };
}

/** Every token a total counts once, which orders totals by size: a subset is never added to its superset. */
export const magnitude = (totals: Totals): number =>
  TOKEN_FIELDS.filter((name) => SUBSET_OF[name] === undefined).reduce((total, name) => total + (totals[name].tokens ?? 0), 0);

/** How recent a run's latest record must be for Binnacle to read the run as active. */
export const ACTIVE_WITHIN_MS = 10 * 60_000;

/** A stored record, with the checkout its `cwd` lies in, which the daemon knows, or null when it cannot say. */
export type RunRecord = UsageRecord & { checkout: string | null };

/** What a run is attributed with: the facts of its project and tracker, read by the daemon. */
export type RunAttribution<T extends Pick<TrackerTask, 'id' | 'title' | 'ticket'>> = {
  projectPath: string;
  /** The repository's default branch, whose runs are Product work. */
  defaultBranch: string;
  /** The tracker's current Tasks, and whether it is a remote tracker. */
  tasks: T[];
  remote: boolean;
  /** Per Task id, the points its review is read from; a Task with none has neither review nor rework. */
  reviews: Map<string, ReviewPoints>;
  now: Date;
};

/**
 * Where a Task's review divides its work, in milliseconds: `firstChange`, when its branch's first
 * commit changing anything but its ticket was made, after which a subagent starting is a review
 * run; and `review`, when the commit that first recorded its Review was, the rework boundary of a
 * Task with no review run. Each is null when there is none or Git cannot say. On GitHub or
 * GitLab `firstChange` is null, so that no run there is a review run, and `review` is when
 * changes were first requested on the Task's pull or merge request.
 */
export type ReviewPoints = { firstChange: number | null; review: number | null };

/**
 * Records grouped into observed runs: by harness, session and subagent, in time order, a
 * new run starting wherever the checkout, the branch or the role changes. A record's branch is the one
 * its checkout's reflog gave it; one only its harness wrote is no branch (ADR-0030). A run's
 * id is its first record's key, so more records never change it. Its Task is the one its
 * branch maps back to (`branchTask`), none being unassigned. Its role is each of its records':
 * `product` on the default branch, `unknown` on a branch no Task has, and on a Task's branch
 * `review` for a subagent that started after the branch's first commit changing anything but
 * the ticket, `rework` for any other record after the last record of the Task's first review
 * subagent, or, with none, after its Review commit, and `implementation` otherwise. Runs come
 * in the order they started.
 *
 * A subagent's runs name their parent run: the run of the parent session that had started
 * by the subagent's first record. None does when that session has no run among `records`.
 */
export function observedRuns<R extends RunRecord, T extends Pick<TrackerTask, 'id' | 'title' | 'ticket'>>(
  records: R[],
  { projectPath, defaultBranch, tasks, remote, reviews, now }: RunAttribution<T>,
): (ObservedRun & { records: R[] })[] {
  const order = (record: R): string[] => [record.harness, record.sessionId, record.subagentId ?? '', record.timestamp, record.naturalKey];
  const sorted = [...records].sort((a, b) => compare(order(a), order(b)));

  const taskOf = (record: R): T | null => {
    const branch = reflogBranch(record);
    return branch === null ? null : branchTask(branch, tasks, remote);
  };
  // Records come session by session in time order, so a subagent's first one is when it started.
  const started = new Map<string, number>();
  const role = new Map<R, RunRole>();
  // Per Task id, its first review subagent, its start and its last record on the Task's branch.
  const firstReview = new Map<string, { subagent: string; start: number; end: number }>();
  for (const record of sorted) {
    const subagent = [record.harness, record.sessionId, record.subagentId ?? ''].join('\0');
    if (!started.has(subagent)) started.set(subagent, Date.parse(record.timestamp));
    const start = started.get(subagent)!;
    const task = taskOf(record);
    const firstChange = task === null ? null : (reviews.get(task.id)?.firstChange ?? null);
    if (reflogBranch(record) === defaultBranch) role.set(record, 'product');
    else if (task === null) role.set(record, 'unknown');
    else if (record.subagentId !== null && firstChange !== null && start > firstChange) {
      role.set(record, 'review');
      // A subagent's records come together and in time order: its last one is its end.
      const first = firstReview.get(task.id);
      const end = Date.parse(record.timestamp);
      if (first === undefined || start < first.start) firstReview.set(task.id, { subagent, start, end });
      else if (subagent === first.subagent) first.end = end;
    }
  }
  for (const record of sorted) {
    if (role.has(record)) continue;
    const id = taskOf(record)!.id;
    const boundary = firstReview.get(id)?.end ?? reviews.get(id)?.review ?? null;
    role.set(record, boundary !== null && Date.parse(record.timestamp) > boundary ? 'rework' : 'implementation');
  }

  const groups: R[][] = [];
  for (const record of sorted) {
    const last = groups.at(-1)?.at(-1);
    const same =
      last !== undefined &&
      last.harness === record.harness &&
      last.sessionId === record.sessionId &&
      last.subagentId === record.subagentId &&
      last.checkout === record.checkout &&
      reflogBranch(last) === reflogBranch(record) &&
      role.get(last) === role.get(record);
    if (same) groups.at(-1)!.push(record);
    else groups.push([record]);
  }

  // The subagent's first group holds its first record, when its parent started it, and the
  // parent session's groups are in time order: the last of them started by then is its run.
  // ponytail: two scans of the groups per subagent run; index them by session if runs ever number in the tens of thousands.
  const parentRun = (record: R): string | null => {
    const same = (own: R, sessionId: string | null, subagentId: string | null): boolean =>
      own.harness === record.harness && own.sessionId === sessionId && own.subagentId === subagentId;
    const spawned = groups.find(([own]) => same(own!, record.sessionId, record.subagentId))![0]!.timestamp;
    const parent = groups.findLast(([own]) => same(own!, record.parentSession, null) && own!.timestamp <= spawned);
    return parent ? runId(parent[0]!) : null;
  };

  const runs = groups.map((group) => {
    const first = group[0]!;
    const latest = group.at(-1)!;
    const branch = reflogBranch(first);
    return {
      id: runId(first),
      projectPath,
      taskId: taskOf(first)?.id ?? null,
      role: role.get(first)!,
      harness: first.harness,
      provider: latest.provider,
      model: latest.model,
      branch,
      branchSource: branch === null ? null : 'reflog',
      checkout: first.checkout,
      parentRunId: first.subagentId === null ? null : parentRun(first),
      startedAt: first.timestamp,
      lastActivityAt: latest.timestamp,
      active: { value: now.getTime() - Date.parse(latest.timestamp) <= ACTIVE_WITHIN_MS, provenance: 'calculated' },
      records: group,
    } satisfies ObservedRun & { records: R[] };
  });
  return runs.sort((a, b) => compare([a.startedAt, a.id], [b.startedAt, b.id]));
}

const runId = (first: UsageRecord): string => `${first.harness}:${first.naturalKey}`;

/** A record's branch as runs read it: the reflog's, since one its harness wrote attributes nothing, however long stored (ADR-0030). */
const reflogBranch = (record: UsageRecord): string | null => (record.branch?.source === 'reflog' ? record.branch.name : null);

/** Code-unit order, element by element, so the same records give the same runs anywhere. */
function compare(a: string[], b: string[]): number {
  for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) return a[index]! < b[index]! ? -1 : 1;
  return 0;
}
