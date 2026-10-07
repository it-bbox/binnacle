import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync, type Dirent } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { setImmediate, setTimeout } from 'node:timers/promises';
import {
  branchAt,
  codexSession,
  readClaudeCode,
  readCodex,
  readDefaultBranch,
  readGeminiCli,
  readFirstReviews,
  readGitHubChangesRequested,
  readGitLabChangesRequested,
  readOpencode,
  readOpencodeSteps,
  readHeadHistory,
  readLastChangeBefore,
  readWorktrees,
  type ArtifactReading,
  type ChangesRequested,
  type GeminiCliSession,
  type HeadHistory,
  type TelemetryRecord,
  type Tree,
} from '@binnacle/adapters';
import { branchTask, type Diagnostic, type ImportWindow, type ObservedRun, type ProjectManifest, type RunRole, type TaskRole, type TrackerTask } from '@binnacle/core';
import {
  ACTIVE_WITHIN_MS,
  callContext,
  magnitude,
  mean,
  observedRuns,
  sum,
  type CompactionMarker,
  type Harness,
  type Provenance,
  type ReviewPoints,
  type RunRecord,
  type Totals,
  type UsageRecord,
} from '@binnacle/telemetry';
import { resolveGitTimeout, trackerToken, type ArtifactRoots } from './home.ts';
import type { OperationContext } from './operations.ts';
import { containingEntry, readRegistry } from './registry.ts';
import { limited, readTracker, SECTION_LIMIT, trackerUnavailable, type Unavailable } from './snapshot.ts';
import { findTask } from './task.ts';
import type { Ingested, IngestCursor } from './store.ts';

/** The import window when the manifest writes none: the horizon of Git's own reflog. */
export const DEFAULT_WINDOW_DAYS = 90;

/** How long a call waits for its project's ingest before answering from what is stored. */
export const INGEST_BUDGET_MS = 1000;

/** How long a Claude Code file must go unwritten before its last message is taken as finished. */
export const SETTLED_AFTER_MS = 60_000;

/** The context, in tokens, from which an active Product session raises `context.pressure` when the manifest states none. */
export const DEFAULT_PRESSURE_TOKENS = 150_000;

/** Why opencode never reaches level 4, which `binn init` and `binn audit` say too: it has no export to point at the daemon. */
export const OPENCODE_NO_EXPORT = 'opencode documents no OpenTelemetry export, so Binnacle counts it only from its database, each call once it has finished';

/**
 * The harnesses Binnacle counts, in the order the snapshot lists them, with their names and
 * artifact roots, and, for one that exports no OpenTelemetry, why it never reaches level 4.
 */
const HARNESSES: { harness: Harness; name: string; root: keyof ArtifactRoots; noExport?: string }[] = [
  { harness: 'claude-code', name: 'Claude Code', root: 'claudeCode' },
  { harness: 'codex', name: 'Codex', root: 'codex' },
  { harness: 'gemini-cli', name: 'Gemini CLI', root: 'geminiCli' },
  {
    harness: 'opencode',
    name: 'opencode',
    root: 'opencode',
    noExport: `${OPENCODE_NO_EXPORT}.`,
  },
];

/** Per harness, why its artifacts of a project cannot be read, if they cannot. */
type Unreadable = Record<Harness, string | null>;

/**
 * The daemon's ingests: one at a time on this machine, each queued behind the one before,
 * and one queued or running per project, which a call under the same window waits for
 * rather than starting another.
 */
export type Importer = {
  budgetMs: number;
  /** How long a Claude Code file must go unwritten before its last message is taken as finished. */
  settledAfterMs: number;
  queue: Promise<void>;
  running: Map<string, { run: Promise<void>; window: ImportWindow }>;
  /**
   * The artifact files whose last reading failed, each with where and why: until a later
   * reading of the file succeeds, its harness is at level 1 and `telemetry.unreadable` names it.
   * ponytail: a failed file that is then deleted keeps its entry, which no answer shows since
   * only files still there are looked up; forget it on deletion if the daemon ever runs for months.
   */
  unreadable: Map<string, string>;
  /** Set when the daemon stops: a running ingest ends before its next file. */
  stopped: boolean;
};

export const importer = (budgetMs: number, settledAfterMs: number): Importer => ({
  budgetMs,
  settledAfterMs,
  queue: Promise.resolve(),
  running: new Map(),
  unreadable: new Map(),
  stopped: false,
});

/** Lets the running ingest end after its current file, each of which commits whole, and waits for it. */
export async function stopImporting(importer: Importer): Promise<void> {
  importer.stopped = true;
  await importer.queue;
}

/**
 * Forgets how far the files a newly registered project's import would read were read, so
 * that it reads them from the start: an earlier project's import may have read past its
 * records while they belonged to no registered project.
 */
export function forgetRead(context: OperationContext, projectPath: string): void {
  context.store.forgetCursors(join(context.runtime.artifacts.claudeCode, claudeCodeDirectory(projectPath)));
  for (const path of geminiCliSessions(context.runtime.artifacts.geminiCli, [projectPath]).files) context.store.forgetCursors(path);
  context.store.forgetCursors(opencodeDatabase(context.runtime.artifacts.opencode));
}

export type HarnessLevel = {
  harness: Harness;
  /**
   * ADR-0014, for this project: 4 when its OpenTelemetry records, this project's or those still
   * in no project, arrived within telemetry's recency (`ACTIVE_WITHIN_MS`), 3 when records with token counts were read, 2 when records
   * were read without any, 1 when an artifact could not be read, null when none were found.
   */
  level: 1 | 2 | 3 | 4 | null;
  /** Why the level is below 2, or, at 2 or 3, why a harness that exports no OpenTelemetry never reaches 4; null otherwise. */
  reason: string | null;
};

export type Usage = {
  /** Whether this project's import is still incomplete, and the local date its window starts, null for `all`. */
  importing: { incomplete: boolean; windowStart: string | null };
  today: Totals;
  last7Days: Totals;
  byModel: { items: { model: string | null; totals: Totals }[]; remainder: number };
  /** The last seven days by the provider a record's artifact states; null for the records whose artifacts state none. */
  byProvider: { items: { provider: string | null; totals: Totals }[]; remainder: number };
  /** The last seven days by Task, largest first; unavailable, with the tracker's reason, when it cannot be read. */
  tasks: { items: { id: string; title: string | null; totals: Totals }[]; remainder: number } | Unavailable;
  /** The last seven days of runs no Task's branch accounts for. */
  unassigned: Totals | Unavailable;
  /** The last seven days by role, every role listed; unavailable, as `tasks` is, without the tracker. */
  byRole: Record<RunRole, Totals> | Unavailable;
  harnesses: HarnessLevel[];
};

/**
 * Reads what is new in the Claude Code, Codex, Gemini CLI and opencode artifacts of `projectPath`, for as long as
 * the time budget allows, and answers the snapshot's `usage` and `activity` sections from
 * everything stored, attributed to `tasks`, the tracker's current Tasks, or unavailable with
 * why they cannot be read, and its `context.pressure` attention items. What the budget does
 * not cover goes on in the background. "Today" and "the last seven days" are calendar days in
 * the daemon's local time zone.
 */
