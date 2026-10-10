import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * The board (`task.list`) through the daemon's HTTP API: a project's roadmap and tickets in a
 * real repository, whose reflog puts the Claude Code sessions, cut from real ones, on their
 * Tasks' branches.
 */
type Run = { harness: string; model: string | null; role: string; lastActivityAt: string; active: { value: boolean; provenance: string } };
type Card = {
  id: string;
  title: string | null;
  state: string | null;
  column: string | null;
  source: string | null;
  unmetDependencies: string[];
  ticket: string;
  start: string | null;
  review: boolean | null;
  questions: { asked: number; unanswered: number } | null;
  latestRun: Run | null;
};
type Column = { items: Card[]; remainder: number };
type Board = {
  epic: { number: number; title: string; status: string; spec: string | null } | null;
  spec: string | null;
  columns: { backlog: Column; ready: Column; inProgress: Column; done: Column };
  unknown: { items: (Card & { diagnostic: { code: string; message: string } | null })[]; remainder: number };
  cancelled: number;
  withoutSpec: number;
};
type Line = Record<string, unknown> & { type: string; message?: Record<string, unknown> };

// The daemon runs in this process and reads its environment: a token the developer has set
// would otherwise reach the loopback GitHub stand-in.
delete process.env.BINNACLE_GITHUB_TOKEN;

