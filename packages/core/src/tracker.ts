import type { ProjectManifest } from './manifest.ts';
import type { TaskState } from './domain.ts';

/** A disagreement Binnacle reports and does not resolve. `code` is part of the API contract. */
export type Diagnostic = { code: string; message: string };

/**
 * The manifest's declared tracker is authoritative; a Git remote that disagrees with it
 * is reported, never resolved. Returns the disagreement, or null when there is none.
 *
 * Only a remote tracker can disagree with a remote. A `local` tracker claims nothing about
 * where the code is hosted, an undeclared one claims nothing at all, and a repository with
 * no remote has nothing to disagree with. One remote whose host is the declared host, and
 * whose path is the declared repository when one is declared, is agreement.
 */
export function trackerRemoteMismatch(tracker: ProjectManifest['tracker'], remoteUrls: string[]): Diagnostic | null {
  const { provider, repository } = tracker;
  if ((provider !== 'github' && provider !== 'gitlab') || remoteUrls.length === 0) return null;
  const host = declaredHostname(provider, tracker.host);
  const path = repository === null ? null : trimPath(repository);
  if (remoteUrls.some((url) => agrees(remoteLocation(url), host, path))) return null;
  return {
    code: 'tracker.remote_mismatch',
    message: `The tracker is declared at ${host}${repository === null ? '' : `/${repository}`}, but no Git remote is: ${remoteUrls.join(', ')}.`,
  };
}

const agrees = (remote: { host: string; path: string } | null, host: string, path: string | null): boolean =>
  remote !== null && remote.host === host && (path === null || remote.path.toLowerCase() === path);

/**
 * The declared `host`'s hostname, without a port, or the provider's default; a base URL
 * gives its own. URL parsing lowercases it, as remotes are compared lowercased.
 */
function declaredHostname(provider: 'github' | 'gitlab', host: string | null): string {
  if (host === null) return `${provider}.com`;
  const url = host.includes('://') ? host : `https://${host}`;
  return URL.canParse(url) ? new URL(url).hostname : host.toLowerCase();
}

/**
 * `scheme://[user@]host[:port]/path`, or scp-like `[user@]host:path`: the host lowercased,
 * the path as written, without its slashes at either end or a `.git` suffix.
 */
export function remoteLocation(url: string): { host: string; path: string } | null {
  const match = /^[a-z][a-z0-9+.-]*:\/\/(?:[^/@]*@)?([^/:]+)(?::\d*)?\/(.*)$/i.exec(url) ?? /^(?:[^/@]*@)?([^/:]+):(.*)$/.exec(url);
  return match ? { host: match[1]!.toLowerCase(), path: trimSlashes(match[2]!).replace(/\.git$/, '') } : null;
}

/**
 * The first GitHub or GitLab remote, `origin` first.
 * ponytail: a forge is recognised by a `github` or `gitlab` label in the remote's host, so a
 * GitHub Enterprise or GitLab host named otherwise is proposed as `local`; the human sees the
 * proposal and can edit it. A probe of the host's API would recognise it, at a network call.
 */
export function forgeRemote(remotes: { name: string; url: string }[]): { provider: 'github' | 'gitlab'; host: string; repository: string } | null {
  const ordered = [...remotes.filter((remote) => remote.name === 'origin'), ...remotes.filter((remote) => remote.name !== 'origin')];
  for (const remote of ordered) {
    const location = remoteLocation(remote.url);
    if (!location || location.path === '') continue;
    const labels = location.host.split('.');
    const provider = labels.includes('github') ? 'github' : labels.includes('gitlab') ? 'gitlab' : null;
    if (provider) return { provider, host: location.host, repository: location.path };
  }
  return null;
}

const trimSlashes = (path: string): string => path.replace(/^\/+|\/+$/g, '');
const trimPath = (path: string): string => trimSlashes(path).toLowerCase();

