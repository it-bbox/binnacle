import type { TaskReading } from '@binnacle/core';
import {
  readChangesRequested,
  readObject,
  readRemoteCi,
  readRemoteTasks,
  type ChangesRequested,
  type CiReading,
  type CiState,
  type Forge,
} from './remote-tracker.ts';

/**
 * The API root for a declared `tracker.host`: `github.com`, the default, is
 * `https://api.github.com`; any other hostname is GitHub Enterprise at `/api/v3`; a base
 * URL with a scheme is used as given.
 */
export function githubApiRoot(host: string | null): string {
  const declared = host ?? 'github.com';
  if (declared.includes('://')) return declared.replace(/\/+$/, '');
  return declared.toLowerCase() === 'github.com' ? 'https://api.github.com' : `https://${declared}/api/v3`;
}

type Issue = {
  number: number;
  title: string;
  state: string;
  state_reason?: string | null;
  body?: string | null;
  labels?: (string | { name?: string })[];
  html_url: string;
  pull_request?: unknown;
};

/** GitHub lists pull requests among issues; those are skipped. */
const GITHUB: Forge = {
  name: 'GitHub',
  headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
  authorization: (token) => ({ authorization: `Bearer ${token}` }),
  toIssue(entry) {
    const issue = entry as Issue;
    if (issue.pull_request !== undefined) return null;
    return {
      number: issue.number,
      title: issue.title,
      open: issue.state === 'open',
      closeReason: issue.state_reason ?? null,
      body: issue.body ?? null,
      labels: (issue.labels ?? []).flatMap((label) => (typeof label === 'string' ? [label] : (label.name ?? []))),
      url: issue.html_url,
    };
  },
};

type Comment = { issue_url?: string; body?: string | null };

/**
 * A GitHub repository's issues as Tasks, read through `readRemoteTasks`, with `token` or
 * anonymously, `perPage` issues a page: only the live tests ask for fewer than 100. Their
 * questions come from the repository's issue comments, one list, oldest first, each matched to
 * its issue by the number its `issue_url` ends with; a pull request's are of no Task.
 */
export function readGitHubTasks(repository: string, host: string | null, token: string | null, perPage = 100): Promise<TaskReading> {
  const root = githubApiRoot(host);
  const path = repository.split('/').map(encodeURIComponent).join('/');
  return readRemoteTasks(GITHUB, `${root}/repos/${path}/issues?state=all&per_page=${perPage}`, `${repository} at ${root}`, token, {
    lists: () => [{ url: `${root}/repos/${path}/issues/comments?sort=created&direction=asc&per_page=${perPage}`, issue: null }],
    toComment(entry) {
      const comment = entry as Comment;
      const number = /\/issues\/(\d+)$/.exec(comment.issue_url ?? '')?.[1];
      return number === undefined ? null : { issue: Number(number), body: comment.body ?? '' };
    },
  });
}

type Review = { state?: string; submitted_at?: string | null };

/**
 * When changes were first requested on a pull request whose head is `branch` in
 * `repository` itself, read with `token`: a review in the `CHANGES_REQUESTED` state, at its
 * submission. A review dismissed by the time it is read does not count: GitHub then reports it `DISMISSED`.
 */
export function readGitHubChangesRequested(repository: string, host: string | null, token: string, branch: string): Promise<ChangesRequested> {
  const root = githubApiRoot(host);
  const path = repository.split('/').map(encodeURIComponent).join('/');
  const head = encodeURIComponent(`${repository.split('/')[0]}:${branch}`);
  return readChangesRequested(GITHUB, `${repository} at ${root}`, token, {
    requests: `${root}/repos/${path}/pulls?state=all&head=${head}&per_page=100`,
    what: 'pull requests',
    noRequest: `No pull request on GitHub has ${branch} as its head.`,
    reviews: (pull) => `${root}/repos/${path}/pulls/${(pull as { number: number }).number}/reviews?per_page=100`,
    changesRequested(entry) {
      const review = entry as Review;
      return review.state === 'CHANGES_REQUESTED' && review.submitted_at ? Date.parse(review.submitted_at) : null;
    },
  });
}

