import { commitTree, EMPTY_TREE, isAncestor, isGitUnavailable, readCommit, readCommitBefore, readLog, type Commit, type Tree } from '@binnacle/adapters';
import type { Diagnostic, ProjectManifest, ResolvedTask, RoadmapStatus, TaskState } from '@binnacle/core';
import { OperationError } from './errors.ts';
import { resolveGitTimeout } from './home.ts';
import type { Projected } from './projection.ts';
import { firstHeading, limited, readState, section, taskSections, type CallerCheckout, type Section, type State, type Unavailable } from './snapshot.ts';
import type { ProjectRow } from './store.ts';

/**
 * The daily delta (`daily.get`): what changed from a baseline commit to the caller's HEAD,
 * over committed state only. Both ends are read from Git, so an uncommitted edit is never
 * part of the answer; `dirty` says there is one. Lists share the snapshot's limit and
 * remainder count (ADR-0012).
 *
 * A remote tracker has no past Binnacle can read at a commit, so its Task changes are
 * computed against the Task states the baseline event recorded, and are unavailable, with
 * the reason, when it recorded none.
 */
export const FALLBACK_DAYS = 7;

/** The events whose head is the next daily's baseline. */
export const BASELINE_EVENTS = ['daily', 'checkpoint'] as const;

export type BaselineEvent = (typeof BASELINE_EVENTS)[number];

/** `{ id → state }` for every Task, as a `daily` or `checkpoint` event records it on a remote tracker. */
export type TaskStates = Record<string, TaskState | null>;

/** `states` is null for `since`, and for an event that recorded none. */
export type Baseline = { commit: string; source: BaselineEvent | 'since'; states: TaskStates | null };

/**
 * A tracker whose past Binnacle cannot read at a commit. A `daily` or `checkpoint` event
 * records its Task states beside the head instead; the local tracker's past is in Git.
 */
export const isRemoteTracker = (manifest: ProjectManifest | null): boolean => manifest !== null && manifest.tracker.provider !== 'local';

export const taskStates = (tasks: ResolvedTask[]): TaskStates => Object.fromEntries(tasks.map(({ id, state }) => [id, state]));

export type Fallback = {
  /** `no_baseline`: nothing recorded yet; `baseline_missing`: not a commit here; `baseline_diverged`: not an ancestor of HEAD. */
  reason: 'no_baseline' | 'baseline_missing' | 'baseline_diverged';
  message: string;
};

export type Daily = {
  project: ProjectRow;
  checkout: CallerCheckout['checkout'];
  /** The caller's HEAD, which the delta runs to. */
  head: string;
  dirty: boolean;
  /**
   * Where the delta runs from. With the fallback, the last commit before the window, and
   * null when the window reaches past the first commit: then everything is new.
   */
  from: { commit: string | null; source: Baseline['source'] | 'fallback' };
  /** Null unless the fallback window was used instead of a baseline, and then why. */
  fallback: Fallback | null;
  /** Newest first. */
  commits: { count: number; items: Commit[]; remainder: number };
  /**
   * Tickets whose `Status:` differs between the two ends. Null, like the next two, when Tasks
   * cannot be read now. Unavailable, like the next one, on a remote tracker whose baseline
   * recorded no Task states: never empty, which would read as "nothing changed".
   */
  transitions: { items: Transition[]; remainder: number } | Unavailable | null;
  /** Tickets that did not exist at the baseline. */
  newTickets: Section | Unavailable | null;
  readyToStart: Section | null;
  /** Epics whose status differs, or that are new (`from` null). Null when there is no roadmap at HEAD. */
  roadmap: { number: number; title: string; from: RoadmapStatus | null; to: RoadmapStatus }[] | null;
  /** ADRs added or changed. Null when there is no ADR directory at HEAD. */
  decisions: { items: { title: string | null; path: string; change: 'added' | 'changed' }[]; remainder: number } | null;
  /** As the snapshot computes it, at HEAD. */
  attention: Diagnostic[];
};

