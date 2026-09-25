import type { Tree } from '@binnacle/adapters';
import { taskBranch, type ProjectManifest, type TaskState, type TrackerTask } from '@binnacle/core';
import { OperationError } from './errors.ts';
import { cut, readTracker } from './snapshot.ts';

/** In characters: Unicode code points. */
export const BODY_LIMIT = 8000;

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
};

/**
 * `id` is `<spec-slug>/<NN>` on the local tracker and `#<number>` or `<number>` on a remote
 * one; the ticket number is compared, so `epic/6` is `epic/06`. An id the tracker does not
 * hold is `task.not_found`. A tracker that cannot be read is an error with its own code.
 */
export async function taskBrief(home: string, tree: Tree, manifest: ProjectManifest | null, id: string): Promise<TaskBrief> {
  const { tasks, diagnostics } = await readTracker(home, tree, manifest);
  // A missing issues directory reads as no Tasks, which the snapshot and the daily need; here it is a broken tracker, not a typo.
  const failure = diagnostics.find((item) => tasks === null || item.code === 'tracker.issues_missing');
  if (failure || tasks === null) throw new OperationError(failure?.code ?? 'tracker.unavailable', failure?.message ?? 'The tracker cannot be read.', 503);

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const task = byId.get(normalized(id));
  if (!task) throw new OperationError('task.not_found', `This project's tracker holds no Task ${JSON.stringify(id)}.`, 404);

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
    branch: taskBranch(task, manifest?.tracker.provider !== 'local'),
  };
}

function normalized(id: string): string {
  const remote = /^#?(\d+)$/.exec(id);
  if (remote) return `#${Number(remote[1])}`;
  const local = /^(.+)\/(\d+)$/.exec(id);
  return local ? `${local[1]}/${String(Number(local[2])).padStart(2, '0')}` : id;
}
