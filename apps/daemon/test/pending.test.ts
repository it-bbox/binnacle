import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * *Waiting for the owner*, the snapshot's `pendingDecisions`: the unanswered questions, the Tasks
 * in `READY_FOR_REVIEW` and the `ready-for-human` Tasks ready to start, through the snapshot,
 * against a real Git repository whose Task branches hold questions (ADR-0040).
 */
type Count = { asked: number; unanswered: number } | null;
type Item = { id: string; title: string | null; state: string | null; unmetDependencies: string[]; ticket: string; questions: Count };
type Unavailable = { available: false; reason: string };
type Question = { id: string; title: string | null; ticket: string; question: string; branch: string | null };
type Pending = {
  questions: { items: Question[]; remainder: number } | Unavailable;
  approvals: { items: Item[]; remainder: number };
  owner: { items: Item[]; remainder: number };
};
type Snapshot = { pendingDecisions: Pending | Unavailable; tasks: { inFlight: { items: Item[] }; readyToStart: { items: Item[] } } | null };

const MANIFEST = 'version: 1\n\nproject:\n  id: pending\n\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n';

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function write(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'ignore' });
}

/** A ticket of `epic`, its header's lines after its heading, and its Comments holding `comments` when any. */
const ticket = (title: string, header: string[], ...comments: string[]): string =>
  [`# ${title}`, '', ...header, '', 'Body.', '', ...(comments.length ? ['## Comments', '', ...comments.flatMap((comment) => [comment, ''])] : [])].join('\n');

const path = (file: string): string => `docs/specs/epic/issues/${file}`;

/** A repository on `main` with `tickets` committed, its `.claude/worktrees/` left out of Git. */
function repository(tickets: Record<string, string>, manifest = MANIFEST): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-pending-')));
  roots.push(root);
  write(root, '.binnacle/project.yaml', manifest);
  for (const [file, text] of Object.entries(tickets)) write(root, path(file), text);
  git(root, 'init', '--quiet', '--initial-branch=main');
  write(root, '.git/info/exclude', '.claude/worktrees/\n');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'Start');
  return root;
}

/** `feat/<slug>` in a worktree of its own, with the ticket `file` as `text` committed on it. */
function branch(root: string, slug: string, file: string, text: string): string {
  const worktree = join(root, '.claude', 'worktrees', slug);
  git(root, 'worktree', 'add', '--quiet', '-b', `feat/${slug}`, worktree);
  write(worktree, path(file), text);
  git(worktree, 'commit', '--quiet', '-am', 'A question');
  return worktree;
}

async function withDaemon(body: (daemon: TestDaemon) => Promise<void>): Promise<void> {
  const daemon = await startTestDaemon();
  try {
    await body(daemon);
  } finally {
    await daemon.stop();
  }
}

