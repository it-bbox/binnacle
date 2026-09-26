import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

type SnapshotTask = { id: string; title: string | null; state: string | null; unmetDependencies: string[]; ticket: string };
type Section<T> = { items: T[]; remainder: number };
type Daily = {
  checkout: { root: string; registered: boolean };
  head: string;
  dirty: boolean;
  from: { commit: string | null; source: string };
  fallback: { reason: string; message: string } | null;
  commits: Section<{ commit: string; subject: string }> & { count: number };
  transitions: Section<{ id: string; title: string | null; from: string | null; to: string | null; ticket: string }>;
  newTickets: Section<SnapshotTask>;
  roadmap: { number: number; title: string; from: string | null; to: string }[] | null;
  decisions: Section<{ title: string | null; path: string; change: string }> | null;
  readyToStart: Section<SnapshotTask> | null;
  attention: { code: string; message: string }[];
};
type Event = { type: string; projectPath: string | null; payload: Record<string, unknown> };

const MANIFEST = `version: 1

project:
  id: daily-project

tracker:
  provider: local
  local:
    issues: docs/specs

knowledge:
  docs: docs
  adr: docs/adr
`;

/** Older than the seven-day fallback window, whenever the tests run. */
const LONG_AGO = '2025-01-01T12:00:00Z';

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** Real Git, real commits; `date` pins the commit date, which is what the fallback window reads. */
function git(root: string, args: string[], date?: string): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Binnacle Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args],
    { cwd: root, encoding: 'utf8', env: date ? { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date } : process.env },
  ).trim();
}

function commitAll(root: string, message: string, date?: string): string {
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '--allow-empty', '-m', message], date);
  return git(root, ['rev-parse', 'HEAD']);
}

function write(root: string, path: string, text: string): void {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}

const ticketText = (title: string, status: string, blockedBy = 'None'): string =>
  `# ${title}\n\nStatus: ${status}\nTriage: ready-for-agent\nBlocked by: ${blockedBy}\n\n**What to build:** something.\n`;

const roadmapText = (rows: string[]): string =>
  ['# Roadmap', '', '| # | Epic | Status | Spec |', '| --- | --- | --- | --- |', ...rows, '', '## Current focus', '', 'Next action: start ticket 01. `/binnacle:autopilot`', ''].join('\n');

const row = (number: number, epic: string, status: string, spec: string): string =>
  `| ${number} | ${epic} | ${status} | [\`${spec}\`](specs/${spec}/spec.md) |`;

/**
 * A repository whose first commit is older than the fallback window: epic 1 at `tickets`
 * with two READY tickets, the second waiting on the first, and one ADR.
 */
function makeRepository(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-daily-')));
  roots.push(root);
  write(root, '.binnacle/project.yaml', MANIFEST);
  write(root, 'docs/roadmap.md', roadmapText([row(1, 'First epic', 'tickets', 'first')]));
  write(root, 'docs/specs/first/issues/01-start.md', ticketText('01: Start', 'READY'));
  write(root, 'docs/specs/first/issues/02-follow.md', ticketText('02: Follow', 'READY', '01'));
  write(root, 'docs/adr/ADR-0001-first.md', '# ADR-0001: First\n');
  git(root, ['init', '--quiet', '--initial-branch=main']);
  commitAll(root, 'Start the project', LONG_AGO);
  return root;
}

async function withDaemon(body: (daemon: TestDaemon) => Promise<void>): Promise<void> {
  const daemon = await startTestDaemon();
  try {
    await body(daemon);
  } finally {
    await daemon.stop();
  }
}

async function daily(daemon: TestDaemon, path: string, since?: string): Promise<Daily> {
  const result = await daemon.call<Daily>('daily.get', since === undefined ? { path } : { path, since });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

async function register(daemon: TestDaemon, root: string): Promise<void> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
}

async function dailies(daemon: TestDaemon): Promise<Event[]> {
  return (await daemon.call<{ events: Event[] }>('event.list')).body.events.filter((event) => event.type === 'daily');
}

const subjects = (body: Daily): string[] => body.commits.items.map((commit) => commit.subject);

function assertEmpty(body: Daily): void {
  assert.deepEqual(body.commits, { count: 0, items: [], remainder: 0 });
  assert.deepEqual(body.transitions, { items: [], remainder: 0 });
  assert.deepEqual(body.newTickets, { items: [], remainder: 0 });
  assert.deepEqual(body.roadmap, []);
  assert.deepEqual(body.decisions, { items: [], remainder: 0 });
}