/**
 * The Task-reading half of the tracker contract: what every tracker adapter returns,
 * whatever the tracker. The local Markdown adapter is the first; the GitHub and GitLab
 * adapters of epic 3 implement this rather than copy it. A field the tracker cannot
 * express is null, never a guess.
 */
export type TrackerTask = {
  /** Unique within the project. On the local Markdown tracker, `<spec-slug>/<NN>`. */
  id: string;
  /** Null when the ticket has none. */
  title: string | null;
  /** Null when the tracker's value is not a Task state; the adapter says so in a diagnostic. */
  state: TaskState | null;
  /** The identities this Task is declared blocked by, as declared: they may name no Task. */
  blockedBy: string[];
  spec: string | null;
  /**
   * The slug of the Task's spec, which links it to its roadmap epic on every tracker. On the
   * local Markdown tracker, the spec directory the ticket lives in.
   */
  specSlug: string | null;
  triage: string | null;
  /** The ticket's path relative to the repository root, or its URL. */
  ticket: string;
  /**
   * The text after the header block (`ticketBody`), without comments: on the local tracker it
   * stops at the first `## Comments` heading, and a remote tracker's comments are never read.
   */
  body: string;
  /**
   * The ticket's Review: on the local tracker, the text under `### Review` inside `## Comments`;
   * null when it records none. Always null on a remote tracker, whose comments are never read.
   */
  review: string | null;
};

/** `tasks` is null when the tracker cannot be read at all; a diagnostic then says why. */
export type TaskReading = { tasks: TrackerTask[] | null; diagnostics: Diagnostic[] };

/** The five canonical triage roles (`docs/agents/triage-labels.md`), used verbatim as label strings. */
export const TRIAGE_ROLES: readonly string[] = ['needs-triage', 'needs-info', 'ready-for-agent', 'ready-for-human', 'wontfix'];

/**
 * The ticket header (ADR-0024) as written, one field per line; null when its line is not
 * there. `heading` is the leading heading's text, without its `#`s.
 */
export type TicketHeader = {
  heading: string | null;
  status: string | null;
  triage: string | null;
  blockedBy: string | null;
  spec: string | null;
};

const HEADER_FIELDS = { Status: 'status', Triage: 'triage', 'Blocked by': 'blockedBy', Spec: 'spec' } as const;
const HEADER_LINE = /^([^:]+):\s*(.*)$/;
const HEADING = /^#{1,6}\s+/;

/**
 * One reading of the ticket header for every tracker, so a Markdown ticket and an issue
 * body cannot drift apart. The header block is the first run of non-blank lines at the top
 * of the text, after one leading heading if the text starts with one. Only that block is
 * read: a `Status:` further down, in the body or the comments, is not the header's.
 */
export function parseTicketHeader(text: string): TicketHeader {
  return readHeader(text).header;
}

/**
 * The text after the header block, without the blank lines around it. A block that holds no
 * header field is not a header: a hand-filed issue keeps its first paragraph, and then the
 * whole text is the body.
 */
export function ticketBody(text: string): string {
  const { fielded, lines, end } = readHeader(text);
  return (fielded ? lines.slice(end) : lines).join('\n').replace(/^(?:[ \t]*\n)+/, '').trimEnd();
}

/** The header, whether its block holds any header field, the text's lines, and the line the block ends before. */
function readHeader(text: string): { header: TicketHeader; fielded: boolean; lines: string[]; end: number } {
  const lines = text.split(/\r?\n/);
  const header: TicketHeader = { heading: null, status: null, triage: null, blockedBy: null, spec: null };
  let fielded = false;
  let line = 0;
  const skipBlank = (): void => {
    while (lines[line]?.trim() === '') line++;
  };

  skipBlank();
  if (HEADING.test(lines[line] ?? '')) {
    header.heading = lines[line]!.replace(HEADING, '').trim();
    line++;
    skipBlank();
  }
  for (; line < lines.length && lines[line]!.trim() !== ''; line++) {
    const match = HEADER_LINE.exec(lines[line]!.trim());
    if (!match || !Object.hasOwn(HEADER_FIELDS, match[1]!)) continue;
    const field = HEADER_FIELDS[match[1] as keyof typeof HEADER_FIELDS];
    fielded = true;
    if (header[field] === null) header[field] = match[2]!.trim();
  }
  return { header, fielded, lines, end: line };
}

