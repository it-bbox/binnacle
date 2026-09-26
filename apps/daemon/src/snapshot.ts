import { posix } from 'node:path';
import { readGitHubTasks, readGitLabTasks, readLastCommitTimes, readLocalTasks, workingTree, type GitFacts, type Tree } from '@binnacle/adapters';
import {
  boardColumn,
  nextAction,
  nextActionAttention,
  parseRoadmap,
  resolveDependencies,
  roadmapAttention,
  startCommand,
  suggestedStep,
  type Diagnostic,
  type Epic,
  type NextAction,
  type ObservedRun,
  type ProjectManifest,
  type ResolvedTask,
  type Roadmap,
  type SuggestedStep,
  type TaskReading,
  type TaskState,
  type TrackerTask,
} from '@binnacle/core';
import { resolveGitTimeout, trackerToken } from './home.ts';
import type { Projected } from './projection.ts';
import type { ProjectRow } from './store.ts';
import type { Activity, Usage } from './usage.ts';

/**
 * The Product Snapshot (`project.snapshot`): a compact, fixed-shape projection for a fresh
 * Product session. Every section has a fixed item limit and a remainder count, so it stays
 * compact as the project grows and says how much it left out (ADR-0012). Nothing is stored:
 * the tracker, the roadmap and the ADRs are read on every call from the caller's checkout,
 * attention items are computed on every call, and the same files give the same snapshot.
 */
export const SECTION_LIMIT = 10;
export const DECISION_LIMIT = 5;
/** In characters: Unicode code points. */
export const FOCUS_LIMIT = 2000;
/** Agents at once where the manifest writes no `automation.max_parallel_development_tasks`, as autopilot reads it. */
export const PARALLEL_LIMIT = 2;

type InFlight = 'ACTIVE' | 'BLOCKED' | 'READY_FOR_REVIEW' | 'APPROVED' | 'MERGE_READY';

export type SnapshotTask = Pick<ResolvedTask, 'id' | 'title' | 'state' | 'unmetDependencies' | 'ticket'>;
export type Section = { items: SnapshotTask[]; remainder: number };
/** A section whose Tasks each carry the command that starts them (`startCommand`), or null when there is none. */
export type SectionWithStart = { items: (SnapshotTask & { start: string | null })[]; remainder: number };

export type TaskCounts = Record<Exclude<TaskState, InFlight> | 'unknown', number>;

export type CallerCheckout = {
  /**
   * The checkout `git` describes: the caller's own when it is a linked worktree of the
   * project, otherwise the registered one. `root` is the project path when Git has no answer.
   */
  checkout: { root: string; registered: boolean };
  git: GitFacts;
  /** The project's directory in that checkout, which is where its files are read. */
  project: string;
};

/** A section Binnacle cannot fill yet. It is present and says so, and is never filled with a guess (ADR-0007). */
export type Unavailable = { available: false; reason: string };
export const UNAVAILABLE: Unavailable = { available: false, reason: 'Not available in this version of Binnacle.' };

export type Snapshot = {
  project: ProjectRow;
  checkout: CallerCheckout['checkout'];
  /** The facts of the caller's checkout, as `project.status` gives them. */
  git: GitFacts;
  /** Null when there is no roadmap to read: without a readable manifest, or with a diagnostic. */
  roadmap: {
    epics: Epic[];
    /** `## Current focus` as written, cut at `FOCUS_LIMIT`; `truncated` says whether it was. */
    focus: { text: string; truncated: boolean } | null;
    /** Every other `##` section, by heading only. */
    sections: string[];
  } | null;
  /**
   * What to do next (ADR-0032): the roadmap's Next action, null when its focus does not end with
   * one, and beside it Binnacle's Suggested step, null when no rule applies, and unavailable,
   * with the tracker's reason, when the Tasks cannot be read.
   */
  next: { action: NextAction | null; suggested: SuggestedStep | null | Unavailable };
  /** Null when the project's tracker cannot be read yet; `attention` says why. */
  tasks: {
    /**
     * In progress, as the board reads it (ADR-0032): `ACTIVE`, `BLOCKED`, `READY_FOR_REVIEW`,
     * `APPROVED`, `MERGE_READY`, and a `READY` Task with an AgentRun attributed to it.
     */
    inFlight: SectionWithStart;
    /** `READY` with no Unmet dependencies and no attributed AgentRun. */
    readyToStart: SectionWithStart;
    /**
     * Every Task not listed by name, by state: `READY` here is a Task waiting on an Unmet
     * dependency, with no attributed run, and `unknown` one whose tracker value is not a Task state.
     */
    counts: TaskCounts;
    /**
     * How many Tasks may be worked on at once: the manifest's limit, the Tasks in flight, and
     * what is left of the limit, never below zero. Binnacle's calculation.
     */
    parallel: { limit: number; inProgress: number; free: number; provenance: 'calculated' };
  } | null;
  /**
   * The most recently committed ADRs; one never committed counts as the most recent, and
   * without Git they go by path. Null when the project declares no ADR directory.
   */
  decisions: { items: { title: string | null; path: string }[]; remainder: number } | null;
  pendingDecisions: Unavailable;
  ci: Unavailable;
  usage: Usage;
  /**
   * The runs active now, within telemetry's recency, and the latest others; unavailable,
   * with the tracker's reason, when it cannot be read.
   */
  activity: Activity | Unavailable;
  /** Deterministic checks and diagnostics only; nothing heuristic. */
  attention: Diagnostic[];
};