export async function usageAndActivity(
  context: OperationContext,
  projectPath: string,
  manifest: ProjectManifest | null,
  tasks: TrackerTask[] | Unavailable,
): Promise<{ usage: Usage; activity: Activity | Unavailable; runs: ObservedRun[]; attention: Diagnostic[] }> {
  const { importing, checkouts } = await ingested(context, projectPath, manifest);
  const failures = unreadableArtifacts(context, [projectPath, ...checkouts.linked]);

  // Every record stored, grouped into runs at once as `usage.get` groups them, so a run has the same id in both.
  // ponytail: every call groups the whole window; keep the runs between calls if a snapshot ever outlasts its budget.
  const all = context.store.usage(projectPath, '');
  const weekStart = localMidnight(6).toISOString();
  const week = all.filter((record) => record.timestamp >= weekStart);
  const since = localMidnight(0).toISOString();
  const today = week.filter((record) => record.timestamp >= since);
  let attributed: Pick<Usage, 'tasks' | 'unassigned' | 'byRole'>;
  let activity: Activity | Unavailable;
  const pressureOf = contextPressures(all, context.store.compactions(projectPath));
  // Without the tracker no run is a Task's, but a Product session is still the default branch's.
  const observed = (await runs(all, projectPath, Array.isArray(tasks) ? tasks : [], context.home, manifest, checkouts)).runs;
  if (Array.isArray(tasks)) {
    const ofWeek = observed.map((run) => ({ ...run, records: run.records.filter((record) => record.timestamp >= weekStart) }));
    attributed = { ...byTask(ofWeek.filter((run) => run.records.length > 0), tasks), byRole: byRole(ofWeek, ROLES) };
    activity = activityOf(observed, tasks, pressureOf);
  } else {
    attributed = { tasks, unassigned: tasks, byRole: tasks };
    activity = tasks;
  }
  const threshold = manifest?.telemetry.contextPressure.tokens ?? DEFAULT_PRESSURE_TOKENS;
  const checkpointAt = context.store.latestEvent(projectPath, ['checkpoint'])?.occurredAt ?? null;

  const byModel = grouped(week, 'model').map(([model, totals]) => ({ model, totals }));
  const byProvider = grouped(week, 'provider').map(([provider, totals]) => ({ provider, totals }));

  return {
    usage: {
      importing,
      today: sum(today),
      last7Days: sum(week),
      byModel: limited(byModel),
      byProvider: limited(byProvider),
      ...attributed,
      harnesses: HARNESSES.map((entry) => level(context, projectPath, entry, failures[entry.harness], importing.incomplete)),
    },
    activity,
    runs: Array.isArray(tasks) ? observed : [],
    attention: pressureAttention(observed, pressureOf, threshold, checkpointAt),
  };
}

/**
 * A session's context pressure (decision 15): the context its latest call read, and the
 * compactions its artifact shows, the latest of them named, each with its provenance; null
 * where its harness reveals neither, which is no sign of health.
 */
export type ContextPressure = {
  context: { tokens: number; provenance: Provenance } | null;
  compactions: { count: number; latest: { at: string; trigger: string | null; provenance: Provenance } | null };
} | null;

/** Which session a record or a marker is of, a subagent's its own. */
type Session = Pick<UsageRecord, 'harness' | 'sessionId' | 'subagentId'>;
const sessionKey = ({ harness, sessionId, subagentId }: Session): string => [harness, sessionId, subagentId ?? ''].join('\0');

/** Each session's context pressure among `records`, every one stored, and `markers`, oldest first. */
function contextPressures(records: UsageRecord[], markers: CompactionMarker[]): (session: Session) => ContextPressure {
  const latest = new Map<string, UsageRecord>();
  for (const record of records) {
    const known = latest.get(sessionKey(record));
    if (known === undefined || record.timestamp > known.timestamp || (record.timestamp === known.timestamp && record.naturalKey > known.naturalKey)) {
      latest.set(sessionKey(record), record);
    }
  }
  const compactions = new Map<string, CompactionMarker[]>();
  for (const marker of markers) compactions.set(sessionKey(marker), [...(compactions.get(sessionKey(marker)) ?? []), marker]);
  return (session) => {
    const call = latest.get(sessionKey(session));
    const tokens = call === undefined ? null : callContext(call);
    const seen = compactions.get(sessionKey(session)) ?? [];
    const last = seen.at(-1);
    if (tokens === null && last === undefined) return null;
    return {
      context: tokens === null ? null : { tokens, provenance: call!.provenance },
      compactions: { count: seen.length, latest: last === undefined ? null : { at: last.timestamp, trigger: last.trigger, provenance: last.provenance } },
    };
  };
}

/**
 * One `context.pressure` item per active Product session, a main session on the default
 * branch, whose latest call read at least `threshold` tokens of context, or whose latest
 * compaction is after `checkpointAt`, the project's last recorded checkpoint, or at all when
 * none was recorded.
 */
function pressureAttention(
  observed: (ObservedRun & { records: RunRecord[] })[],
  pressureOf: (session: Session) => ContextPressure,
  threshold: number,
  checkpointAt: string | null,
): Diagnostic[] {
  const raised = new Map<string, Diagnostic>();
  for (const run of observed) {
    const session = run.records[0]!;
    if (run.role !== 'product' || !run.active.value || session.subagentId !== null || raised.has(sessionKey(session))) continue;
    const pressure = pressureOf(session);
    const reasons: string[] = [];
    if (pressure?.context && pressure.context.tokens >= threshold) {
      reasons.push(`read ${pressure.context.tokens} tokens of context in its latest call, at least telemetry.context_pressure.tokens, ${threshold}`);
    }
    const compaction = pressure?.compactions.latest;
    if (compaction && (checkpointAt === null || compaction.at > checkpointAt)) {
      const since = checkpointAt === null ? 'and no checkpoint has been recorded' : `after the last checkpoint at ${checkpointAt}`;
      reasons.push(`compacted (${compaction.trigger ?? 'trigger not reported'}) at ${compaction.at}, ${since}`);
    }
    if (reasons.length === 0) continue;
    const name = HARNESSES.find((entry) => entry.harness === session.harness)!.name;
    raised.set(sessionKey(session), {
      code: 'context.pressure',
      message: `The Product session ${session.sessionId} in ${name} ${reasons.join(', and ')}. Run /binnacle:checkpoint, then go on in a fresh session.`,
    });
  }
  return [...raised.values()];
}

/** `records` totalled by `key`, largest first, then by key. */
function grouped(records: UsageRecord[], key: 'model' | 'provider'): [string | null, Totals][] {
  const groups = new Map<string | null, UsageRecord[]>();
  for (const record of records) groups.set(record[key], [...(groups.get(record[key]) ?? []), record]);
  const totals = [...groups].map(([value, members]): [string | null, Totals] => [value, sum(members)]);
  return totals.sort(([valueA, totalsA], [valueB, totalsB]) => magnitude(totalsB) - magnitude(totalsA) || String(valueA).localeCompare(String(valueB), 'en'));
}

/** A run as the snapshot's `activity` shows it: as `usage.get` gives it, with its Task's title, null when unassigned. */
export type ActivityRun = RunUsage & { taskTitle: string | null };

/** The snapshot's `activity`: the project's runs active now, and its latest other runs, latest activity first. */
export type Activity = { running: { items: ActivityRun[]; remainder: number }; recent: ActivityRun[] };

