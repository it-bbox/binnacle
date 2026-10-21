import type { Params } from '@binnacle/core';
import type { InjectionKey, Ref } from 'vue';
import { call, DaemonError, type Failure } from './daemon';
import { daemonSaid, type Dictionary, type Language } from '~/i18n';
import type { SnapshotUsage } from './usage';

/** The parts of `project.list` and `project.snapshot` the pages render. */

/** `gone`: the registered directory no longer exists, which the daemon tells apart from a manifest it cannot read. */
export type ProjectRow = { id: string | null; name: string | null; path: string; unavailable: string | null; gone: boolean };

export type Epic = { number: number; title: string; status: string; spec: string | null };
/** An epic as the snapshot lists it: with its Tasks done out of all, `CANCELLED` left out; null without a spec or when the Tasks cannot be read. */
export type EpicWithProgress = Epic & { progress: { done: number; all: number } | null };

type GitFacts =
  | { available: true; branch: string | null; detached: boolean; commit: string | null; dirty: boolean }
  | { available: false; reason: string; code: string; params: Params };

export type SnapshotTask = { id: string; title: string | null; state: string | null; unmetDependencies: string[]; start: string | null };
export type Section<T> = { items: T[]; remainder: number };

/** How many a section holds: the items it lists and the remainder it leaves out. */
export const count = (section: Section<unknown>): number => section.items.length + section.remainder;

/** A section the daemon cannot fill, with why; `code` and `params`, when it has them, word the reason in the page's language. */
export type Unavailable = { available: false; reason: string; code?: string; params?: Params };

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

/** One of the Suggested step's alternatives, Binnacle's calculation (ADR-0032); the page writes its title and reason from `kind` and `tasks`. */
export type Alternative = {
  kind: 'wait' | 'parallel' | 'resume' | 'autopilot' | 'byHand' | 'owner' | 'blocked' | 'close' | 'plan' | 'finished';
  tasks: string[];
  command: string | null;
  provenance: 'calculated';
};

/** The conflict risk between the Tasks in flight and ready to start, Binnacle's calculation against the graph. */
export type ConflictRisk = 'high' | 'medium' | 'low' | 'unknown';
/** The Parallel limit as `parallel.get` and the snapshot's `tasks.parallel` give it (ADR-0041). */
export type ParallelLimit = { limit: number; mode: 'number' | 'auto'; source: 'manifest' | 'machine' | 'default' };

export type Impact = {
  available: true;
  tasks: { id: string; modules: string[]; from: 'branch' | 'ticket'; provenance: 'calculated' }[];
  pairs: { tasks: [string, string]; risk: ConflictRisk; modules: string[]; reason: string; provenance: 'calculated' }[];
  provenance: 'calculated';
};

/** How fresh the Graphify graph the daemon keeps is. */
export type GraphSection = {
  available: boolean;
  reason: string | null;
  code?: string;
  params?: Params;
  builtFrom: { commit: string; at: string } | null;
  behind: boolean | null;
  lastRun: { commit: string; at: string; outcome: 'built' | 'failed'; reason: string | null } | null;
};

export type Snapshot = {
  git: GitFacts;
  /** `current` is the current epic as the daemon names it (`docs/04-telemetry-dashboard.md`). */
  roadmap: { epics: EpicWithProgress[]; current: EpicWithProgress | null } | null;
  next: { action: { description: string; command: string } | null; alternatives: Alternative[] | Unavailable };
  tasks: {
    inFlight: Section<SnapshotTask>;
    readyToStart: Section<SnapshotTask>;
    /** Every Task not listed by name, by state. */
    counts: Record<string, number>;
    /** How many Tasks may be worked on at once, Binnacle's calculation. */
    parallel: ParallelLimit & { inProgress: number; free: number; provenance: 'calculated'; impact: Impact | Unavailable };
  } | null;
  graph: GraphSection;
  activity: Activity | Unavailable;
  usage: SnapshotUsage;
  /** Autostart for the daemon's own home (ADR-0043), with the command that changes it. */
  autostart: { state: 'on' | 'off' | 'broken'; platform: string; home: string; command: string } | Unavailable;
  attention: Failure[];
};

export type ProjectView = { project: ProjectRow; snapshot: Snapshot | null; failure: Failure | null };

/** How many attention items a project has, none when its snapshot cannot be read. */
export const attentionCount = (view: ProjectView): number => view.snapshot?.attention.length ?? 0;

/** The shell's view of every registered project, which the Projects and Attention pages read rather than poll again. */
export const PROJECT_VIEWS: InjectionKey<Ref<ProjectView[] | null>> = Symbol('registered projects');

/** The shell's view of the selected project, which it polls for the rail and the sidebar; a page reads it rather than polling the snapshot again. */
export const SELECTED_VIEW: InjectionKey<Ref<ProjectView | null>> = Symbol('selected project');

