import {
  blockedByNumbers,
  headerRoles,
  isTaskState,
  parseTicketHeader,
  ticketBody,
  TRIAGE_ROLES,
  unquote,
  type Diagnostic,
  type Question,
  type TaskReading,
  type TaskState,
  type TrackerTask,
} from '@binnacle/core';
import { addQuestionOrAnswer, sectionText } from './local-tracker.ts';

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
 * returns; null reads anonymously. Each Task's questions are read from its issue's
 * `comments` (`readQuestions`).
 */
export async function readRemoteTasks(forge: Forge, firstPage: string, where: string, token: string | null, comments: IssueComments): Promise<TaskReading> {
  const entries = await readPages(forge, firstPage, where, token, 'issues');
  if (!Array.isArray(entries)) return { tasks: null, diagnostics: [entries] };
  const issues = entries.flatMap((entry) => forge.toIssue(entry) ?? []).sort((a, b) => a.number - b.number);
  const questions = await readQuestions(forge, issues, where, token, comments);
  const diagnostics: Diagnostic[] = [];
  const tasks = issues.map((issue) => toTask(issue, questions(issue), diagnostics));
  return { tasks, diagnostics };
}

/** A comment on an issue, by the issue's number. */
type RemoteComment = { issue: number; body: string };

/** Where a forge lists its issues' comments, oldest first. */
export type IssueComments = {
  /**
   * The first page of each list to read for `issues`: the repository's, `issue` null, whose
   * entries name their issue, or one per issue. An issue no list covers has its comments unread.
   */
  lists(issues: RemoteIssue[]): { url: string; issue: number | null }[];
  /** One entry of a list, of `issue` when the list is one issue's, as a comment; null for one that is not, such as a system note. */
  toComment(entry: unknown, issue: number | null): RemoteComment | null;
};

/** A comment that is a Question or an Answer starts with its heading, and its text is the rest. */
const COMMENT_HEADING = /^### +(Question|Answer)[ \t]*(?:\n|$)/;

/**
 * Each issue's questions (ADR-0040): its comments that start with `### Question` or
 * `### Answer`, in the order they were made, paired as a ticket's are (`addQuestionOrAnswer`).
 * The lists are read as issues are, through every page on the declared host only, with
 * `token`; a failure on any of them leaves every issue's questions unavailable with the reason.
 */
async function readQuestions(
  forge: Forge,
  issues: RemoteIssue[],
  where: string,
  token: string | null,
  comments: IssueComments,
): Promise<(issue: RemoteIssue) => TrackerTask['questions']> {
  const lists = comments.lists(issues);
  // ponytail: every list at once and uncached, one per open issue on GitLab; bound or cache them once a forge's rate limit is reached in practice.
  const read = await Promise.all(
    lists.map(async ({ url, issue }) => {
      const entries = await readPages(forge, url, where, token, 'comments');
      return Array.isArray(entries) ? entries.flatMap((entry) => comments.toComment(entry, issue) ?? []) : entries;
    }),
  );
  const failure = read.find((result): result is Diagnostic => !Array.isArray(result));
  if (failure !== undefined) return () => ({ available: false, reason: failure.message });

  const byIssue = new Map<number, Question[]>();
  for (const { issue, body } of read.flat() as RemoteComment[]) {
    const text = body.replace(/\r\n?/g, '\n');
    const heading = COMMENT_HEADING.exec(text);
    if (heading === null) continue;
    const questions = byIssue.get(issue) ?? [];
    byIssue.set(issue, questions);
    addQuestionOrAnswer(questions, heading[1] as 'Question' | 'Answer', sectionText(text.slice(heading[0].length)));
  }
  const covered = lists.some((list) => list.issue === null) ? null : new Set(lists.map((list) => list.issue));
  return (issue) =>
    covered === null || covered.has(issue.number)
      ? (byIssue.get(issue.number) ?? [])
      : { available: false, reason: `Binnacle reads the comments of open issues only on ${forge.name}, and #${issue.number} is closed.` };
}

