import { commitTree, EMPTY_TREE, isAncestor, isGitUnavailable, readCommit, readCommitBefore, readLog, type Commit, type Tree } from '@binnacle/adapters';
import type { Diagnostic, RoadmapStatus, TaskState } from '@binnacle/core';
import { OperationError } from './errors.ts';
import { resolveGitTimeout } from './home.ts';
import type { Projected } from './projection.ts';
import { firstHeading, limited, readState, section, taskSections, type CallerCheckout, type Section, type State } from './snapshot.ts';
import type { ProjectRow } from './store.ts';

/**
 * The daily delta (`daily.get`): what changed from a baseline commit to the caller's HEAD,
 * over committed state only. Both ends are read from Git, so an uncommitted edit is never
 * part of the answer; `dirty` says there is one. Lists share the snapshot's limit and
 * remainder count (ADR-0012).
 */
export const FALLBACK_DAYS = 7;

/** The events whose head is the next daily's baseline. */
export const BASELINE_EVENTS = ['daily', 'checkpoint'] as const;

export type Baseline = { commit: string; source: (typeof BASELINE_EVENTS)[number] | 'since' };

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
  /** Tickets whose `Status:` differs between the two ends. Null, like the next two, when Tasks cannot be read. */
  transitions: { items: Transition[]; remainder: number } | null;
  /** Tickets that did not exist at the baseline. */
  newTickets: Section | null;
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
 * baseline, so its delta is the daily's code with the daily's fallback.
 */
export async function daily(
  projected: Projected,
  caller: CallerCheckout,
  diagnostics: Diagnostic[],
  baseline: Baseline | null,
  recorded: readonly string[] = BASELINE_EVENTS,
): Promise<Daily> {
  const { head, dirty } = committedHead(caller);
  const cwd = caller.project;
  const timeout = resolveGitTimeout();

  try {
    const { from, fallback } = await startingPoint(cwd, head, baseline, recorded, timeout);
    const beforeTree = from.commit === null ? EMPTY_TREE : commitTree(cwd, from.commit, timeout);
    const afterTree = commitTree(cwd, head, timeout);
    const [commits, before, after] = await Promise.all([
      readLog(cwd, from.commit, head, timeout),
      // The baseline's own attention items are not news.
      readState(beforeTree, projected, []),
      readState(afterTree, projected, diagnostics),
    ]);

    return {
      project: projected.row,
      checkout: caller.checkout,
      head,
      dirty,
      from,
      fallback,
      commits: { count: commits.length, ...limited(commits) },
      ...taskChanges(before, after),
      roadmap: roadmapChanges(before, after),
      decisions: await decisionChanges(before, after, beforeTree, afterTree),
      attention: after.attention,
    };
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
  recorded: readonly string[],
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
  if (git.commit === null) throw new OperationError('git.no_commits', 'This checkout has no commits yet, so nothing has changed.', 409);
  return { head: git.commit, dirty: git.dirty };
}

function taskChanges(before: State, after: State): Pick<Daily, 'transitions' | 'newTickets' | 'readyToStart'> {
  if (after.tasks === null) return { transitions: null, newTickets: null, readyToStart: null };
  const was = new Map((before.tasks ?? []).map((task) => [task.id, task]));
  const transitions: Transition[] = [];
  const created = after.tasks.filter((task) => !was.has(task.id));
  for (const { id, title, state, ticket } of after.tasks) {
    const old = was.get(id);
    if (old && old.state !== state) transitions.push({ id, title, from: old.state, to: state, ticket });
  }
  return { transitions: limited(transitions), newTickets: section(created), readyToStart: taskSections(after.tasks).readyToStart };
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