async function snapshot(daemon: TestDaemon, root: string): Promise<Snapshot> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
  const result = await daemon.call<Snapshot>('project.snapshot', { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

const pending = (body: Snapshot): Pending => {
  assert.ok(!('available' in body.pendingDecisions), JSON.stringify(body.pendingDecisions));
  return body.pendingDecisions;
};

describe('waiting for the owner', () => {
  it('lists the unanswered questions, from a Task’s branch while it is unmerged, the approvals and the ready-for-human Tasks ready to start', async () => {
    await withDaemon(async (daemon) => {
      const root = repository({
        '01-asked.md': ticket('01: Asked on its branch', ['Status: READY']),
        '02-review.md': ticket('02: Waiting for review', ['Status: READY_FOR_REVIEW']),
        '03-human.md': ticket('03: The owner’s', ['Status: READY', 'Triage: ready-for-human']),
        '04-later.md': ticket('04: The owner’s, later', ['Status: READY', 'Triage: ready-for-human', 'Blocked by: 02']),
        '05-planning.md': ticket('05: Asked while planning', ['Status: ACTIVE'], '### Question', '', 'Answered?', '### Answer', '', 'Yes.', '### Question', '', 'Still open?'),
        '06-agent.md': ticket('06: The agent’s', ['Status: READY', 'Triage: ready-for-agent']),
      });
      branch(root, 'asked', '01-asked.md', ticket('01: Asked on its branch', ['Status: ACTIVE'], '### Question', '', 'Which way?'));

      const body = await snapshot(daemon, root);
      const item = (id: string, title: string, state: string, file: string, questions: Count, unmet: string[] = []): Item => ({
        id,
        title,
        state,
        unmetDependencies: unmet,
        ticket: path(file),
        questions,
      });
      assert.deepEqual(pending(body), {
        questions: {
          items: [
            { id: 'epic/01', title: 'Asked on its branch', ticket: path('01-asked.md'), question: 'Which way?', branch: 'feat/asked' },
            { id: 'epic/05', title: 'Asked while planning', ticket: path('05-planning.md'), question: 'Still open?', branch: null },
          ],
          remainder: 0,
        },
        approvals: { items: [item('epic/02', 'Waiting for review', 'READY_FOR_REVIEW', '02-review.md', { asked: 0, unanswered: 0 })], remainder: 0 },
        owner: { items: [item('epic/03', 'The owner’s', 'READY', '03-human.md', { asked: 0, unanswered: 0 })], remainder: 0 },
      });

      // Each Task item of the snapshot counts its questions, a branch's included.
      const counts = Object.fromEntries([...body.tasks!.inFlight.items, ...body.tasks!.readyToStart.items].map((task) => [task.id, task.questions]));
      assert.deepEqual(counts, {
        'epic/01': { asked: 1, unanswered: 1 },
        'epic/02': { asked: 0, unanswered: 0 },
        'epic/03': { asked: 0, unanswered: 0 },
        'epic/05': { asked: 2, unanswered: 1 },
        'epic/06': { asked: 0, unanswered: 0 },
      });
    });
  });

  it('lists a question with its options whole, and reads an answer as given without its date line, a date alone answering nothing', async () => {
    await withDaemon(async (daemon) => {
      const root = repository({ '01-asked.md': ticket('01: Asked', ['Status: READY']) });
      const options = 'Which store?\n\n- SQLite (recommended): one file, no server.\n- PostgreSQL: a server to run.';
      branch(
        root,
        'asked',
        '01-asked.md',
        ticket(
          '01: Asked',
          ['Status: ACTIVE'],
          ...['### Question', '', 'And the port?', '### Answer', '', '2026-10-11', '', 'Any free one.'],
          ...['### Question', '', 'And when?', '### Answer', '', '2026-10-12 at the earliest.'],
          ...['### Question', '', 'And the user?', '### Answer', '', 'Root.'],
          ...['### Question', '', 'And the host?', '### Answer', '', '2026-10-11'],
          ...['### Question', '', options],
        ),
      );
      const body = await snapshot(daemon, root);
      assert.deepEqual(pending(body).questions, {
        items: [
          { id: 'epic/01', title: 'Asked', ticket: path('01-asked.md'), question: 'And the host?', branch: 'feat/asked' },
          { id: 'epic/01', title: 'Asked', ticket: path('01-asked.md'), question: options, branch: 'feat/asked' },
        ],
        remainder: 0,
      });
      const task = [...body.tasks!.inFlight.items, ...body.tasks!.readyToStart.items].find((item) => item.id === 'epic/01');
      assert.deepEqual(task?.questions, { asked: 5, unanswered: 2 });
    });
  });

  it('reads a question from the checkout once its branch is merged', async () => {
    await withDaemon(async (daemon) => {
      const root = repository({ '01-asked.md': ticket('01: Asked', ['Status: READY']) });
      branch(root, 'asked', '01-asked.md', ticket('01: Asked', ['Status: ACTIVE'], '### Question', '', 'Which way?'));
      assert.equal((pending(await snapshot(daemon, root)).questions as { items: Question[] }).items.length, 1);

      // Merged, keeping main's ticket, which asks nothing.
      git(root, 'merge', '--quiet', '--no-edit', '-s', 'ours', 'feat/asked');
      assert.deepEqual(pending(await snapshot(daemon, root)).questions, { items: [], remainder: 0 });
    });
  });

  it('gives each list empty when nothing waits, a closed Task’s unanswered question included', async () => {
    await withDaemon(async (daemon) => {
      const root = repository({
        '01-done.md': ticket('01: Done', ['Status: DONE', 'Triage: ready-for-human'], '### Question', '', 'Asked.', '### Answer', '', 'Answered.'),
        '02-done.md': ticket('02: Done, still asking', ['Status: DONE'], '### Question', '', 'Moot?'),
        '03-cancelled.md': ticket('03: Cancelled', ['Status: CANCELLED'], '### Question', '', 'Moot too?'),
      });
      assert.deepEqual(pending(await snapshot(daemon, root)), {
        questions: { items: [], remainder: 0 },
        approvals: { items: [], remainder: 0 },
        owner: { items: [], remainder: 0 },
      });
    });
  });

  it('cuts each list at the snapshot’s limit and counts the remainder', async () => {
    await withDaemon(async (daemon) => {
      const tickets: Record<string, string> = {};
      const questions = Array.from({ length: 12 }, (_, index) => ['### Question', '', `Question ${index + 1}?`]).flat();
      tickets['01-asking.md'] = ticket('01: Asking', ['Status: ACTIVE'], ...questions);
      for (let index = 2; index <= 13; index++) tickets[`${String(index).padStart(2, '0')}-review.md`] = ticket(`${index}: Review`, ['Status: READY_FOR_REVIEW']);
      for (let index = 14; index <= 25; index++) tickets[`${index}-human.md`] = ticket(`${index}: Human`, ['Status: READY', 'Triage: ready-for-human']);
      const { questions: asked, approvals, owner } = pending(await snapshot(daemon, repository(tickets)));

      assert.ok(!('available' in asked));
      assert.deepEqual(
        asked.items.map((item) => item.question),
        Array.from({ length: 10 }, (_, index) => `Question ${index + 1}?`),
      );
      assert.equal(asked.remainder, 2);
      assert.deepEqual([approvals.items.length, approvals.remainder, owner.items.length, owner.remainder], [10, 2, 10, 2]);
      assert.equal(approvals.items[0]!.id, 'epic/02');
      assert.equal(owner.items[0]!.id, 'epic/14');
    });
  });

  it('is unavailable with the tracker’s reason when the Tasks cannot be read', async () => {
    await withDaemon(async (daemon) => {
      const root = repository({}, 'version: 1\n\nproject:\n  id: pending\n\ntracker:\n  provider: local\n');
      assert.deepEqual((await snapshot(daemon, root)).pendingDecisions, {
        available: false,
        reason: 'tracker.provider is local, and this project declares no tracker.local.issues.',
        code: 'tracker.unavailable',
        params: { kind: 'issues' },
      });
    });
  });
});