/**
 * Every entry of every page from `firstPage` on, `what` naming them, read as `readRemoteTasks`
 * reads issues: the `Link` header followed on the declared host only, and a failure on any
 * page giving nothing but the diagnostic that says why.
 */
export async function readPages(forge: Forge, firstPage: string, where: string, token: string | null, what: Listed): Promise<unknown[] | Diagnostic> {
  let url: URL;
  try {
    url = new URL(firstPage);
  } catch {
    return failed('tracker.unreachable', `tracker.host gives no URL for ${where}.`);
  }
  const origin = url.origin;
  const entries: unknown[] = [];
  for (;;) {
    const read = await readResponse(forge, url, where, token, what);
    if ('code' in read) return read;
    const { response, body: page } = read;
    if (!Array.isArray(page)) return failed('tracker.unreachable', `${forge.name} answered for ${where} with something other than a list of ${what}.`);
    entries.push(...page);

    const next = /<([^>]*)>\s*;\s*rel="next"/.exec(response.headers.get('link') ?? '')?.[1];
    if (next === undefined) return entries;
    url = new URL(next, url);
    if (url.origin !== origin) return failed('tracker.unreachable', `${forge.name} pointed the next page of ${where} at another host, ${url.origin}, which is not read.`);
  }
}

/**
 * The one object a forge answers `url` with, read as `readPages` reads a page; `{ failure }`,
 * the diagnostic that says why, when it cannot be read or is not an object.
 */
export async function readObject(forge: Forge, url: string, where: string, token: string | null, what: Listed): Promise<{ entry: Record<string, unknown> } | { failure: Diagnostic }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { failure: failed('tracker.unreachable', `tracker.host gives no URL for ${where}.`) };
  }
  const read = await readResponse(forge, parsed, where, token, what);
  if ('code' in read) return { failure: read };
  if (typeof read.body !== 'object' || read.body === null || Array.isArray(read.body)) {
    return { failure: failed('tracker.unreachable', `${forge.name} answered for ${where} with something other than its ${what}.`) };
  }
  return { entry: read.body as Record<string, unknown> };
}

const failed = (code: string, message: string): Diagnostic => ({ code, message });

/** One request, with `token` when there is one, and its JSON body; the diagnostic that says why when it fails. */
async function readResponse(forge: Forge, url: URL, where: string, token: string | null, what: Listed): Promise<{ response: Response; body: unknown } | Diagnostic> {
  const headers = token === null ? forge.headers : { ...forge.headers, ...forge.authorization(token) };
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(TRACKER_TIMEOUT_MS) });
    if (!response.ok) return failed(...statusFailure(forge.name, response, where, token !== null, what));
    return { response, body: await response.json() };
  } catch (error) {
    return failed('tracker.unreachable', `${forge.name} could not be read for ${where}: ${(error as Error).message}.`);
  }
}

/** What a forge's pages list, or what one of its objects is. */
type Listed = 'issues' | 'comments' | 'pull requests' | 'merge requests' | 'reviews' | 'commits' | 'check runs' | 'statuses';

/**
 * When changes were first requested on a pull or merge request of one branch, in
 * milliseconds: `at`, null while none has had changes requested; `noRequest`, saying so, when
 * the branch has no such request; or, when the forge cannot be read, the `reason` why.
 */
export type ChangesRequested = { at: number | null } | { noRequest: string } | { reason: string };

/** A commit's CI state as a forge reports it: any check failed, any still to finish, all passed, or none at all. */
export type CiState = 'passing' | 'failing' | 'running' | 'none';

/** A state as the forge reported it, never Binnacle's guess. */
export type ReportedState = { value: CiState; provenance: 'provider_reported' };

/** An open pull or merge request, with its head commit's CI state. */
export type CiRequest = { number: number; title: string; branch: string; draft: boolean; state: ReportedState; url: string };

