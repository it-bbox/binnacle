import {
  blockedByNumbers,
  isTaskState,
  parseTicketHeader,
  TRIAGE_ROLES,
  unquote,
  type Diagnostic,
  type TaskReading,
  type TaskState,
  type TrackerTask,
} from '@binnacle/core';

/** Per request, in milliseconds. A tracker slower than this is `tracker.unreachable`. */
const TRACKER_TIMEOUT_MS = 10_000;

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

/**
 * A GitHub repository's issues as Tasks (ADR-0024). Every issue, open and closed, is read
 * through every page on every call, read-only, with the platform `fetch`; pull requests,
 * which GitHub lists among issues, are skipped. Requests go to the declared host only: a
 * next page elsewhere is refused. A failure on any page gives no Tasks at all, never a
 * partial list, and one diagnostic that says why.
 */
export async function readGitHubTasks(repository: string, host: string | null): Promise<TaskReading> {
  const root = githubApiRoot(host);
  const where = `${repository} at ${root}`;
  const failed = (code: string, message: string): TaskReading => ({ tasks: null, diagnostics: [{ code, message }] });

  let url: URL;
  try {
    url = new URL(`${root}/repos/${repository.split('/').map(encodeURIComponent).join('/')}/issues?state=all&per_page=100`);
  } catch {
    return failed('tracker.unreachable', `tracker.host gives ${root}, which is not a URL.`);
  }
  const origin = url.origin;
  const issues: Issue[] = [];
  for (;;) {
    let response: Response;
    let page: unknown;
    try {
      response = await fetch(url, {
        headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
        signal: AbortSignal.timeout(TRACKER_TIMEOUT_MS),
      });
      if (!response.ok) return failed(...statusFailure(response, where));
      page = await response.json();
    } catch (error) {
      return failed('tracker.unreachable', `GitHub could not be read for ${where}: ${(error as Error).message}.`);
    }
    if (!Array.isArray(page)) return failed('tracker.unreachable', `GitHub answered for ${where} with something other than a list of issues.`);
    issues.push(...(page as Issue[]));

    const next = /<([^>]*)>\s*;\s*rel="next"/.exec(response.headers.get('link') ?? '')?.[1];
    if (next === undefined) break;
    url = new URL(next, url);
    if (url.origin !== origin) return failed('tracker.unreachable', `GitHub pointed the next page of ${where} at another host, ${url.origin}, which is not read.`);
  }

  const diagnostics: Diagnostic[] = [];
  const tasks = issues
    .filter((issue) => issue.pull_request === undefined)
    .sort((a, b) => a.number - b.number)
    .map((issue) => toTask(issue, diagnostics));
  return { tasks, diagnostics };
}

/** No token is sent in this version, so a refusal is always of an anonymous request. */
function statusFailure(response: Response, where: string): [string, string] {
  const { status, headers } = response;
  if (status === 429 || (status === 403 && (headers.get('x-ratelimit-remaining') === '0' || headers.has('retry-after')))) {
    return ['tracker.rate_limited', `GitHub rate-limited the reading of ${where} (${status}).`];
  }
  if (status === 401) return ['tracker.unauthorized', `GitHub refused an anonymous request for ${where} (401); no token was used.`];
  if (status === 403) return ['tracker.forbidden', `GitHub gave no read access to the issues of ${where} (403).`];
  if (status === 404 || status === 410) return ['tracker.not_found', `GitHub has no repository ${where} with issues visible to this request (${status}).`];
  return ['tracker.unreachable', `GitHub answered ${status} for ${where}.`];
}

function toTask(issue: Issue, diagnostics: Diagnostic[]): TrackerTask {
  const id = `#${issue.number}`;
  const named = `${id} (${issue.html_url})`;
  const { status, blockedBy, spec: specLine } = parseTicketHeader(issue.body ?? '');
  const mismatch = (message: string): void => void diagnostics.push({ code: 'tracker.state_mismatch', message: `${named} ${message}` });

  let state: TaskState | null;
  if (issue.state === 'open') {
    state = status !== null && isTaskState(status) ? status : null;
    if (state === null) {
      diagnostics.push({
        code: 'task.unknown_state',
        message: status === null ? `${named} has no Status: line.` : `${named} has Status: ${JSON.stringify(status)}, which is not a Task state.`,
      });
    } else if (state === 'DONE' || state === 'CANCELLED') {
      mismatch(`is open, but its Status: is ${state}.`);
    }
  } else {
    // Closing outranks Status:. With no close reason reported, Status: CANCELLED still says abandoned.
    const reason = issue.state_reason;
    state = reason === 'completed' ? 'DONE' : reason === 'not_planned' || reason === 'duplicate' ? 'CANCELLED' : status === 'CANCELLED' ? 'CANCELLED' : 'DONE';
    if (status !== null && status !== state) mismatch(`is closed as ${state}, but its Status: is ${status}.`);
  }

  const spec = unquote(specLine);
  const label = (issue.labels ?? []).map((item) => (typeof item === 'string' ? item : item.name)).find((name) => name !== undefined && TRIAGE_ROLES.includes(name));
  return {
    id,
    title: issue.title,
    state,
    blockedBy: blockedByNumbers(blockedBy).map((number) => `#${number}`),
    spec,
    specSlug: /(?:^|\/)specs\/([^/]+)\/spec\.md(?:$|[?#])/.exec(spec ?? '')?.[1] ?? null,
    triage: label ?? null,
    ticket: issue.html_url,
  };
}
