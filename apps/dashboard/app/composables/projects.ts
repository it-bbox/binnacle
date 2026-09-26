import type { InjectionKey, Ref } from 'vue';
import { call, DaemonError, type Failure } from './daemon';
import type { SnapshotUsage } from './usage';

/** The parts of `project.list` and `project.snapshot` the Overview and Projects pages render. */

export type ProjectRow = { id: string | null; name: string | null; path: string; unavailable: string | null };

export type Epic = { number: number; title: string; status: string; spec: string | null };

type GitFacts =
  | { available: true; branch: string | null; detached: boolean; commit: string | null; dirty: boolean }
  | { available: false; reason: string };

export type SnapshotTask = { id: string; title: string | null; state: string | null; unmetDependencies: string[]; start: string | null };
export type Section<T> = { items: T[]; remainder: number };

/** How many a section holds: the items it lists and the remainder it leaves out. */
export const count = (section: Section<unknown>): number => section.items.length + section.remainder;

export type Unavailable = { available: false; reason: string };

/** A run as the snapshot's `activity` gives it. */
export type Run = {
  id: string;
  taskId: string | null;
  taskTitle: string | null;
  role: string;
  harness: string;
  model: string | null;
  branch: string | null;
  checkout: string | null;
  lastActivityAt: string;
};

export type Activity = { running: { items: Run[]; remainder: number }; recent: Run[] };

/** Binnacle's Suggested step, which it labels as its calculation (ADR-0032). */
export type SuggestedStep = { description: string; command: string | null; task: string | null; provenance: 'calculated' };

export type Snapshot = {
  git: GitFacts;
  roadmap: { epics: Epic[] } | null;
  next: { action: { description: string; command: string } | null; suggested: SuggestedStep | null | Unavailable };
  tasks: {
    inFlight: Section<SnapshotTask>;
    readyToStart: Section<SnapshotTask>;
    /** Every Task not listed by name, by state. */
    counts: Record<string, number>;
    /** How many Tasks may be worked on at once, Binnacle's calculation. */
    parallel: { limit: number; inProgress: number; free: number; provenance: 'calculated' };
  } | null;
  activity: Activity | Unavailable;
  usage: SnapshotUsage;
  attention: Failure[];
};

export type ProjectView = { project: ProjectRow; snapshot: Snapshot | null; failure: Failure | null };

/** The shell's view of the selected project, which it polls for the rail and the sidebar; a page reads it rather than polling the snapshot again. */
export const SELECTED_VIEW: InjectionKey<Ref<ProjectView | null>> = Symbol('selected project');

/** `task.list`'s board: one epic's Tasks in four columns. */
export type LatestRun = { harness: string; model: string | null; role: string; lastActivityAt: string; active: { value: boolean } };
export type Card = { id: string; title: string | null; state: string | null; source: 'state' | 'runs' | null; unmetDependencies: string[]; review: boolean | null; latestRun: LatestRun | null };
export type Board = {
  epic: Epic | null;
  spec: string | null;
  columns: Record<'backlog' | 'ready' | 'inProgress' | 'done', Section<Card>>;
  unknown: Section<Card & { diagnostic: Failure | null }>;
  cancelled: number;
  withoutSpec: number;
};

/** Every registered project, with its snapshot read from its registered checkout. */
export async function loadProjects(): Promise<ProjectView[]> {
  const { projects } = await call<{ projects: ProjectRow[] }>('project.list');
  return await Promise.all(
    projects.map(async (project): Promise<ProjectView> => {
      if (project.unavailable !== null) return { project, snapshot: null, failure: null };
      try {
        return { project, snapshot: await call<Snapshot>('project.snapshot', { path: project.path }), failure: null };
      } catch (error) {
        if (!(error instanceof DaemonError)) throw error;
        return { project, snapshot: null, failure: { code: error.code, message: error.message } };
      }
    }),
  );
}

export const projectName = (project: ProjectRow): string => project.name ?? project.id ?? project.path;

/** The first epic not done, as the roadmap lists them. */
export function position(snapshot: Snapshot): string {
  if (snapshot.roadmap === null) return 'No roadmap';
  const current = snapshot.roadmap.epics.find((epic) => epic.status !== 'done');
  if (current === undefined) return snapshot.roadmap.epics.length === 0 ? 'No epics' : 'Every epic is done';
  return `Epic ${current.number}, ${current.title}: ${current.status}`;
}

export function checkout(git: GitFacts): string {
  if (!git.available) return `Git unavailable: ${git.reason}`;
  const head = git.detached ? 'detached HEAD' : (git.branch ?? 'no branch');
  return `${head} at ${git.commit?.slice(0, 12) ?? 'no commits'}, ${git.dirty ? 'dirty' : 'clean'}`;
}

export const isUnavailable = (section: object): section is Unavailable => 'available' in section;

/** How the pages label a run as running: `active` is the daemon's reading, within telemetry's recency. */
export const RUNNING_READING = "Running means active in the last ten minutes, Binnacle's reading of the latest activity, not a state the harness reports.";

/** The run's Task, or its role when it has none. */
export const runSubject = (run: Run): string =>
  run.taskId === null ? `No Task, ${run.role} role` : `${run.taskId}${run.taskTitle === null ? '' : `: ${run.taskTitle}`}`;

/** How long ago `timestamp` was, as a person says it. */
export function ago(timestamp: string): string {
  const minutes = Math.floor((Date.now() - Date.parse(timestamp)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return new Date(timestamp).toLocaleDateString('en');
}

/** The latest run's activity: the first running one, or the latest recent one. */
export function latestActivity(activity: Snapshot['activity']): string {
  if (isUnavailable(activity)) return `Not available: ${activity.reason}`;
  const run = activity.running.items[0] ?? activity.recent[0];
  return run === undefined ? 'No runs observed' : `${ago(run.lastActivityAt)}, ${runSubject(run)}`;
}