function activityOf(
  observed: (ObservedRun & { records: RunRecord[] })[],
  tasks: Pick<TrackerTask, 'id' | 'title'>[],
  pressureOf: (session: Session) => ContextPressure,
): Activity {
  const titles = new Map(tasks.map((task) => [task.id, task.title]));
  const shown = (run: (typeof observed)[number]): ActivityRun => ({ ...runUsage(run, pressureOf), taskTitle: run.taskId === null ? null : (titles.get(run.taskId) ?? null) });
  const latest = [...observed].sort((a, b) => (a.lastActivityAt !== b.lastActivityAt ? (a.lastActivityAt < b.lastActivityAt ? 1 : -1) : a.id < b.id ? -1 : 1));
  const running = limited(latest.filter((run) => run.active.value));
  return {
    running: { items: running.items.map(shown), remainder: running.remainder },
    recent: latest.filter((run) => !run.active.value).slice(0, SECTION_LIMIT).map(shown),
  };
}

const runUsage = ({ records, projectPath: _project, ...run }: ObservedRun & { records: RunRecord[] }, pressureOf: (session: Session) => ContextPressure): RunUsage => ({
  ...run,
  totals: sum(records),
  contextPressure: pressureOf(records[0]!),
});

/** `usage.get` without a Task: the project's totals over everything ingested, by Task and unassigned, by role, and derived. */
export type ProjectUsage = Pick<Usage, 'importing' | 'tasks' | 'unassigned' | 'byRole'> & { totals: Totals; derived: Derived };

/**
 * Binnacle's calculations over the same records, each labelled so. The two that need the
 * tracker are unavailable with its reason when it cannot be read, like `tasks`.
 */
export type Derived = {
  /**
   * Each `DONE` Task with attributed runs: its totals and how many runs, largest first. Their
   * mean, null when there is none, and how many `DONE` Tasks have no runs, which it leaves out.
   */
  perCompletedTask:
    | {
        provenance: 'calculated';
        items: { id: string; title: string | null; runs: number; totals: Totals }[];
        remainder: number;
        mean: Totals | null;
        withoutRuns: number;
      }
    | Unavailable;
  /** Each Task with attributed runs: how many, and how many of them were subagents', most first, and their mean. */
  runsPerTask:
    | {
        provenance: 'calculated';
        items: { id: string; title: string | null; runs: number; subagentRuns: number }[];
        remainder: number;
        mean: { runs: number; subagentRuns: number } | null;
      }
    | Unavailable;
  /** Totals per calendar week, oldest first, from the first record's to this one, each named by its Monday's local date. */
  weekly: { provenance: 'calculated'; items: { week: string; totals: Totals }[] };
};

/** A run as `usage.get` shows it: the observed run, less its project, with its totals and its session's context pressure. */
export type RunUsage = Omit<ObservedRun, 'projectPath'> & { totals: Totals; contextPressure: ContextPressure };

/** `usage.get` with a Task: its totals over everything ingested, the same by role, and its runs, newest first. */
export type TaskUsage = Pick<Usage, 'importing'> & {
  task: Pick<TrackerTask, 'id' | 'title'>;
  totals: Totals;
  byRole: Record<TaskRole, Totals>;
  /** Why the Task's rework is not read, on GitHub or GitLab; null when it is, and on the local tracker. */
  reworkUnread: string | null;
  runs: { items: RunUsage[]; remainder: number };
};

/**
 * `usage.get`: reads what is new first, as the snapshot does, then answers from every stored
 * record, grouped into runs all at once, so that a run's id does not depend on how far back
 * a call looks. `tree` is the caller's checkout, where the tracker is read. With `taskId`, in
 * any form `task.get` takes, the tracker must be readable and hold that Task, as for `task.get`.
 */
export async function usageGet(
  context: OperationContext,
  projectPath: string,
  manifest: ProjectManifest | null,
  tree: Tree,
  taskId: string | undefined,
): Promise<ProjectUsage | TaskUsage> {
  const { importing, checkouts } = await ingested(context, projectPath, manifest);
  let found: Awaited<ReturnType<typeof findTask>> | null = null;
  let tasks: TrackerTask[] | Unavailable;
  if (taskId !== undefined) {
    found = await findTask(context.home, tree, manifest, taskId);
    tasks = found.tasks;
  } else {
    const reading = await readTracker(context.home, tree, manifest);
    tasks = reading.tasks ?? trackerUnavailable(reading.diagnostics);
  }

  // Since the earliest timestamp there is: every record stored, whatever the window is now.
  const records = context.store.usage(projectPath, '');
  if (!Array.isArray(tasks)) {
    return { importing, totals: sum(records), tasks, unassigned: tasks, byRole: tasks, derived: { perCompletedTask: tasks, runsPerTask: tasks, weekly: weekly(records) } };
  }
  const { runs: attributed, reworkUnread } = await runs(records, projectPath, tasks, context.home, manifest, checkouts);
  if (!found) {
    return { importing, totals: sum(records), ...byTask(attributed, tasks), byRole: byRole(attributed, ROLES), derived: { ...perTask(attributed, tasks), weekly: weekly(records) } };
  }

  const pressureOf = contextPressures(records, context.store.compactions(projectPath));
  // Runs come oldest first.
  const own = attributed.filter((run) => run.taskId === found.task.id).reverse();
  return {
    importing,
    task: { id: found.task.id, title: found.task.title },
    totals: sum(own.flatMap((run) => run.records)),
    byRole: byRole(own, TASK_ROLES),
    reworkUnread: reworkUnread.get(found.task.id) ?? null,
    runs: limited(own.map((run) => runUsage(run, pressureOf))),
  };
}

/**
 * Each of `tasks`' latest run, the one with the latest activity, among every stored record,
 * after the ingest `usage.get` also runs. A Task with no attributed run is not in the map.
 */
export async function latestRuns(
  context: OperationContext,
  projectPath: string,
  manifest: ProjectManifest | null,
  tasks: TrackerTask[],
): Promise<Map<string, ObservedRun>> {
  const attributed = (await storedRuns(context, projectPath, manifest, tasks)).runs;
  const latest = new Map<string, ObservedRun>();
  for (const run of attributed) {
    const known = run.taskId === null ? undefined : latest.get(run.taskId);
    if (run.taskId !== null && (known === undefined || run.lastActivityAt >= known.lastActivityAt)) latest.set(run.taskId, run);
  }
  return latest;
}

/**
 * `task`'s totals by role over every stored record, after the ingest `usage.get` also runs, and
 * why its rework is not read, as `usage.get` gives them; `tasks` are the tracker's.
 */
export async function taskByRole(
  context: OperationContext,
  projectPath: string,
  manifest: ProjectManifest | null,
  tasks: TrackerTask[],
  task: Pick<TrackerTask, 'id'>,
): Promise<Pick<TaskUsage, 'byRole' | 'reworkUnread'>> {
  const { runs: attributed, reworkUnread } = await storedRuns(context, projectPath, manifest, tasks);
  return { byRole: byRole(attributed.filter((run) => run.taskId === task.id), TASK_ROLES), reworkUnread: reworkUnread.get(task.id) ?? null };
}

/** The project's runs among every stored record, after the ingest `usage.get` also runs. */
async function storedRuns(context: OperationContext, projectPath: string, manifest: ProjectManifest | null, tasks: TrackerTask[]): Promise<Attributed> {
  const { checkouts } = await ingested(context, projectPath, manifest);
  return runs(context.store.usage(projectPath, ''), projectPath, tasks, context.home, manifest, checkouts);
}

/**
 * Starts the project's ingest, or joins the one already running under the same window, and
 * waits for it up to the budget: whether it is still incomplete, the local date its window
 * starts, and the project's checkouts.
 */
