import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import type { Diagnostic, ProjectManifest } from '@binnacle/core';
import { OperationError } from './errors.ts';
import { OWNER_ONLY_FILE, settingsPath } from './home.ts';

/**
 * The machine's two settings the dashboard's Settings page writes through the daemon, each one
 * key of the Binnacle home's `settings.json`: the Parallel limit and the context-pressure thresholds.
 *
 * The Parallel limit (`CONTEXT.md`, ADR-0041): how many Tasks autopilot works on at once. A
 * property of the machine, kept under `parallelLimit`, a whole number up to `PARALLEL_BOUND` or
 * `"auto"`; 2 when unset. A project manifest's `automation.max_parallel_development_tasks` wins
 * for its project.
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
  const params = settings === null ? { kind: 'file', file, limit: DEFAULT_PARALLEL_LIMIT } : { kind: 'setting', file, max: PARALLEL_BOUND, limit: DEFAULT_PARALLEL_LIMIT };
  return { parallel: fallback, attention: [{ code: 'parallel_limit.invalid', message: `${why}, so the limit is ${DEFAULT_PARALLEL_LIMIT}.`, params }] };
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
  if (!usable(value)) {
    const got = describe(value, 'a string other than "auto"');
    throw new OperationError('parallel_limit.invalid', `${RULE}; ${got} is not.`, 400, undefined, { kind: 'value', max: PARALLEL_BOUND, got });
  }
  writeKey(home, KEY, value);
  return limitOf(value, 'machine');
}

/**
 * Rewrites `key` alone in the settings file, keeping every other key, owner-only. A file that
 * cannot be read as a JSON object is never overwritten, since that would lose what it holds.
 */
function writeKey(home: string, key: string, value: unknown): void {
  const file = settingsPath(home);
  const settings = readSettings(file);
  if (settings === null) throw new OperationError('settings.unreadable', `${file} cannot be read as a JSON object, so it is not rewritten. Fix it by hand.`, 409, undefined, { file });
  // A fresh temporary file, so that one left behind, or a link in its place, never decides the mode or the target.
  const temporary = `${file}.tmp`;
  rmSync(temporary, { force: true });
  writeFileSync(temporary, `${JSON.stringify({ ...settings, [key]: value }, null, 2)}\n`, { mode: OWNER_ONLY_FILE, flag: 'wx' });
  // ponytail: read and rewritten in one synchronous step, so the daemon never races itself; a `binn init` writing
  // the vault at the same instant can still lose one of the two changes. A lock file if that ever happens.
  renameSync(temporary, file);
}

/** Names a refused value by its shape, a number as it is, without quoting a string back. */
function describe(value: unknown, string = 'a string'): string {
  if (value === undefined) return 'nothing';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return string;
  return value === null ? 'null' : Array.isArray(value) ? 'a list' : typeof value === 'object' ? 'a mapping' : typeof value;
}

/**
 * The context-pressure thresholds (ADR-0046): the context, in tokens, from which an active
 * Product session raises `context.pressure`. Kept under `contextPressure`, `{ tokens, models }`:
 * the machine's default and a number per model name, each a whole number of at least
 * `PRESSURE_FLOOR`; 150 000 when unset. A project manifest's `telemetry.context_pressure.tokens`
 * wins for its project, for every model. Binnacle ships no table of models.
 */
export const DEFAULT_PRESSURE_TOKENS = 150_000;
/** The least number of tokens a threshold takes. */
export const PRESSURE_FLOOR = 1000;
/** The longest model name a threshold is kept under. */
export const MODEL_NAME_BOUND = 200;
const PRESSURE_KEY = 'contextPressure';
const PRESSURE_RULE = `The context-pressure thresholds are tokens, the default, and models, a number for each model name, not blank and at most ${MODEL_NAME_BOUND} characters, each a whole number of at least ${PRESSURE_FLOOR}`;

/** The machine's thresholds: its default, `machine` when the file sets it, and its numbers by model name. */
export type PressureThresholds = { tokens: number; models: Record<string, number>; source: 'machine' | 'default' };

