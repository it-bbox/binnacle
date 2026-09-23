import { readdirSync, readFileSync, type Dirent } from 'node:fs';
import { join, posix } from 'node:path';
import { readLastCommitTimes, readLocalTasks, type GitFacts } from '@binnacle/adapters';
import {
  parseRoadmap,
  resolveDependencies,
  roadmapAttention,
  type Diagnostic,
  type Epic,
  type ProjectManifest,
  type ResolvedTask,
  type TaskState,
} from '@binnacle/core';
import { resolveGitTimeout } from './home.ts';
import type { CallerCheckout } from './operations.ts';
import type { Projected } from './projection.ts';
import type { ProjectRow } from './store.ts';

/**
 * The Product Snapshot (`project.snapshot`): a compact, fixed-shape projection for a fresh
 * Product session. Every section has a fixed item limit and a remainder count, so it stays
 * compact as the project grows and says how much it left out (ADR-0012). Nothing is stored:
 * the tracker, the roadmap and the ADRs are read on every call from the caller's checkout,
 * attention items are computed on every call, and the same files give the same snapshot.
 */
export const SECTION_LIMIT = 10;
export const DECISION_LIMIT = 5;
/** In UTF-16 code units, which is what JavaScript counts as characters. */
export const FOCUS_LIMIT = 2000;

const IN_FLIGHT = ['ACTIVE', 'BLOCKED', 'READY_FOR_REVIEW', 'APPROVED', 'MERGE_READY'] as const satisfies readonly TaskState[];
type InFlight = (typeof IN_FLIGHT)[number];
const inFlight = (state: TaskState | null): state is InFlight => (IN_FLIGHT as readonly (TaskState | null)[]).includes(state);

export type SnapshotTask = Pick<ResolvedTask, 'id' | 'title' | 'state' | 'unmetDependencies' | 'ticket'>;
export type Section = { items: SnapshotTask[]; remainder: number };

export type TaskCounts = Record<Exclude<TaskState, InFlight> | 'unknown', number>;

/** A section Binnacle cannot fill yet. It is present and says so, and is never filled with a guess (ADR-0007). */
export type Unavailable = { available: false; reason: string };
const UNAVAILABLE: Unavailable = { available: false, reason: 'Not available in this version of Binnacle.' };

export type Snapshot = {
  project: ProjectRow;
  checkout: CallerCheckout['checkout'];
  /** The facts of the caller's checkout, as `project.status` gives them. */
  git: GitFacts;
  /** Null when there is no roadmap to read; `attention` says why. */
  roadmap: {
    epics: Epic[];
    /** `## Current focus` as written, cut at `FOCUS_LIMIT`; `truncated` says whether it was. */
    focus: { text: string; truncated: boolean } | null;
    /** Every other `##` section, by heading only. */
    sections: string[];
  } | null;
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
  /** The most recently committed ADRs; one never committed counts as the most recent. Null when there is no ADR directory. */
  decisions: { items: { title: string | null; path: string }[]; remainder: number } | null;
  pendingDecisions: Unavailable;
  ci: Unavailable;
  usage: Unavailable;
  /** Deterministic checks and diagnostics only; nothing heuristic. */
  attention: Diagnostic[];
};

/** `diagnostics` are the caller's own findings about the checkout, such as a tracker-remote mismatch. */
export async function snapshot({ row, manifest, warnings }: Projected, caller: CallerCheckout, diagnostics: Diagnostic[]): Promise<Snapshot> {
  const attention: Diagnostic[] = [
    ...warnings.map((warning) => ({ code: 'manifest.warning', message: `${warning.path}: ${warning.message}` })),
    ...diagnostics,
  ];
  const tasks = readTasks(caller.project, manifest, attention);
  const roadmap = readRoadmap(caller.project, manifest, attention);
  if (roadmap && tasks) attention.push(...roadmapAttention(roadmap.epics, tasks));
  const decisions = await recentDecisions(caller.project, manifest, attention);

  return {
    project: row,
    checkout: caller.checkout,
    git: caller.git,
    roadmap,
    tasks: tasks && taskSections(tasks),
    decisions,
    pendingDecisions: UNAVAILABLE,
    ci: UNAVAILABLE,
    usage: UNAVAILABLE,
    attention,
  };
}

