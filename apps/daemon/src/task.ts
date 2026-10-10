import type { Tree } from '@binnacle/adapters';
import { sharedBranch, startCommand, taskBranch, type Diagnostic, type ProjectManifest, type TaskRole, type TaskRoles, type TaskState, type TrackerTask } from '@binnacle/core';
import { OperationError } from './errors.ts';
import type { Totals } from '@binnacle/telemetry';
import { cut, readQuestions, readTracker, type TaskQuestions, type Unavailable } from './snapshot.ts';

/** In characters: Unicode code points. */
export const BODY_LIMIT = 8000;

const REVIEW_UNAVAILABLE: Unavailable = {
  available: false,
  reason: 'Binnacle reads an issue’s body and never its comments, so no Review is read on GitHub or GitLab.',
};

/**
 * The task brief (`task.get`): what a session needs to start one Task, and nothing more. It
 * is read now, from the caller's checkout on the local tracker, and nothing is stored.
 */
export type TaskBrief = Pick<TrackerTask, 'id' | 'title' | 'state' | 'triage' | 'ticket' | 'spec'> & {
  /**
   * Each declared dependency, in the order declared; met when its Task is `DONE`. A dangling one
   * names no known Task: it has no title or state, and `met` is null, since it is neither met
   * nor unmet, as the snapshot never counts it as unmet.
   */
  dependencies: { id: string; title: string | null; state: TaskState | null; met: boolean | null; dangling: boolean }[];
  /** The ticket body without its header or comments, cut at `BODY_LIMIT`; `truncated` says whether it was. */
  body: { text: string; truncated: boolean };
  branch: string;
  /** The command that starts it in a fresh session (`startCommand`), or null when there is none. */
  start: string | null;
  /**
   * The ticket's Review, cut at `BODY_LIMIT` as the body is; null when the ticket records none.
   * Unavailable on a remote tracker, whose comments are never read.
   */
  review: { text: string; truncated: boolean } | Unavailable | null;
  /**
   * The ticket's questions, each with its answer or null (`taskQuestions`), and the branch they
   * were read from, null for the caller's checkout. Unavailable on a remote tracker.
   */
  questions: TaskQuestions | Unavailable;
  /** The roles it needs, and beside them Binnacle's suggestions, read against the graph (`taskRoles`). */
  roles: TaskRoles;
  /** `task.shared_branch` when another Task has the same branch, which then credits neither. */
  diagnostics: Diagnostic[];
  /** Its usage by role over everything ingested, as `usage.get` gives it for the Task. */
  byRole: Record<TaskRole, Totals>;
  /** Why its rework is not read, on GitHub or GitLab, as `usage.get` gives it; null when it is. */
  reworkUnread: string | null;
};

/** The brief of `task`, one of `tasks`, the tracker's, which `findTask` read, with its usage by role and its roles. */
export function taskBrief(
  { tasks, task }: { tasks: TrackerTask[]; task: TrackerTask },
  manifest: ProjectManifest | null,
  { byRole, reworkUnread, questions, roles }: Pick<TaskBrief, 'byRole' | 'reworkUnread' | 'questions' | 'roles'>,
): TaskBrief {
  const byId = new Map(tasks.map((known) => [known.id, known]));
  const remote = manifest?.tracker.provider !== 'local';
  const shared = sharedBranch(task, tasks, remote);

  return {
    id: task.id,
    title: task.title,
    state: task.state,
    triage: task.triage,
    ticket: task.ticket,
    spec: task.spec,
    dependencies: task.blockedBy.map((dependency) => {
      const known = byId.get(dependency);
      return known
        ? { id: dependency, title: known.title, state: known.state, met: known.state === 'DONE', dangling: false }
        : { id: dependency, title: null, state: null, met: null, dangling: true };
    }),
    body: cut(task.body, BODY_LIMIT),
    branch: taskBranch(task, remote),
    start: startCommand(task, manifest?.workflow.provider ?? null),
    review: remote ? REVIEW_UNAVAILABLE : task.review === null ? null : cut(task.review, BODY_LIMIT),
    questions,
    roles,
    diagnostics: shared ? [shared] : [],
    byRole,
    reworkUnread,
  };
}

/** A Task's questions and answers, read as the snapshot reads every Task's (`readQuestions`). */
export async function taskQuestions(projectPath: string, manifest: ProjectManifest | null, task: TrackerTask): Promise<TaskBrief['questions']> {
  const read = await readQuestions(projectPath, manifest, [task]);
  return read instanceof Map ? read.get(task.id)! : read;
}

/**
 * The tracker's Tasks and the one `id` names: `<spec-slug>/<NN>` on the local tracker and
 * `#<number>` or `<number>` on a remote one; the ticket number is compared, so `epic/6` is
 * `epic/06`. An id the tracker does not hold is `task.not_found`; a tracker that cannot be
 * read is an error with its own code.
 */
export async function findTask(home: string, tree: Tree, manifest: ProjectManifest | null, id: string): Promise<{ tasks: TrackerTask[]; task: TrackerTask }> {
  const { tasks, diagnostics } = await readTracker(home, tree, manifest);
  // A missing issues directory reads as no Tasks, which the snapshot and the daily need; here it is a broken tracker, not a typo.
  const failure = diagnostics.find((item) => tasks === null || item.code === 'tracker.issues_missing');
  if (failure || tasks === null) throw new OperationError(failure?.code ?? 'tracker.unavailable', failure?.message ?? 'The tracker cannot be read.', 503);

  const task = tasks.find((known) => known.id === normalized(id));
  if (!task) throw new OperationError('task.not_found', `This project's tracker holds no Task ${JSON.stringify(id)}.`, 404);
  return { tasks, task };
}

function normalized(id: string): string {
  const remote = /^#?(\d+)$/.exec(id);
  if (remote) return `#${Number(remote[1])}`;
  const local = /^(.+)\/(\d+)$/.exec(id);
  return local ? `${local[1]}/${String(Number(local[2])).padStart(2, '0')}` : id;
}
