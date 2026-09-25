import { spawn } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import type { Tree } from './tree.ts';

/**
 * The Git adapter. It reads and never writes, and that holds by construction rather
 * than by care:
 *
 * - only inspecting commands run — `rev-parse`, `symbolic-ref` without a new value,
 *   `worktree list`, `status`, `remote -v`, `log` (the reflog's too), `show`, `ls-tree`,
 *   `merge-base --is-ancestor` — and nothing that fetches, writes, or changes config or refs;
 * - a revision is only ever passed as a commit hash, never as caller text that git could
 *   read as an option, and a caller's path only after `--` as a `:(literal)` pathspec;
 * - `--no-optional-locks` stops `status` refreshing the index, which it otherwise does
 *   as a side effect, and `core.fsmonitor=false` stops it running the hook a
 *   repository's config may name;
 * - `git` is spawned with an argument array and no shell, so nothing is ever parsed as
 *   a command line;
 * - every spawn has a timeout, and a git that does not answer is reported unavailable
 *   instead of holding the caller.
 */
export type GitRemote = { name: string; url: string };

export type GitFacts =
  | {
      available: true;
      root: string;
      /** Null on a detached HEAD. A repository with no commits still has its unborn branch. */
      branch: string | null;
      detached: boolean;
      /** Null when there are no commits yet. */
      commit: string | null;
      /** Includes untracked files, whatever `status.showUntrackedFiles` says. */
      dirty: boolean;
      remotes: GitRemote[];
    }
  | { available: false; code: UnavailableCode; reason: string };

export type UnavailableCode = 'git.not_found' | 'git.not_a_repository' | 'git.timeout' | 'git.failed';

type Unavailable = Extract<GitFacts, { available: false }>;
/** `code` is null when git was ended by a signal rather than exiting. */
type Run = { code: number | null; stdout: string; stderr: string };

export async function readGitFacts(cwd: string, timeoutMs: number): Promise<GitFacts> {
  // Checked first because a missing working directory makes the spawn fail with the
  // same ENOENT as a missing git binary, and the reason would then name the wrong thing.
  if (!statSync(cwd, { throwIfNoEntry: false })?.isDirectory()) {
    return unavailable('git.not_a_repository', `No directory at ${cwd}.`);
  }
  try {
    const top = await git(cwd, timeoutMs, ['rev-parse', '--show-toplevel']);
    if (top.code !== 0) {
      throw /not a git repository/i.test(top.stderr)
        ? unavailable('git.not_a_repository', `${cwd} is not inside a Git repository.`)
        : failed('rev-parse', top);
    }

    const [head, branch, status, remotes] = await Promise.all([
      // Exit 1 with no output: there are no commits yet.
      git(cwd, timeoutMs, ['rev-parse', '--verify', '--quiet', 'HEAD']).then((run) => acceptExit(run, 'rev-parse', [0, 1])),
      // Exit 1 with no output: HEAD is detached.
      git(cwd, timeoutMs, ['symbolic-ref', '--quiet', '--short', 'HEAD']).then((run) => acceptExit(run, 'symbolic-ref', [0, 1])),
      git(cwd, timeoutMs, ['status', '--porcelain', '--untracked-files=normal']).then((run) => acceptExit(run, 'status', [0])),
      git(cwd, timeoutMs, ['remote', '-v']).then((run) => acceptExit(run, 'remote', [0])),
    ]);

    return {
      available: true,
      root: top.stdout.trim(),
      branch: branch.code === 0 ? branch.stdout.trim() : null,
      detached: branch.code !== 0,
      commit: head.code === 0 ? head.stdout.trim() : null,
      dirty: status.stdout.trim() !== '',
      remotes: parseRemotes(remotes.stdout),
    };
  } catch (error) {
    if (isGitUnavailable(error)) return error;
    throw error;
  }
}

export type GitLocation = { root: string; commonDir: string };

/**
 * Where a path sits in Git: the root of the checkout it is in, and the repository's
 * common directory, which the main checkout and every linked worktree of one repository
 * share and a separate repository does not. Null whenever Git cannot say — not a working
 * tree, no git, a git that does not answer — because the caller then falls back to what
 * it knew without Git.
 */
