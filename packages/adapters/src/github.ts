import type { TaskReading } from '@binnacle/core';
import { readChangesRequested, readRemoteTasks, type ChangesRequested, type Forge } from './remote-tracker.ts';

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

/**
 * A GitHub repository's issues as Tasks, read through `readRemoteTasks`, with `token` or
 * anonymously, `perPage` issues a page: only the live tests ask for fewer than 100.
 */
export function readGitHubTasks(repository: string, host: string | null, token: string | null, perPage = 100): Promise<TaskReading> {
  const root = githubApiRoot(host);
  const path = repository.split('/').map(encodeURIComponent).join('/');
  return readRemoteTasks(GITHUB, `${root}/repos/${path}/issues?state=all&per_page=${perPage}`, `${repository} at ${root}`, token);
}

type Review = { state?: string; submitted_at?: string | null };

/**
 * When changes were first requested on a pull request whose head is `branch` in
 * `repository` itself, read with `token`: a review in the `CHANGES_REQUESTED` state, at its
 * submission. A review dismissed since no longer counts: GitHub then reports it `DISMISSED`.
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
