import { readLocalTasks } from '@binnacle/adapters';
import { resolveDependencies, type Diagnostic, type ProjectManifest, type ResolvedTask, type TaskState } from '@binnacle/core';
import type { ProjectRow } from './store.ts';

/**
 * The Product Snapshot (`project.snapshot`): a compact, fixed-shape projection for a fresh
 * Product session. Every section has a fixed item limit and a remainder count, so it stays
 * compact as the project grows and says how much it left out (ADR-0012). Nothing is stored:
 * the tracker is read on every call, and the same files give the same snapshot.
 */
export const SECTION_LIMIT = 10;

const IN_FLIGHT = ['ACTIVE', 'BLOCKED', 'READY_FOR_REVIEW', 'APPROVED', 'MERGE_READY'] as const satisfies readonly TaskState[];
type InFlight = (typeof IN_FLIGHT)[number];
const inFlight = (state: TaskState | null): state is InFlight => (IN_FLIGHT as readonly (TaskState | null)[]).includes(state);

export type SnapshotTask = Pick<ResolvedTask, 'id' | 'title' | 'state' | 'unmetDependencies' | 'ticket'>;
export type Section = { items: SnapshotTask[]; remainder: number };

export type TaskCounts = Record<Exclude<TaskState, InFlight> | 'unknown', number>;

export type Snapshot = {
  project: ProjectRow;
  /** Null when the project's tracker cannot be read yet; `attention` says why. */
  tasks: {
    /** `ACTIVE`, `BLOCKED`, `READY_FOR_REVIEW`, `APPROVED`, `MERGE_READY`. */
    inFlight: Section;
    /** `READY` with no Unmet dependencies. */
    readyToStart: Section;
    /**
     * Every Task not listed by name, by state: `READY` here is a Task waiting on an Unmet
     * dependency, and `unknown` one whose tracker value is not a Task state.
     */
    counts: TaskCounts;
  } | null;
  attention: Diagnostic[];
};

export function snapshot(row: ProjectRow, manifest: ProjectManifest | null): Snapshot {
  const issues = manifest?.tracker.provider === 'local' ? manifest.tracker.local.issues : null;
  if (issues === null) {
    return {
      project: row,
      tasks: null,
      attention: [
        {
          code: 'tracker.unavailable',
          message: manifest
            ? 'Tasks are read from the local Markdown tracker only, and this project declares no tracker.local.issues on it.'
            : 'Tasks cannot be read without a readable manifest.',
        },
      ],
    };
  }

  const reading = readLocalTasks(row.path, issues);
  const { tasks, diagnostics } = resolveDependencies(reading.tasks);

  const counts: TaskCounts = { BACKLOG: 0, READY: 0, MERGED: 0, DONE: 0, CANCELLED: 0, unknown: 0 };
  const listedInFlight: ResolvedTask[] = [];
  const readyToStart: ResolvedTask[] = [];
  for (const task of tasks) {
    if (inFlight(task.state)) listedInFlight.push(task);
    else if (task.state === 'READY' && task.unmetDependencies.length === 0) readyToStart.push(task);
    else counts[task.state ?? 'unknown']++;
  }

  return {
    project: row,
    tasks: { inFlight: section(listedInFlight), readyToStart: section(readyToStart), counts },
    attention: [...reading.diagnostics, ...diagnostics],
  };
}

/** In tracker order, which the adapter makes stable. */
function section(tasks: ResolvedTask[]): Section {
  return {
    items: tasks.slice(0, SECTION_LIMIT).map(({ id, title, state, unmetDependencies, ticket }) => ({
      id,
      title,
      state,
      unmetDependencies,
      ticket,
    })),
    remainder: Math.max(0, tasks.length - SECTION_LIMIT),
  };
}