/** In characters of a remote Task's slug, after `feat/<number>-`. */
export const BRANCH_SLUG_LIMIT = 50;

/**
 * The branch a Task's work goes on (ADR-0018), chosen so that it maps back to the Task. The
 * slug is lowercased, and every run of characters other than ASCII letters and digits is one
 * hyphen, trimmed; a slug with nothing left leaves the number alone.
 *
 * - Local tracker: `feat/<slug>` from the ticket's file name without its number, as this
 *   repository has always named them. It is not cut, so it maps back by the file slug.
 * - Remote tracker: `feat/<number>-<slug>` from the issue title, the slug cut at
 *   `BRANCH_SLUG_LIMIT`. It maps back by the number.
 */
export function taskBranch(task: Pick<TrackerTask, 'id' | 'title' | 'ticket'>, remote: boolean): string {
  if (remote) {
    const slug = branchSlug(task.title ?? '').slice(0, BRANCH_SLUG_LIMIT).replace(/-+$/, '');
    return `feat/${[task.id.replace(/^#/, ''), slug].filter(Boolean).join('-')}`;
  }
  const [, number = '', name = ''] = /(\d+)-([^/]*)\.md$/.exec(task.ticket) ?? [];
  return `feat/${branchSlug(name) || number}`;
}

/**
 * The one command that starts a Task in a fresh session: `/mattpocock-skills:implement` with
 * its ticket path or URL, when the project's `workflow.provider` is `matt-pocock` and the Task
 * is neither `DONE` nor `CANCELLED`. Otherwise none: finished work is not restarted, and
 * another workflow is not offered commands it does not have.
 */
export function startCommand(task: Pick<TrackerTask, 'state' | 'ticket'>, workflow: string | null): string | null {
  if (workflow !== 'matt-pocock' || task.state === 'DONE' || task.state === 'CANCELLED') return null;
  return `/mattpocock-skills:implement ${task.ticket}`;
}

/** The board's columns, in order. */
export type BoardColumn = 'backlog' | 'ready' | 'inProgress' | 'done';

/**
 * A Task's column on the board, and what it is read from (ADR-0032): its state, or, for a
 * `READY` Task with AgentRuns attributed to it, those runs, which stand it In progress while its
 * ticket still says `READY`. None for `CANCELLED`, which is counted and not listed, nor for an
 * unknown state, which is listed apart.
 */
export function boardColumn(state: TaskState | null, runs: boolean): { column: BoardColumn; source: 'state' | 'runs' } | null {
  switch (state) {
    case null:
    case 'CANCELLED':
      return null;
    case 'BACKLOG':
      return { column: 'backlog', source: 'state' };
    case 'READY':
      return runs ? { column: 'inProgress', source: 'runs' } : { column: 'ready', source: 'state' };
    case 'ACTIVE':
    case 'BLOCKED':
    case 'READY_FOR_REVIEW':
    case 'APPROVED':
    case 'MERGE_READY':
      return { column: 'inProgress', source: 'state' };
    case 'MERGED':
    case 'DONE':
      return { column: 'done', source: 'state' };
  }
}

/**
 * The inverse of `taskBranch`: the one Task `branch` maps back to, or null when none or
 * several do, which is unassigned and never a guess (ADR-0018).
 *
 * - Local tracker: `feat/<slug>` to the ticket whose file slug gives that branch.
 * - Remote tracker: `feat/<number>` or `feat/<number>-…` to issue `#<number>`, whatever the
 *   rest says, when the tracker holds it.
 */