export type Transition = { id: string; title: string | null; from: TaskState | null; to: TaskState | null; ticket: string };

/**
 * `baseline` is null when no event of the `recorded` types exists; `diagnostics` are the
 * caller's findings, as for the snapshot. `checkpoint.prepare` calls this with its own
 * baseline, so its delta is the daily's code with the daily's fallback. `states` is what a
 * `daily` event recording this delta's head records beside it.
 */
export async function daily(
  projected: Projected,
  caller: CallerCheckout,
  diagnostics: Diagnostic[],
  baseline: Baseline | null,
  recorded: readonly BaselineEvent[] = BASELINE_EVENTS,
): Promise<{ delta: Daily; states: TaskStates | null }> {
  const { head, dirty } = committedHead(caller);
  const cwd = caller.project;
  const timeout = resolveGitTimeout();

  try {
    const { from, fallback } = await startingPoint(cwd, head, baseline, recorded, timeout);
    const beforeTree = from.commit === null ? EMPTY_TREE : commitTree(cwd, from.commit, timeout);
    const afterTree = commitTree(cwd, head, timeout);
    const [commits, before, after] = await Promise.all([
      readLog(cwd, from.commit, head, timeout),
      // The baseline's own attention items are not news. A remote tracker has no past to read here.
      readState(beforeTree, projected, [], { readRemoteTracker: false }),
      readState(afterTree, projected, diagnostics),
    ]);

    const remote = isRemoteTracker(projected.manifest);
    const was = remote ? recordedStates(baseline, fallback, recorded) : before.tasks && taskStates(before.tasks);
    const delta: Daily = {
      project: projected.row,
      checkout: caller.checkout,
      head,
      dirty,
      from,
      fallback,
      commits: { count: commits.length, ...limited(commits) },
      ...taskChanges(was, after),
      roadmap: roadmapChanges(before, after),
      decisions: await decisionChanges(before, after, beforeTree, afterTree),
      attention: after.attention,
    };
    // An unreadable tracker records no states, so that the next delta says so instead of guessing.
    return { delta, states: remote && after.tasks ? taskStates(after.tasks) : null };
  } catch (error) {
    if (isGitUnavailable(error)) throw new OperationError(error.code, error.reason, 503);
    throw error;
  }
}

/**
 * The baseline when it is still an ancestor of HEAD, and otherwise the fallback window,
 * with the reason. An explicit `since` that cannot be used is refused instead: it was
 * asked for, and a window nobody asked for would hide the typo.
 */
async function startingPoint(
  cwd: string,
  head: string,
  baseline: Baseline | null,
  recorded: readonly BaselineEvent[],
  timeout: number,
): Promise<{ from: Daily['from']; fallback: Fallback | null }> {
  let fallback: Fallback;
  if (baseline === null) {
    fallback = { reason: 'no_baseline', message: `No ${recorded.join(' or ')} has been recorded for this project on this machine.` };
  } else {
    const named = `The baseline ${baseline.commit} from the last ${baseline.source}`;
    const commit = await readCommit(cwd, baseline.commit, timeout);
    const usable = commit !== null && (await isAncestor(cwd, commit, head, timeout));
    if (!usable && baseline.source === 'since') {
      throw new OperationError('request.invalid', `"since" ${baseline.commit} ${commit === null ? 'names no commit here' : 'is not an ancestor of HEAD'}.`, 400, [
        { path: 'since', message: 'expected a commit HEAD descends from' },
      ]);
    }
    if (commit === null) {
      fallback = { reason: 'baseline_missing', message: `${named} is not a commit in this repository.` };
    } else if (!usable) {
      fallback = { reason: 'baseline_diverged', message: `${named} is not an ancestor of HEAD: history was rewritten, or this checkout is on another line of work.` };
    } else {
      return { from: { commit, source: baseline.source }, fallback: null };
    }
  }

  const window = new Date(Date.now() - FALLBACK_DAYS * 24 * 60 * 60 * 1000);
  return {
    from: { commit: await readCommitBefore(cwd, head, window, timeout), source: 'fallback' },
    fallback: { ...fallback, message: `${fallback.message} The delta covers the last ${FALLBACK_DAYS} days of commits instead.` },
  };
}