async function ingested(
  context: OperationContext,
  projectPath: string,
  manifest: ProjectManifest | null,
): Promise<{ importing: Usage['importing']; checkouts: Checkouts }> {
  const window = windowOf(manifest);
  const checkouts = await projectCheckouts(projectPath);
  const { running, budgetMs } = context.importer;
  const current = running.get(projectPath);
  // One started under another window, on startup or before the manifest changed, is not this call's.
  const run = current?.window === window ? current.run : startIngest(context, projectPath, manifest, checkouts.linked);
  if (budgetMs > 0) await Promise.race([run, setTimeout(budgetMs, undefined, { ref: false })]);
  // A run leaves `running` as it settles, so one still there is still going.
  const incomplete = running.get(projectPath)?.run === run;
  return {
    importing: { incomplete, windowStart: window === 'all' ? null : localDate(localMidnight(window - 1)) },
    checkouts,
  };
}

/**
 * Per harness, why the project's artifacts cannot be read as of their last reading, in one
 * message that names the first unreadable one and counts the rest; null when every one can.
 * `directoriesOfProject` are the project's directory in each of its checkouts.
 */
function unreadableArtifacts(context: OperationContext, directoriesOfProject: string[]): Unreadable {
  const { artifacts } = context.runtime;
  const { unreadable } = context.importer;
  const places = directoriesOfProject.map((path) => ({ path }));
  const failed = (files: string[]): string[] => files.sort().flatMap((path) => unreadable.get(path) ?? []);
  const claudeCode = claudeCodeFiles(artifacts.claudeCode, directoriesOfProject);
  const codex = codexSessions(artifacts.codex);
  const geminiCli = geminiCliSessions(artifacts.geminiCli, directoriesOfProject);
  // opencode's one database holds every project's sessions, so its failure is every project's.
  const opencode = opencodeDatabase(artifacts.opencode);
  // A rollout says whose it is on its first line; one that cannot be opened may be anyone's, this project's included.
  const ours = (path: string): boolean => {
    try {
      return containingEntry(rolloutCwd(path) ?? '', places) !== undefined;
    } catch {
      return true;
    }
  };
  return {
    'claude-code': summary('Claude Code', [...claudeCode.failures, ...failed(claudeCode.files)]),
    codex: summary('Codex', [...codex.failures, ...failed(codex.files.filter((path) => unreadable.has(path) && ours(path)))]),
    'gemini-cli': summary('Gemini CLI', [...geminiCli.failures, ...failed(geminiCli.files)]),
    opencode: summary('opencode', [
      ...failed([opencode]),
      ...[...unreadable]
        .filter(([key]) => key.startsWith(sessionFailureKey(opencode, '')) && containingEntry(key.slice(sessionFailureKey(opencode, '').length), places) !== undefined)
        .map(([, failure]) => failure),
    ]),
  };
}

function summary(name: string, failures: string[]): string | null {
  if (failures.length === 0) return null;
  const others = failures.length - 1;
  const rest = others === 0 ? '' : ` It could not read ${others} other ${others === 1 ? 'file or directory' : 'files or directories'} either.`;
  return `${name} could not read ${failures[0]}.${rest}`;
}

/**
 * The project's observed runs among `records`, each attributed to the one Task of
 * `tasks` its branch maps back to. The default branch is the one `origin/HEAD` names in
 * the registered checkout, otherwise `main`. Where a Task's rework cannot be read, which only
 * a remote tracker's can fail to be, `reworkUnread` says why, by Task id. `home` is the
 * Binnacle home, where a remote tracker's credentials are.
 */
async function runs(
  records: UsageRecord[],
  projectPath: string,
  tasks: Pick<TrackerTask, 'id' | 'title' | 'ticket'>[],
  home: string,
  manifest: ProjectManifest | null,
  checkouts: Checkouts,
): Promise<Attributed> {
  const tracker = manifest?.tracker;
  const remote = tracker?.provider !== 'local';
  const defaultBranch = (await readDefaultBranch(projectPath, resolveGitTimeout())) ?? 'main';
  // ponytail: a record's checkout is found among the ones that exist now, so a removed
  // worktree's records have none: its directory is gone, and the registered checkout that
  // still contains its path is not where they ran. Store each record's checkout at ingest if
  // past runs ever need theirs. A directory deleted inside the registered checkout looks the
  // same, so a session launched there has none either. The branch its reflog gave them while
  // it existed still attributes them; those first read after its removal have none (ADR-0030).
  const registered = containingEntry(projectPath, checkouts.roots);
  const exists = new Map<string, boolean>();
  const checkout = (cwd: string): string | null => {
    const root = containingEntry(cwd, checkouts.roots);
    if (root === undefined || root !== registered) return root?.path ?? null;
    if (!exists.has(cwd)) exists.set(cwd, existsSync(cwd));
    return exists.get(cwd) ? root.path : null;
  };
  const withCheckout = records.map((record) => ({ ...record, checkout: checkout(record.cwd) }));
  const { provider = null, repository = null, host = null } = tracker ?? {};
  const { reviews, reworkUnread } =
    (provider === 'github' || provider === 'gitlab') && repository !== null
      ? await forgeReviewPoints(home, { provider, repository, host }, records, tasks)
      : { reviews: remote ? new Map<string, ReviewPoints>() : await reviewPoints(projectPath, records, tasks), reworkUnread: new Map<string, string>() };
  return { runs: observedRuns(withCheckout, { projectPath, defaultBranch, tasks, remote, reviews, now: new Date() }), reworkUnread };
}

type Attributed = { runs: (ObservedRun & { records: RunRecord[] })[]; reworkUnread: Map<string, string> };

/**
 * When changes were first requested on a forge request, by forge, host, repository and
 * branch: a review that requested changes stays one.
 * ponytail: a branch with none is asked again on every call, as the tracker's issues are; keep its answer for a while if a forge's rate limit is ever reached.
 * ponytail: a review dismissed after it was read here still counts until the daemon restarts; re-read found branches too if dismissals ever matter.
 */
const changesRequestedAt = new Map<string, number>();

/** What differs between GitHub and GitLab for reading rework. */
const FORGES = {
  github: { name: 'GitHub', request: 'pull request', read: readGitHubChangesRequested },
  gitlab: { name: 'GitLab', request: 'merge request', read: readGitLabChangesRequested },
} as const;

/**
 * On GitHub or GitLab, per Task whose branch `records` were on, when changes were first
 * requested on a pull or merge request whose head is that branch, read with the tracker's
 * token: the work after it is rework, and no run is a review run, the forge's review being no
 * commit of a ticket's. Without a token, a request or a forge that answers, `reworkUnread`
 * says why, by Task id.
 */