const GRILL = readFileSync(join(import.meta.dirname, 'fixtures', 'claude-code', 'grill-on-main.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as Line);

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function temporary(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  roots.push(root);
  return root;
}

function write(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

const MANIFEST = `version: 1

project:
  id: board-project

tracker:
  provider: local
  local:
    issues: docs/specs

knowledge:
  docs: docs

workflow:
  provider: matt-pocock
`;

const ROADMAP = `# Roadmap

| # | Epic | Status | Spec |
| --- | --- | --- | --- |
| 1 | First | done | [first](specs/first/spec.md) |
| 2 | Second | in progress | [second](specs/second/spec.md) |
| 3 | Third | not started | — |

## Current focus

Epic 2.
`;

function makeProject(): string {
  const root = temporary('binnacle-board-');
  write(root, '.binnacle/project.yaml', MANIFEST);
  write(root, 'docs/roadmap.md', ROADMAP);
  return root;
}

/** `docs/specs/<spec>/issues/<file>` with its title and header lines. */
function ticket(root: string, spec: string, file: string, title: string, ...header: string[]): string {
  const path = `docs/specs/${spec}/issues/${file}`;
  write(root, path, [`# ${file.slice(0, 2)}: ${title}`, '', ...header, '', '**What to build:** it.', ''].join('\n'));
  return path;
}

/** Git, with the reflog entries it writes dated `timestamp`. */
function gitAt(timestamp: string, cwd: string, ...args: string[]): void {
  const date = `@${Math.floor(Date.parse(timestamp) / 1000)} +0000`;
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    stdio: 'ignore',
    env: { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date },
  });
}

/** `root` as a repository whose `HEAD` reflog begins on `main` at `since`, then switches to each branch at its time. */
function repository(root: string, since: string, ...switches: [at: string, branch: string][]): void {
  gitAt(since, root, 'init', '--quiet', '--initial-branch=main');
  gitAt(since, root, 'add', '.');
  gitAt(since, root, 'commit', '--quiet', '-m', 'initial');
  for (const [time, branch] of switches) gitAt(time, root, 'switch', '--quiet', '-C', branch);
}

/** A Claude Code session launched in `cwd`, whose one message is at `timestamp`. */
function session(artifacts: string, cwd: string, sessionId: string, timestamp: string): void {
  const records = GRILL.map((line) => ({
    ...line,
    cwd,
    sessionId,
    timestamp,
    ...(line.message && line.type === 'assistant' ? { message: { ...line.message, id: `${String(line.message.id)}-${sessionId}` } } : {}),
  }));
  write(join(artifacts, cwd.replace(/[^a-zA-Z0-9]/g, '-')), `${sessionId}.jsonl`, records.map((record) => `${JSON.stringify(record)}\n`).join(''));
}

const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

async function withDaemon(body: (daemon: TestDaemon, artifacts: string) => Promise<void>): Promise<void> {
  const artifacts = temporary('binnacle-board-claude-');
  const daemon = await startTestDaemon({ artifacts: { claudeCode: artifacts, codex: join(artifacts, 'no-codex') } });
  try {
    await body(daemon, artifacts);
  } finally {
    await daemon.stop();
  }
}

async function taskList(daemon: TestDaemon, root: string, input: object = {}): Promise<Board> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
  const result = await daemon.call<Board>('task.list', { path: root, ...input });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

const ids = (column: Column): string[] => column.items.map((card) => card.id);

describe('the board', () => {
  it('puts each Task of the current epic in its column, a READY one with runs In progress from runs, counts CANCELLED and lists an unknown state apart', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject();
      ticket(root, 'first', '01-old.md', 'Old', 'Status: DONE');
      const backlog = ticket(root, 'second', '01-backlog.md', 'Backlog', 'Status: BACKLOG');
      const ready = ticket(root, 'second', '02-ready.md', 'Ready', 'Status: READY', 'Blocked by: 01');
      const worked = ticket(root, 'second', '03-worked.md', 'Worked on', 'Status: READY');
      ticket(root, 'second', '04-active.md', 'Active', 'Status: ACTIVE');
      ticket(root, 'second', '05-blocked.md', 'Blocked', 'Status: BLOCKED');
      ticket(root, 'second', '06-merged.md', 'Merged', 'Status: MERGED');
      const done = ticket(root, 'second', '07-done.md', 'Done', 'Status: DONE');
      ticket(root, 'second', '08-cancelled.md', 'Cancelled', 'Status: CANCELLED');
      const unknown = ticket(root, 'second', '09-unknown.md', 'Unknown', 'Status: WIP');
      const yesterday = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      repository(root, minutesAgo(3 * 24 * 60), [yesterday, 'feat/done'], [minutesAgo(3), 'feat/worked']);
      session(artifacts, root, 'finished', new Date(Date.parse(yesterday) + 60_000).toISOString());
      session(artifacts, root, 'earlier', minutesAgo(2));
      const latest = minutesAgo(1);
      session(artifacts, root, 'latest', latest);

      const board = await taskList(daemon, root);
      assert.deepEqual(board.epic, { number: 2, title: 'Second', status: 'in progress', spec: 'second' });
      assert.equal(board.spec, 'second');
      assert.deepEqual(board.columns.backlog, {
        items: [
          {
            id: 'second/01',
            title: 'Backlog',
            state: 'BACKLOG',
            column: 'backlog',
            source: 'state',
            unmetDependencies: [],
            ticket: backlog,
            start: `/mattpocock-skills:implement ${backlog}`,
            review: false,
            questions: { asked: 0, unanswered: 0 },
            latestRun: null,
          },
        ],
        remainder: 0,
      });
      assert.deepEqual(board.columns.ready.items[0], {
        id: 'second/02',
        title: 'Ready',
        state: 'READY',
        column: 'ready',
        source: 'state',
        unmetDependencies: ['second/01'],
        ticket: ready,
        start: `/mattpocock-skills:implement ${ready}`,
        review: false,
        questions: { asked: 0, unanswered: 0 },
        latestRun: null,
      });
      assert.deepEqual(ids(board.columns.ready), ['second/02']);

      // The ticket still says READY; its runs stand it In progress, and name who works on it.
      assert.deepEqual(ids(board.columns.inProgress), ['second/03', 'second/04', 'second/05']);
      assert.deepEqual(board.columns.inProgress.items[0], {
        id: 'second/03',
        title: 'Worked on',
        state: 'READY',
        column: 'inProgress',
        source: 'runs',
        unmetDependencies: [],
        ticket: worked,
        start: `/mattpocock-skills:implement ${worked}`,
        review: false,
        questions: { asked: 0, unanswered: 0 },
        latestRun: { harness: 'claude-code', model: 'claude-opus-5-5', role: 'implementation', lastActivityAt: latest, active: { value: true, provenance: 'calculated' } },
      });
      assert.deepEqual(
        board.columns.inProgress.items.slice(1).map((card) => [card.state, card.source]),
        [['ACTIVE', 'state'], ['BLOCKED', 'state']],
      );

      // The latest first, by id; a DONE Task with runs stays Done, and has no start command.
      assert.deepEqual(ids(board.columns.done), ['second/07', 'second/06']);
      assert.deepEqual(board.columns.done.items[0]!.latestRun?.active, { value: false, provenance: 'calculated' });
      assert.equal(board.columns.done.items[0]!.ticket, done);
      assert.equal(board.columns.done.items[0]!.start, null);
      assert.equal(board.columns.done.remainder, 0);

      assert.equal(board.cancelled, 1);
      const listed = [...Object.values(board.columns).flatMap((column) => column.items), ...board.unknown.items];
      assert.ok(!listed.some((card) => card.state === 'CANCELLED'));
      // Epic 1's Task is not on epic 2's board.
      assert.ok(!listed.some((card) => card.id.startsWith('first/')));

      assert.deepEqual(board.unknown, {
        items: [
          {
            id: 'second/09',
            title: 'Unknown',
            state: null,
            column: null,
            source: null,
            unmetDependencies: [],
            ticket: unknown,
            start: `/mattpocock-skills:implement ${unknown}`,
            review: false,
            questions: { asked: 0, unanswered: 0 },
            latestRun: null,
            diagnostic: { code: 'task.unknown_state', message: `second/09 (${unknown}) has Status: "WIP", which is not a Task state.` },
          },
        ],
        remainder: 0,
      });
      assert.equal(board.withoutSpec, 0);
    });
  });

  it('answers for the current epic without a spec slug, and for any other epic with one', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      ticket(root, 'first', '01-old.md', 'Old', 'Status: DONE');
      ticket(root, 'second', '01-new.md', 'New', 'Status: READY');

      assert.deepEqual(ids((await taskList(daemon, root)).columns.ready), ['second/01']);
      const first = await taskList(daemon, root, { spec: 'first' });
      assert.deepEqual(first.epic, { number: 1, title: 'First', status: 'done', spec: 'first' });
      assert.equal(first.spec, 'first');
      assert.deepEqual(ids(first.columns.done), ['first/01']);
      assert.deepEqual(ids(first.columns.ready), []);

      // Once the second is done, the third is current; it has no spec yet, so no Tasks.
      write(root, 'docs/roadmap.md', ROADMAP.replace('| Second | in progress |', '| Second | done |'));
      const third = await taskList(daemon, root);
      assert.deepEqual(third.epic, { number: 3, title: 'Third', status: 'not started', spec: null });
      assert.equal(third.spec, null);
      assert.deepEqual(Object.values(third.columns).flatMap(ids), []);
    });
  });

  it('lists at most ten Tasks in a column, with a remainder, and Done its latest by id', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      for (let number = 1; number <= 12; number++) {
        const nn = String(number).padStart(2, '0');
        ticket(root, 'second', `${nn}-backlog-${nn}.md`, `Backlog ${nn}`, 'Status: BACKLOG');
        ticket(root, 'second', `${number + 20}-done-${nn}.md`, `Done ${nn}`, 'Status: DONE');
      }

      const board = await taskList(daemon, root);
      assert.deepEqual(ids(board.columns.backlog), Array.from({ length: 10 }, (_, index) => `second/${String(index + 1).padStart(2, '0')}`));
      assert.equal(board.columns.backlog.remainder, 2);
      assert.deepEqual(ids(board.columns.done), Array.from({ length: 10 }, (_, index) => `second/${32 - index}`));
      assert.equal(board.columns.done.remainder, 2);
    });
  });

  it('counts a card’s questions, from its unmerged branch, so that one with an unanswered question can be marked', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      const asked = ticket(root, 'second', '01-asked.md', 'Asked', 'Status: READY');
      ticket(root, 'second', '02-quiet.md', 'Quiet', 'Status: READY');
      repository(root, minutesAgo(60));
      const worktree = join(temporary('binnacle-board-worktree-'), 'asked');
      gitAt(minutesAgo(5), root, 'worktree', 'add', '--quiet', '-b', 'feat/asked', worktree);
      write(worktree, asked, `${readFileSync(join(root, asked), 'utf8')}\n## Comments\n\n### Question\n\nWhich way?\n`);
      gitAt(minutesAgo(4), worktree, 'commit', '--quiet', '-am', 'A question');

      const board = await taskList(daemon, root);
      assert.deepEqual(
        board.columns.ready.items.map((card) => [card.id, card.questions]),
        [
          ['second/01', { asked: 1, unanswered: 1 }],
          ['second/02', { asked: 0, unanswered: 0 }],
        ],
      );
    });
  });

  it('refuses a spec that is neither a slug nor null', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      const result = await daemon.call<{ error: { code: string } }>('task.list', { path: root, spec: 2 });
      assert.equal(result.status, 400);
      assert.equal(result.body.error.code, 'request.invalid');
    });
  });
});