/** The caller's HEAD, which a delta runs to and a checkpoint records; refused when there is none. */
export function committedHead({ git }: CallerCheckout): { head: string; dirty: boolean } {
  if (!git.available) throw new OperationError(git.code, git.reason, 409);
  if (git.commit === null) throw new OperationError('git.no_commits', 'This checkout has no commits yet.', 409);
  return { head: git.commit, dirty: git.dirty };
}

/**
 * The Task states a remote tracker's delta runs from: those the baseline event recorded, or
 * why there are none. They are never taken from a commit, a fallback window or a guess.
 */
function recordedStates(baseline: Baseline | null, fallback: Fallback | null, recorded: readonly BaselineEvent[]): TaskStates | Unavailable {
  const known = 'On a remote tracker, past Task states are known only as a daily or checkpoint recorded them';
  let reason: string;
  if (baseline?.source === 'since') reason = `${known}, and an explicit since names a commit instead.`;
  else if (baseline === null) reason = `No ${recorded.join(' or ')} has recorded Task states for this project on this machine.`;
  else if (fallback !== null) reason = `${known}, and this delta fell back to a window of commits instead of the last ${baseline.source}.`;
  else if (baseline.states === null) {
    reason = `The last ${baseline.source} recorded no Task states: it was recorded before Binnacle recorded them, while the tracker could not be read, or on another tracker.`;
  } else return baseline.states;
  return { available: false, reason };
}

// No Task state is `false`, so this cannot mistake recorded states for a reason.
const isUnavailable = (value: TaskStates | Unavailable): value is Unavailable => value.available === false;

function taskChanges(was: TaskStates | Unavailable | null, after: State): Pick<Daily, 'transitions' | 'newTickets' | 'readyToStart'> {
  if (after.tasks === null) return { transitions: null, newTickets: null, readyToStart: null };
  const readyToStart = taskSections(after.tasks).readyToStart;
  if (was === null) return { transitions: null, newTickets: null, readyToStart };
  if (isUnavailable(was)) return { transitions: was, newTickets: was, readyToStart };
  const transitions: Transition[] = [];
  const created = after.tasks.filter((task) => !Object.hasOwn(was, task.id));
  for (const { id, title, state, ticket } of after.tasks) {
    const old = Object.hasOwn(was, id) ? was[id] : undefined;
    if (old !== undefined && old !== state) transitions.push({ id, title, from: old, to: state, ticket });
  }
  return { transitions: limited(transitions), newTickets: section(created), readyToStart };
}

function roadmapChanges(before: State, after: State): Daily['roadmap'] {
  if (after.roadmap === null) return null;
  const was = new Map((before.roadmap?.epics ?? []).map((epic) => [epic.number, epic.status]));
  return after.roadmap.epics
    .filter((epic) => was.get(epic.number) !== epic.status)
    .map(({ number, title, status }) => ({ number, title, from: was.get(number) ?? null, to: status }));
}

async function decisionChanges(before: State, after: State, beforeTree: Tree, afterTree: Tree): Promise<Daily['decisions']> {
  if (after.adrs === null) return null;
  const known = new Set(before.adrs?.paths);
  const changes = await Promise.all(
    after.adrs.paths.map(async (path) => {
      const [was, is] = await Promise.all([known.has(path) ? beforeTree.read(path) : null, afterTree.read(path)]);
      if (was === is) return null;
      return { title: firstHeading(is ?? ''), path, change: was === null ? ('added' as const) : ('changed' as const) };
    }),
  );
  return limited(changes.filter((change) => change !== null));
}
