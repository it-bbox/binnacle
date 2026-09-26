import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { BODY_LIMIT } from '../src/task.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

type Brief = {
  id: string;
  title: string | null;
  state: string | null;
  triage: string | null;
  ticket: string;
  spec: string | null;
  dependencies: { id: string; title: string | null; state: string | null; met: boolean | null; dangling: boolean }[];
  body: { text: string; truncated: boolean };
  branch: string;
  start: string | null;
  review: { text: string; truncated: boolean } | { available: false; reason: string } | null;
  diagnostics: { code: string; message: string }[];
};
type Envelope = { error: { code: string; message: string } };

const MANIFEST = 'version: 1\n\nproject:\n  id: task-project\n\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n';

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function makeProject(manifest = MANIFEST): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-task-')));
  roots.push(root);
  mkdirSync(join(root, '.binnacle'));
  writeFileSync(join(root, '.binnacle', 'project.yaml'), manifest);
  return root;
}

function write(root: string, path: string, text: string): void {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}

/** A ticket in the shape `/to-tickets` writes, with a body, a `Status:` in that body, and comments ending with its Review. */
const ticketText = (title: string, header: string[], body: string, review = 'Nothing found.'): string =>
  [`# ${title}`, '', ...header, '', body, '', '## Comments', '', '- A comment the brief leaves out.', '', '### Review', '', review, ''].join('\n');

async function withDaemon(body: (daemon: TestDaemon) => Promise<void>): Promise<void> {
  const daemon = await startTestDaemon();
  try {
    await body(daemon);
  } finally {
    await daemon.stop();
  }
}

async function taskGet(daemon: TestDaemon, root: string, id: string, register = root): Promise<{ status: number; body: Brief & Envelope }> {
  assert.equal((await daemon.call('project.register', { path: register })).status, 200);
  return daemon.call<Brief & Envelope>('task.get', { path: root, id });
}