/**
 * `diagnostics` are the caller's own findings about the checkout, such as a tracker-remote
 * mismatch; `home` is the Binnacle home, where a remote tracker's credentials are.
 * `usageAndActivity` answers the usage and activity sections from the Tasks this snapshot read, so the tracker is read once.
 */
export async function snapshot(
  home: string,
  projected: Projected,
  caller: CallerCheckout,
  diagnostics: Diagnostic[],
  usageAndActivity: (tasks: TrackerTask[] | Unavailable) => Promise<Pick<Snapshot, 'usage' | 'activity'> & { runs: ObservedRun[] }>,
): Promise<Snapshot> {
  const tree = workingTree(caller.project);
  const { tasks, unreadable, roadmap, adrs, attention } = await readState(home, tree, projected, diagnostics);
  const { usage: usageSection, activity, runs } = await usageAndActivity(tasks ?? trackerUnavailable(unreadable));
  const workflow = projected.manifest?.workflow.provider ?? null;
  // A harness whose artifacts cannot be read is at level 1, and says why.
  for (const { level, reason } of usageSection.harnesses) if (level === 1 && reason !== null) attention.push({ code: 'telemetry.unreadable', message: reason });

  return {
    project: projected.row,
    checkout: caller.checkout,
    git: caller.git,
    roadmap: roadmap && { ...roadmap, focus: roadmap.focus == null ? null : cut(roadmap.focus, FOCUS_LIMIT) },
    next: {
      action: nextAction(roadmap?.focus ?? null),
      suggested: tasks ? suggestedStep(roadmap?.epics ?? [], tasks, runs, workflow) : trackerUnavailable(unreadable),
    },
    tasks: tasks && withStartAndParallel(taskSections(tasks, new Set(runs.flatMap((run) => run.taskId ?? []))), workflow, projected.manifest?.automation.maxParallelDevelopmentTasks ?? PARALLEL_LIMIT),
    decisions: adrs && (await recentDecisions(tree, caller.project, adrs)),
    pendingDecisions: UNAVAILABLE,
    ci: UNAVAILABLE,
    usage: usageSection,
    activity,
    attention,
  };
}

/** Attribution to Tasks, unavailable with the tracker's own reasons for being unreadable. */
export const trackerUnavailable = (unreadable: Diagnostic[]): Unavailable => ({
  available: false,
  reason: unreadable.map((item) => item.message).join(' ') || 'The tracker cannot be read.',
});

/** `text` cut at `limit` code points, so that a cut never splits a character in two, and whether it was. */
export function cut(text: string, limit: number): { text: string; truncated: boolean } {
  const characters = Array.from(text);
  return { text: characters.slice(0, limit).join(''), truncated: characters.length > limit };
}

/** What the snapshot and the daily delta read from one version of the project, and the attention it calls for. */
export type State = {
  /** Null when the project's tracker cannot be read yet; `attention` says why. */
  tasks: ResolvedTask[] | null;
  /** The tracker's own diagnostics, which say why `tasks` is null when it is. */
  unreadable: Diagnostic[];
  roadmap: Roadmap | null;
  /** The ADR directory and the ADRs in it; null when the project declares none or it is not there. */
  adrs: { dir: string; paths: string[] } | null;
  attention: Diagnostic[];
};