async function forgeReviewPoints(
  home: string,
  tracker: { provider: 'github' | 'gitlab'; repository: string; host: string | null },
  records: UsageRecord[],
  tasks: Pick<TrackerTask, 'id' | 'title' | 'ticket'>[],
): Promise<Pick<Attributed, 'reworkUnread'> & { reviews: Map<string, ReviewPoints> }> {
  const branches = new Map<string, string[]>();
  for (const branch of new Set(records.flatMap((record) => (record.branch?.source === 'reflog' ? [record.branch.name] : [])))) {
    const task = branchTask(branch, tasks, true);
    if (task !== null) branches.set(task.id, [...(branches.get(task.id) ?? []), branch]);
  }
  const reviews = new Map<string, ReviewPoints>();
  const reworkUnread = new Map<string, string>();
  const unread = (id: string, why: string): void => void reworkUnread.set(id, `${why} So ${id}'s rework is not read.`);
  const { name, request, read } = FORGES[tracker.provider];
  const credential = trackerToken(home, tracker.provider, tracker.host);
  const token = 'token' in credential ? credential.token : null;
  if (token === null) {
    for (const id of branches.keys()) unread(id, 'failure' in credential ? credential.failure.message : `Without a token for ${name}, the reviews on ${id}'s ${request} are not read.`);
    return { reviews, reworkUnread };
  }

  const changesRequested = async (branch: string): Promise<ChangesRequested> => {
    const key = [tracker.provider, tracker.host ?? '', tracker.repository, branch].join('\0');
    const known = changesRequestedAt.get(key);
    if (known !== undefined) return { at: known };
    const answer = await read(tracker.repository, tracker.host, token, branch);
    if ('at' in answer && answer.at !== null) changesRequestedAt.set(key, answer.at);
    return answer;
  };
  await Promise.all(
    [...branches].map(async ([id, names]) => {
      const answers = await Promise.all(names.map(changesRequested));
      const times = answers.flatMap((answer) => ('at' in answer && answer.at !== null ? [answer.at] : []));
      const failures = answers.flatMap((answer) => ('reason' in answer ? [answer.reason] : []));
      const noRequests = answers.flatMap((answer) => ('noRequest' in answer ? [answer.noRequest] : []));
      const at = Math.min(...times);
      if (times.length > 0) reviews.set(id, { lastChange: at, review: at });
      // A branch the forge did not answer for may hold an earlier request; one with no request holds none.
      if (failures.length > 0) unread(id, failures[0]!);
      else if (noRequests.length === answers.length) unread(id, noRequests[0]!);
    }),
  );
  return { reviews, reworkUnread };
}

/**
 * The last change before each commit that first recorded a ticket's Review, by commit and
 * ticket: history does not change under a commit, so it is read once per daemon.
 * ponytail: one entry per reviewed ticket, never forgotten; bound it if a daemon ever sees tens of thousands.
 */
const lastChangeBeforeReview = new Map<string, number | null>();

/**
 * On the local tracker, per Task whose branch `records` were on, when its ticket's first
 * Review was committed and when the last commit before it changed anything but the ticket.
 * A Task with no Review, or whose history Git cannot read, has none: its runs are implementation.
 */
async function reviewPoints(projectPath: string, records: UsageRecord[], tasks: Pick<TrackerTask, 'id' | 'title' | 'ticket'>[]): Promise<Map<string, ReviewPoints>> {
  const branches = new Set(records.flatMap((record) => (record.branch?.source === 'reflog' ? [record.branch.name] : [])));
  const worked = [...new Set([...branches].flatMap((branch) => branchTask(branch, tasks, false) ?? []))];
  const timeout = resolveGitTimeout();
  const first = await readFirstReviews(projectPath, worked.map((task) => task.ticket), timeout);
  const points = new Map<string, ReviewPoints>();
  for (const task of worked) {
    const review = first?.get(task.ticket);
    if (review === undefined) continue;
    const key = `${review.commit}\0${task.ticket}`;
    if (!lastChangeBeforeReview.has(key)) lastChangeBeforeReview.set(key, await readLastChangeBefore(projectPath, review.commit, task.ticket, timeout));
    points.set(task.id, { lastChange: lastChangeBeforeReview.get(key)!, review: review.at });
  }
  return points;
}

function byTask(attributed: { taskId: string | null; records: RunRecord[] }[], tasks: Pick<TrackerTask, 'id' | 'title'>[]): Pick<Usage, 'tasks' | 'unassigned'> {
  const records = new Map<string | null, RunRecord[]>();
  for (const run of attributed) records.set(run.taskId, (records.get(run.taskId) ?? []).concat(run.records));
  const titles = new Map(tasks.map((task) => [task.id, task.title]));
  const items = [...records]
    .filter((entry): entry is [string, RunRecord[]] => entry[0] !== null)
    .map(([id, taskRecords]) => ({ id, title: titles.get(id) ?? null, totals: sum(taskRecords) }));
  items.sort((a, b) => magnitude(b.totals) - magnitude(a.totals) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { tasks: limited(items), unassigned: sum(records.get(null) ?? []) };
}

/** The derived metrics per Task: those of the `DONE` Tasks, and the runs of every Task. */
function perTask(
  attributed: { taskId: string | null; records: RunRecord[] }[],
  tasks: Pick<TrackerTask, 'id' | 'title' | 'state'>[],
): Pick<Derived, 'perCompletedTask' | 'runsPerTask'> {
  const runsOf = new Map<string, RunRecord[][]>();
  for (const { taskId, records } of attributed) {
    if (taskId === null) continue;
    if (runsOf.has(taskId)) runsOf.get(taskId)!.push(records);
    else runsOf.set(taskId, [records]);
  }
  const titles = new Map(tasks.map((task) => [task.id, task.title]));
  const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  const done = tasks.filter((task) => task.state === 'DONE');
  const completed = done.flatMap((task) => {
    const own = runsOf.get(task.id);
    return own === undefined ? [] : [{ id: task.id, title: task.title, runs: own.length, totals: sum(own.flat()) }];
  });
  completed.sort((a, b) => magnitude(b.totals) - magnitude(a.totals) || byId(a, b));

  const runCounts = [...runsOf].map(([id, own]) => ({
    id,
    title: titles.get(id) ?? null,
    runs: own.length,
    // A run is a subagent's when its records are: every one of them comes from the same session and subagent.
    subagentRuns: own.filter((records) => records[0]!.subagentId !== null).length,
  }));
  runCounts.sort((a, b) => b.runs - a.runs || byId(a, b));
  const average = (value: (item: (typeof runCounts)[number]) => number): number => runCounts.reduce((all, item) => all + value(item), 0) / runCounts.length;

  return {
    perCompletedTask: {
      provenance: 'calculated',
      ...limited(completed),
      mean: completed.length === 0 ? null : mean(completed.map((item) => item.totals)),
      withoutRuns: done.length - completed.length,
    },
    runsPerTask: {
      provenance: 'calculated',
      ...limited(runCounts),
      mean: runCounts.length === 0 ? null : { runs: average((item) => item.runs), subagentRuns: average((item) => item.subagentRuns) },
    },
  };
}

/** `records` totalled per calendar week, weeks starting on Monday in the daemon's local time zone. */
function weekly(records: UsageRecord[]): Derived['weekly'] {
  if (records.length === 0) return { provenance: 'calculated', items: [] };
  const weeks = new Map<string, UsageRecord[]>();
  let first = Infinity;
  let last = Date.now();
  for (const record of records) {
    const time = Date.parse(record.timestamp);
    [first, last] = [Math.min(first, time), Math.max(last, time)];
    const week = localDate(mondayOf(new Date(time)));
    if (weeks.has(week)) weeks.get(week)!.push(record);
    else weeks.set(week, [record]);
  }
  const items: Derived['weekly']['items'] = [];
  // Every week from the first record's to this one, one with no records included: a trend shows its gaps.
  for (let monday = mondayOf(new Date(first)); monday.getTime() <= last; monday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7)) {
    items.push({ week: localDate(monday), totals: sum(weeks.get(localDate(monday)) ?? []) });
  }
  return { provenance: 'calculated', items };
}

/** Local midnight of the Monday that starts `date`'s week. */
const mondayOf = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));

const ROLES: RunRole[] = ['product', 'implementation', 'review', 'rework', 'unknown'];
const TASK_ROLES: TaskRole[] = ['implementation', 'review', 'rework'];

