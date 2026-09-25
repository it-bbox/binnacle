import { closeSync, openSync, readdirSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readClaudeCode } from '@binnacle/adapters';
import type { ProjectManifest } from '@binnacle/core';
import { magnitude, sum, type Harness, type Totals } from '@binnacle/telemetry';
import type { OperationContext } from './operations.ts';
import { containingEntry, readRegistry } from './registry.ts';
import { limited, UNAVAILABLE, type Unavailable } from './snapshot.ts';
import type { Ingested } from './store.ts';

/** The import window when the manifest writes none: the horizon of Git's own reflog. */
const DEFAULT_WINDOW_DAYS = 90;

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
  /** Whether this project's import is still incomplete, and the local date its window starts. */
  importing: { incomplete: boolean; windowStart: string };
  today: Totals;
  last7Days: Totals;
  byModel: { items: { model: string | null; totals: Totals }[]; remainder: number };
  tasks: Unavailable;
  unassigned: Unavailable;
  harnesses: HarnessLevel[];
};

/**
 * Reads what is new in the Claude Code artifacts of `projectPath` and answers the snapshot's
 * `usage` section from everything stored. "Today" and "the last seven days" are calendar
 * days in the daemon's local time zone.
 */
export function usage(context: OperationContext, projectPath: string, manifest: ProjectManifest | null): Usage {
  const windowDays = manifest?.telemetry.import.windowDays ?? DEFAULT_WINDOW_DAYS;
  const failure = ingest(context, projectPath, windowDays);

  const week = context.store.usage(projectPath, 'claude-code', localMidnight(6).toISOString());
  const since = localMidnight(0).toISOString();
  const today = week.filter((record) => record.timestamp >= since);

  const models = new Map<string | null, typeof week>();
  for (const record of week) models.set(record.model, [...(models.get(record.model) ?? []), record]);
  const byModel = [...models].map(([model, records]) => ({ model, totals: sum(records) }));
  byModel.sort((a, b) => magnitude(b.totals) - magnitude(a.totals) || String(a.model).localeCompare(String(b.model), 'en'));

  return {
    importing: { incomplete: false, windowStart: localDate(localMidnight(windowDays - 1)) },
    today: sum(today),
    last7Days: sum(week),
    byModel: limited(byModel),
    tasks: UNAVAILABLE,
    unassigned: UNAVAILABLE,
    harnesses: [level(context, projectPath, failure)],
  };
}

function level(context: OperationContext, projectPath: string, failure: string | null): HarnessLevel {
  if (failure !== null) return { harness: 'claude-code', level: 1, reason: failure };
  const { records, withTokens } = context.store.usageCounts(projectPath, 'claude-code');
  if (withTokens > 0) return { harness: 'claude-code', level: 3, reason: null };
  if (records > 0) return { harness: 'claude-code', level: 2, reason: null };
  return { harness: 'claude-code', level: null, reason: `No Claude Code session of this project was found under ${context.runtime.artifacts.claudeCode}.` };
}

/**
 * Claude Code's directory name for the directory a session was launched in. It is lossy, so
 * it only selects candidates: every directory whose name starts with the project's, which
 * includes its subdirectories and the worktrees under it. Each record's own `cwd` decides.
 */
const claudeCodeDirectory = (path: string): string => path.replace(/[^a-zA-Z0-9]/g, '-');

/**
 * Reads the new tail of every main session file of the project's candidate directories,
 * and returns why one of them could not be read, if one could not. Each file's records and
 * its cursor commit together; a failing line stops that file just before it, and the next
 * call tries it again. A record whose `cwd` lies in no registered project is never stored,
 * and neither is one older than the window.
 *
 * ponytail: a record in another registered project found here is stored under that
 * project, but read under this one's window.
 */
function ingest(context: OperationContext, projectPath: string, windowDays: number): string | null {
  const root = context.runtime.artifacts.claudeCode;
  const prefix = claudeCodeDirectory(projectPath);
  const registered = readRegistry(context.home);
  const windowStart = localMidnight(windowDays - 1).toISOString();
  const failures: string[] = [];

  let directories: string[];
  try {
    directories = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
      .map((entry) => join(root, entry.name));
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? null : unreadable(root, error);
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

  for (const path of files) {
    const cursor = context.store.cursor(path) ?? { path, size: 0, offset: 0, line: 0, windowDays };
    let size: number;
    let bytes: Buffer;
    try {
      size = statSync(path).size;
      // ponytail: a file that shrank is left alone until re-reading from the start lands.
      if (size <= cursor.offset) continue;
      bytes = readFrom(path, cursor.offset, size);
    } catch (error) {
      // A file that vanished or cannot be opened is reported, never a failed snapshot.
      failures.push(unreadable(path, error));
      continue;
    }

    const reading = readClaudeCode(bytes, cursor);
    const records: Ingested[] = [];
    for (const record of reading.records) {
      const project = containingEntry(record.cwd, registered);
      if (project && record.timestamp >= windowStart) records.push({ record, projectPath: project.path, sourceRef: path });
    }
    context.store.ingest({ path, size, offset: reading.stop.offset, line: reading.stop.line, windowDays }, records);
    if (reading.failure) failures.push(`${path} could not be read at line ${reading.failure.line}: ${reading.failure.reason}.`);
  }
  return failures[0] ?? null;
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
