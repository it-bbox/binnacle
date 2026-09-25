import { closeSync, openSync, readdirSync, readSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { setImmediate, setTimeout } from 'node:timers/promises';
import { readClaudeCode, readDefaultBranch, readWorktrees, type Tree } from '@binnacle/adapters';
import type { ImportWindow, ObservedRun, ProjectManifest, TrackerTask } from '@binnacle/core';
import { magnitude, observedRuns, sum, type Harness, type RunRecord, type Totals } from '@binnacle/telemetry';
import { resolveGitTimeout } from './home.ts';
import type { OperationContext } from './operations.ts';
import { containingEntry, readRegistry } from './registry.ts';
import { limited, readTracker, trackerUnavailable, type Unavailable } from './snapshot.ts';
import { findTask } from './task.ts';
import type { Ingested, IngestCursor, StoredUsage } from './store.ts';

/** The import window when the manifest writes none: the horizon of Git's own reflog. */
export const DEFAULT_WINDOW_DAYS = 90;

/** How long a call waits for its project's ingest before answering from what is stored. */
export const INGEST_BUDGET_MS = 1000;

/**
 * The daemon's ingests: one at a time on this machine, each queued behind the one before,
 * and one queued or running per project, which a call under the same window waits for
 * rather than starting another.
 */
export type Importer = {
  budgetMs: number;
  queue: Promise<void>;
  running: Map<string, { run: Promise<string | null>; window: ImportWindow }>;
  /** Set when the daemon stops: a running ingest ends before its next file. */
  stopped: boolean;
};

export const importer = (budgetMs: number): Importer => ({ budgetMs, queue: Promise.resolve(), running: new Map(), stopped: false });

/** Lets the running ingest end after its current file, each of which commits whole, and waits for it. */
export async function stopImporting(importer: Importer): Promise<void> {
  importer.stopped = true;
  await importer.queue;
}

/**
 * Forgets how far the files a newly registered project's import would read were read, so
 * that it reads them from the start: an earlier project's import may have read past its
 * records while they belonged to no registered project.
 */
export function forgetRead(context: OperationContext, projectPath: string): void {
  context.store.forgetCursors(join(context.runtime.artifacts.claudeCode, claudeCodeDirectory(projectPath)));
}

export type HarnessLevel = {
  harness: Harness;
  /**
   * ADR-0014, for this project: 3 when records with token counts were read, 2 when records
   * were read without any, 1 when an artifact could not be read, null when none were found.
   */
  level: 1 | 2 | 3 | null;
  /** Why the level is below 2; null otherwise. */
  reason: string | null;
};

export type Usage = {
  /** Whether this project's import is still incomplete, and the local date its window starts, null for `all`. */
  importing: { incomplete: boolean; windowStart: string | null };
  today: Totals;
  last7Days: Totals;
  byModel: { items: { model: string | null; totals: Totals }[]; remainder: number };
  /** The last seven days by Task, largest first; unavailable, with the tracker's reason, when it cannot be read. */
  tasks: { items: { id: string; title: string | null; totals: Totals }[]; remainder: number } | Unavailable;
  /** The last seven days of runs no Task's branch accounts for. */
  unassigned: Totals | Unavailable;
  harnesses: HarnessLevel[];
};

/**
 * Reads what is new in the Claude Code artifacts of `projectPath`, for as long as the time
 * budget allows, and answers the snapshot's `usage` section from everything stored,
 * attributed to `tasks`, the tracker's current Tasks, or unavailable with why they cannot
 * be read. What the budget does not cover goes on in the background. "Today" and "the last
 * seven days" are calendar days in the daemon's local time zone.
 */
export async function usage(
  context: OperationContext,
  projectPath: string,
  manifest: ProjectManifest | null,
  tasks: TrackerTask[] | Unavailable,
): Promise<Usage> {
  const { importing, failure, checkouts } = await ingested(context, projectPath, manifest);

  const week = context.store.usage(projectPath, 'claude-code', localMidnight(6).toISOString());
  const since = localMidnight(0).toISOString();
  const today = week.filter((record) => record.timestamp >= since);
  const attributed = Array.isArray(tasks)
    ? byTask(await runs(week, projectPath, tasks, manifest?.tracker.provider !== 'local', checkouts), tasks)
    : { tasks, unassigned: tasks };

  const models = new Map<string | null, typeof week>();
  for (const record of week) models.set(record.model, [...(models.get(record.model) ?? []), record]);
  const byModel = [...models].map(([model, records]) => ({ model, totals: sum(records) }));
  byModel.sort((a, b) => magnitude(b.totals) - magnitude(a.totals) || String(a.model).localeCompare(String(b.model), 'en'));

  return {
    importing,
    today: sum(today),
    last7Days: sum(week),
    byModel: limited(byModel),
    ...attributed,
    harnesses: [level(context, projectPath, failure, importing.incomplete)],
  };
}

/** `usage.get` without a Task: the project's totals over everything ingested, by Task and unassigned. */
export type ProjectUsage = Pick<Usage, 'importing' | 'tasks' | 'unassigned'> & { totals: Totals };

/** A run as `usage.get` shows it: the observed run, less its project, with its totals. */
export type RunUsage = Omit<ObservedRun, 'projectPath'> & { totals: Totals };

/** `usage.get` with a Task: its totals over everything ingested, and its runs, newest first. */
export type TaskUsage = Pick<Usage, 'importing'> & {
  task: Pick<TrackerTask, 'id' | 'title'>;
  totals: Totals;
  runs: { items: RunUsage[]; remainder: number };
};

/**
 * `usage.get`: reads what is new first, as the snapshot does, then answers from every stored
 * record, grouped into runs all at once, so that a run's id does not depend on how far back
 * a call looks. `tree` is the caller's checkout, where the tracker is read. With `taskId`, in
 * any form `task.get` takes, the tracker must be readable and hold that Task, as for `task.get`.
 */
export async function usageGet(
  context: OperationContext,
  projectPath: string,
  manifest: ProjectManifest | null,
  tree: Tree,
  taskId: string | undefined,
): Promise<ProjectUsage | TaskUsage> {
  const found = taskId === undefined ? null : await findTask(context.home, tree, manifest, taskId);
  const reading = found ? null : await readTracker(context.home, tree, manifest);
  const tasks = found?.tasks ?? reading?.tasks ?? trackerUnavailable(reading?.diagnostics ?? []);
  const { importing, checkouts } = await ingested(context, projectPath, manifest);

  const records = context.store.usage(projectPath, 'claude-code', '');
  if (!Array.isArray(tasks)) return { importing, totals: sum(records), tasks, unassigned: tasks };
  const attributed = await runs(records, projectPath, tasks, manifest?.tracker.provider !== 'local', checkouts);
  if (!found) return { importing, totals: sum(records), ...byTask(attributed, tasks) };

  // Runs come oldest first.
  const own = attributed.filter((run) => run.taskId === found.task.id).reverse();
  return {
    importing,
    task: { id: found.task.id, title: found.task.title },
    totals: sum(own.flatMap((run) => run.records)),
    runs: limited(own.map(({ records: runRecords, projectPath: _project, ...run }) => ({ ...run, totals: sum(runRecords) }))),
  };
}

/**
 * Starts the project's ingest, or joins the one already running under the same window, and
 * waits for it up to the budget: whether it is still incomplete, the local date its window
 * starts, why a file could not be read if one could not, and the project's checkouts.
 */
async function ingested(
  context: OperationContext,
  projectPath: string,
  manifest: ProjectManifest | null,
): Promise<{ importing: Usage['importing']; failure: string | null; checkouts: Checkouts }> {
  const window = windowOf(manifest);
  const checkouts = await projectCheckouts(projectPath);
  const { running, budgetMs } = context.importer;
  const current = running.get(projectPath);
  // One started under another window, on startup or before the manifest changed, is not this call's.
  const run = current?.window === window ? current.run : startIngest(context, projectPath, manifest, checkouts.linked);
  if (budgetMs > 0) await Promise.race([run, setTimeout(budgetMs, undefined, { ref: false })]);
  // A run leaves `running` as it settles, so one still there is still going.
  const incomplete = running.get(projectPath)?.run === run;
  return {
    importing: { incomplete, windowStart: window === 'all' ? null : localDate(localMidnight(window - 1)) },
    failure: incomplete ? null : await run,
    checkouts,
  };
}

/**
 * The project's observed runs among `records`, each attributed to the one Task of
 * `tasks` its branch maps back to. The default branch is the one `origin/HEAD` names in
 * the registered checkout, otherwise `main`.
 */
export async function runs(
  records: StoredUsage[],
  projectPath: string,
  tasks: Pick<TrackerTask, 'id' | 'title' | 'ticket'>[],
  remote: boolean,
  checkouts: Checkouts,
): Promise<(ObservedRun & { records: RunRecord[] })[]> {
  const defaultBranch = (await readDefaultBranch(projectPath, resolveGitTimeout())) ?? 'main';
  // ponytail: a record's checkout is found among the ones that exist now, so a removed
  // worktree's records read as the registered checkout's; its branch still splits them.
  const withCheckout = records.map((record) => ({ ...record, checkout: containingEntry(record.cwd, checkouts.roots)?.path ?? projectPath }));
  return observedRuns(withCheckout, { projectPath, defaultBranch, tasks, remote, now: new Date() });
}

function byTask(attributed: { taskId: string | null; records: RunRecord[] }[], tasks: Pick<TrackerTask, 'id' | 'title'>[]): Pick<Usage, 'tasks' | 'unassigned'> {
  const records = new Map<string | null, RunRecord[]>();
  for (const run of attributed) records.set(run.taskId, (records.get(run.taskId) ?? []).concat(run.records));
  const titles = new Map(tasks.map((task) => [task.id, task.title]));
  const items = [...records]
    .filter((entry): entry is [string, RunRecord[]] => entry[0] !== null)
    .map(([id, taskRecords]) => ({ id, title: titles.get(id) ?? null, totals: sum(taskRecords) }));
  items.sort((a, b) => magnitude(b.totals) - magnitude(a.totals) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { tasks: limited(items), unassigned: sum(records.get(null) ?? []) };
}

/**
 * The checkouts of the project's repository that exist now, and the project's directory in
 * each linked one: a session there is the project's, wherever the worktree is.
 */
export type Checkouts = { roots: { path: string }[]; linked: string[] };

/** The project's checkouts, from Git's list of worktrees; none when Git cannot say. */
export async function projectCheckouts(projectPath: string): Promise<Checkouts> {
  const roots = ((await readWorktrees(projectPath, resolveGitTimeout())) ?? []).map((path) => ({ path }));
  const own = containingEntry(projectPath, roots);
  if (!own) return { roots: [], linked: [] };
  const inside = relative(own.path, projectPath);
  return { roots, linked: roots.filter((root) => root !== own).map((root) => join(root.path, inside)) };
}

function level(context: OperationContext, projectPath: string, failure: string | null, incomplete: boolean): HarnessLevel {
  if (failure !== null) return { harness: 'claude-code', level: 1, reason: failure };
  const { records, withTokens } = context.store.usageCounts(projectPath, 'claude-code');
  if (withTokens > 0) return { harness: 'claude-code', level: 3, reason: null };
  if (records > 0) return { harness: 'claude-code', level: 2, reason: null };
  if (incomplete) return { harness: 'claude-code', level: null, reason: 'The import of this project has not reached a record yet.' };
  return { harness: 'claude-code', level: null, reason: `No Claude Code session of this project was found under ${context.runtime.artifacts.claudeCode}.` };
}

const windowOf = (manifest: ProjectManifest | null): ImportWindow => manifest?.telemetry.import.windowDays ?? DEFAULT_WINDOW_DAYS;

/**
 * Queues an ingest of the project's artifacts behind the machine's others and returns it,
 * settling with why one of its files could not be read, if one could not. Which files have
 * anything to read is decided now, so a project with nothing new settles at once. `linked` is
 * the project's directory in each of its linked worktrees (`projectCheckouts`).
 */
export function startIngest(context: OperationContext, projectPath: string, manifest: ProjectManifest | null, linked: string[]): Promise<string | null> {
  const window = windowOf(manifest);
  const { files, failures } = claudeCodeSessions(context.runtime.artifacts.claudeCode, [projectPath, ...linked]);
  const pending = files.filter((path) => {
    try {
      return readPosition(context.store.cursor(path), statSync(path).size, window) !== null;
    } catch (error) {
      failures.push(unreadable(path, error));
      return false;
    }
  });
  if (pending.length === 0) return Promise.resolve(failures[0] ?? null);

  const { importer } = context;
  const run = importer.queue
    .then(async () => {
      // A record is the project's whose `cwd` it contains, or one of its linked worktrees does.
      const places = [
        ...readRegistry(context.home).map((entry) => ({ path: entry.path, project: entry.path })),
        ...linked.map((path) => ({ path, project: projectPath })),
      ];
      for (const path of pending) {
        // The yield between files is what lets a waiting call answer when its budget runs out.
        // ponytail: a single file is read in one go; read it in chunks if one ever outlasts the budget.
        await setImmediate();
        if (importer.stopped) break;
        const failure = ingestFile(context, path, window, places);
        if (failure) failures.push(failure);
      }
      return failures[0] ?? null;
    })
    .finally(() => {
      if (importer.running.get(projectPath)?.run === run) importer.running.delete(projectPath);
    });
  importer.running.set(projectPath, { run, window });
  // Nobody may be waiting on it, so its failure is logged here rather than left unhandled.
  importer.queue = run.then(
    () => undefined,
    (error: unknown) => console.error(error),
  );
  return run;
}

/**
 * Claude Code's directory name for the directory a session was launched in. It is lossy, so
 * it only selects candidates: every directory whose name starts with the project's, which
 * includes its subdirectories and the worktrees under it. Each record's own `cwd` decides.
 */
const claudeCodeDirectory = (path: string): string => path.replace(/[^a-zA-Z0-9]/g, '-');

/**
 * The main session files under Claude Code's `root` of the candidate directories of the
 * project's directories, in its own checkout and in each of its linked worktrees, and why a
 * directory could not be listed.
 */
export function claudeCodeSessions(root: string, directoriesOfProject: string[]): { files: string[]; failures: string[] } {
  const prefixes = directoriesOfProject.map(claudeCodeDirectory);
  const failures: string[] = [];

  let directories: string[];
  try {
    directories = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && prefixes.some((prefix) => entry.name.startsWith(prefix)))
      .map((entry) => join(root, entry.name));
  } catch (error) {
    return { files: [], failures: (error as NodeJS.ErrnoException).code === 'ENOENT' ? [] : [unreadable(root, error)] };
  }

  const files = directories.flatMap((directory) => {
    try {
      return readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
        .map((entry) => join(directory, entry.name));
    } catch (error) {
      failures.push(unreadable(directory, error));
      return [];
    }
  });
  return { files, failures };
}

/**
 * Where to read a file of `size` bytes from, or null when it has nothing new. A file that
 * shrank, or a window wider than the one its cursor was read under, is read from the
 * start; the unique constraint absorbs what was already stored.
 */
function readPosition(cursor: IngestCursor | null, size: number, window: ImportWindow): { offset: number; line: number } | null {
  const restart = cursor === null || size < cursor.size || wider(window, cursor.windowDays);
  const from = restart ? { offset: 0, line: 0 } : cursor;
  return size > from.offset ? from : null;
}

const wider = (window: ImportWindow, than: ImportWindow): boolean => than !== 'all' && (window === 'all' || window > than);

/**
 * Reads one file from its read position to its end, and returns why it could not be read,
 * if it could not. Its records and its cursor commit together; a failing line stops the
 * file just before it, and the next call tries it again. A record whose `cwd` lies in no
 * registered project, nor in a linked worktree of the one being read, is never stored, and
 * neither is one older than the window.
 *
 * ponytail: a record of another registered project found here is stored under that
 * project, but read under this one's window. That project's own ingest re-reads the file
 * when its window is wider, so nothing is lost, but two such projects with different
 * windows take turns re-reading the files they share.
 */
function ingestFile(context: OperationContext, path: string, window: ImportWindow, places: { path: string; project: string }[]): string | null {
  let size: number;
  let from: { offset: number; line: number } | null;
  let bytes: Buffer;
  try {
    // Decided again: the file, or its cursor, may have moved while this ingest was queued.
    size = statSync(path).size;
    from = readPosition(context.store.cursor(path), size, window);
    if (from === null) return null;
    bytes = readFrom(path, from.offset, size);
  } catch (error) {
    // A file that vanished or cannot be opened is reported, never a failed snapshot.
    return unreadable(path, error);
  }

  const windowStart = window === 'all' ? '' : localMidnight(window - 1).toISOString();
  const reading = readClaudeCode(bytes, from);
  const records: Ingested[] = [];
  for (const record of reading.records) {
    const project = containingEntry(record.cwd, places)?.project;
    if (project && record.timestamp >= windowStart) records.push({ record, projectPath: project, sourceRef: path });
  }
  context.store.ingest({ path, size, offset: reading.stop.offset, line: reading.stop.line, windowDays: window }, records);
  return reading.failure ? `${path} could not be read at line ${reading.failure.line}: ${reading.failure.reason}.` : null;
}

const unreadable = (path: string, error: unknown): string => `${path} could not be read (${(error as NodeJS.ErrnoException).code ?? 'error'}).`;

function readFrom(path: string, offset: number, size: number): Buffer {
  const buffer = Buffer.alloc(size - offset);
  const fd = openSync(path, 'r');
  try {
    return buffer.subarray(0, readSync(fd, buffer, 0, buffer.length, offset));
  } finally {
    closeSync(fd);
  }
}

/** Local midnight `days` days before today. */
function localMidnight(days: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
}

const localDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