/**
 * A forge's CI (ADR-0007): the default branch's latest commit with its state, and the open
 * requests, the first `limit` of them with theirs and how many more there are; or, when
 * anything of it cannot be read, the `reason` why, never part of it.
 */
export type CiReading =
  | {
      defaultBranch: { branch: string; commit: string; state: ReportedState; url: string; at: string | null };
      requests: { items: CiRequest[]; remainder: number };
    }
  | { reason: string };

/** Where a forge lists a branch's requests, and how it tells when one had changes requested. */
type RequestReviews = {
  /** The first page of the requests whose head is the branch, in every state, and what the forge calls them. */
  requests: string;
  what: 'pull requests' | 'merge requests';
  /** What is said when there is none. */
  noRequest: string;
  /** The first page of what records the reviews of `request`, one entry of `requests`. */
  reviews(request: unknown): string;
  /** When `review`, one entry of `reviews`, requested changes, in milliseconds; null for any other entry. */
  changesRequested(review: unknown): number | null;
};

/**
 * `ChangesRequested` for one branch: the earliest over every request whose head it is, read
 * with `token` through every page, as `readRemoteTasks` reads issues.
 */
export async function readChangesRequested(forge: Forge, where: string, token: string, request: RequestReviews): Promise<ChangesRequested> {
  const requests = await readPages(forge, request.requests, where, token, request.what);
  if (!Array.isArray(requests)) return { reason: requests.message };
  if (requests.length === 0) return { noRequest: request.noRequest };
  let first: number | null = null;
  for (const entry of requests) {
    const reviews = await readPages(forge, request.reviews(entry), where, token, 'reviews');
    if (!Array.isArray(reviews)) return { reason: reviews.message };
    for (const review of reviews) {
      const at = request.changesRequested(review);
      if (at !== null && (first === null || at < first)) first = at;
    }
  }
  return { at: first };
}

/**
 * Each refusal says whether a token was used: the fix is to create one, or to fix or widen
 * the one there is. GitHub signals its primary rate limit as a 403 with no requests
 * remaining; GitLab uses 429.
 */
function statusFailure(name: Forge['name'], response: Response, where: string, authenticated: boolean, what: Listed): [string, string] {
  const { status, headers } = response;
  const used = authenticated ? 'a token was used' : 'no token was used';
  if (status === 429 || (status === 403 && (headers.get('x-ratelimit-remaining') === '0' || headers.has('retry-after')))) {
    return ['tracker.rate_limited', `${name} rate-limited the reading of ${where} (${status}).`];
  }
  if (status === 401) return ['tracker.unauthorized', `${name} refused the request for ${where} (401); ${used}.`];
  if (status === 403) return ['tracker.forbidden', `${name} gave no read access to the ${what} of ${where} (403); ${used}.`];
  if (status === 404 || status === 410) return ['tracker.not_found', `${name} has nothing at ${where} with ${what} visible to this request (${status}); ${used}.`];
  return ['tracker.unreachable', `${name} answered ${status} for ${where}.`];
}

/** Closing outranks `Status:`. With no close reason reported, `Status: CANCELLED` still says abandoned. */
function closedState(reason: string | null, status: string | null): 'DONE' | 'CANCELLED' {
  if (reason === 'completed') return 'DONE';
  if (reason === 'not_planned' || reason === 'duplicate') return 'CANCELLED';
  return status === 'CANCELLED' ? 'CANCELLED' : 'DONE';
}

function toTask(issue: RemoteIssue, questions: TrackerTask['questions'], diagnostics: Diagnostic[]): TrackerTask {
  const id = `#${issue.number}`;
  const named = `${id} (${issue.url})`;
  const { status, blockedBy, spec: specLine, roles } = parseTicketHeader(issue.body ?? '');
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
    review: null,
    questions,
    roles: headerRoles(roles, named, diagnostics),
  };
}
