import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { codexSession } from '@binnacle/adapters';
import { claudeCodeSessions, codexSessions, containingEntry, projectCheckouts, resolveArtifactRoots } from '@binnacle/daemon';

/**
 * Where each harness keeps its session files, and where a session names its `cwd`: Claude
 * Code on any record that has one, Codex on its `session_meta` record, which comes first.
 */
const HISTORIES: { name: string; files(directories: string[]): string[]; cwd(record: Record<string, unknown>): unknown }[] = [
  {
    name: 'Claude Code',
    files: (directories) => claudeCodeSessions(resolveArtifactRoots().claudeCode, directories).files,
    cwd: (record) => record.cwd,
  },
  {
    name: 'Codex',
    files: () => codexSessions(resolveArtifactRoots().codex).files,
    cwd: (record) => codexSession(record)?.cwd,
  },
];

/**
 * Per harness, the sessions whose `cwd` lies in `root` or in the same directory of one of its
 * linked worktrees, as the daemon attributes them, and the start of the oldest, in
 * milliseconds. Each file is read only up to its first record that names a `cwd`, which also
 * gives the session's start; a file with no such record among its first `START_LINES`, or
 * none that can be read, is not counted.
 */
export async function sessionHistory(root: string): Promise<{ name: string; sessions: number; oldest: number }[]> {
  const directories = [root, ...(await projectCheckouts(root)).linked];
  const checkouts = directories.map((path) => ({ path }));
  const histories = [];
  for (const { name, files, cwd } of HISTORIES) {
    let sessions = 0;
    let oldest = Infinity;
    for (const path of files(directories)) {
      const start = await sessionStart(path, cwd);
      if (!start || !containingEntry(start.cwd, checkouts)) continue;
      sessions += 1;
      oldest = Math.min(oldest, start.time);
    }
    histories.push({ name, sessions, oldest });
  }
  return histories;
}

/** How far into a file its first record naming a `cwd` is looked for: the owner's sessions have it by line 30. */
const START_LINES = 100;

async function sessionStart(path: string, cwdOf: (record: Record<string, unknown>) => unknown): Promise<{ cwd: string; time: number } | null> {
  const input = createReadStream(path);
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    let read = 0;
    for await (const line of lines) {
      if (++read > START_LINES) return null;
      let record: unknown;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (!isRecord(record)) continue;
      const cwd = cwdOf(record);
      if (typeof cwd !== 'string') continue;
      const time = typeof record.timestamp === 'string' ? Date.parse(record.timestamp) : NaN;
      return Number.isNaN(time) ? null : { cwd, time };
    }
    return null;
  } catch {
    // A file that vanished or cannot be opened is not counted.
    return null;
  } finally {
    lines.close();
    input.destroy();
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