const enoughTokens = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= PRESSURE_FLOOR;

/** What a value of `contextPressure` breaks, as `context_pressure.invalid`'s params name it. */
type Broken = { field: 'tokens' | 'models' | 'model'; got: string } | { field: 'name' };

/**
 * The thresholds `value` holds, or what it breaks. The file may leave either key out; `whole`,
 * a write, needs both. A name is kept as an own property only, so no name reaches a prototype.
 */
function thresholdsOf(value: unknown, whole: boolean): { tokens: number | null; models: Record<string, number> } | Broken {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { field: 'tokens', got: describe(value) };
  const { tokens, models = whole ? undefined : {} } = value as { tokens?: unknown; models?: unknown };
  if (!(enoughTokens(tokens) || (!whole && tokens === undefined))) return { field: 'tokens', got: describe(tokens) };
  if (typeof models !== 'object' || models === null || Array.isArray(models)) return { field: 'models', got: describe(models) };
  const entries = Object.entries(models);
  for (const [name, number] of entries) {
    if (name.trim() === '' || name.length > MODEL_NAME_BOUND) return { field: 'name' };
    if (!enoughTokens(number)) return { field: 'model', got: describe(number) };
  }
  return { tokens: tokens ?? null, models: Object.fromEntries(entries) as Record<string, number> };
}

/** The machine's thresholds, read now, and why the file's value is not used when it cannot be: then 150 000 for every model. */
export function machinePressureThresholds(home: string): { thresholds: PressureThresholds; attention: Diagnostic[] } {
  const file = settingsPath(home);
  const settings = readSettings(file);
  const value = settings?.[PRESSURE_KEY];
  const fallback: PressureThresholds = { tokens: DEFAULT_PRESSURE_TOKENS, models: {}, source: 'default' };
  if (settings !== null && value === undefined) return { thresholds: fallback, attention: [] };
  const read = settings === null ? null : thresholdsOf(value, false);
  if (read !== null && !('field' in read)) {
    return { thresholds: { tokens: read.tokens ?? DEFAULT_PRESSURE_TOKENS, models: read.models, source: read.tokens === null ? 'default' : 'machine' }, attention: [] };
  }
  const why = settings === null ? `${file} cannot be read as a JSON object` : `${PRESSURE_RULE}, and ${PRESSURE_KEY} in ${file} is not`;
  const params = settings === null ? { kind: 'file', file, tokens: DEFAULT_PRESSURE_TOKENS } : { kind: 'setting', file, min: PRESSURE_FLOOR, max: MODEL_NAME_BOUND, tokens: DEFAULT_PRESSURE_TOKENS };
  return {
    thresholds: fallback,
    attention: [{ code: 'context_pressure.invalid', message: `${why}, so the context-pressure threshold is ${DEFAULT_PRESSURE_TOKENS}.`, params }],
  };
}

/**
 * Sets the machine's thresholds: takes the whole `{ tokens, models }` and rewrites
 * `contextPressure` alone, as `setParallelLimit` rewrites its key. A value that is not one is
 * refused with the rule and what breaks it, never quoting a name back.
 */
export function setPressureThresholds(home: string, body: unknown): PressureThresholds {
  const value = typeof body === 'object' && body !== null ? { tokens: (body as { tokens?: unknown }).tokens, models: (body as { models?: unknown }).models } : body;
  const read = thresholdsOf(value, true);
  if ('field' in read) {
    const which =
      read.field === 'name'
        ? `a model name is blank or longer than ${MODEL_NAME_BOUND} characters`
        : `${read.got}, given for ${read.field === 'model' ? "a model's number" : read.field}, is not`;
    throw new OperationError('context_pressure.invalid', `${PRESSURE_RULE}; ${which}.`, 400, undefined, { kind: 'value', min: PRESSURE_FLOOR, max: MODEL_NAME_BOUND, ...read });
  }
  writeKey(home, PRESSURE_KEY, { tokens: read.tokens, models: read.models });
  return { tokens: read.tokens!, models: read.models, source: 'machine' };
}