/**
 * `readRemoteTracker: false` leaves the Tasks of a remote tracker unread and null: it has
 * no past version to read at a commit, which is what the daily's baseline side reads.
 */
export async function readState(
  home: string,
  tree: Tree,
  { manifest, warnings }: Projected,
  diagnostics: Diagnostic[],
  { readRemoteTracker = true } = {},
): Promise<State> {
  const attention: Diagnostic[] = [
    ...warnings.map((warning) => ({ code: 'manifest.warning', message: `${warning.path}: ${warning.message}` })),
    ...diagnostics,
  ];
  const tracker: Diagnostic[] = [];
  const tasks = await readTasks(home, tree, manifest, tracker, readRemoteTracker);
  attention.push(...tracker);
  const roadmap = await readRoadmap(tree, manifest, attention);
  if (roadmap && tasks) attention.push(...roadmapAttention(roadmap.epics, tasks));
  if (roadmap) attention.push(...nextActionAttention(roadmap, tasks));
  // Only the local tracker reads a Review; a remote one never reads the comments that would hold it.
  if (tasks && manifest?.tracker.provider === 'local') {
    for (const task of tasks) {
      if (task.state === 'DONE' && task.review === null) {
        attention.push({ code: 'review.missing', message: `${task.id} (${task.ticket}) is DONE, and its ticket records no Review under ## Comments.` });
      }
    }
  }
  const adrs = await readAdrs(tree, manifest, attention);
  return { tasks, unreadable: tasks === null ? tracker : [], roadmap, adrs, attention };
}

/** The project's Tasks, or null with the reason pushed to `attention`. `home` is where a remote tracker's credentials are. */
export async function readTasks(
  home: string,
  tree: Tree,
  manifest: ProjectManifest | null,
  attention: Diagnostic[],
  readRemoteTracker = true,
): Promise<ResolvedTask[] | null> {
  const tracker = manifest?.tracker;
  if (!readRemoteTracker && (tracker?.provider === 'github' || tracker?.provider === 'gitlab') && tracker.repository !== null) return null;
  const reading = await readTracker(home, tree, manifest);
  attention.push(...reading.diagnostics);
  if (reading.tasks === null) return null;
  const { tasks, diagnostics } = resolveDependencies(reading.tasks);
  attention.push(...diagnostics);
  return tasks;
}

/**
 * The declared tracker's Tasks; with none that can be read, `tracker.unavailable` says why.
 * `home` is the Binnacle home, where a remote tracker's credentials are.
 */
export async function readTracker(home: string, tree: Tree, manifest: ProjectManifest | null): Promise<TaskReading> {
  const tracker = manifest?.tracker;
  if (tracker?.provider === 'local' && tracker.local.issues !== null) return readLocalTasks(tree, tracker.local.issues);
  if ((tracker?.provider === 'github' || tracker?.provider === 'gitlab') && tracker.repository !== null) {
    // A credentials problem reads nothing: the token that would have been used is unknown.
    const credential = trackerToken(home, tracker.provider, tracker.host);
    if ('failure' in credential) return { tasks: null, diagnostics: [credential.failure] };
    return (tracker.provider === 'github' ? readGitHubTasks : readGitLabTasks)(tracker.repository, tracker.host, credential.token);
  }
  return { tasks: null, diagnostics: [{ code: 'tracker.unavailable', message: unavailable(tracker) }] };
}

function unavailable(tracker: ProjectManifest['tracker'] | undefined): string {
  if (tracker === undefined) return 'Tasks cannot be read without a readable manifest.';
  if (tracker.provider === null) return 'This project declares no tracker.provider.';
  if (tracker.provider === 'local') return 'tracker.provider is local, and this project declares no tracker.local.issues.';
  return `tracker.provider is ${tracker.provider}, and this project declares no tracker.repository.`;
}

/** `attributed` holds the ids of the Tasks with AgentRuns attributed to them, which the board's rule reads (`boardColumn`). */
export function taskSections(tasks: ResolvedTask[], attributed: ReadonlySet<string>): { inFlight: Section; readyToStart: Section; counts: TaskCounts } {
  const counts: TaskCounts = { BACKLOG: 0, READY: 0, MERGED: 0, DONE: 0, CANCELLED: 0, unknown: 0 };
  const listedInFlight: ResolvedTask[] = [];
  const readyToStart: ResolvedTask[] = [];
  for (const task of tasks) {
    const column = boardColumn(task.state, attributed.has(task.id))?.column;
    if (column === 'inProgress') listedInFlight.push(task);
    else if (column === 'ready' && task.unmetDependencies.length === 0) readyToStart.push(task);
    // ponytail: the cast trusts boardColumn to put every InFlight state In progress; derive the type from it if they ever drift.
    else counts[(task.state ?? 'unknown') as keyof TaskCounts]++;
  }
  return { inFlight: section(listedInFlight), readyToStart: section(readyToStart), counts };
}