/** Totals by each of `roles`, in that order, one that no run has with no records. */
function byRole<Role extends RunRole>(attributed: { role: RunRole; records: RunRecord[] }[], roles: Role[]): Record<Role, Totals> {
  const records = (role: RunRole): RunRecord[] => attributed.filter((run) => run.role === role).flatMap((run) => run.records);
  return Object.fromEntries(roles.map((role) => [role, sum(records(role))])) as Record<Role, Totals>;
}

/**
 * The checkouts of the project's repository that exist now, and the project's directory in
 * each linked one: a session there is the project's, wherever the worktree is.
 */
export type Checkouts = { roots: { path: string }[]; linked: string[] };

/** The project's checkouts, from Git's list of worktrees; none when Git cannot say. */
export async function projectCheckouts(projectPath: string): Promise<Checkouts> {
  const roots = ((await readWorktrees(projectPath, resolveGitTimeout())) ?? []).map((path) => ({ path }));
  const own = containingEntry(projectPath, roots);
  if (!own) return { roots: [], linked: [] };
  const inside = relative(own.path, projectPath);
  return { roots, linked: roots.filter((root) => root !== own).map((root) => join(root.path, inside)) };
}

function level(
  context: OperationContext,
  projectPath: string,
  { harness, name, root, noExport }: (typeof HARNESSES)[number],
  failure: string | null,
  incomplete: boolean,
): HarnessLevel {
  if (failure !== null) return { harness, level: 1, reason: failure };
  const { records, withTokens, live } = context.store.usageCounts(projectPath, harness, new Date(Date.now() - ACTIVE_WITHIN_MS).toISOString());
  if (live > 0) return { harness, level: 4, reason: null };
  if (withTokens > 0) return { harness, level: 3, reason: noExport ?? null };
  if (records > 0) return { harness, level: 2, reason: noExport ?? null };
  if (incomplete) return { harness, level: null, reason: 'The import of this project has not reached a record yet.' };
  return { harness, level: null, reason: `No ${name} session of this project was found under ${context.runtime.artifacts[root]}.` };
}

const windowOf = (manifest: ProjectManifest | null): ImportWindow => manifest?.telemetry.import.windowDays ?? DEFAULT_WINDOW_DAYS;

/**
 * Queues an ingest of the project's artifacts behind the machine's others and returns it.
 * Which files have anything to read is decided now, so a project with nothing new settles at
 * once. A file that fails stays in `importer.unreadable` until one of its readings succeeds.
 * `linked` is the project's directory in each of its linked worktrees (`projectCheckouts`).
 */
export function startIngest(context: OperationContext, projectPath: string, manifest: ProjectManifest | null, linked: string[]): Promise<void> {
  const window = windowOf(manifest);
  const directories = [projectPath, ...linked].map((path) => ({ path }));
  const { artifacts } = context.runtime;
  const { importer } = context;
  const found: Record<Harness, { files: string[] }> = {
    'claude-code': claudeCodeFiles(artifacts.claudeCode, [projectPath, ...linked]),
    codex: codexSessions(artifacts.codex),
    'gemini-cli': geminiCliSessions(artifacts.geminiCli, [projectPath, ...linked]),
    opencode: { files: existsSync(opencodeDatabase(artifacts.opencode)) ? [opencodeDatabase(artifacts.opencode)] : [] },
  };

  const pending: { path: string; harness: Harness }[] = [];
  for (const { harness } of HARNESSES) {
    for (const path of found[harness].files) {
      try {
        const cursor = context.store.cursor(path);
        if (harness === 'opencode' ? !databaseChanged(cursor, databaseMark(path), window) : readPosition(cursor, statSync(path).size, window) === null) {
          // Read to its end, and it can be opened again: nothing about it is unreadable any more.
          importer.unreadable.delete(path);
          continue;
        }
        // A rollout's name says nothing of where it ran; its first line does.
        if (harness === 'codex' && !containingEntry(rolloutCwd(path) ?? '', directories)) continue;
        pending.push({ path, harness });
      } catch (error) {
        importer.unreadable.set(path, openFailure(path, error));
      }
    }
  }
  if (pending.length === 0) return Promise.resolve();

  const run = importer.queue
    .then(async () => {
      // A record is the project's whose `cwd` it contains, or one of its linked worktrees does.
      const places = [
        ...readRegistry(context.home).map((entry) => ({ path: entry.path, project: entry.path })),
        ...linked.map((path) => ({ path, project: projectPath })),
      ];
      // Each checkout's reflog is read once per ingest.
      const histories = new Map<string, Promise<HeadHistory | null>>();
      for (const file of pending) {
        // The yield between files is what lets a waiting call answer when its budget runs out.
        // ponytail: a single file is read in one go; read it in chunks if one ever outlasts the budget.
        await setImmediate();
        if (importer.stopped) break;
        const failure = await ingestFile(context, file, window, places, histories);
        if (failure === null) importer.unreadable.delete(file.path);
        else importer.unreadable.set(file.path, failure);
      }
    })
    .finally(() => {
      if (importer.running.get(projectPath)?.run === run) importer.running.delete(projectPath);
    });
  importer.running.set(projectPath, { run, window });
  // Nobody may be waiting on it, so its failure is logged here rather than left unhandled.
  importer.queue = run.then(
    () => undefined,
    (error: unknown) => console.error(error),
  );
  return run;
}

/**
 * Claude Code's directory name for the directory a session was launched in. It is lossy, so
 * it only selects candidates: every directory whose name starts with the project's, which
 * includes its subdirectories and the worktrees under it. Each record's own `cwd` decides.
 */
const claudeCodeDirectory = (path: string): string => path.replace(/[^a-zA-Z0-9]/g, '-');

/**
 * The session files under Claude Code's `root` of the candidate directories of the
 * project's directories, in its own checkout and in each of its linked worktrees: its main
 * sessions, the sessions of their subagents beside them, and why a directory could not be
 * listed. A subagent's `.meta.json` is not among them.
 */
export function claudeCodeSessions(root: string, directoriesOfProject: string[]): { files: string[]; subagents: string[]; failures: string[] } {
  const prefixes = directoriesOfProject.map(claudeCodeDirectory);
  const failures: string[] = [];
  const list = (directory: string, missing: boolean): Dirent[] => {
    try {
      return readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if (!missing || (error as NodeJS.ErrnoException).code !== 'ENOENT') failures.push(openFailure(directory, error));
      return [];
    }
  };
  const paths = (entries: Dirent[], name: (entry: Dirent) => boolean): string[] =>
    entries.filter((entry) => entry.isFile() && name(entry)).map((entry) => join(entry.parentPath, entry.name));

  // A root that does not exist holds no session, and neither does a session with no subagents.
  const directories = list(root, true)
    .filter((entry) => entry.isDirectory() && prefixes.some((prefix) => entry.name.startsWith(prefix)))
    .map((entry) => list(join(root, entry.name), false));
  // Beside `<session>.jsonl`, the directory `<session>/subagents` holds its subagents' sessions.
  const subagentDirectories = directories.flatMap((entries) =>
    entries.filter((entry) => entry.isDirectory()).map((entry) => list(join(entry.parentPath, entry.name, 'subagents'), true)),
  );
  return {
    files: directories.flatMap((entries) => paths(entries, (entry) => entry.name.endsWith('.jsonl'))),
    subagents: subagentDirectories.flatMap((entries) => paths(entries, (entry) => /^agent-.+\.jsonl$/.test(entry.name))),
    failures,
  };
}

