import { randomBytes } from 'node:crypto';
import { closeSync, fstatSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, writeSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Diagnostic, TrackerProvider } from '@binnacle/core';

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

/**
 * How long one `git` invocation may take before its facts are reported unavailable.
 * `BINNACLE_GIT_TIMEOUT_MS` raises it for a repository on a slow filesystem; the daemon
 * reads it from its own environment, so it takes effect from the next daemon start.
 */
const DEFAULT_GIT_TIMEOUT_MS = 5_000;

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
/** Read-only tracker tokens, a JSON object keyed by host. Binnacle reads it and never writes it. */
export const credentialsPath = (home: string): string => join(home, 'credentials.json');

/** This machine's own settings, a JSON object the owner (or `binn init`) writes: `obsidian.vaultPath`. Binnacle's daemon only reads it. */
export const settingsPath = (home: string): string => join(home, 'settings.json');

/** The credentials file's key for a tracker: `tracker.host` as written, or the provider's default host. */
export const credentialsKey = (provider: Exclude<TrackerProvider, 'local'>, host: string | null): string => host ?? `${provider}.com`;

/** A token as an HTTP header can carry it. Anything else is refused before it can be sent, or quoted back in an error. */
const USABLE_TOKEN = /^[\x21-\x7e]+$/;

/**
 * The token a tracker on `host` is read with, looked up on every call, in this order:
 * `BINNACLE_<PROVIDER>_TOKEN` from the daemon's environment; then the declared host's entry
 * in the credentials file, keyed by `tracker.host` as written, or by the provider's default
 * host when none is; then none, and the read is anonymous. Generic names like `GITHUB_TOKEN`
 * are never read, and nothing is taken from `gh` or `glab`: those tokens can usually write.
 * A token never appears in a diagnostic; `failure` names only where it came from.
 */
export function trackerToken(
  home: string,
  provider: Exclude<TrackerProvider, 'local'>,
  host: string | null,
  env: NodeJS.ProcessEnv = process.env,
): { token: string | null } | { failure: Diagnostic } {
  const variable = `BINNACLE_${provider.toUpperCase()}_TOKEN`;
  const path = credentialsPath(home);
  const unusable = (source: string): { failure: Diagnostic } => ({
    failure: { code: 'tracker.unavailable', message: `${source} is not a usable token, so the tracker was not read.` },
  });

  const fromEnv = env[variable]?.trim();
  if (fromEnv) return USABLE_TOKEN.test(fromEnv) ? { token: fromEnv } : unusable(variable);

  let text: string;
  try {
    // One descriptor for the check and the read, so the file checked is the file read.
    const fd = openSync(path, 'r');
    try {
      // Only where there are POSIX modes; on Windows the profile's ACL protects the file.
      if (process.platform !== 'win32' && (fstatSync(fd).mode & 0o077) !== 0) {
        return {
          failure: {
            code: 'tracker.credentials_insecure',
            message: `${path} can be read by others than its owner, so it was not read; make it owner-only (chmod 600).`,
          },
        };
      }
      text = readFileSync(fd, 'utf8');
    } finally {
      closeSync(fd);
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { token: null };
    return { failure: { code: 'tracker.unavailable', message: `${path} could not be read (${code ?? 'error'}).` } };
  }

  let entries: unknown;
  try {
    entries = JSON.parse(text);
  } catch {
    // Never the parser's message: it quotes the text, which holds tokens.
    entries = null;
  }
  if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) {
    return { failure: { code: 'tracker.unavailable', message: `${path} is not a JSON object of host to token, so the tracker was not read.` } };
  }
  const key = credentialsKey(provider, host);
  if (!Object.hasOwn(entries, key)) return { token: null };
  const entry: unknown = (entries as Record<string, unknown>)[key];
  const token = typeof entry === 'string' ? entry.trim() : '';
  return USABLE_TOKEN.test(token) ? { token } : unusable(`The entry for ${key} in ${path}`);
}

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
  artifacts: ArtifactRoots;
};

/** Where each harness keeps the session artifacts the daemon reads usage from. It only ever reads there. */
export type ArtifactRoots = { claudeCode: string; codex: string };

/**
 * Claude Code's: `$CLAUDE_CONFIG_DIR/projects`, otherwise `~/.claude/projects`. Codex's:
 * `$CODEX_HOME/sessions`, otherwise `~/.codex/sessions`.
 */
export function resolveArtifactRoots(env: NodeJS.ProcessEnv = process.env): ArtifactRoots {
  const claude = env.CLAUDE_CONFIG_DIR?.trim();
  const codex = env.CODEX_HOME?.trim();
  return {
    claudeCode: join(claude ? claude : join(homedir(), '.claude'), 'projects'),
    codex: join(codex ? codex : join(homedir(), '.codex'), 'sessions'),
  };
}

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