/** `task.list`'s board: one epic's Tasks in four columns. */
export type LatestRun = { harness: string; model: string | null; role: string; startedAt: string; lastActivityAt: string; active: { value: boolean } };
export type Card = { id: string; title: string | null; state: string | null; source: 'state' | 'runs' | null; unmetDependencies: string[]; review: boolean | null; questions: { asked: number; unanswered: number } | null; latestRun: LatestRun | null };
export type Board = {
  epic: Epic | null;
  spec: string | null;
  columns: Record<'backlog' | 'ready' | 'inProgress' | 'done', Section<Card>>;
  unknown: Section<Card & { diagnostic: Failure | null }>;
  cancelled: number;
  withoutSpec: number;
};

/**
 * Every registered project, with its snapshot read from its registered checkout when `read`
 * says so for its path, and otherwise kept from `previous`, or none yet when `previous` holds none.
 */
export async function loadProjects(previous: ProjectView[] | null, read: (path: string) => boolean): Promise<ProjectView[]> {
  const { projects } = await call<{ projects: ProjectRow[] }>('project.list');
  return await Promise.all(
    projects.map(async (project): Promise<ProjectView> => {
      if (project.unavailable !== null) return { project, snapshot: null, failure: null };
      const known = previous?.find((view) => view.project.path === project.path);
      if (!read(project.path)) return { snapshot: null, failure: null, ...known, project };
      try {
        return { project, snapshot: await call<Snapshot>('project.snapshot', { path: project.path }), failure: null };
      } catch (error) {
        if (!(error instanceof DaemonError)) throw error;
        return { project, snapshot: null, failure: { code: error.code, message: error.message, ...(error.params && { params: error.params }) } };
      }
    }),
  );
}

/** The command that removes a registration, its path quoted for a POSIX shell. */
export const unregisterCommand = (path: string): string => `binn project unregister '${path.replaceAll("'", "'\\''")}'`;

export const projectName = (project: ProjectRow): string => project.name ?? project.id ?? project.path;

/** Up to two initials of a project: the first letters of its name's first two words. */
export function initials(project: ProjectRow): string {
  const name = projectName(project);
  return (name.split('/').at(-1) ?? name)
    .split(/[\s\-_./]+/)
    .filter((word) => word !== '')
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

export const isUnavailable = (section: object): section is Unavailable => 'available' in section && section.available === false;

/** The registered checkout's Git state in one line: its head, commit, and whether it is clean. */
export function gitLine(git: GitFacts, t: Dictionary, language: Language): string {
  if (!git.available) return `${t.gitUnavailable} ${daemonSaid(language, git).text}`;
  const head = git.detached ? t.detachedHead : (git.branch ?? t.noBranch);
  return [head, git.commit?.slice(0, 12) ?? t.noCommits, git.dirty ? t.dirty : t.clean].join(' · ');
}

/** A Task's state, a roadmap status or a ticket's role in the page's language, or as written when the dictionary has no word for it. */
export const said = (words: Record<string, string>, value: string): string => words[value] ?? value;

/** A run's role in the page's language. */
export const runRole = (t: Dictionary, role: string): string =>
  ({ product: t.roleProduct, implementation: t.roleImplementation, review: t.roleReview, rework: t.roleRework, unknown: t.roleUnknown })[role] ?? role;

/** A roadmap status as a badge: done is quiet, in progress is the accent, the rest are outlined. */
export const statusBadge = (status: string) =>
  status === 'done'
    ? { color: 'neutral' as const, variant: 'soft' as const }
    : status === 'in progress'
      ? { color: 'primary' as const, variant: 'soft' as const }
      : { color: status === 'not started' ? ('neutral' as const) : ('primary' as const), variant: 'outline' as const };

/** A commit's CI state, as the forge reports it. */
export type CiState = { value: 'passing' | 'failing' | 'running' | 'none'; provenance: 'provider_reported' };
/** Where CI is read from, as the snapshot's `ci` and the brief's `request` name it. */
export type CiForge = { provider: 'github' | 'gitlab'; host: string; repository: string; from: 'tracker' | 'remote' };
/** An open pull or merge request with its head's CI state, as the `ci` section lists it and the brief's `request` gives it. */
export type CiRequest = { number: number; title: string; branch: string; draft: boolean; state: CiState; url: string };
/** How each CI state is coloured: a failing one warns. */
export const CI_TONE: Record<CiState['value'], string> = { passing: 'text-success', failing: 'text-error', running: 'text-warning', none: 'text-dimmed' };
export const forgeName = (forge: CiForge): string => (forge.provider === 'github' ? 'GitHub' : 'GitLab');
