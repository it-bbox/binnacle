import type { TaskReading } from '@binnacle/core';
import { readChangesRequested, readPages, readRemoteCi, readRemoteTasks, type ChangesRequested, type CiReading, type CiState, type Forge } from './remote-tracker.ts';

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
 * Their questions come from the notes of each open issue, oldest first, system notes left out;
 * a closed issue's are not read.
 */
export function readGitLabTasks(repository: string, host: string | null, token: string | null, perPage = 100): Promise<TaskReading> {
  const root = gitlabApiRoot(host);
  const issues = `${root}/projects/${encodeURIComponent(repository)}/issues`;
  return readRemoteTasks(GITLAB, `${issues}?per_page=${perPage}`, `${repository} at ${root}`, token, {
    lists: (read) =>
      read.filter((issue) => issue.open).map((issue) => ({ url: `${issues}/${issue.number}/notes?sort=asc&order_by=created_at&per_page=${perPage}`, issue: issue.number })),
    toComment(entry, issue) {
      const note = entry as Note;
      return note.system === true || issue === null ? null : { issue, body: note.body ?? '' };
    },
  });
}

type Note = { system?: boolean; body?: string; created_at?: string };

/**
 * When changes were first requested on a merge request whose source branch is `branch`, read
 * with `token`: GitLab records a reviewer's request for changes as a system note on the merge
 * request, `requested changes`, made when it was.
 */
export function readGitLabChangesRequested(repository: string, host: string | null, token: string, branch: string): Promise<ChangesRequested> {
  const root = gitlabApiRoot(host);
  const project = `${root}/projects/${encodeURIComponent(repository)}`;
  return readChangesRequested(GITLAB, `${repository} at ${root}`, token, {
    requests: `${project}/merge_requests?state=all&source_branch=${encodeURIComponent(branch)}&per_page=100`,
    what: 'merge requests',
    noRequest: `No merge request on GitLab has ${branch} as its source branch.`,
    reviews: (request) => `${project}/merge_requests/${(request as { iid: number }).iid}/notes?per_page=100`,
    changesRequested(entry) {
      const note = entry as Note;
      return note.system === true && note.body === 'requested changes' && note.created_at ? Date.parse(note.created_at) : null;
    },
  });
}

type MergeRequest = { iid: number; title: string; draft?: boolean; source_branch: string; web_url: unknown };

/** A pipeline still to finish, waiting on a runner, a schedule or a person. */
const UNFINISHED = new Set(['created', 'waiting_for_resource', 'preparing', 'pending', 'running', 'scheduled', 'manual']);

/**
 * A pipeline's status as a state: passing on `success` or `skipped`, as a skipped check run
 * passes on GitHub; running while it is to finish; failing on `failed`, `canceled` and any
 * other status, a red the owner looks at rather than a green that hides one.
 */
const pipelineState = (status: unknown): CiState => (status === 'success' || status === 'skipped' ? 'passing' : UNFINISHED.has(status as string) ? 'running' : 'failing');

/**
 * A GitLab project's CI, read through `readRemoteCi`: the open merge requests, each with the
 * status of its latest pipeline, which GitLab lists whatever commit or project it ran on, a
 * merged result's or a fork's included; and the default branch's latest pipeline for its latest
 * commit, as GitHub's state is that commit's. `none` where there is no pipeline.
 */
export function readGitLabCi(
  repository: string,
  host: string | null,
  token: string | null,
  limit: number,
  keep: (branch: string) => boolean = () => true,
): Promise<CiReading> {
  const root = gitlabApiRoot(host);
  const project = `${root}/projects/${encodeURIComponent(repository)}`;
  const where = `${repository} at ${root}`;
  /** The state of the first pipeline `pipelines` lists, newest first, no page past the first read; `none` when it lists none. */
  const latest = async (pipelines: string): Promise<CiState | { reason: string }> => {
    const read = await readPages(GITLAB, pipelines, where, token, 'pipelines', 1);
    if (!Array.isArray(read)) return { reason: read.message };
    const [pipeline] = read as { status?: unknown }[];
    return pipeline === undefined ? 'none' : pipelineState(pipeline.status);
  };
  return readRemoteCi(
    GITLAB,
    where,
    token,
    {
      repository: project,
      commit: (branch) => `${project}/repository/commits/${encodeURIComponent(branch)}`,
      toCommit: (entry) => ({ sha: entry.id, url: entry.web_url, at: typeof entry.committed_date === 'string' ? entry.committed_date : null }),
      requests: `${project}/merge_requests?state=opened&per_page=100`,
      what: 'merge requests',
      toRequest(entry) {
        const request = entry as MergeRequest;
        return {
          number: request.iid,
          title: request.title,
          branch: request.source_branch,
          draft: request.draft ?? false,
          url: request.web_url,
          state: () => latest(`${project}/merge_requests/${request.iid}/pipelines?per_page=1`),
        };
      },
      named: (number) => `merge request !${number}`,
      state: (branch, sha) => latest(`${project}/pipelines?ref=${encodeURIComponent(branch)}&sha=${encodeURIComponent(sha)}&order_by=id&sort=desc&per_page=1`),
    },
    limit,
    keep,
  );
}