export function branchTask<T extends Pick<TrackerTask, 'id' | 'title' | 'ticket'>>(branch: string, tasks: T[], remote: boolean): T | null {
  const matches = tasksOnBranch(branch, tasks, remote);
  return matches.length === 1 ? matches[0]! : null;
}

/** Every Task `branch` maps back to, by the rules `branchTask` states; it credits one only when it is alone. */
function tasksOnBranch<T extends Pick<TrackerTask, 'id' | 'title' | 'ticket'>>(branch: string, tasks: T[], remote: boolean): T[] {
  const number = /^feat\/(\d+)(?:-|$)/.exec(branch)?.[1];
  return remote
    ? tasks.filter((task) => number !== undefined && task.id === `#${Number(number)}`)
    : tasks.filter((task) => taskBranch(task, false) === branch);
}

/**
 * Says when other Tasks have `task`'s branch, and names them: `branchTask` maps that branch to
 * none of them, so the work on it is credited to no Task. Null when the branch is the Task's
 * alone. Only local tickets can share one, through their file slug, which is why a ticket's
 * slug is unique across epics (`docs/agents/issue-tracker.md`); a remote Task's branch carries
 * its number.
 */
export function sharedBranch<T extends Pick<TrackerTask, 'id' | 'title' | 'ticket'>>(task: T, tasks: T[], remote: boolean): Diagnostic | null {
  const branch = taskBranch(task, remote);
  // By ticket, not id: `03-a.md` and `3-a.md` in one spec are both `<spec>/03`, and both are on its branch.
  const others = tasksOnBranch(branch, tasks, remote).filter((other) => other.ticket !== task.ticket);
  if (others.length === 0) return null;
  return {
    code: 'task.shared_branch',
    message:
      `${branch}, the branch of ${task.id}, is also the branch of ${others.map((other) => `${other.id} (${other.ticket})`).join(', ')}, ` +
      "so the work on it is credited to no Task. A ticket's slug is meant to be unique across epics.",
  };
}

const branchSlug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * The numbers a `Blocked by:` value names: `None`, with or without a parenthetical, is
 * none; otherwise every number outside a parenthetical, with or without `#`. Each tracker
 * turns them into its own identities.
 */
export function blockedByNumbers(value: string | null): number[] {
  if (value === null || /^none\b/i.test(value)) return [];
  return [...new Set((value.replace(/\([^)]*\)/g, '').match(/\d+/g) ?? []).map(Number))];
}

/** A header value written as inline code, `` `docs/specs/x/spec.md` ``, without the backticks; null when empty. */
export const unquote = (value: string | null): string | null => value?.replace(/^`(.*)`$/, '$1') || null;

export type ResolvedTask = TrackerTask & {
  /** Declared dependencies whose Task is not `DONE`. A dependency naming no Task is not one. */
  unmetDependencies: string[];
};

/**
 * Unmet dependencies are the contract's, not the adapter's, so that every tracker agrees
 * on them. A dependency naming no known Task is a dangling reference, reported, and never
 * counted as unmet: a typo must not block work forever.
 */
export function resolveDependencies(tasks: TrackerTask[]): { tasks: ResolvedTask[]; diagnostics: Diagnostic[] } {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const diagnostics: Diagnostic[] = [];
  const resolved = tasks.map((task) => {
    const unmetDependencies: string[] = [];
    for (const id of task.blockedBy) {
      const dependency = byId.get(id);
      if (!dependency) {
        diagnostics.push({
          code: 'task.dangling_dependency',
          message: `${task.id} (${task.ticket}) is declared blocked by ${id}, which is not a known Task.`,
        });
      } else if (dependency.state !== 'DONE') {
        unmetDependencies.push(id);
      }
    }
    return { ...task, unmetDependencies };
  });
  return { tasks: resolved, diagnostics };
}