export async function readGitLocation(cwd: string, timeoutMs: number): Promise<GitLocation | null> {
  if (!statSync(cwd, { throwIfNoEntry: false })?.isDirectory()) return null;
  try {
    const run = await git(cwd, timeoutMs, ['rev-parse', '--show-toplevel', '--git-common-dir']);
    const [root, commonDir] = run.stdout.trim().split('\n');
    if (run.code !== 0 || !root || !commonDir) return null;
    // The common directory may come back relative to `cwd`. Both are resolved like
    // registered paths are, so that one repository reached through a symlinked prefix
    // compares equal to itself.
    return { root: realpathSync(root), commonDir: realpathSync(resolve(cwd, commonDir)) };
  } catch (error) {
    if (isGitUnavailable(error)) return null;
    throw error;
  }
}

/**
 * The roots of the checkouts of the repository `cwd` is in that still exist, the main one
 * first, resolved like registered paths are. A worktree Git still lists whose directory is
 * gone is left out. Null whenever Git cannot say.
 */
export async function readWorktrees(cwd: string, timeoutMs: number): Promise<string[] | null> {
  if (!statSync(cwd, { throwIfNoEntry: false })?.isDirectory()) return null;
  try {
    const run = await git(cwd, timeoutMs, ['worktree', 'list', '--porcelain', '-z']);
    if (run.code !== 0) return null;
    return run.stdout
      .split('\0')
      .filter((field) => field.startsWith('worktree '))
      .map((field) => field.slice('worktree '.length))
      .filter((path) => statSync(path, { throwIfNoEntry: false })?.isDirectory())
      .map((path) => realpathSync(path));
  } catch (error) {
    if (isGitUnavailable(error)) return null;
    throw error;
  }
}

