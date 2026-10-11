import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import type { Diagnostic, ProjectManifest } from '@binnacle/core';
import { OperationError } from './errors.ts';
import { OWNER_ONLY_FILE, settingsPath } from './home.ts';

/**
 * The Parallel limit (`CONTEXT.md`, ADR-0041): how many Tasks autopilot works on at once. A
 * property of the machine, kept in the Binnacle home's `settings.json` under `parallelLimit`,
 * a whole number up to `PARALLEL_BOUND` or `"auto"`; 2 when unset. A project manifest's
 * `automation.max_parallel_development_tasks` wins for its project. The dashboard's Settings
 * page sets it through the daemon, the one setting it writes.
 */
export const DEFAULT_PARALLEL_LIMIT = 2;
/** *auto*'s ceiling: it never starts more agents than this. */
export const AUTO_CEILING = 4;
/** The largest number the machine's setting takes. */
export const PARALLEL_BOUND = 16;
const KEY = 'parallelLimit';

export type ParallelLimit = { limit: number; mode: 'number' | 'auto'; source: 'manifest' | 'machine' | 'default' };

const usable = (value: unknown): value is number | 'auto' =>
  value === 'auto' || (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= PARALLEL_BOUND);

const RULE = `The Parallel limit is a whole number from 1 to ${PARALLEL_BOUND}, or "auto"`;

/** The settings file as an object, `{}` when there is none; null when it cannot be read as a JSON object. */
function readSettings(file: string): Record<string, unknown> | null {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    return null;
  }
  try {
    const settings: unknown = JSON.parse(text);
    return typeof settings === 'object' && settings !== null && !Array.isArray(settings) ? (settings as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The limit `value` gives, from `source`. */
const limitOf = (value: number | 'auto', source: 'manifest' | 'machine'): ParallelLimit =>
  value === 'auto' ? { limit: AUTO_CEILING, mode: 'auto', source } : { limit: value, mode: 'number', source };

/** The machine's limit, read now, and why the file's value is not used when it cannot be. */
export function machineParallelLimit(home: string): { parallel: ParallelLimit; attention: Diagnostic[] } {
  const file = settingsPath(home);
  const settings = readSettings(file);
  const value = settings?.[KEY];
  if (usable(value)) return { parallel: limitOf(value, 'machine'), attention: [] };
  const fallback: ParallelLimit = { limit: DEFAULT_PARALLEL_LIMIT, mode: 'number', source: 'default' };
  if (settings !== null && value === undefined) return { parallel: fallback, attention: [] };
  const why = settings === null ? `${file} cannot be read as a JSON object` : `${RULE}, and ${KEY} in ${file} is not one`;
  return { parallel: fallback, attention: [{ code: 'parallel_limit.invalid', message: `${why}, so the limit is ${DEFAULT_PARALLEL_LIMIT}.` }] };
}

/** The limit a project works under: its manifest's, or else the machine's. */
export function parallelLimit(home: string, manifest: ProjectManifest | null): { parallel: ParallelLimit; attention: Diagnostic[] } {
  const own = manifest?.automation.maxParallelDevelopmentTasks ?? null;
  return own === null ? machineParallelLimit(home) : { parallel: limitOf(own, 'manifest'), attention: [] };
}

/**
 * Sets the machine's limit: rewrites `parallelLimit` alone, keeping every other key of the file,
 * owner-only. A value that is not one is refused with the rule; a file that cannot be read as a
 * JSON object is never overwritten, since that would lose what it holds.
 */
export function setParallelLimit(home: string, body: unknown): ParallelLimit {
  const value = typeof body === 'object' && body !== null ? (body as { limit?: unknown }).limit : undefined;
  if (!usable(value)) throw new OperationError('parallel_limit.invalid', `${RULE}; ${describe(value)} is not.`);
  const file = settingsPath(home);
  const settings = readSettings(file);
  if (settings === null) throw new OperationError('settings.unreadable', `${file} cannot be read as a JSON object, so it is not rewritten. Fix it by hand.`, 409);
  // A fresh temporary file, so that one left behind, or a link in its place, never decides the mode or the target.
  const temporary = `${file}.tmp`;
  rmSync(temporary, { force: true });
  writeFileSync(temporary, `${JSON.stringify({ ...settings, [KEY]: value }, null, 2)}\n`, { mode: OWNER_ONLY_FILE, flag: 'wx' });
  // ponytail: read and rewritten in one synchronous step, so the daemon never races itself; a `binn init` writing
  // the vault at the same instant can still lose one of the two changes. A lock file if that ever happens.
  renameSync(temporary, file);
  return limitOf(value, 'machine');
}

/** Names a refused value without quoting a string back. */
function describe(value: unknown): string {
  if (value === undefined) return 'nothing';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return 'a string other than "auto"';
  return value === null ? 'null' : Array.isArray(value) ? 'a list' : typeof value;
}
