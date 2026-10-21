import type { TrackerProvider } from './manifest.ts';
import type { Params } from './wording.ts';

/**
 * The entities of `docs/06-data-model.md` and the three state machines of
 * `docs/workflow/03-state-machines.md`, for the tracker and telemetry adapters of epics 3
 * and 4 to map into. No storage exists for Task, AgentRun or Review yet: each table
 * arrives with the epic that writes it.
 *
 * Task, AgentRun and Review each have their own state union and their own transition
 * function. There is deliberately no status spanning them (`docs/06-data-model.md`), which
 * is why Task's `APPROVED` and Review's `APPROVED` are unrelated values. The observed run
 * is a type of its own with no state at all: the AgentRun machine is for runs Binnacle
 * will manage, of which there are none yet.
 *
 * A field the data model marks optional is null when absent, never undefined and never a
 * substituted default, the same rule the manifest follows. Timestamps are ISO 8601 strings.
 */

export type Project = {
  id: string;
  /** Null when the manifest declares none, as `project.name` may. */
  name: string | null;
  repoPath: string;
  /** Null for a repository with no remote, which is a normal case. */
  remote: string | null;
  /** Null when the manifest declares no tracker. */
  trackerType: TrackerProvider | null;
  manifestVersion: number;
  createdAt: string;
};

export type TaskState =
  | 'BACKLOG'
  | 'READY'
  | 'ACTIVE'
  | 'BLOCKED'
  | 'READY_FOR_REVIEW'
  | 'APPROVED'
  | 'MERGE_READY'
  | 'MERGED'
  | 'DONE'
  | 'CANCELLED';

