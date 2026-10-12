import { posix } from 'node:path';
import {
  commitTree,
  isAncestor,
  isGitUnavailable,
  readBranches,
  readGitHubTasks,
  readGitLabTasks,
  readLastCommitTimes,
  readLocalTasks,
  ticketComments,
  workingTree,
  type GitFacts,
  type Tree,
} from '@binnacle/adapters';
import {
  boardColumn,
  currentEpic,
  nextAction,
  nextActionAttention,
  parseRoadmap,
  resolveDependencies,
  roadmapAttention,
  startCommand,
  suggestedStep,
  taskBranch,
  taskRoles,
  type Alternative,
  type Diagnostic,
  type Epic,
  type Impact,
  type NextAction,
  type ObservedRun,
  type ProjectManifest,
  type Question,
  type ResolvedTask,
  type Roadmap,
  type TaskReading,
  type TaskRoles,
  type TaskState,
  type TrackerTask,
} from '@binnacle/core';
import { ciAttention, fromForge, readCi, type Ci } from './ci.ts';
import { resolveGitTimeout, trackerToken } from './home.ts';
import { defaultCommit, impactSection, touchedBy, type GraphSection } from './graph.ts';
import { parallelLimit, type ParallelLimit } from './settings.ts';
import { vaultAttention } from './vault.ts';
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
type InFlight = 'ACTIVE' | 'BLOCKED' | 'READY_FOR_REVIEW' | 'APPROVED' | 'MERGE_READY';

export type SnapshotTask = Pick<ResolvedTask, 'id' | 'title' | 'state' | 'unmetDependencies' | 'ticket'>;
export type Section = { items: SnapshotTask[]; remainder: number };
/**
 * How many questions a Task's ticket asks (`readQuestions`), and how many of them are unanswered;
 * null where its questions could not be read: a GitHub or GitLab issue whose comments failed, or a
 * closed GitLab issue, whose notes are not read.
 */
export type QuestionCount = { asked: number; unanswered: number } | null;
/** A Task item of the snapshot, which counts its questions. */
export type CountedTask = SnapshotTask & { questions: QuestionCount };
/**
 * A section whose Tasks each carry the command that starts them (`startCommand`), or null when
 * there is none, and their roles with Binnacle's suggestions (`taskRoles`).
 */
export type SectionWithStart = { items: (CountedTask & { start: string | null; roles: TaskRoles })[]; remainder: number };

/** A Task's questions, each with its answer or null, and the branch they were read from, null for the checkout's ticket. */
export type TaskQuestions = { branch: string | null; items: Question[] };

/** An unanswered question, with its Task and the branch it was read from, null for the checkout's ticket. */
export type PendingQuestion = Pick<SnapshotTask, 'id' | 'title' | 'ticket'> & { question: string; branch: string | null };

/**
 * *Waiting for the owner*: what only the owner can move. `questions`, every unanswered question of a Task neither `DONE` nor `CANCELLED`, in
 * tracker order and then the ticket's, unavailable with the reason when such a Task's questions could not be read; `approvals`, the
 * Tasks in `READY_FOR_REVIEW`, which the owner approves by changing their status; `owner`, the
 * Tasks triaged `ready-for-human` and ready to start, as the snapshot's Ready to start reads it.
 */
export type PendingDecisions = {
  questions: { items: PendingQuestion[]; remainder: number } | Unavailable;
  approvals: { items: CountedTask[]; remainder: number };
  owner: { items: CountedTask[]; remainder: number };
};

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

/**
 * An epic with its Tasks done out of all of them, `CANCELLED` left out: null without a spec,
 * or when the Tasks cannot be read.
 */
export type EpicWithProgress = Epic & { progress: { done: number; all: number } | null };

/** A section Binnacle cannot fill. It is present and says why, and is never filled with a guess (ADR-0007). */
export type Unavailable = { available: false; reason: string };

