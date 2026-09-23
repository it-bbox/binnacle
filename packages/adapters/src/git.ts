import { spawn } from 'node:child_process';

/**
 * The Git adapter. It reads and never writes, and that holds by construction rather
 * than by care:
 *
 * - only inspecting commands run — `rev-parse`, `symbolic-ref` without a new value,
 *   `status`, `remote -v` — and nothing that fetches, writes, or changes config or refs;
 * - `--no-optional-locks` stops `status` refreshing the index, which it otherwise does
 *   as a side effect;
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
      /** Includes untracked files. */
      dirty: boolean;
      remotes: GitRemote[];
    }
  | { available: false; code: UnavailableCode; reason: string };

export type UnavailableCode = 'git.not_found' | 'git.not_a_repository' | 'git.timeout' | 'git.failed';

type Unavailable = Extract<GitFacts, { available: false }>;
type Run = { code: number; stdout: string; stderr: string };

export async function readGitFacts(cwd: string, timeoutMs: number): Promise<GitFacts> {
  try {
    const top = await git(cwd, timeoutMs, ['rev-parse', '--show-toplevel']);
    if (top.code !== 0) {
      throw /not a git repository/i.test(top.stderr)
        ? unavailable('git.not_a_repository', `${cwd} is not inside a Git repository.`)
        : failed('rev-parse', top);
    }

    const [head, branch, status, remotes] = await Promise.all([
      // Exit 1 with no output: there are no commits yet.
      git(cwd, timeoutMs, ['rev-parse', '--verify', '--quiet', 'HEAD']).then((run) => expect(run, 'rev-parse', [0, 1])),
      // Exit 1 with no output: HEAD is detached.
      git(cwd, timeoutMs, ['symbolic-ref', '--quiet', '--short', 'HEAD']).then((run) => expect(run, 'symbolic-ref', [0, 1])),
      git(cwd, timeoutMs, ['status', '--porcelain']).then((run) => expect(run, 'status', [0])),
      git(cwd, timeoutMs, ['remote', '-v']).then((run) => expect(run, 'remote', [0])),
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
    if (isUnavailable(error)) return error;
    throw error;
  }
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
 * A token embedded in an HTTPS remote is a secret, and these facts are headed for agent
 * sessions and their transcripts (ADR-0013). The host and path are what anything needs.
 */
const withoutCredentials = (url: string): string => url.replace(/^(https?:\/\/)[^/@]*@/i, '$1');

function git(cwd: string, timeoutMs: number, args: string[]): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['--no-optional-locks', ...args], {
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
      resolve({ code: code ?? -1, stdout, stderr });
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

function expect(run: Run, command: string, codes: number[]): Run {
  if (!codes.includes(run.code)) throw failed(command, run);
  return run;
}

function failed(command: string, run: Run): Unavailable {
  const detail = run.stderr.trim().split('\n')[0] || `exit code ${run.code}`;
  return unavailable('git.failed', `git ${command} failed: ${detail}`);
}

const unavailable = (code: UnavailableCode, reason: string): Unavailable => ({ available: false, code, reason });

function isUnavailable(value: unknown): value is Unavailable {
  return typeof value === 'object' && value !== null && (value as { available?: unknown }).available === false;
}
