import type { Tree } from '@binnacle/adapters';
import { boardColumn, startCommand, type BoardColumn, type Diagnostic, type Epic, type ObservedRun, type ResolvedTask } from '@binnacle/core';
import { OperationError } from './errors.ts';
import type { OperationContext } from './operations.ts';
import type { Projected } from './projection.ts';
import { limited, readState } from './snapshot.ts';
import { latestRuns } from './usage.ts';

/** A Task on the board, with its column and what the column is read from; both null for one listed apart. */
export type Card = Pick<ResolvedTask, 'id' | 'title' | 'state' | 'unmetDependencies' | 'ticket'> & {
  column: BoardColumn | null;
  source: 'state' | 'runs' | null;
  /** The command that starts it (`startCommand`), or null when there is none. */
  start: string | null;
  /** Who works on it: its latest attributed run, or null when it has none. */
  latestRun: Pick<ObservedRun, 'harness' | 'model' | 'role' | 'lastActivityAt' | 'active'> | null;
};

/** The board (`task.list`): one group of the project's Tasks, in four columns. */
export type TaskList = {
  /** The roadmap's epic the board is for; null for the Tasks without a spec, and when no epic is current or the roadmap links none to the slug. */
  epic: Epic | null;
  /** The spec slug whose Tasks are listed; null for the Tasks without one, and when the epic has no spec yet, which lists none. */
  spec: string | null;
  /** Each column with the section limit and a remainder. Done lists its latest Tasks by id, the others go in tracker order. */
  columns: Record<BoardColumn, { items: Card[]; remainder: number }>;
  /** Tasks whose tracker value is not a Task state, each with the tracker's diagnostic. */
  unknown: { items: (Card & { diagnostic: Diagnostic | null })[]; remainder: number };
  /** `CANCELLED` Tasks are counted, not listed. */
  cancelled: number;
  /** How many of the project's Tasks carry no spec: a remote tracker's, which `spec: null` lists. */
  withoutSpec: number;
};

/**
 * `spec` is a spec slug, `null` for the Tasks that carry none, or undefined for the current
 * epic: the roadmap's first row that is not `done`. Read now from the caller's checkout, as the
 * snapshot is, and never written back (ADR-0032). A tracker that cannot be read is an error with
 * its own code, as for `task.get`.
 */
export async function taskList(context: OperationContext, projected: Projected, tree: Tree, spec: string | null | undefined): Promise<TaskList> {
  const { tasks, unreadable, roadmap, attention } = await readState(context.home, tree, projected, []);
  if (tasks === null) {
    const failure = unreadable[0];
    throw new OperationError(failure?.code ?? 'tracker.unavailable', failure?.message ?? 'The tracker cannot be read.', 503);
  }

  const epics = roadmap?.epics ?? [];
  const epic = spec === undefined ? (epics.find((row) => row.status !== 'done') ?? null) : spec === null ? null : (epics.find((row) => row.spec === spec) ?? null);
  const slug = spec === undefined ? (epic?.spec ?? null) : spec;
  // The current epic without a spec has no Tasks; only `spec: null` asks for the Tasks without one.
  const group = spec === undefined && slug === null ? [] : tasks.filter((task) => task.specSlug === slug);

  const runs = await latestRuns(context, projected.row.path, projected.manifest, tasks);
  const workflow = projected.manifest?.workflow.provider ?? null;
  const columns: Record<BoardColumn, Card[]> = { backlog: [], ready: [], inProgress: [], done: [] };
  const unknown: TaskList['unknown']['items'] = [];
  let cancelled = 0;
  for (const task of group) {
    const run = runs.get(task.id);
    const placed = boardColumn(task.state, run !== undefined);
    const card: Card = {
      id: task.id,
      title: task.title,
      state: task.state,
      column: placed?.column ?? null,
      source: placed?.source ?? null,
      unmetDependencies: task.unmetDependencies,
      ticket: task.ticket,
      start: startCommand(task, workflow),
      latestRun: run ? { harness: run.harness, model: run.model, role: run.role, lastActivityAt: run.lastActivityAt, active: run.active } : null,
    };
    if (placed) columns[placed.column].push(card);
    else if (task.state === 'CANCELLED') cancelled++;
    else unknown.push({ ...card, diagnostic: attention.find((item) => item.code === 'task.unknown_state' && item.message.startsWith(`${task.id} (`)) ?? null });
  }
  // Remote ids are `#<number>`, so ids compare by their numbers.
  columns.done.sort((a, b) => b.id.localeCompare(a.id, 'en', { numeric: true }));

  return {
    epic,
    spec: slug,
    columns: { backlog: limited(columns.backlog), ready: limited(columns.ready), inProgress: limited(columns.inProgress), done: limited(columns.done) },
    unknown: limited(unknown),
    cancelled,
    withoutSpec: tasks.filter((task) => task.specSlug === null).length,
  };
}