/** The branch `origin/HEAD` names, without `origin/`; null when there is none or Git cannot say. */
export async function readDefaultBranch(cwd: string, timeoutMs: number): Promise<string | null> {
  if (!statSync(cwd, { throwIfNoEntry: false })?.isDirectory()) return null;
  try {
    const run = await git(cwd, timeoutMs, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
    return run.code === 0 ? run.stdout.trim().replace(/^origin\//, '') || null : null;
  } catch (error) {
    if (isGitUnavailable(error)) return null;
    throw error;
  }
}

/**
 * What the `HEAD` reflog of one checkout says about the branches it was on: when its oldest
 * entry was written, each `checkout` or `switch` it records, oldest first, with the branch it
 * left, null when HEAD was detached, and the branch HEAD is on now, null when detached. Times
 * are in milliseconds.
 */
export type HeadHistory = { since: number; switches: { at: number; from: string | null }[]; current: string | null };

/**
 * The `HEAD` reflog of the checkout `cwd` is in, a linked worktree's own included. Null
 * whenever Git cannot say, or the reflog is empty.
 */
export async function readHeadHistory(cwd: string, timeoutMs: number): Promise<HeadHistory | null> {
  if (!statSync(cwd, { throwIfNoEntry: false })?.isDirectory()) return null;
  try {
    const [log, head] = await Promise.all([
      git(cwd, timeoutMs, ['log', '--walk-reflogs', '--date=unix', '--format=%gd%x00%gs', 'HEAD']),
      git(cwd, timeoutMs, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
    ]);
    if (log.code !== 0) return null;
    // Newest first. `%gd` is `HEAD@{<unix seconds>}` with `--date=unix`.
    const entries = log.stdout
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => {
        const [selector = '', subject = ''] = line.split('\0');
        return { at: Number(/\{(\d+)\}$/.exec(selector)?.[1]) * 1000, subject };
      });
    if (entries.length === 0 || entries.some((entry) => Number.isNaN(entry.at))) return null;
    // Git names the branch it left by its short name, or by the full hash when HEAD was detached.
    const switches = entries.flatMap(({ at, subject }) => {
      const from = /^checkout: moving from (\S+) to \S+$/.exec(subject)?.[1];
      return from === undefined ? [] : [{ at, from: /^[0-9a-f]{40}([0-9a-f]{24})?$/.test(from) ? null : from }];
    });
    return { since: entries.at(-1)!.at, switches: switches.reverse(), current: head.code === 0 ? head.stdout.trim() : null };
  } catch (error) {
    if (isGitUnavailable(error)) return null;
    throw error;
  }
}

/**
 * The branch `history` says its checkout was on at `time`, in milliseconds: the one the next
 * switch after it left, or the current one when none came after. Null when HEAD was detached,
 * and before the reflog's oldest entry, where it no longer says.
 *
 * ponytail: only `checkout` entries are switches, so the detached HEAD of a rebase in progress
 * reads as the branch being rebased; read `rebase` entries too if that ever misattributes.
 */
export function branchAt(history: HeadHistory, time: number): string | null {
  if (time < history.since) return null;
  const next = history.switches.find((change) => change.at > time);
  return next ? next.from : history.current;
}

/**
 * When each file under `pathspec` was last committed, as Unix seconds, keyed by its path
 * relative to `cwd`. A file that was never committed is absent. Null whenever Git cannot
 * say, because the caller then orders by what it knew without Git.
 */
export async function readLastCommitTimes(cwd: string, pathspec: string, timeoutMs: number): Promise<Map<string, number> | null> {
  if (!statSync(cwd, { throwIfNoEntry: false })?.isDirectory()) return null;
  try {
    // Newest first, so the first time a path appears is its last commit.
    const run = await git(cwd, timeoutMs, ['log', '--relative', '--name-only', '--format=%x00%ct', '--', pathspec]);
    if (run.code !== 0) return null;
    const times = new Map<string, number>();
    for (const entry of run.stdout.split('\0').slice(1)) {
      const [time, ...paths] = entry.split('\n');
      for (const path of paths) if (path !== '' && !times.has(path)) times.set(path, Number(time));
    }
    return times;
  } catch (error) {
    if (isGitUnavailable(error)) return null;
    throw error;
  }
}

/**
 * The full hash of the commit that `hash`, full or abbreviated, names; null when it names
 * none here. Anything but hexadecimal digits is null without asking Git, which is what
 * lets every other function here take the commits it returns.
 */
export async function readCommit(cwd: string, hash: string, timeoutMs: number): Promise<string | null> {
  if (!/^[0-9a-f]{4,64}$/i.test(hash)) return null;
  const run = acceptExit(await git(cwd, timeoutMs, ['rev-parse', '--verify', '--quiet', `${hash}^{commit}`]), 'rev-parse', [0, 1]);
  return run.code === 0 ? run.stdout.trim() : null;
}

/** Whether `ancestor` is `commit` or one of its ancestors. */
export async function isAncestor(cwd: string, ancestor: string, commit: string, timeoutMs: number): Promise<boolean> {
  return acceptExit(await git(cwd, timeoutMs, ['merge-base', '--is-ancestor', ancestor, commit]), 'merge-base', [0, 1]).code === 0;
}

/** The newest commit reachable from `commit` whose date is before `date`, or null when there is none. */
export async function readCommitBefore(cwd: string, commit: string, date: Date, timeoutMs: number): Promise<string | null> {
  const run = acceptExit(await git(cwd, timeoutMs, ['log', '-1', '--format=%H', `--before=${date.toISOString()}`, commit]), 'log', [0]);
  return run.stdout.trim() || null;
}

/**
 * Whether `path`, a file or directory relative to `cwd`, has uncommitted changes: staged,
 * unstaged or untracked. The path is passed as a literal pathspec after `--`, so caller
 * text is never read as an option or as pathspec magic.
 */
export async function hasUncommittedChanges(cwd: string, path: string, timeoutMs: number): Promise<boolean> {
  const run = acceptExit(await git(cwd, timeoutMs, ['status', '--porcelain', '--untracked-files=normal', '--', `:(literal)${path}`]), 'status', [0]);
  return run.stdout.trim() !== '';
}

export type Commit = { commit: string; subject: string };

/** The commits reachable from `to` and not from `from`, newest first; every one reachable from `to` when `from` is null. */
export async function readLog(cwd: string, from: string | null, to: string, timeoutMs: number): Promise<Commit[]> {
  const run = acceptExit(await git(cwd, timeoutMs, ['log', '--format=%H%x00%s', from === null ? to : `${from}..${to}`]), 'log', [0]);
  return run.stdout
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const [commit, subject] = line.split('\0') as [string, string];
      return { commit, subject };
    });
}

