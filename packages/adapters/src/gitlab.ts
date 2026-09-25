import type { TaskReading } from '@binnacle/core';
import { readRemoteTasks, type Forge } from './remote-tracker.ts';

/**
 * The API root for a declared `tracker.host`: a hostname, `gitlab.com` by default, is
 * `https://<host>/api/v4`; a base URL with a scheme is used as given.
 */
export function gitlabApiRoot(host: string | null): string {
  const declared = host ?? 'gitlab.com';
  return declared.includes('://') ? declared.replace(/\/+$/, '') : `https://${declared}/api/v4`;
}

type Issue = { iid: number; title: string; state: string; description?: string | null; labels?: string[]; web_url: string };

/** GitLab's issue number is its `iid`, and it reports no close reason. */
const GITLAB: Forge = {
  name: 'GitLab',
  headers: { accept: 'application/json' },
  authorization: (token) => ({ 'private-token': token }),
  toIssue(entry) {
    const issue = entry as Issue;
    return {
      number: issue.iid,
      title: issue.title,
      open: issue.state === 'opened',
      closeReason: null,
      body: issue.description ?? null,
      labels: issue.labels ?? [],
      url: issue.web_url,
    };
  },
};

/**
 * A GitLab project's issues as Tasks, read through `readRemoteTasks`. The project is its
 * full path, subgroups included, which the API takes URL-encoded as one segment. GitLab
 * lists issues in every state unless asked for one. `token` and `perPage` as for GitHub.
 */
export function readGitLabTasks(repository: string, host: string | null, token: string | null, perPage = 100): Promise<TaskReading> {
  const root = gitlabApiRoot(host);
  return readRemoteTasks(GITLAB, `${root}/projects/${encodeURIComponent(repository)}/issues?per_page=${perPage}`, `${repository} at ${root}`, token);
}