type WorkflowRun = { status?: string; conclusion?: string | null };
type Pull = { number: number; title: string; draft?: boolean; html_url: unknown; head: { ref: string; sha: string } };

/** A completed workflow run that counts as passed; any other conclusion, a failure, a cancellation or a timeout among them, fails. */
const PASSED = new Set(['success', 'skipped', 'neutral']);

/**
 * A commit's state from its GitHub Actions workflow runs and the statuses of its combined status
 * together: failing when any failed, was cancelled or timed out; running when any is queued,
 * waiting, in progress or pending; passing when every one passed; `none` when it has neither.
 */
function commitState(runs: WorkflowRun[], statuses: { state?: string }[]): CiState {
  const states = [
    ...runs.map((run) => (run.status !== 'completed' ? 'running' : PASSED.has(run.conclusion ?? '') ? 'passing' : 'failing')),
    ...statuses.map((status) => (status.state === 'success' ? 'passing' : status.state === 'pending' ? 'running' : 'failing')),
  ];
  if (states.length === 0) return 'none';
  return states.includes('failing') ? 'failing' : states.includes('running') ? 'running' : 'passing';
}

/**
 * A GitHub repository's CI, read through `readRemoteCi`: the open pull requests, and a commit's
 * state from its workflow runs and combined status together (`commitState`). Nothing is read
 * that a fine-grained token with Actions, Commit statuses and Pull requests read access cannot
 * read: not check runs, which GitHub serves to GitHub Apps only, and not a branch's commit,
 * which needs Contents access. The default branch's commit is the one its combined status
 * names, its link the repository's page, and when it was made is not known.
 * ponytail: one page of 100 workflow runs per commit; follow the pages once a commit has more.
 */
export async function readGitHubCi(
  repository: string,
  host: string | null,
  token: string | null,
  limit: number,
  keep: (branch: string) => boolean = () => true,
): Promise<CiReading> {
  const root = githubApiRoot(host);
  const repo = `${root}/repos/${repository.split('/').map(encodeURIComponent).join('/')}`;
  const where = `${repository} at ${root}`;
  const object = (url: string, what: 'workflow runs' | 'statuses') => readObject(GITHUB, url, where, token, what);
  const state = async (sha: string): Promise<CiState | { reason: string }> => {
    const [runs, status] = await Promise.all([
      object(`${repo}/actions/runs?head_sha=${encodeURIComponent(sha)}&per_page=100`, 'workflow runs'),
      object(`${repo}/commits/${sha}/status?per_page=100`, 'statuses'),
    ]);
    if ('failure' in runs) return { reason: runs.failure.message };
    if ('failure' in status) return { reason: status.failure.message };
    return commitState((runs.entry.workflow_runs ?? []) as WorkflowRun[], (status.entry.statuses ?? []) as { state?: string }[]);
  };
  return readRemoteCi(
    GITHUB,
    where,
    token,
    {
      repository: repo,
      commit: (branch) => `${repo}/commits/${encodeURIComponent(branch)}/status?per_page=1`,
      commitWhat: 'statuses',
      toCommit: (entry, repository) => ({
        sha: entry.sha,
        url: typeof repository.html_url === 'string' && typeof entry.sha === 'string' ? `${repository.html_url}/commit/${entry.sha}` : undefined,
        at: null,
      }),
      requests: `${repo}/pulls?state=open&per_page=100`,
      what: 'pull requests',
      toRequest(entry) {
        const pull = entry as Pull;
        return { number: pull.number, title: pull.title, branch: pull.head.ref, draft: pull.draft ?? false, url: pull.html_url, state: () => state(pull.head.sha) };
      },
      named: (number) => `pull request #${number}`,
      state: (_, sha) => state(sha),
    },
    limit,
    keep,
  );
}
