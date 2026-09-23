import { randomBytes } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, writeSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * The Binnacle home directory holds everything this machine keeps about Binnacle
 * itself: the daemon's runtime file, the API token and (from ticket 02) the store.
 *
 * `0o600` / `0o700` are POSIX concepts. On Windows they are ignored: these files
 * are protected by the user profile's ACL and by nothing Binnacle does.
 */
export const OWNER_ONLY_FILE = 0o600;
export const OWNER_ONLY_DIR = 0o700;

export const DEFAULT_PORT = 7717;

export function resolveHome(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.BINNACLE_HOME?.trim();
  return override ? override : join(homedir(), '.binnacle');
}

export function resolvePort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.BINNACLE_PORT?.trim();
  if (!raw) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`BINNACLE_PORT must be an integer between 0 and 65535, got ${JSON.stringify(raw)}`);
  }
  return port;
}

/** How long one `git` invocation may take before its facts are reported unavailable. */
export const DEFAULT_GIT_TIMEOUT_MS = 5_000;

/** Read at call time, so a slow filesystem can be given more room without a restart of anything else. */
export function resolveGitTimeout(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.BINNACLE_GIT_TIMEOUT_MS?.trim();
  const timeout = raw ? Number(raw) : DEFAULT_GIT_TIMEOUT_MS;
  return Number.isInteger(timeout) && timeout > 0 ? timeout : DEFAULT_GIT_TIMEOUT_MS;
}

export function ensureHome(home: string): string {
  mkdirSync(home, { recursive: true, mode: OWNER_ONLY_DIR });
  return home;
}

export const tokenPath = (home: string): string => join(home, 'token');
export const runtimePath = (home: string): string => join(home, 'runtime.json');
export const logPath = (home: string): string => join(home, 'daemon.log');
/** The project registry is a file, not a table (ADR-0019). */
export const registryPath = (home: string): string => join(home, 'projects.json');
export const storePath = (home: string): string => join(home, 'binnacle.db');

/**
 * Writes a file owner-only, but only if it does not exist yet. Returns false when
 * something is already there, so that two processes racing for the same path cannot
 * overwrite each other.
 */
export function createExclusive(path: string, contents: string): boolean {
  let fd;
  try {
    fd = openSync(path, 'wx', OWNER_ONLY_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }
  try {
    writeSync(fd, contents);
  } finally {
    closeSync(fd);
  }
  return true;
}

/** Reads the API token, creating it owner-only on first call. */
export function ensureToken(home: string): string {
  const existing = readToken(home);
  if (existing) return existing;

  const path = tokenPath(home);
  createExclusive(path, randomBytes(32).toString('hex'));
  // Either we wrote it or a racing process did; read back whichever token won.
  const token = readToken(home);
  if (!token) throw new Error(`Could not create the Binnacle API token at ${path}.`);
  return token;
}

export function readToken(home: string): string | null {
  const contents = readIfPresent(tokenPath(home))?.trim();
  return contents ? contents : null;
}

export type Runtime = {
  pid: number;
  host: string;
  port: number;
  startedAt: string;
  version: string;
};

export function writeRuntime(home: string, runtime: Runtime): void {
  writeFileSync(runtimePath(home), `${JSON.stringify(runtime, null, 2)}\n`, { mode: OWNER_ONLY_FILE });
}

/**
 * Creates the runtime file only if it is absent, so that the file itself is the claim
 * on this Binnacle home. Returns false when another process got there first — which is
 * the window a check-then-write would leave open for two daemons and one database.
 */
export function tryClaimRuntime(home: string, runtime: Runtime): boolean {
  return createExclusive(runtimePath(home), `${JSON.stringify(runtime, null, 2)}\n`);
}

/** Removes the runtime file only if it still names this pid, so that one daemon never clears another's claim. */
export function releaseRuntime(home: string, pid: number): void {
  if (readRuntime(home)?.pid === pid) removeRuntime(home);
}

/** Returns null when there is no runtime file, or when it is unreadable — both mean "no daemon here". */
export function readRuntime(home: string): Runtime | null {
  const contents = readIfPresent(runtimePath(home));
  if (contents === null) return null;
  try {
    const parsed: unknown = JSON.parse(contents);
    return isRuntime(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function removeRuntime(home: string): void {
  rmSync(runtimePath(home), { force: true });
}

/**
 * ponytail: liveness is a pid check, so a recycled pid can look like a live daemon.
 * Callers that can afford a round trip confirm with the liveness endpoint.
 */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function readIfPresent(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function isRuntime(value: unknown): value is Runtime {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.pid === 'number' &&
    typeof candidate.host === 'string' &&
    typeof candidate.port === 'number' &&
    typeof candidate.startedAt === 'string' &&
    typeof candidate.version === 'string'
  );
}
