import {
  blockedByNumbers,
  isTaskState,
  parseTicketHeader,
  ticketBody,
  TRIAGE_ROLES,
  unquote,
  type Diagnostic,
  type TaskReading,
  type TaskState,
  type TrackerTask,
} from '@binnacle/core';

/** Per request, in milliseconds. A tracker slower than this is `tracker.unreachable`. */
const TRACKER_TIMEOUT_MS = 10_000;

/** An issue as every remote tracker is read, whatever its API calls the fields. */
export type RemoteIssue = {
  number: number;
  title: string;
  open: boolean;
  /** `completed`, `not_planned` or `duplicate` where the tracker reports one; null otherwise, and always on GitLab. */
  closeReason: string | null;
  body: string | null;
  labels: string[];
  url: string;
};

/** What differs between the remote trackers, past the URL of the first page. */
export type Forge = {
  name: 'GitHub' | 'GitLab';
  headers: Record<string, string>;
  /** The header a read-only token is sent in. */
  authorization(token: string): Record<string, string>;
  /** One entry of a page as an issue, or null for one that is not an issue. */
  toIssue(entry: unknown): RemoteIssue | null;
};

/**
 * A remote tracker's issues as Tasks (ADR-0024). Every issue, open and closed, is read
 * through every page, following the `Link` header both GitHub and GitLab send, on every
 * call, read-only, with the platform `fetch`. Requests go to the declared host only: a next
 * page elsewhere is refused. A failure on any page gives no Tasks at all, never a partial
 * list, and one diagnostic that says why. `where` names the repository and API root.
 * `token`, when there is one, is sent with every request and appears in nothing this
 * returns; null reads anonymously.
 */
export async function readRemoteTasks(forge: Forge, firstPage: string, where: string, token: string | null): Promise<TaskReading> {
  const failed = (code: string, message: string): TaskReading => ({ tasks: null, diagnostics: [{ code, message }] });
  let url: URL;
  try {
    url = new URL(firstPage);
  } catch {
    return failed('tracker.unreachable', `tracker.host gives no URL for ${where}.`);
  }
  const origin = url.origin;
  const headers = token === null ? forge.headers : { ...forge.headers, ...forge.authorization(token) };
  const issues: RemoteIssue[] = [];
  for (;;) {
    let response: Response;
    let page: unknown;
    try {
      response = await fetch(url, { headers, signal: AbortSignal.timeout(TRACKER_TIMEOUT_MS) });
      if (!response.ok) return failed(...statusFailure(forge.name, response, where, token !== null));
      page = await response.json();
    } catch (error) {
      return failed('tracker.unreachable', `${forge.name} could not be read for ${where}: ${(error as Error).message}.`);
    }
    if (!Array.isArray(page)) return failed('tracker.unreachable', `${forge.name} answered for ${where} with something other than a list of issues.`);
    for (const entry of page) {
      const issue = forge.toIssue(entry);
      if (issue !== null) issues.push(issue);
    }

    const next = /<([^>]*)>\s*;\s*rel="next"/.exec(response.headers.get('link') ?? '')?.[1];
    if (next === undefined) break;
    url = new URL(next, url);
    if (url.origin !== origin) return failed('tracker.unreachable', `${forge.name} pointed the next page of ${where} at another host, ${url.origin}, which is not read.`);
  }

  const diagnostics: Diagnostic[] = [];
  const tasks = issues.sort((a, b) => a.number - b.number).map((issue) => toTask(issue, diagnostics));
  return { tasks, diagnostics };
}

/**
 * Each refusal says whether a token was used: the fix is to create one, or to fix or widen
 * the one there is. GitHub signals its primary rate limit as a 403 with no requests
 * remaining; GitLab uses 429.
 */
function statusFailure(name: Forge['name'], response: Response, where: string, authenticated: boolean): [string, string] {
  const { status, headers } = response;
  const used = authenticated ? 'a token was used' : 'no token was used';
  if (status === 429 || (status === 403 && (headers.get('x-ratelimit-remaining') === '0' || headers.has('retry-after')))) {
    return ['tracker.rate_limited', `${name} rate-limited the reading of ${where} (${status}).`];
  }
  if (status === 401) return ['tracker.unauthorized', `${name} refused the request for ${where} (401); ${used}.`];
  if (status === 403) return ['tracker.forbidden', `${name} gave no read access to the issues of ${where} (403); ${used}.`];
  if (status === 404 || status === 410) return ['tracker.not_found', `${name} has nothing at ${where} with issues visible to this request (${status}); ${used}.`];
  return ['tracker.unreachable', `${name} answered ${status} for ${where}.`];
}

/** Closing outranks `Status:`. With no close reason reported, `Status: CANCELLED` still says abandoned. */
function closedState(reason: string | null, status: string | null): 'DONE' | 'CANCELLED' {
  if (reason === 'completed') return 'DONE';
  if (reason === 'not_planned' || reason === 'duplicate') return 'CANCELLED';
  return status === 'CANCELLED' ? 'CANCELLED' : 'DONE';
}

function toTask(issue: RemoteIssue, diagnostics: Diagnostic[]): TrackerTask {
  const id = `#${issue.number}`;
  const named = `${id} (${issue.url})`;
  const { status, blockedBy, spec: specLine } = parseTicketHeader(issue.body ?? '');
  const mismatch = (message: string): void => {
    diagnostics.push({ code: 'tracker.state_mismatch', message: `${named} ${message}` });
  };

  let state: TaskState | null;
  if (issue.open) {
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
    state = closedState(issue.closeReason, status);
    if (status !== null && status !== state) mismatch(`is closed as ${state}, but its Status: is ${status}.`);
  }

  const spec = unquote(specLine);
  return {
    id,
    title: issue.title,
    state,
    blockedBy: blockedByNumbers(blockedBy).map((number) => `#${number}`),
    spec,
    specSlug: /(?:^|\/)specs\/([^/]+)\/spec\.md(?:$|[?#])/.exec(spec ?? '')?.[1] ?? null,
    triage: issue.labels.find((name) => TRIAGE_ROLES.includes(name)) ?? null,
    ticket: issue.url,
    body: ticketBody(issue.body ?? ''),
  };
}