/**
 * The files of `commit`, for the project directory `cwd`: committed state only, whatever
 * the working tree holds. Git failing here is thrown as unavailable rather than read as a
 * missing file, which would make a wrong answer out of a failed one.
 */
export function commitTree(cwd: string, commit: string, timeoutMs: number): Tree {
  return {
    async list(path) {
      // A tree in Git is never empty, so nothing listed means no directory there.
      const run = acceptExit(await git(cwd, timeoutMs, ['ls-tree', '-z', commit, '--', `${path}/`]), 'ls-tree', [0]);
      const entries = run.stdout.split('\0').filter((entry) => entry !== '');
      if (entries.length === 0) return null;
      return entries.map((entry) => {
        const [meta, name] = entry.split('\t') as [string, string];
        return { name: posix.basename(name), directory: meta.split(' ')[1] === 'tree' };
      });
    },
    async read(path) {
      const run = await git(cwd, timeoutMs, ['show', `${commit}:./${path}`]);
      if (run.code === 128 && /does not exist|exists on disk, but not in/.test(run.stderr)) return null;
      return acceptExit(run, 'show', [0]).stdout;
    },
  };
}

/** `git remote -v` lists each remote twice; the fetch URL is the one that says where it lives. */
function parseRemotes(output: string): GitRemote[] {
  const remotes: GitRemote[] = [];
  for (const line of output.split('\n')) {
    const match = /^(\S+)\t(.*) \(fetch\)$/.exec(line);
    if (match) remotes.push({ name: match[1]!, url: withoutCredentials(match[2]!) });
  }
  return remotes;
}

/**
 * A credential embedded in a remote is a secret, and these facts are headed for agent
 * sessions and their transcripts (ADR-0013). Over HTTPS the whole user part goes, because
 * a token is often passed as the user name; elsewhere the user name is kept (`git@`) and
 * only a password is removed.
 */
const withoutCredentials = (url: string): string =>
  url.replace(/^(https?:\/\/)[^/@]*@/i, '$1').replace(/^([a-z][a-z0-9+.-]*:\/\/[^/:@]*):[^/@]*@/i, '$1@');

function git(cwd: string, timeoutMs: number, args: string[]): Promise<Run> {
  return new Promise((resolve, reject) => {
    // `core.quotePath=false` so that a path is printed as it is named, not octal-escaped.
    const child = spawn('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.quotePath=false', ...args], {
      cwd,
      env: gitEnvironment(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));

    // Settles on the timer rather than on the child's exit: a hung git may never close
    // its pipes, and waiting for that is the hang this exists to avoid.
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(unavailable('git.timeout', `git ${args[0]} did not answer within ${timeoutMs} ms.`));
    }, timeoutMs);

    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(error.code === 'ENOENT' ? unavailable('git.not_found', 'git is not on PATH.') : error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/**
 * The daemon's own environment, minus anything that would point git somewhere else — a
 * `GIT_DIR` inherited from a hook would otherwise answer for the wrong repository.
 * English messages so that a reason can be recognised; no prompt, no lazy fetch.
 */
function gitEnvironment(): NodeJS.ProcessEnv {
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  return { ...environment, LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0', GIT_NO_LAZY_FETCH: '1' };
}

/** Passes the run through when git exited with one of `codes`, which are its normal answers. */
function acceptExit(run: Run, command: string, codes: number[]): Run {
  if (run.code === null || !codes.includes(run.code)) throw failed(command, run);
  return run;
}

function failed(command: string, run: Run): Unavailable {
  const detail = run.stderr.trim().split('\n')[0] || (run.code === null ? 'ended by a signal' : `exit code ${run.code}`);
  return unavailable('git.failed', `git ${command} failed: ${detail}`);
}

const unavailable = (code: UnavailableCode, reason: string): Unavailable => ({ available: false, code, reason });

/** Whether a thrown value is Git reporting itself unavailable, which callers turn into their own error. */
export function isGitUnavailable(value: unknown): value is Unavailable {
  return typeof value === 'object' && value !== null && (value as { available?: unknown }).available === false;
}