describe('the daily delta', () => {
  it('falls back to the last seven days on the first call, says so, and records the head it reached', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      const base = git(root, ['rev-parse', 'HEAD']);
      for (let n = 1; n <= 12; n++) commitAll(root, `Recent ${n}`);
      const head = git(root, ['rev-parse', 'HEAD']);
      await register(daemon, root);

      const body = await daily(daemon, root);
      assert.equal(body.fallback?.reason, 'no_baseline');
      assert.match(body.fallback!.message, /7 days/);
      // The window starts after the last commit before it, so the old commit is not in the delta.
      assert.deepEqual(body.from, { commit: base, source: 'fallback' });
      assert.equal(body.head, head);
      assert.equal(body.commits.count, 12);
      assert.deepEqual(subjects(body), ['Recent 12', 'Recent 11', 'Recent 10', 'Recent 9', 'Recent 8', 'Recent 7', 'Recent 6', 'Recent 5', 'Recent 4', 'Recent 3']);
      assert.equal(body.commits.remainder, 2);
      assert.equal(body.commits.items[0]!.commit, head);
      // Ends with what can start and what needs attention.
      assert.deepEqual(body.readyToStart?.items.map((task) => task.id), ['first/01']);
      assert.deepEqual(body.attention, []);

      const recorded = await dailies(daemon);
      assert.equal(recorded.length, 1);
      assert.equal(recorded[0]!.projectPath, root);
      assert.deepEqual(recorded[0]!.payload, { head });
    });
  });

  it('counts every commit as new when the window reaches past the first one', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      git(root, ['commit', '--quiet', '--amend', '--no-edit', '--reset-author']);
      await register(daemon, root);

      const body = await daily(daemon, root);
      assert.deepEqual(body.from, { commit: null, source: 'fallback' });
      assert.deepEqual(subjects(body), ['Start the project']);
      assert.deepEqual(body.newTickets.items.map((task) => task.id), ['first/01', 'first/02']);
      assert.deepEqual(body.decisions?.items, [{ title: 'ADR-0001: First', path: 'docs/adr/ADR-0001-first.md', change: 'added' }]);
      assert.deepEqual(body.roadmap, [{ number: 1, title: 'First epic', from: null, to: 'tickets' }]);
    });
  });

  it('returns an empty delta on a second call in a row, from the daily before it', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      await register(daemon, root);
      const first = await daily(daemon, root);

      const second = await daily(daemon, root);
      assert.equal(second.fallback, null);
      assert.deepEqual(second.from, { commit: first.head, source: 'daily' });
      assertEmpty(second);
      assert.deepEqual(second.readyToStart?.items.map((task) => task.id), ['first/01']);
      assert.equal((await dailies(daemon)).length, 2);
    });
  });

  it('reports a READY → DONE transition, a new ticket, a roadmap status change and a new ADR', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      await register(daemon, root);
      await daily(daemon, root);

      write(root, 'docs/specs/first/issues/01-start.md', ticketText('01: Start', 'DONE'));
      write(root, 'docs/specs/first/issues/03-later.md', ticketText('03: Later', 'BACKLOG'));
      write(root, 'docs/roadmap.md', roadmapText([row(1, 'First epic', 'in progress', 'first')]));
      write(root, 'docs/adr/ADR-0002-second.md', '# ADR-0002: Second\n');
      commitAll(root, 'Finish ticket 01');

      const body = await daily(daemon, root);
      assert.deepEqual(subjects(body), ['Finish ticket 01']);
      assert.deepEqual(body.transitions, {
        items: [{ id: 'first/01', title: 'Start', from: 'READY', to: 'DONE', ticket: 'docs/specs/first/issues/01-start.md' }],
        remainder: 0,
      });
      assert.deepEqual(body.newTickets, {
        items: [{ id: 'first/03', title: 'Later', state: 'BACKLOG', unmetDependencies: [], ticket: 'docs/specs/first/issues/03-later.md' }],
        remainder: 0,
      });
      assert.deepEqual(body.roadmap, [{ number: 1, title: 'First epic', from: 'tickets', to: 'in progress' }]);
      assert.deepEqual(body.decisions, { items: [{ title: 'ADR-0002: Second', path: 'docs/adr/ADR-0002-second.md', change: 'added' }], remainder: 0 });
      // 02 was waiting on 01, which is now DONE.
      assert.deepEqual(body.readyToStart?.items.map((task) => task.id), ['first/02']);
    });
  });

  it('reads committed state only, and flags a dirty working tree', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      await register(daemon, root);
      await daily(daemon, root);

      write(root, 'docs/specs/first/issues/01-start.md', ticketText('01: Start', 'DONE'));
      write(root, 'docs/specs/first/issues/04-draft.md', ticketText('04: Draft', 'READY'));
      write(root, 'docs/roadmap.md', 'not a roadmap any more\n');

      const body = await daily(daemon, root);
      assert.equal(body.dirty, true);
      assertEmpty(body);
      assert.deepEqual(body.readyToStart?.items.map((task) => task.id), ['first/01']);
      assert.deepEqual(body.attention, []);
    });
  });

  it('starts from an explicit since without recording anything or moving the baseline', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      const start = git(root, ['rev-parse', 'HEAD']);
      await register(daemon, root);
      const baseline = await daily(daemon, root);
      write(root, 'docs/specs/first/issues/01-start.md', ticketText('01: Start', 'ACTIVE'));
      commitAll(root, 'Start ticket 01');
      await daily(daemon, root);
      commitAll(root, 'Something else');

      const since = await daily(daemon, root, start.slice(0, 12));
      assert.equal(since.fallback, null);
      assert.deepEqual(since.from, { commit: start, source: 'since' });
      assert.deepEqual(subjects(since), ['Something else', 'Start ticket 01']);
      assert.deepEqual(since.transitions.items.map(({ id, from, to }) => ({ id, from, to })), [{ id: 'first/01', from: 'READY', to: 'ACTIVE' }]);
      assert.equal((await dailies(daemon)).length, 2);

      // The next daily still starts from the last recorded one, not from `since`.
      const next = await daily(daemon, root);
      assert.deepEqual(subjects(next), ['Something else']);
      assert.notEqual(next.from.commit, baseline.head);
    });
  });

  it('falls back and says why when the baseline was rewritten away, and when it was then garbage-collected', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      commitAll(root, 'To be rewritten');
      await register(daemon, root);
      await daily(daemon, root);

      git(root, ['reset', '--quiet', '--hard', 'HEAD~1']);
      commitAll(root, 'Rewritten');

      const rewritten = await daily(daemon, root);
      assert.equal(rewritten.fallback?.reason, 'baseline_diverged');
      assert.equal(rewritten.from.source, 'fallback');
      assert.deepEqual(subjects(rewritten), ['Rewritten']);

      // The fallback's daily recorded the new head; go back past it and drop the old line for good.
      const gone = git(root, ['rev-parse', 'HEAD']);
      git(root, ['reset', '--quiet', '--hard', 'HEAD~1']);
      commitAll(root, 'Rewritten again');
      git(root, ['reflog', 'expire', '--expire=now', '--all']);
      git(root, ['gc', '--quiet', '--prune=now']);

      const missing = await daily(daemon, root);
      assert.equal(missing.fallback?.reason, 'baseline_missing');
      assert.match(missing.fallback!.message, new RegExp(gone));
      assert.deepEqual(subjects(missing), ['Rewritten again']);
    });
  });

  it('refuses a since that is not a commit HEAD descends from, and a checkout with no commits', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      const side = commitAll(root, 'On a line HEAD will not have');
      git(root, ['reset', '--quiet', '--hard', 'HEAD~1']);
      await register(daemon, root);
      for (const since of ['--output=/tmp/x', 'deadbeef', side]) {
        const refused = await daemon.call<{ error: { code: string } }>('daily.get', { path: root, since });
        assert.equal(refused.status, 400, since);
        assert.equal(refused.body.error.code, 'request.invalid');
      }

      const empty = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-daily-empty-')));
      roots.push(empty);
      write(empty, '.binnacle/project.yaml', MANIFEST);
      git(empty, ['init', '--quiet']);
      await register(daemon, empty);
      const none = await daemon.call<{ error: { code: string } }>('daily.get', { path: empty });
      assert.equal(none.status, 409);
      assert.equal(none.body.error.code, 'git.no_commits');
      assert.equal((await dailies(daemon)).length, 0);
    });
  });
});