/** Every Claude Code file the daemon reads for the project: its main sessions and its subagents'. */
function claudeCodeFiles(root: string, directoriesOfProject: string[]): { files: string[]; failures: string[] } {
  const { files, subagents, failures } = claudeCodeSessions(root, directoriesOfProject);
  return { files: [...files, ...subagents], failures };
}

/** Every rollout under Codex's `root`, which files them by the day each session started, and why the root could not be listed. */
export function codexSessions(root: string): { files: string[]; failures: string[] } {
  try {
    const files = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
      .map((entry) => join(entry.parentPath, entry.name));
    return { files, failures: [] };
  } catch (error) {
    return { files: [], failures: (error as NodeJS.ErrnoException).code === 'ENOENT' ? [] : [openFailure(root, error)] };
  }
}

/**
 * Gemini CLI's session files under its `root`, `~/.gemini/tmp`, of the project's directories,
 * and why a directory could not be listed. Gemini CLI keeps a temp directory per launch
 * directory, which its `.project_root` names, and in its `chats` each main session's file
 * and, in a directory named after a main session, its subagents'. A temp directory with no
 * `.project_root`, as one older Gemini CLI named by a hash, is no project's.
 *
 * ponytail: the `.json` files of a Gemini CLI from before its JSON Lines sessions are not read;
 * Gemini CLI converts one when it resumes it. Read them if history that old turns out to matter.
 */
export function geminiCliSessions(root: string, directoriesOfProject: string[]): { files: string[]; failures: string[] } {
  const places = directoriesOfProject.map((path) => ({ path }));
  const failures: string[] = [];
  const list = (directory: string): Dirent[] => {
    try {
      return readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') failures.push(openFailure(directory, error));
      return [];
    }
  };
  const sessions = (entries: Dirent[]): string[] =>
    entries.filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl')).map((entry) => join(entry.parentPath, entry.name));
  const files = list(root)
    .filter((entry) => {
      const launched = entry.isDirectory() ? projectRoot(join(root, entry.name)) : null;
      return launched !== null && containingEntry(launched, places) !== undefined;
    })
    .flatMap((entry) => {
      const chats = list(join(root, entry.name, 'chats'));
      const subagents = chats.filter((chat) => chat.isDirectory()).flatMap((chat) => sessions(list(join(chat.parentPath, chat.name))));
      return [...sessions(chats), ...subagents];
    });
  return { files, failures };
}

/** The launch directory a Gemini CLI temp directory's `.project_root` names; null when it names none. */
function projectRoot(directory: string): string | null {
  try {
    return readFileSync(join(directory, '.project_root'), 'utf8').trim() || null;
  } catch {
    return null;
  }
}

/** What a Gemini CLI session file's place says of it: the directory it ran in, and the main session a subagent's is under. */
function geminiCliSession(path: string): GeminiCliSession {
  const directory = dirname(path);
  const main = basename(directory) === 'chats';
  const temp = dirname(main ? directory : dirname(directory));
  // Listed only under a temp directory that names one, so a failure to read it now is reported.
  return { cwd: readFileSync(join(temp, '.project_root'), 'utf8').trim(), parentSession: main ? null : basename(directory) };
}

/**
 * The `cwd` a rollout's first line, its `session_meta`, names; null when it names none, or
 * the line cannot be read yet. Only that line is read.
 *
 * ponytail: the first line of a rollout of no registered project is read again by every call
 * that finds it has grown; remember each rollout's `cwd` if that ever costs.
 */
function rolloutCwd(path: string): string | null {
  const fd = openSync(path, 'r');
  try {
    const chunks: Buffer[] = [];
    const chunk = Buffer.alloc(64 * 1024);
    for (let position = 0; ; ) {
      const read = readSync(fd, chunk, 0, chunk.length, position);
      const end = chunk.subarray(0, read).indexOf(0x0a);
      chunks.push(Buffer.from(chunk.subarray(0, end === -1 ? read : end)));
      if (end !== -1 || read === 0) break;
      position += read;
    }
    const meta: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return typeof meta === 'object' && meta !== null ? (codexSession(meta as Record<string, unknown>)?.cwd ?? null) : null;
  } catch {
    // A first line that is not JSON yet is still being written.
    return null;
  } finally {
    closeSync(fd);
  }
}

/**
 * Where to read a file of `size` bytes from, or null when it has nothing new. A file that
 * shrank, or a window wider than the one its cursor was read under, is read from the
 * start; the unique constraint absorbs what was already stored.
 */
function readPosition(cursor: IngestCursor | null, size: number, window: ImportWindow): { offset: number; line: number } | null {
  const restart = cursor === null || size < cursor.size || wider(window, cursor.windowDays);
  const from = restart ? { offset: 0, line: 0 } : cursor;
  return size > from.offset ? from : null;
}

const wider = (window: ImportWindow, than: ImportWindow): boolean => than !== 'all' && (window === 'all' || window > than);

/**
 * Reads one file from its read position to its end, and returns where and why it could not
 * be read, if it could not. Its records and its cursor commit together; a failing line stops the
 * file just before it, and the next call tries it again. A record whose `cwd` lies in no
 * registered project, nor in a linked worktree of the one being read, is never stored, and
 * neither is one older than the window. A record's branch is the reflog's, read now, while
 * the reflog still says; otherwise the record keeps the one its harness wrote, which
 * attributes nothing (ADR-0030). A Claude Code file's last message waits until it is
 * finished (`readClaudeCode`).
 *
 * ponytail: a record of another registered project found here is stored under that
 * project, but read under this one's window. That project's own ingest re-reads the file
 * when its window is wider, so nothing is lost, but two such projects with different
 * windows take turns re-reading the files they share.
 */
async function ingestFile(
  context: OperationContext,
  { path, harness }: { path: string; harness: Harness },
  window: ImportWindow,
  places: { path: string; project: string }[],
  histories: Map<string, Promise<HeadHistory | null>>,
): Promise<string | null> {
  if (harness === 'opencode') return ingestDatabase(context, path, window, places, histories);
  let size: number;
  let settled: boolean;
  let from: { offset: number; line: number } | null;
  let bytes: Buffer;
  let read: (bytes: Buffer) => ArtifactReading;
  try {
    // Decided again: the file, or its cursor, may have moved while this ingest was queued.
    const stat = statSync(path);
    size = stat.size;
    settled = Date.now() - stat.mtimeMs >= context.importer.settledAfterMs;
    from = readPosition(context.store.cursor(path), size, window);
    if (from === null) return null;
    const start = from;
    switch (harness) {
      case 'claude-code':
        read = (bytes) => readClaudeCode(bytes, start, settled);
        break;
      // ponytail: a rollout is read whole whenever it has grown, since its differences need the
      // totals before them; keep the reader's running totals on the cursor if rollouts outgrow that.
      case 'codex':
        from = { offset: 0, line: 0 };
        read = readCodex;
        break;
      // A Gemini CLI file names its session on its first line only, so it is read whole too.
      case 'gemini-cli': {
        from = { offset: 0, line: 0 };
        const session = geminiCliSession(path);
        read = (bytes) => readGeminiCli(bytes, session, settled);
        break;
      }
    }
    bytes = readFrom(path, from.offset, size);
  } catch (error) {
    // A file that vanished or cannot be opened is reported, never a failed snapshot.
    return openFailure(path, error);
  }

  const reading = read(bytes);
  await keep(context, { path, size, offset: reading.stop.offset, line: reading.stop.line, windowDays: window }, reading.records, places, histories, reading.markers);
  // Every later reading stops at the same line, a rollout's included, though it is read from its start.
  return reading.failure ? `${path} at line ${reading.failure.line}: ${reading.failure.reason}, and nothing after it is counted, however the file grows, until Binnacle can read that line` : null;
}