export type Task = {
  id: string;
  projectId: string;
  externalId: string | null;
  title: string;
  state: TaskState;
  priority: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentRunState =
  | 'PLANNED'
  | 'RUNNING'
  | 'WAITING_INPUT'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABORTED'
  | 'BUDGET_EXCEEDED';

export type AgentRun = {
  id: string;
  projectId: string;
  taskId: string | null;
  role: string;
  harness: string;
  provider: string;
  model: string | null;
  profile: string | null;
  branch: string | null;
  worktree: string | null;
  state: AgentRunState;
  startedAt: string;
  finishedAt: string | null;
  initiator: string;
  budgetPolicy: string | null;
};

/**
 * From the run's branch: the default branch is Product work, a Task's branch implementation,
 * review or rework, told apart by the branch's first commit changing anything but the ticket,
 * the Task's first review run, or, with none, its first Review's commit.
 */
export type RunRole = 'product' | 'implementation' | 'review' | 'rework' | 'unknown';
/** The roles of a run on a Task's branch. */
export type TaskRole = Extract<RunRole, 'implementation' | 'review' | 'rework'>;

/**
 * An AgentRun Binnacle reads out of a session artifact rather than one it manages: one
 * unbroken stretch of one session in one checkout on one branch. It has no lifecycle
 * state, since an artifact cannot tell a finished run from an abandoned one, and it is
 * derived from the ingested records on every read, never stored.
 */
export type ObservedRun = {
  /** Derived from its first record's key, so stable across reads. */
  id: string;
  projectPath: string;
  /** Null is unassigned. */
  taskId: string | null;
  role: RunRole;
  harness: string;
  /** Its latest record's, null when that record does not state one. */
  provider: string | null;
  model: string | null;
  /** Its checkout's reflog's, or none: the branch a harness wrote attributes nothing (ADR-0030). */
  branch: string | null;
  branchSource: 'reflog' | null;
  /**
   * The root of the checkout its records' `cwd` lies in: the registered one, or a linked
   * worktree. Null when Git cannot say, or that checkout is gone, as a worktree is once removed.
   */
  checkout: string | null;
  /** The run that started a subagent. */
  parentRunId: string | null;
  startedAt: string;
  lastActivityAt: string;
  /** Binnacle's own reading of `lastActivityAt` against a fixed recency, never an observed state. */
  active: { value: boolean; provenance: 'calculated' };
};

export type ReviewState = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'CHANGES_REQUESTED' | 'RESOLVED';

export type Review = {
  id: string;
  projectId: string;
  taskId: string;
  runId: string | null;
  reviewerRunId: string | null;
  state: ReviewState;
  /** Review cycles stay measurable: one more each time a resolved review goes back into review. */
  cycle: number;
  createdAt: string;
  resolvedAt: string | null;
};

/**
 * The next state, or why not. `code` is part of the contract:
 *
 * - `transition.unknown_state` — either side is not a state of this machine, which is what
 *   an adapter gets for an unmapped external value;
 * - `transition.terminal` — the current state has no way out;
 * - `transition.not_allowed` — both are states, and the machine has no such edge.
 */
export type TransitionResult<S extends string> =
  | { ok: true; state: S }
  | { ok: false; code: 'transition.unknown_state' | 'transition.terminal' | 'transition.not_allowed'; message: string; params: Params };

/**
 * The edges are the diagram's and nothing more. Where the diagram is silent, this machine
 * does not guess: a reopened issue (`DONE` back to `ACTIVE`) is a rejection for the tracker
 * adapter to surface, not an edge invented here.
 *
 * `CANCELLED` is reachable from every state before `MERGED`. The diagram allows it "from
 * applicable pre-completion states"; once code is merged, cancelling would claim it was not.
 */
const TASK: Record<TaskState, readonly TaskState[]> = {
  BACKLOG: ['READY', 'CANCELLED'],
  READY: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['BLOCKED', 'READY_FOR_REVIEW', 'CANCELLED'],
  BLOCKED: ['ACTIVE', 'CANCELLED'],
  // Back to ACTIVE is "changes requested".
  READY_FOR_REVIEW: ['ACTIVE', 'APPROVED', 'CANCELLED'],
  APPROVED: ['MERGE_READY', 'CANCELLED'],
  MERGE_READY: ['MERGED', 'CANCELLED'],
  MERGED: ['DONE'],
  DONE: [],
  CANCELLED: [],
};

/**
 * The diagram lists the terminal alternatives without saying where they are entered from.
 * They are reachable from every live state: a run can fail, be aborted or run out of budget
 * before it starts or while it waits for input.
 */
const TERMINAL_ALTERNATIVES = ['FAILED', 'ABORTED', 'BUDGET_EXCEEDED'] as const;
const AGENT_RUN: Record<AgentRunState, readonly AgentRunState[]> = {
  PLANNED: ['RUNNING', ...TERMINAL_ALTERNATIVES],
  RUNNING: ['WAITING_INPUT', 'COMPLETED', ...TERMINAL_ALTERNATIVES],
  WAITING_INPUT: ['RUNNING', ...TERMINAL_ALTERNATIVES],
  COMPLETED: [],
  FAILED: [],
  ABORTED: [],
  BUDGET_EXCEEDED: [],
};

const REVIEW: Record<ReviewState, readonly ReviewState[]> = {
  PENDING: ['IN_REVIEW'],
  IN_REVIEW: ['APPROVED', 'CHANGES_REQUESTED'],
  APPROVED: [],
  CHANGES_REQUESTED: ['RESOLVED'],
  RESOLVED: ['IN_REVIEW'],
};

/** Every Task state, in the order of the state machine. */
export const TASK_STATES = Object.keys(TASK) as TaskState[];

/** For an adapter reading a state from outside: a value that is not a Task state is not guessed at. */
export const isTaskState = (value: string): value is TaskState => Object.hasOwn(TASK, value);

export function transitionTask(from: TaskState, to: TaskState): TransitionResult<TaskState> {
  return transition('Task', TASK, from, to);
}

export function transitionAgentRun(from: AgentRunState, to: AgentRunState): TransitionResult<AgentRunState> {
  return transition('AgentRun', AGENT_RUN, from, to);
}

export function transitionReview(from: ReviewState, to: ReviewState): TransitionResult<ReviewState> {
  return transition('Review', REVIEW, from, to);
}

/** Never throws: the states usually come from outside, and a rejection is an answer. */
function transition<S extends string>(
  entity: string,
  edges: Record<S, readonly S[]>,
  from: S,
  to: S,
): TransitionResult<S> {
  // `Object.hasOwn`, so that `toString` and friends are not mistaken for states.
  const unknown = [from, to].filter((state) => typeof state !== 'string' || !Object.hasOwn(edges, state));
  if (unknown.length > 0) {
    const states = unknown.map((state) => JSON.stringify(state) ?? String(state));
    return {
      ok: false,
      code: 'transition.unknown_state',
      message: `${entity} has no state ${states.join(' or ')}.`,
      params: { entity, states: states.join(', ') },
    };
  }

  const next = edges[from];
  if (next.includes(to)) return { ok: true, state: to };
  if (next.length === 0) {
    return { ok: false, code: 'transition.terminal', message: `${entity} ${from} is terminal; it cannot move to ${to}.`, params: { entity, from, to } };
  }
  return { ok: false, code: 'transition.not_allowed', message: `${entity} cannot move from ${from} to ${to}.`, params: { entity, from, to } };
}
