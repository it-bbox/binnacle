import { call, DaemonError, type Failure } from './daemon';

/** The parts of `project.list` and `project.snapshot` the Overview and Projects pages render. */

export type ProjectRow = { id: string | null; name: string | null; path: string; unavailable: string | null };

type Epic = { number: number; title: string; status: string };

type GitFacts =
  | { available: true; branch: string | null; detached: boolean; commit: string | null; dirty: boolean }
  | { available: false; reason: string };

export type SnapshotTask = { id: string; title: string | null; state: string | null; start: string | null };

export type Snapshot = {
  git: GitFacts;
  roadmap: { epics: Epic[] } | null;
  tasks: { readyToStart: { items: SnapshotTask[]; remainder: number } } | null;
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