/**
 * Reads opencode's database at `path` whole, as `ingestFile` reads a file, and returns why it
 * could not be opened or read, if it could not. The database holds every project's sessions,
 * so a session stopped at a step it cannot read is unreadable only for the project it was
 * launched in: kept in `importer.unreadable` under `sessionFailureKey`, and only when that
 * project is registered. The cursor's `size` holds the database's mark (`databaseMark`) as of
 * this reading, its offset and line none, or 0 when such a step was found, so that every later
 * reading tries it again.
 *
 * ponytail: every step of every project is read whenever the database changed, since a step's
 * row says nothing of whose it is; select the project's sessions by their directory if the
 * database ever outgrows the budget.
 */
async function ingestDatabase(
  context: OperationContext,
  path: string,
  window: ImportWindow,
  places: { path: string; project: string }[],
  histories: Map<string, Promise<HeadHistory | null>>,
): Promise<string | null> {
  let mark: number;
  let reading: ReturnType<typeof readOpencode>;
  try {
    mark = databaseMark(path);
    if (!databaseChanged(context.store.cursor(path), mark, window)) return null;
    reading = readOpencode(readOpencodeSteps(path));
  } catch (error) {
    // SQLite says why in `errstr`, as "file is not a database"; its code is SQLite's for any error.
    return `${path} (${(error as { errstr?: string }).errstr ?? (error as NodeJS.ErrnoException).code ?? 'error'})`;
  }
  const { unreadable } = context.importer;
  for (const key of unreadable.keys()) if (key.startsWith(sessionFailureKey(path, ''))) unreadable.delete(key);
  const failures = reading.failures.filter((failure) => containingEntry(failure.directory, places) !== undefined);
  for (const { step, directory, reason } of failures) {
    unreadable.set(sessionFailureKey(path, directory), `${path} at step ${step}: ${reason}, and nothing after it in its session is counted until Binnacle can read that step`);
  }
  await keep(context, { path, size: failures.length > 0 ? 0 : mark, offset: 0, line: 0, windowDays: window }, reading.records, places, histories);
  return null;
}

/**
 * Where `importer.unreadable` keeps a step of opencode's database at `path` that stopped a
 * session launched in `directory`.
 * ponytail: one failure per directory is kept, the latest read; key it by session too if
 * two broken sessions in one directory ever need telling apart.
 */
const sessionFailureKey = (path: string, directory: string): string => `${path}\0${directory}`;

/** Where opencode's database is in its data directory `root`. */
const opencodeDatabase = (root: string): string => join(root, 'opencode.db');

/**
 * When opencode's database at `path` last changed: the latest modification of the database
 * and of its write-ahead log, where opencode writes first.
 */
function databaseMark(path: string): number {
  const wal = `${path}-wal`;
  return Math.max(statSync(path).mtimeMs, existsSync(wal) ? statSync(wal).mtimeMs : 0);
}

/** Whether a database marked `mark` has anything new since `cursor`: it changed, or the window is wider. */
const databaseChanged = (cursor: IngestCursor | null, mark: number, window: ImportWindow): boolean =>
  cursor === null || cursor.size !== mark || wider(window, cursor.windowDays);

/**
 * Stores, with `cursor`, the records and compaction markers of a reading whose `cwd` lies in
 * one of `places` and that are within the window, and attributes the OpenTelemetry waiting
 * for their sessions.
 */
async function keep(
  context: OperationContext,
  cursor: IngestCursor,
  read: UsageRecord[],
  places: { path: string; project: string }[],
  histories: Map<string, Promise<HeadHistory | null>>,
  markers: CompactionMarker[] = [],
): Promise<void> {
  const windowStart = cursor.windowDays === 'all' ? '' : localMidnight(cursor.windowDays - 1).toISOString();
  const projectOf = (item: { cwd: string; timestamp: string }): string | undefined =>
    item.timestamp >= windowStart ? containingEntry(item.cwd, places)?.project : undefined;
  const records: Ingested[] = [];
  for (const record of read) {
    const project = projectOf(record);
    if (project) records.push({ record: await withBranch(record, histories), projectPath: project, sourceRef: cursor.path });
  }
  const kept = markers.flatMap((marker) => {
    const project = projectOf(marker);
    return project ? [{ marker, projectPath: project, sourceRef: cursor.path }] : [];
  });
  context.store.ingest(cursor, records, kept);
  // A session's OpenTelemetry received before any of its artifact records were stored joins their project now.
  await attributeSessions(context, records.map(({ record }) => record), histories);
}

/**
 * Keeps the calls an OpenTelemetry export posted, and attributes each whose session's
 * artifact records are already stored; the rest wait, in no project, for those records.
 */
export async function receiveTelemetry(context: OperationContext, records: TelemetryRecord[]): Promise<void> {
  context.store.receive(records);
  await attributeSessions(context, records, new Map());
}

/**
 * Moves the OpenTelemetry records still in no project of the sessions of `records` into the
 * project their session's artifact records are in, each with the directory of that session's
 * record nearest before it and, as every record, the branch that directory's reflog gives it.
 *
 * ponytail: a session whose artifact never names a registered project keeps its records in
 * no project for good; forget them past the import window if they ever weigh on the store.
 */
async function attributeSessions(
  context: OperationContext,
  records: Pick<UsageRecord, 'harness' | 'sessionId'>[],
  histories: Map<string, Promise<HeadHistory | null>>,
): Promise<void> {
  const sessions = new Map(records.map((record) => [`${record.harness}\0${record.sessionId}`, record]));
  for (const { harness, sessionId } of sessions.values()) {
    for (const { record, receivedAt } of context.store.unattributed(harness, sessionId)) {
      const place = context.store.sessionPlace(harness, sessionId, record.timestamp);
      if (place === null) break;
      const placed = await withBranch({ ...record, cwd: place.cwd, branch: null }, histories);
      context.store.attribute(placed, place.projectPath, receivedAt);
    }
  }
}

/**
 * `record`, with the branch the `HEAD` reflog of the checkout its `cwd` names was on at its
 * timestamp. Where the reflog has no answer, because the checkout is gone, its reflog does
 * not reach back that far, or HEAD was detached, the record keeps the branch its harness
 * wrote, stored as recorded, and has none when runs are read (ADR-0030). `histories` holds
 * each `cwd`'s reflog for the rest of the ingest.
 */
async function withBranch(record: UsageRecord, histories: Map<string, Promise<HeadHistory | null>>): Promise<UsageRecord> {
  if (!histories.has(record.cwd)) histories.set(record.cwd, readHeadHistory(record.cwd, resolveGitTimeout()));
  const history = await histories.get(record.cwd)!;
  const name = history && branchAt(history, Date.parse(record.timestamp));
  return name ? { ...record, branch: { name, source: 'reflog' } } : record;
}

/** A file or directory that could not be opened, and the system's code for why. */
const openFailure = (path: string, error: unknown): string => `${path} (${(error as NodeJS.ErrnoException).code ?? 'error'})`;

function readFrom(path: string, offset: number, size: number): Buffer {
  const buffer = Buffer.alloc(size - offset);
  const fd = openSync(path, 'r');
  try {
    return buffer.subarray(0, readSync(fd, buffer, 0, buffer.length, offset));
  } finally {
    closeSync(fd);
  }
}

/** Local midnight `days` days before today. */
function localMidnight(days: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
}

const localDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