function readTasks(root: string, manifest: ProjectManifest | null, attention: Diagnostic[]): ResolvedTask[] | null {
  const issues = manifest?.tracker.provider === 'local' ? manifest.tracker.local.issues : null;
  if (issues === null) {
    attention.push({
      code: 'tracker.unavailable',
      message: manifest
        ? 'Tasks are read from the local Markdown tracker only, and this project declares no tracker.local.issues on it.'
        : 'Tasks cannot be read without a readable manifest.',
    });
    return null;
  }
  const reading = readLocalTasks(root, issues);
  const { tasks, diagnostics } = resolveDependencies(reading.tasks);
  attention.push(...reading.diagnostics, ...diagnostics);
  return tasks;
}

function taskSections(tasks: ResolvedTask[]): NonNullable<Snapshot['tasks']> {
  const counts: TaskCounts = { BACKLOG: 0, READY: 0, MERGED: 0, DONE: 0, CANCELLED: 0, unknown: 0 };
  const listedInFlight: ResolvedTask[] = [];
  const readyToStart: ResolvedTask[] = [];
  for (const task of tasks) {
    if (inFlight(task.state)) listedInFlight.push(task);
    else if (task.state === 'READY' && task.unmetDependencies.length === 0) readyToStart.push(task);
    else counts[task.state ?? 'unknown']++;
  }
  return { inFlight: section(listedInFlight), readyToStart: section(readyToStart), counts };
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

/** On the local Markdown tracker the roadmap is `<knowledge.docs>/roadmap.md` (ADR-0017). */
function readRoadmap(root: string, manifest: ProjectManifest | null, attention: Diagnostic[]): Snapshot['roadmap'] {
  const docs = manifest?.tracker.provider === 'local' ? manifest.knowledge.docs : null;
  if (docs === null) {
    attention.push({
      code: 'roadmap.unavailable',
      message: manifest
        ? 'The roadmap is read from the local Markdown tracker only, as <knowledge.docs>/roadmap.md, and this project declares no knowledge.docs on it.'
        : 'The roadmap cannot be read without a readable manifest.',
    });
    return null;
  }

  const path = posix.join(docs, 'roadmap.md');
  const text = readOptional(join(root, path));
  if (text === null) {
    attention.push({ code: 'roadmap.missing', message: `There is no roadmap at ${path}.` });
    return null;
  }
  const { roadmap, diagnostics } = parseRoadmap(text);
  attention.push(...diagnostics);
  const focus = roadmap.focus;
  return {
    ...roadmap,
    focus: focus === null ? null : { text: focus.slice(0, FOCUS_LIMIT), truncated: focus.length > FOCUS_LIMIT },
  };
}

async function recentDecisions(root: string, manifest: ProjectManifest | null, attention: Diagnostic[]): Promise<Snapshot['decisions']> {
  const adr = manifest?.knowledge.adr ?? null;
  const files = adr === null ? null : listing(join(root, adr));
  if (adr === null || files === null) {
    attention.push(
      adr === null
        ? { code: 'adr.unavailable', message: manifest ? 'This project declares no knowledge.adr.' : 'ADRs cannot be found without a readable manifest.' }
        : { code: 'adr.missing', message: `knowledge.adr names ${adr}, which is not a directory.` },
    );
    return null;
  }

  const paths = files.filter((entry) => entry.isFile() && entry.name.endsWith('.md')).map((entry) => posix.join(adr, entry.name));
  const times = (await readLastCommitTimes(root, adr, resolveGitTimeout())) ?? new Map<string, number>();
  // Never committed sorts as newest; one commit's ADRs go by path, highest number first.
  const time = (path: string): number => times.get(path) ?? Infinity;
  paths.sort((a, b) => time(b) - time(a) || (a < b ? 1 : a > b ? -1 : 0));

  return {
    items: paths.slice(0, DECISION_LIMIT).map((path) => ({ title: firstHeading(readFileSync(join(root, path), 'utf8')), path })),
    remainder: Math.max(0, paths.length - DECISION_LIMIT),
  };
}

const firstHeading = (text: string): string | null => /^#\s+(.+?)\s*$/m.exec(text)?.[1] ?? null;

/** Null for a file or directory that is not there; anything else is thrown. */
function readOptional(path: string): string | null {
  return absentAsNull(() => readFileSync(path, 'utf8'));
}

function listing(path: string): Dirent[] | null {
  return absentAsNull(() => readdirSync(path, { withFileTypes: true }));
}

function absentAsNull<T>(read: () => T): T | null {
  try {
    return read();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    throw error;
  }
}