describe('Ready to start beside the board', () => {
  it('leaves out a READY Task the board stands In progress from its runs, by the same rule, in the snapshot and the daily, and lists it in flight', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject();
      ticket(root, 'second', '01-waiting.md', 'Waiting', 'Status: READY');
      const worked = ticket(root, 'second', '02-worked.md', 'Worked on', 'Status: READY');
      repository(root, minutesAgo(60), [minutesAgo(3), 'feat/worked']);
      session(artifacts, root, 'working', minutesAgo(1));

      const board = await taskList(daemon, root);
      assert.deepEqual(ids(board.columns.ready), ['second/01']);
      assert.deepEqual(board.columns.inProgress.items.map((card) => [card.id, card.source]), [['second/02', 'runs']]);

      type Tasks = { inFlight: Column; readyToStart: Column };
      const snapshot = await daemon.call<{ tasks: Tasks }>('project.snapshot', { path: root });
      assert.equal(snapshot.status, 200, JSON.stringify(snapshot.body));
      assert.deepEqual(ids(snapshot.body.tasks.readyToStart), ['second/01']);
      assert.deepEqual(snapshot.body.tasks.inFlight.items.map((task) => [task.id, task.state]), [['second/02', 'READY']]);

      const daily = await daemon.call<{ readyToStart: Column }>('daily.get', { path: root });
      assert.equal(daily.status, 200, JSON.stringify(daily.body));
      assert.deepEqual(ids(daily.body.readyToStart), ['second/01']);

      // A reading, never written back (ADR-0032).
      assert.match(readFileSync(join(root, worked), 'utf8'), /^Status: READY$/m);
    });
  });
});