describe('the task brief on the local tracker', () => {
  it('gives the Task’s fields, its dependencies with their titles and states, the body without comments, and the branch', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      write(root, 'docs/specs/epic/issues/01-done.md', ticketText('01: Done first', ['Status: DONE'], 'Done.'));
      write(root, 'docs/specs/epic/issues/02-in-flight.md', ticketText('02: In flight', ['Status: ACTIVE'], 'Going.'));
      write(
        root,
        'docs/specs/epic/issues/03-build-the-thing.md',
        ticketText(
          '03: Build the thing',
          ['Status: READY', 'Triage: ready-for-agent', 'Blocked by: 01, 2, 09 (a typo)', 'Spec: `docs/specs/epic/spec.md`'],
          '**What to build:** the thing.\n\nStatus: DONE\n\n- [ ] It works.',
        ),
      );

      const result = await taskGet(daemon, root, 'epic/3');
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.deepEqual(result.body, {
        id: 'epic/03',
        title: 'Build the thing',
        state: 'READY',
        triage: 'ready-for-agent',
        ticket: 'docs/specs/epic/issues/03-build-the-thing.md',
        spec: 'docs/specs/epic/spec.md',
        dependencies: [
          { id: 'epic/01', title: 'Done first', state: 'DONE', met: true, dangling: false },
          { id: 'epic/02', title: 'In flight', state: 'ACTIVE', met: false, dangling: false },
          { id: 'epic/09', title: null, state: null, met: null, dangling: true },
        ],
        body: { text: '**What to build:** the thing.\n\nStatus: DONE\n\n- [ ] It works.', truncated: false },
        branch: 'feat/build-the-thing',
        start: null,
        review: { text: 'Nothing found.', truncated: false },
        diagnostics: [],
      });
    });
  });

  it('cuts a long body at the limit in code points, and says so', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      // Astral characters, two UTF-16 code units each: a cut by code unit would split one.
      write(root, 'docs/specs/epic/issues/01-long.md', ticketText('01: Long', ['Status: READY'], '🦆'.repeat(BODY_LIMIT + 5)));
      write(root, 'docs/specs/epic/issues/02-exact.md', ticketText('02: Exact', ['Status: READY'], '🦆'.repeat(BODY_LIMIT)));

      const long = (await taskGet(daemon, root, 'epic/01')).body.body;
      assert.equal(long.truncated, true);
      assert.equal(long.text, '🦆'.repeat(BODY_LIMIT));
      assert.deepEqual((await taskGet(daemon, root, 'epic/02')).body.body, { text: '🦆'.repeat(BODY_LIMIT), truncated: false });
    });
  });

  it('keeps the body of a ticket with no header whole, and makes its branch from the file name', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      write(root, 'docs/specs/epic/issues/04-Fix THE_thing!.md', '# 04: Fix the thing\n\nSomething is broken.\n');

      const result = await taskGet(daemon, root, 'epic/04');
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.state, null);
      assert.deepEqual(result.body.body, { text: '# 04: Fix the thing\n\nSomething is broken.', truncated: false });
      assert.equal(result.body.branch, 'feat/fix-the-thing');

      // Not cut, so that the branch maps back to the file.
      const long = 'a-ticket-whose-file-name-runs-well-past-any-remote-branch-slug-limit';
      write(root, `docs/specs/epic/issues/05-${long}.md`, ticketText('05: Long', ['Status: READY'], 'Body.'));
      assert.equal((await taskGet(daemon, root, 'epic/05')).body.branch, `feat/${long}`);
    });
  });

  it('says when a ticket in another epic has the same slug, and names it, since their branch then credits neither', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      write(root, 'docs/specs/telemetry/issues/09-exit-demonstration.md', ticketText('09: Exit demonstration', ['Status: READY'], 'Body.'));
      write(root, 'docs/specs/tracker/issues/12-exit-demonstration.md', ticketText('12: Exit demonstration', ['Status: DONE'], 'Body.'));

      const result = await taskGet(daemon, root, 'telemetry/09');
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.branch, 'feat/exit-demonstration');
      assert.deepEqual(result.body.diagnostics.map((item) => item.code), ['task.shared_branch']);
      const { message } = result.body.diagnostics[0]!;
      assert.ok(message.includes('tracker/12 (docs/specs/tracker/issues/12-exit-demonstration.md)'), message);
    });
  });

  it('reads the ticket from the caller’s linked worktree, as edited on its branch', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      write(root, 'docs/specs/epic/issues/01-thing.md', ticketText('01: Thing', ['Status: READY'], 'As on main.'));
      const git = (...args: string[]): void => {
        execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: root, stdio: 'ignore' });
      };
      git('init', '--quiet', '--initial-branch=main');
      write(root, '.git/info/exclude', '.claude/worktrees/\n');
      git('add', '.');
      git('commit', '--quiet', '-m', 'Start');
      const worktree = join(root, '.claude', 'worktrees', 'probe');
      git('worktree', 'add', '--quiet', '-b', 'feat/thing', worktree);
      write(worktree, 'docs/specs/epic/issues/01-thing.md', ticketText('01: Thing', ['Status: ACTIVE'], 'As on the branch.'));

      const result = await taskGet(daemon, worktree, 'epic/01', root);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.state, 'ACTIVE');
      assert.equal(result.body.body.text, 'As on the branch.');
      assert.equal((await taskGet(daemon, root, 'epic/01')).body.state, 'READY');
    });
  });

  it('answers an unknown id with task.not_found', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      write(root, 'docs/specs/epic/issues/01-thing.md', ticketText('01: Thing', ['Status: READY'], 'Body.'));
      for (const id of ['epic/02', 'other/01', '#1', '1', 'epic']) {
        const result = await taskGet(daemon, root, id);
        assert.equal(result.status, 404, id);
        assert.equal(result.body.error.code, 'task.not_found', id);
      }
    });
  });

  it('answers with the tracker’s own code when the tracker cannot be read', async () => {
    await withDaemon(async (daemon) => {
      const missing = makeProject();
      const result = await taskGet(daemon, missing, 'epic/01');
      assert.equal(result.body.error.code, 'tracker.issues_missing');

      const undeclared = makeProject('version: 1\n\nproject:\n  id: no-tracker\n');
      assert.equal((await taskGet(daemon, undeclared, 'epic/01')).body.error.code, 'tracker.unavailable');
    });
  });

  it('gives no start command when the project declares no workflow', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      write(root, 'docs/specs/epic/issues/01-thing.md', ticketText('01: Thing', ['Status: READY'], 'Body.'));
      assert.equal((await taskGet(daemon, root, 'epic/01')).body.start, null);
    });
  });

  it('refuses a call without an id', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      const result = await daemon.call<Envelope>('task.get', { path: root });
      assert.equal(result.status, 400);
      assert.equal(result.body.error.code, 'request.invalid');
    });
  });
});

describe('the start command', () => {
  const workflow = (provider: string): string => `${MANIFEST}\nworkflow:\n  provider: ${provider}\n`;
  type SnapshotTask = { id: string; start: string | null };
  type Snapshot = { tasks: { inFlight: { items: SnapshotTask[] }; readyToStart: { items: SnapshotTask[] } } };

  function tickets(root: string): void {
    write(root, 'docs/specs/epic/issues/01-ready.md', ticketText('01: Ready', ['Status: READY'], 'Body.'));
    write(root, 'docs/specs/epic/issues/02-done.md', ticketText('02: Done', ['Status: DONE'], 'Body.'));
    write(root, 'docs/specs/epic/issues/03-cancelled.md', ticketText('03: Cancelled', ['Status: CANCELLED'], 'Body.'));
    write(root, 'docs/specs/epic/issues/04-in-flight.md', ticketText('04: In flight', ['Status: ACTIVE'], 'Body.'));
  }

  async function snapshotStarts(daemon: TestDaemon, root: string): Promise<Record<string, string | null>> {
    const result = await daemon.call<Snapshot>('project.snapshot', { path: root });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    const { inFlight, readyToStart } = result.body.tasks;
    return Object.fromEntries([...inFlight.items, ...readyToStart.items].map((task) => [task.id, task.start]));
  }

  it('is the implement command with the ticket path under the Matt Pocock workflow, in the brief and the snapshot, and none for a DONE or CANCELLED Task', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject(workflow('matt-pocock'));
      tickets(root);

      assert.equal((await taskGet(daemon, root, 'epic/01')).body.start, '/mattpocock-skills:implement docs/specs/epic/issues/01-ready.md');
      assert.equal((await taskGet(daemon, root, 'epic/02')).body.start, null);
      assert.equal((await taskGet(daemon, root, 'epic/03')).body.start, null);
      assert.deepEqual(await snapshotStarts(daemon, root), {
        'epic/01': '/mattpocock-skills:implement docs/specs/epic/issues/01-ready.md',
        'epic/04': '/mattpocock-skills:implement docs/specs/epic/issues/04-in-flight.md',
      });
    });
  });

  it('is none under another workflow, even for a READY Task', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject(workflow('another'));
      tickets(root);

      assert.equal((await taskGet(daemon, root, 'epic/01')).body.start, null);
      assert.deepEqual(await snapshotStarts(daemon, root), { 'epic/01': null, 'epic/04': null });
    });
  });
});