/** The snapshot's sections, each Task with its start command under the project's `workflow.provider`, and the parallel capacity under `limit`. */
function withStartAndParallel({ inFlight, readyToStart, counts }: ReturnType<typeof taskSections>, workflow: string | null, limit: number): NonNullable<Snapshot['tasks']> {
  const startable = ({ items, remainder }: Section): SectionWithStart => ({ items: items.map((task) => ({ ...task, start: startCommand(task, workflow) })), remainder });
  const inProgress = inFlight.items.length + inFlight.remainder;
  return {
    inFlight: startable(inFlight),
    readyToStart: startable(readyToStart),
    counts,
    parallel: { limit, inProgress, free: Math.max(0, limit - inProgress), provenance: 'calculated' },
  };
}

/** In tracker order, which the adapter makes stable. */
export function section(tasks: ResolvedTask[]): Section {
  return limited(tasks.map(({ id, title, state, unmetDependencies, ticket }) => ({ id, title, state, unmetDependencies, ticket })));
}

/** The first `limit` items, and how many were left out. */
export const limited = <T>(items: T[], limit = SECTION_LIMIT): { items: T[]; remainder: number } => ({
  items: items.slice(0, limit),
  remainder: Math.max(0, items.length - limit),
});

/**
 * The roadmap is `<knowledge.docs>/roadmap.md` whatever the tracker (ADR-0025). With no
 * readable manifest it is simply absent: `tracker.unavailable` already says why, and saying
 * it twice only makes the attention list noisier.
 */
async function readRoadmap(tree: Tree, manifest: ProjectManifest | null, attention: Diagnostic[]): Promise<Roadmap | null> {
  if (manifest === null) return null;
  const docs = manifest.knowledge.docs;
  if (docs === null) {
    attention.push({ code: 'roadmap.missing', message: 'The roadmap is <knowledge.docs>/roadmap.md, and this project declares no knowledge.docs.' });
    return null;
  }

  const path = posix.join(docs, 'roadmap.md');
  const text = await tree.read(path);
  if (text === null) {
    attention.push({ code: 'roadmap.missing', message: `There is no roadmap at ${path}.` });
    return null;
  }
  const { roadmap, diagnostics } = parseRoadmap(text);
  attention.push(...diagnostics);
  return roadmap;
}

async function readAdrs(tree: Tree, manifest: ProjectManifest | null, attention: Diagnostic[]): Promise<State['adrs']> {
  // A project need not keep ADRs, and declaring none is a choice, not a problem to report.
  const adr = manifest?.knowledge.adr ?? null;
  if (adr === null) return null;
  const files = await tree.list(adr);
  if (files === null) {
    attention.push({ code: 'adr.missing', message: `knowledge.adr names ${adr}, which is not a directory.` });
    return null;
  }
  return { dir: adr, paths: files.filter((entry) => !entry.directory && entry.name.endsWith('.md')).map((entry) => posix.join(adr, entry.name)) };
}

async function recentDecisions(tree: Tree, root: string, { dir, paths }: NonNullable<State['adrs']>): Promise<NonNullable<Snapshot['decisions']>> {
  const times = (await readLastCommitTimes(root, dir, resolveGitTimeout())) ?? new Map<string, number>();
  // Never committed sorts as newest; one commit's ADRs go by path, highest number first.
  const time = (path: string): number => times.get(path) ?? Infinity;
  paths.sort((a, b) => time(b) - time(a) || (a < b ? 1 : a > b ? -1 : 0));

  const { items, remainder } = limited(paths, DECISION_LIMIT);
  return { items: await Promise.all(items.map(async (path) => ({ title: firstHeading((await tree.read(path)) ?? ''), path }))), remainder };
}

export const firstHeading = (text: string): string | null => /^#\s+(.+?)\s*$/m.exec(text)?.[1] ?? null;
