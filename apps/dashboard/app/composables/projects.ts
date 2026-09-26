import { call, DaemonError, type Failure } from './daemon';

/** The parts of `project.list` and `project.snapshot` the Overview and Projects pages render. */

export type ProjectRow = { id: string | null; name: string | null; path: string; unavailable: string | null };

type Epic = { number: number; title: string; status: string };

type GitFacts =
  | { available: true; branch: string | null; detached: boolean; commit: string | null; dirty: boolean }
  | { available: false; reason: string };

export type SnapshotTask = { id: string; title: string | null; state: string | null; start: string | null };
type Unavailable = { available: false; reason: string };

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

export type Snapshot = {
  git: GitFacts;
  roadmap: { epics: Epic[] } | null;
  tasks: { readyToStart: { items: SnapshotTask[]; remainder: number } } | null;
  activity: Activity | Unavailable;
  attention: Failure[];
};

export type ProjectView = { project: ProjectRow; snapshot: Snapshot | null; failure: Failure | null };

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