describe('the Review', () => {
  type Card = { id: string; review: boolean | null };
  type Board = { columns: Record<'backlog' | 'ready' | 'inProgress' | 'done', { items: Card[] }> };
  type Attention = { attention: { code: string; message: string }[] };

  it('is the text under `### Review` inside `## Comments`, up to the next heading of the same level or above', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      const text = [
        '# 01: Reviewed',
        '',
        'Status: DONE',
        '',
        '### Review',
        '',
        'In the body: not the Review.',
        '',
        '## Comments',
        '',
        '- A note.',
        '',
        '### Review',
        '',
        '  Found two things.',
        '',
        '#### Standards',
        '',
        '```sh',
        '# a comment, not a heading',
        '```',
        '',
        '````md',
        '```',
        '## A fenced fence, not a heading either',
        '````',
        '',
        '### Afterwards',
        '',
        'Not the Review.',
        '',
      ].join('\n');
      write(root, 'docs/specs/epic/issues/01-reviewed.md', text);
      write(root, 'docs/specs/epic/issues/02-above.md', ticketText('02: Above', ['Status: DONE'], 'Body.', 'Kept.\n\n## After the comments\n\nNot the Review.'));

      assert.deepEqual((await taskGet(daemon, root, 'epic/01')).body.review, {
        text: '  Found two things.\n\n#### Standards\n\n```sh\n# a comment, not a heading\n```\n\n````md\n```\n## A fenced fence, not a heading either\n````',
        truncated: false,
      });
      assert.deepEqual((await taskGet(daemon, root, 'epic/02')).body.review, { text: 'Kept.', truncated: false });
    });
  });

  it('is cut at the body limit in code points, and says so', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      write(root, 'docs/specs/epic/issues/01-long.md', ticketText('01: Long', ['Status: DONE'], 'Body.', '🦆'.repeat(BODY_LIMIT + 5)));
      assert.deepEqual((await taskGet(daemon, root, 'epic/01')).body.review, { text: '🦆'.repeat(BODY_LIMIT), truncated: true });
    });
  });

  it('is null when the ticket records none, which makes a DONE Task a review.missing item, and the board says whether each Task has one', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      write(root, 'docs/specs/epic/issues/01-reviewed.md', ticketText('01: Reviewed', ['Status: DONE'], 'Body.'));
      write(root, 'docs/specs/epic/issues/02-unreviewed.md', '# 02: Unreviewed\n\nStatus: DONE\n\nBody.\n\n## Comments\n\n- No review.\n');
      write(root, 'docs/specs/epic/issues/03-empty.md', '# 03: Empty\n\nStatus: DONE\n\nBody.\n\n## Comments\n\n### Review\n\n## Later\n');
      write(root, 'docs/specs/epic/issues/04-ready.md', '# 04: Ready\n\nStatus: READY\n\nBody.\n');

      assert.equal((await taskGet(daemon, root, 'epic/02')).body.review, null);
      assert.equal((await taskGet(daemon, root, 'epic/03')).body.review, null, 'an empty Review records nothing');
      assert.equal((await taskGet(daemon, root, 'epic/04')).body.review, null);

      const snapshot = await daemon.call<Attention>('project.snapshot', { path: root });
      assert.deepEqual(
        snapshot.body.attention.filter((item) => item.code === 'review.missing'),
        [
          { code: 'review.missing', message: 'epic/02 (docs/specs/epic/issues/02-unreviewed.md) is DONE, and its ticket records no Review under ## Comments.' },
          { code: 'review.missing', message: 'epic/03 (docs/specs/epic/issues/03-empty.md) is DONE, and its ticket records no Review under ## Comments.' },
        ],
      );

      const board = await daemon.call<Board>('task.list', { path: root, spec: 'epic' });
      assert.equal(board.status, 200, JSON.stringify(board.body));
      const reviews = Object.values(board.body.columns).flatMap((column) => column.items.map((card) => [card.id, card.review]));
      assert.deepEqual(Object.fromEntries(reviews), { 'epic/01': true, 'epic/02': false, 'epic/03': false, 'epic/04': false });
    });
  });
});
