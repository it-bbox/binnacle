import type { TaskReading } from '@binnacle/core';
import { readRemoteTasks, type Forge } from './remote-tracker.ts';

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
export const GITHUB: Forge = {
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

/** A GitHub repository's issues as Tasks, read through `readRemoteTasks`, with `token` or anonymously. */
export function readGitHubTasks(repository: string, host: string | null, token: string | null): Promise<TaskReading> {
  const root = githubApiRoot(host);
  const path = repository.split('/').map(encodeURIComponent).join('/');
  return readRemoteTasks(GITHUB, `${root}/repos/${path}/issues?state=all&per_page=100`, `${repository} at ${root}`, token);
}