export type Snapshot = {
  project: ProjectRow;
  checkout: CallerCheckout['checkout'];
  /** The facts of the caller's checkout, as `project.status` gives them. */
  git: GitFacts;
  /** Null when there is no roadmap to read: without a readable manifest, or with a diagnostic. */
  roadmap: {
    epics: EpicWithProgress[];
    /** The current epic, as `currentEpic` reads it. */
    current: EpicWithProgress | null;
    /** `## Current focus` as written, cut at `FOCUS_LIMIT`; `truncated` says whether it was. */
    focus: { text: string; truncated: boolean } | null;
    /** Every other `##` section, by heading only. */
    sections: string[];
  } | null;
  /**
   * What to do next (ADR-0032): the roadmap's Next action, null when its focus does not end with
   * one, and beside it Binnacle's Suggested step as up to three alternatives, none when no rule
   * applies or every one agrees with the Next action, and unavailable, with the tracker's reason,
   * when the Tasks cannot be read.
   */
  next: { action: NextAction | null; alternatives: Alternative[] | Unavailable };
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
     * How many Tasks may be worked on at once: the Parallel limit with its mode and its source
     * (`parallelLimit`), the Tasks in flight, and what is left of the limit, never below zero: of one
     * under *auto* while `impact` is unavailable.
     * Binnacle's calculation. `impact` is the
     * conflict risk between the Tasks in flight and ready to start, read against the graph,
     * and unavailable, with the graph's reason, without one, or when `graph.json` cannot be read as a graph.
     */
    parallel: ParallelLimit & { inProgress: number; free: number; provenance: 'calculated'; impact: Impact | Unavailable };
  } | null;
  /**
   * The most recently committed ADRs; one never committed counts as the most recent, and
   * without Git they go by path. Null when the project declares no ADR directory.
   */
  decisions: { items: { title: string | null; path: string }[]; remainder: number } | null;
  /** How fresh the Graphify graph is, read from the daemon's recorded runs (ADR-0036). */
  graph: GraphSection;
  /** *Waiting for the owner*; unavailable, with the tracker's reason, when the Tasks cannot be read. */
  pendingDecisions: PendingDecisions | Unavailable;
  /**
   * CI as the forge reports it now: the default branch's latest commit and the open pull
   * requests, each with the Task its branch maps to; unavailable with the reason when there is
   * no forge or it cannot be read.
   */
  ci: Ci | Unavailable;
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
  graph: { graph: GraphSection; attention: Diagnostic[] },
  usageAndActivity: (tasks: TrackerTask[] | Unavailable) => Promise<Pick<Snapshot, 'usage' | 'activity'> & { runs: ObservedRun[]; attention: Diagnostic[] }>,
): Promise<Snapshot> {
  const tree = workingTree(caller.project);
  // The forge is read while the tracker is.
  const forge = readCi(home, projected.manifest, caller.git, SECTION_LIMIT);
  const { tasks, unreadable, roadmap, adrs, attention } = await readState(home, tree, projected, diagnostics);
  const ci = (await forge)(tasks);
  attention.push(...ciAttention(ci));
  const { usage: usageSection, activity, runs, attention: pressure } = await usageAndActivity(tasks ?? trackerUnavailable(unreadable));
  const workflow = projected.manifest?.workflow.provider ?? null;
  // A harness whose artifacts cannot be read is at level 1, and says why.
  for (const { level, reason } of usageSection.harnesses) if (level === 1 && reason !== null) attention.push({ code: 'telemetry.unreadable', message: reason });
  const limit = parallelLimit(home, projected.manifest);
  attention.push(...pressure, ...graph.attention, ...vaultAttention(home), ...limit.attention);
  const attributed = new Set(runs.flatMap((run) => run.taskId ?? []));
  const questions = tasks && (await readQuestions(projected.row.path, projected.manifest, tasks));
  const listed = tasks && taskSections(tasks, attributed);
  const impact = listed && (await impactSection(projected.row.path, graph.graph, listed.inFlightAndReady, projected.manifest?.tracker.provider !== 'local'));
  const sections = listed && impact && questions && withStartAndParallel(listed, limit.parallel, impact, questions);
  const action = nextAction(roadmap?.focus ?? null);
  const epics = roadmap && roadmap.epics.map((epic): EpicWithProgress => {
    const own = tasks && epic.spec !== null ? tasks.filter((task) => task.specSlug === epic.spec && task.state !== 'CANCELLED') : null;
    return { ...epic, progress: own && { done: own.filter((task) => task.state === 'DONE').length, all: own.length } };
  });

  return {
    project: projected.row,
    checkout: caller.checkout,
    git: caller.git,
    roadmap: roadmap && epics && { ...roadmap, epics, current: currentEpic(epics), focus: roadmap.focus == null ? null : cut(roadmap.focus, FOCUS_LIMIT) },
    next: {
      action,
      alternatives:
        tasks && sections ? suggestedStep(roadmap?.epics ?? null, tasks, runs, { workflow, free: sections.parallel.free, next: action, impact: impact?.available ? impact : null }) : trackerUnavailable(unreadable),
    },
    tasks: sections,
    decisions: adrs && (await recentDecisions(tree, caller.project, adrs)),
    graph: graph.graph,
    pendingDecisions: tasks && questions ? pendingDecisions(tasks, attributed, questions) : trackerUnavailable(unreadable),
    ci,
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
  if (roadmap && tasks) attention.push(...roadmapAttention(roadmap.epics, tasks, await readSpecs(tree, manifest)));
  if (roadmap) attention.push(...nextActionAttention(roadmap, tasks));
  // Only the local tracker reads a Review; a remote one never reads the comments that would hold it.
  // A ready-for-human Task is the owner's to do, such as a demonstration, which no review follows.
  if (tasks && manifest?.tracker.provider === 'local') {
    for (const task of tasks) {
      if (task.state === 'DONE' && task.review === null && task.triage !== 'ready-for-human') {
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
 * `home` is the Binnacle home, where a remote tracker's credentials are. A remote tracker's
 * Tasks are kept for a while, as CI is (`fromForge`).
 */
export async function readTracker(home: string, tree: Tree, manifest: ProjectManifest | null): Promise<TaskReading> {
  const tracker = manifest?.tracker;
  if (tracker?.provider === 'local' && tracker.local.issues !== null) return readLocalTasks(tree, tracker.local.issues);
  if ((tracker?.provider === 'github' || tracker?.provider === 'gitlab') && tracker.repository !== null) {
    // A credentials problem reads nothing: the token that would have been used is unknown.
    const credential = trackerToken(home, tracker.provider, tracker.host);
    if ('failure' in credential) return { tasks: null, diagnostics: [credential.failure] };
    const { provider, host, repository } = tracker;
    const read = provider === 'github' ? readGitHubTasks : readGitLabTasks;
    return fromForge(['tasks', provider, host, repository, credential.token], () => read(repository, host, credential.token), (answer) => answer.tasks !== null);
  }
  return { tasks: null, diagnostics: [{ code: 'tracker.unavailable', message: unavailable(tracker) }] };
}

function unavailable(tracker: ProjectManifest['tracker'] | undefined): string {
  if (tracker === undefined) return 'Tasks cannot be read without a readable manifest.';
  if (tracker.provider === null) return 'This project declares no tracker.provider.';
  if (tracker.provider === 'local') return 'tracker.provider is local, and this project declares no tracker.local.issues.';
  return `tracker.provider is ${tracker.provider}, and this project declares no tracker.repository.`;
}

/**
 * `attributed` holds the ids of the Tasks with AgentRuns attributed to them, which the board's rule
 * reads (`boardColumn`). `inFlightAndReady` is every Task in flight and ready to start, none left out.
 */
export function taskSections(
  tasks: ResolvedTask[],
  attributed: ReadonlySet<string>,
): { inFlight: Section; readyToStart: Section; counts: TaskCounts; inFlightAndReady: ResolvedTask[] } {
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
  return { inFlight: section(listedInFlight), readyToStart: section(readyToStart), counts, inFlightAndReady: [...listedInFlight, ...readyToStart] };
}

/**
 * The snapshot's sections, each Task with its start command
 * and its roles read against `impact`, and the parallel capacity under `limit`.
 */
function withStartAndParallel(
  { inFlight, readyToStart, counts, inFlightAndReady }: ReturnType<typeof taskSections>,
  limit: ParallelLimit,
  impact: Impact | Unavailable,
  questions: ReadQuestions,
): NonNullable<Snapshot['tasks']> {
  const byId = new Map(inFlightAndReady.map((task) => [task.id, task]));
  const startable = ({ items, remainder }: Section): SectionWithStart => ({
    items: items.map((task) => ({
      ...task,
      questions: questionCount(questions, task.id),
      start: startCommand(task),
      roles: taskRoles(byId.get(task.id)!, touchedBy(impact, task.id)),
    })),
    remainder,
  });
  const inProgress = inFlight.items.length + inFlight.remainder;
  // *auto* runs one Task at a time while no graph assesses the conflict risk (ADR-0041).
  const room = limit.mode === 'auto' && !impact.available ? 1 : limit.limit;
  return {
    inFlight: startable(inFlight),
    readyToStart: startable(readyToStart),
    counts,
    parallel: { ...limit, inProgress, free: Math.max(0, room - inProgress), provenance: 'calculated', impact },
  };
}

/** In tracker order, which the adapter makes stable. */
export function section(tasks: ResolvedTask[]): Section {
  return limited(tasks.map(snapshotTask));
}

const snapshotTask = ({ id, title, state, unmetDependencies, ticket }: ResolvedTask): SnapshotTask => ({ id, title, state, unmetDependencies, ticket });

/** Every Task's questions by id (`readQuestions`), or why its own could not be read. */
export type ReadQuestions = Map<string, TaskQuestions | Unavailable>;

/**
 * Each Task's questions and answers (ADR-0040). On the local tracker, from its ticket at the tip of
 * its branch (`taskBranch`) while that is a local branch of the registered repository at
 * `projectPath` and not merged into the default branch, `origin/HEAD`'s or else `main`, as usage
 * reads it; otherwise the Task's own, as `tasks` were read: on GitHub or GitLab, from its issue's
 * comments, or why they could not be. A repository with no such default branch, a branch without
 * the ticket, or a Git that cannot say gives the Task's own. The branches and the default branch
 * are read once, whatever the number of Tasks.
 */
export async function readQuestions(projectPath: string, manifest: ProjectManifest | null, tasks: TrackerTask[]): Promise<ReadQuestions> {
  const read: ReadQuestions = new Map(tasks.map((task) => [task.id, Array.isArray(task.questions) ? { branch: null, items: task.questions } : task.questions]));
  if (manifest?.tracker.provider !== 'local') return read;
  const timeout = resolveGitTimeout();
  try {
    const [branches, base] = await Promise.all([readBranches(projectPath, timeout), defaultCommit(projectPath)]);
    if (branches === null || base === null) return read;
    await Promise.all(
      tasks.map(async (task) => {
        const branch = taskBranch(task, false);
        const tip = branches.get(branch);
        if (tip === undefined || (await isAncestor(projectPath, tip, base, timeout))) return;
        const text = await commitTree(projectPath, tip, timeout).read(task.ticket);
        if (text !== null) read.set(task.id, { branch, items: ticketComments(text).questions });
      }),
    );
  } catch (error) {
    if (!isGitUnavailable(error)) throw error;
  }
  return read;
}

/** How many questions the Task `id` has, and how many are unanswered; null where they could not be read. */
export function questionCount(questions: ReadQuestions, id: string): QuestionCount {
  const read = questions.get(id) ?? { branch: null, items: [] };
  if (!('items' in read)) return null;
  return { asked: read.items.length, unanswered: read.items.filter((item) => item.answer === null).length };
}

/**
 * *Waiting for the owner* over `tasks`; `attributed` holds the ids of the Tasks with AgentRuns
 * attributed to them, which a `ready-for-human` Task has none of when it is ready to start.
 */
export function pendingDecisions(tasks: ResolvedTask[], attributed: ReadonlySet<string>, questions: ReadQuestions): PendingDecisions {
  const counted = (task: ResolvedTask): CountedTask => ({ ...snapshotTask(task), questions: questionCount(questions, task.id) });
  const ready = (task: ResolvedTask): boolean => boardColumn(task.state, attributed.has(task.id))?.column === 'ready' && task.unmetDependencies.length === 0;
  // A closed Task's question waits for no one: no answer moves it.
  const open = tasks.filter((task) => task.state !== 'DONE' && task.state !== 'CANCELLED').map((task) => ({ task, read: questions.get(task.id)! }));
  const unread = open.find(({ read }) => !('items' in read))?.read as Unavailable | undefined;
  return {
    questions:
      unread ??
      limited(
        open.flatMap(({ task: { id, title, ticket }, read }) => {
          const { branch, items } = read as TaskQuestions;
          return items.filter((item) => item.answer === null).map((item) => ({ id, title, ticket, question: item.text, branch }));
        }),
      ),
    approvals: limited(tasks.filter((task) => task.state === 'READY_FOR_REVIEW').map(counted)),
    owner: limited(tasks.filter((task) => task.triage === 'ready-for-human' && ready(task)).map(counted)),
  };
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
export async function readRoadmap(tree: Tree, manifest: ProjectManifest | null, attention: Diagnostic[]): Promise<Roadmap | null> {
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

/**
 * Every `<knowledge.specs>/<slug>/spec.md`: specs live in Git whatever the tracker (ADR-0017), and
 * `knowledge.specs` is their directory, the local tracker's own. None when the project declares none.
 */
async function readSpecs(tree: Tree, manifest: ProjectManifest | null): Promise<{ slug: string; path: string }[]> {
  const dir = manifest?.knowledge.specs ?? null;
  if (dir === null) return [];
  const slugs = ((await tree.list(dir)) ?? []).filter((entry) => entry.directory).map((entry) => entry.name);
  const hasSpec = async (slug: string): Promise<boolean> => ((await tree.list(posix.join(dir, slug))) ?? []).some((entry) => !entry.directory && entry.name === 'spec.md');
  const found = await Promise.all(slugs.map(hasSpec));
  return slugs.filter((_, index) => found[index]).map((slug) => ({ slug, path: posix.join(dir, slug, 'spec.md') }));
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