describe('the board on a remote tracker', () => {
  it('groups the Tasks that carry no spec on their own, which `spec: null` lists, an unknown state with its diagnostic', async () => {
    const server = createServer((request, response) => {
      const found = new URL(request.url ?? '/', 'http://x').pathname === '/repos/octo/repo/issues';
      const issue = (number: number, body: string): object => ({
        number,
        title: `Issue ${number}`,
        state: 'open',
        state_reason: null,
        body,
        labels: [],
        html_url: `https://github.com/octo/repo/issues/${number}`,
      });
      response.writeHead(found ? 200 : 404, { 'content-type': 'application/json' });
      response.end(JSON.stringify(found ? [issue(1, 'Status: READY\nSpec: `docs/specs/second/spec.md`'), issue(2, 'Status: READY'), issue(3, 'Status: BACKLOG'), issue(4, 'Status: WIP')] : {}));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      await withDaemon(async (daemon) => {
        const root = makeProject();
        const host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        write(root, '.binnacle/project.yaml', MANIFEST.replace(/tracker:[\s\S]*?\n\n/, `tracker:\n  provider: github\n  repository: octo/repo\n  host: ${host}\n\n`));

        const current = await taskList(daemon, root);
        assert.deepEqual(ids(current.columns.ready), ['#1']);
        assert.equal(current.withoutSpec, 3);

        const without = await taskList(daemon, root, { spec: null });
        assert.equal(without.epic, null);
        assert.equal(without.spec, null);
        assert.deepEqual(ids(without.columns.ready), ['#2']);
        assert.deepEqual(ids(without.columns.backlog), ['#3']);
        assert.deepEqual(without.unknown.items[0]!.diagnostic, {
          code: 'task.unknown_state',
          message: '#4 (https://github.com/octo/repo/issues/4) has Status: "WIP", which is not a Task state.',
        });
        assert.deepEqual(without.columns.ready.items[0]!.start, '/mattpocock-skills:implement https://github.com/octo/repo/issues/2');
        // Unavailable, since an issue's comments are never read.
        assert.equal(without.columns.ready.items[0]!.review, null);
      });
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