describe('the roadmap on a remote tracker', () => {
  it('is in the snapshot, its changes are in the daily and it is a checkpoint target, while Tasks stay unavailable', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      write(root, '.binnacle/project.yaml', 'version: 1\n\nproject:\n  id: daily-project\n\ntracker:\n  provider: github\n\nknowledge:\n  docs: docs\n  adr: docs/adr\n');
      commitAll(root, 'Move the tickets to GitHub', LONG_AGO);
      await register(daemon, root);

      type Snapshot = { roadmap: { epics: unknown[] } | null; tasks: unknown; attention: Daily['attention'] };
      const snapshot = (await daemon.call<Snapshot>('project.snapshot', { path: root })).body;
      assert.deepEqual(snapshot.roadmap?.epics, [{ number: 1, title: 'First epic', status: 'tickets', spec: 'first' }]);
      assert.equal(snapshot.tasks, null);
      assert.deepEqual(snapshot.attention.map((item) => item.code), ['tracker.unavailable']);

      await daily(daemon, root);
      write(root, 'docs/roadmap.md', roadmapText([row(1, 'First epic', 'in progress', 'first')]));
      commitAll(root, 'Start epic 1');

      const body = await daily(daemon, root);
      assert.deepEqual(body.roadmap, [{ number: 1, title: 'First epic', from: 'tickets', to: 'in progress' }]);
      assert.equal(body.transitions, null);
      assert.equal(body.newTickets, null);
      assert.equal(body.readyToStart, null);
      assert.deepEqual(body.attention.map((item) => item.code), ['tracker.unavailable']);

      const prepared = await daemon.call<{ targets: { type: string; path: string | null }[] }>('checkpoint.prepare', { path: root });
      assert.deepEqual(prepared.body.targets.find((target) => target.type === 'position'), { type: 'position', path: 'docs/roadmap.md' });
    });
  });
});
