import { closeSync, openSync, readdirSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { setImmediate, setTimeout } from 'node:timers/promises';
import { readClaudeCode } from '@binnacle/adapters';
import type { ProjectManifest } from '@binnacle/core';
import { magnitude, sum, type Harness, type Totals } from '@binnacle/telemetry';
import type { OperationContext } from './operations.ts';
import { containingEntry, readRegistry, type RegistryEntry } from './registry.ts';
import { limited, UNAVAILABLE, type Unavailable } from './snapshot.ts';
import type { Ingested, IngestCursor } from './store.ts';

/** The import window when the manifest writes none: the horizon of Git's own reflog. */
const DEFAULT_WINDOW_DAYS = 90;

/** How long a call waits for its project's ingest before answering from what is stored. */
export const INGEST_BUDGET_MS = 1000;

/** A number of days, or everything on disk. */
type Window = number | 'all';

/**
 * The daemon's ingests: one at a time on this machine, each queued behind the one before,
 * and at most one queued or running per project, which a call waits for rather than
 * starting another.
 */
export type Importer = {
  budgetMs: number;
  queue: Promise<void>;
  running: Map<string, Promise<string | null>>;
  /** Set when the daemon stops: a running ingest ends before its next file. */
  stopped: boolean;
};

export const importer = (budgetMs: number): Importer => ({ budgetMs, queue: Promise.resolve(), running: new Map(), stopped: false });

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
  tasks: Unavailable;
  unassigned: Unavailable;
  harnesses: HarnessLevel[];
};

/**
 * Reads what is new in the Claude Code artifacts of `projectPath`, for as long as the time
 * budget allows, and answers the snapshot's `usage` section from everything stored. What
 * the budget does not cover goes on in the background. "Today" and "the last seven days"
 * are calendar days in the daemon's local time zone.
 */
export async function usage(context: OperationContext, projectPath: string, manifest: ProjectManifest | null): Promise<Usage> {
  const window = windowOf(manifest);
  const { running, budgetMs } = context.importer;
  const run = running.get(projectPath) ?? startIngest(context, projectPath, manifest);
  if (budgetMs > 0) await Promise.race([run, setTimeout(budgetMs, undefined, { ref: false })]);
  // A run leaves `running` as it settles, so one still there is still going.
  const incomplete = running.get(projectPath) === run;
  const failure = incomplete ? null : await run;

  const week = context.store.usage(projectPath, 'claude-code', localMidnight(6).toISOString());
  const since = localMidnight(0).toISOString();
  const today = week.filter((record) => record.timestamp >= since);

  const models = new Map<string | null, typeof week>();
  for (const record of week) models.set(record.model, [...(models.get(record.model) ?? []), record]);
  const byModel = [...models].map(([model, records]) => ({ model, totals: sum(records) }));
  byModel.sort((a, b) => magnitude(b.totals) - magnitude(a.totals) || String(a.model).localeCompare(String(b.model), 'en'));

  return {
    importing: { incomplete, windowStart: window === 'all' ? null : localDate(localMidnight(window - 1)) },
    today: sum(today),
    last7Days: sum(week),
    byModel: limited(byModel),
    tasks: UNAVAILABLE,
    unassigned: UNAVAILABLE,
    harnesses: [level(context, projectPath, failure, incomplete)],
  };
}

function level(context: OperationContext, projectPath: string, failure: string | null, incomplete: boolean): HarnessLevel {
  if (failure !== null) return { harness: 'claude-code', level: 1, reason: failure };
  const { records, withTokens } = context.store.usageCounts(projectPath, 'claude-code');
  if (withTokens > 0) return { harness: 'claude-code', level: 3, reason: null };
  if (records > 0) return { harness: 'claude-code', level: 2, reason: null };
  if (incomplete) return { harness: 'claude-code', level: null, reason: 'The import of this project has not reached a record yet.' };
  return { harness: 'claude-code', level: null, reason: `No Claude Code session of this project was found under ${context.runtime.artifacts.claudeCode}.` };
}

const windowOf = (manifest: ProjectManifest | null): Window => manifest?.telemetry.import.windowDays ?? DEFAULT_WINDOW_DAYS;

/**
 * Queues an ingest of the project's artifacts behind the machine's others and returns it,
 * settling with why one of its files could not be read, if one could not. Which files have
 * anything to read is decided now, so a project with nothing new settles at once.
 */
export function startIngest(context: OperationContext, projectPath: string, manifest: ProjectManifest | null): Promise<string | null> {
  const window = windowOf(manifest);
  const { files, failures } = candidates(context, projectPath);
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
      const registered = readRegistry(context.home);
      for (const path of pending) {
        // The yield between files is what lets a waiting call answer when its budget runs out.
        // ponytail: a single file is read in one go; read it in chunks if one ever outlasts the budget.
        await setImmediate();
        if (importer.stopped) break;
        const failure = ingestFile(context, path, window, registered);
        if (failure) failures.push(failure);
      }
      return failures[0] ?? null;
    })
    .finally(() => importer.running.delete(projectPath));
  importer.running.set(projectPath, run);
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

/** The main session files of the project's candidate directories, and why a directory could not be listed. */
function candidates(context: OperationContext, projectPath: string): { files: string[]; failures: string[] } {
  const root = context.runtime.artifacts.claudeCode;
  const prefix = claudeCodeDirectory(projectPath);
  const failures: string[] = [];

  let directories: string[];
  try {
    directories = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
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
function readPosition(cursor: IngestCursor | null, size: number, window: Window): { offset: number; line: number } | null {
  const restart = cursor === null || size < cursor.size || wider(window, cursor.windowDays);
  const from = restart ? { offset: 0, line: 0 } : cursor;
  return size > from.offset ? from : null;
}

const wider = (window: Window, than: Window): boolean => than !== 'all' && (window === 'all' || window > than);

/**
 * Reads one file from its read position to its end, and returns why it could not be read,
 * if it could not. Its records and its cursor commit together; a failing line stops the
 * file just before it, and the next call tries it again. A record whose `cwd` lies in no
 * registered project is never stored, and neither is one older than the window.
 *
 * ponytail: a record of another registered project found here is stored under that
 * project, but read under this one's window. That project's own ingest re-reads the file
 * when its window is wider, so nothing is lost, but two such projects with different
 * windows take turns re-reading the files they share.
 */
function ingestFile(context: OperationContext, path: string, window: Window, registered: RegistryEntry[]): string | null {
  let size: number;
  let from: { offset: number; line: number } | null;
  let bytes: Buffer;
  try {
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
    const project = containingEntry(record.cwd, registered);
    if (project && record.timestamp >= windowStart) records.push({ record, projectPath: project.path, sourceRef: path });
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
