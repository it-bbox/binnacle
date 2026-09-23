import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

type SnapshotTask = {
  id: string;
  title: string | null;
  state: string | null;
  unmetDependencies: string[];
  ticket: string;
};
type Section = { items: SnapshotTask[]; remainder: number };
type Snapshot = {
  tasks: { inFlight: Section; readyToStart: Section; counts: Record<string, number> } | null;
  attention: { code: string; message: string }[];
};

const MANIFEST = `version: 1

project:
  id: snapshot-project

tracker:
  provider: local
  local:
    issues: docs/specs
`;

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A project on the local Markdown tracker. The snapshot reads files, so Git is not needed. */
function makeProject(manifest: string = MANIFEST): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-snapshot-')));
  roots.push(root);
  mkdirSync(join(root, '.binnacle'));
  writeFileSync(join(root, '.binnacle', 'project.yaml'), manifest);
  return root;
}

/** Writes `docs/specs/<spec>/issues/<file>` in the shape `/to-tickets` produces. */
function ticket(root: string, spec: string, file: string, header: { title: string; status?: string; blockedBy?: string }): void {
  const dir = join(root, 'docs', 'specs', spec, 'issues');
  mkdirSync(dir, { recursive: true });
  const lines = [
    `# ${header.title}`,
    '',
    ...(header.status === undefined ? [] : [`Status: ${header.status}`]),
    'Triage: ready-for-agent',
    `Blocked by: ${header.blockedBy ?? 'None (can start immediately)'}`,
    `Spec: \`docs/specs/${spec}/spec.md\``,
    '',
    '**What to build:** something.',
    '',
    'Status: DONE',
    'Blocked by: 99',
    '',
    '## Comments',
    '',
  ];
  writeFileSync(join(dir, file), lines.join('\n'));
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

const ids = (section: Section): string[] => section.items.map((task) => task.id);

describe('Tasks in the Product Snapshot', () => {
  it('lists a Task in flight with its identity, title, state, Unmet dependencies and ticket path', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      ticket(root, 'epic', '03-build-the-thing.md', { title: '03: Build the thing', status: 'ACTIVE' });

      const body = await snapshot(daemon, root);
      assert.deepEqual(body.tasks?.inFlight, {
        items: [
          {
            id: 'epic/03',
            title: 'Build the thing',
            state: 'ACTIVE',
            unmetDependencies: [],
            ticket: 'docs/specs/epic/issues/03-build-the-thing.md',
          },
        ],
        remainder: 0,
      });
    });
  });

  it('lists what is in flight and what can start, and counts every other state, unknown included', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      const states = ['BACKLOG', 'READY', 'ACTIVE', 'BLOCKED', 'READY_FOR_REVIEW', 'APPROVED', 'MERGE_READY', 'MERGED', 'DONE', 'CANCELLED'];
      states.forEach((status, index) => {
        const nn = String(index + 1).padStart(2, '0');
        ticket(root, 'every-state', `${nn}-${status.toLowerCase()}.md`, { title: `${nn}: ${status}`, status });
      });
      // READY waiting on 02, which is READY and not DONE: counted, not listed.
      ticket(root, 'every-state', '11-waits.md', { title: '11: Waits', status: 'READY', blockedBy: '02' });
      // READY on 09, which is DONE: can start.
      ticket(root, 'every-state', '12-unblocked.md', { title: '12: Unblocked', status: 'READY', blockedBy: '09 (the parser)' });
      ticket(root, 'every-state', '13-typo.md', { title: '13: Typo', status: 'In progress' });
      ticket(root, 'every-state', '14-no-status.md', { title: '14: No status' });
      // 42 is no ticket: a dangling reference, not an Unmet dependency, so this READY can start.
      ticket(root, 'every-state', '15-dangling.md', { title: '15: Dangling', status: 'READY', blockedBy: '42' });

      const body = await snapshot(daemon, root);
      assert.ok(body.tasks);
      assert.deepEqual(ids(body.tasks.inFlight), [
        'every-state/03',
        'every-state/04',
        'every-state/05',
        'every-state/06',
        'every-state/07',
      ]);
      assert.deepEqual(ids(body.tasks.readyToStart), ['every-state/02', 'every-state/12', 'every-state/15']);
      assert.deepEqual(body.tasks.counts, { BACKLOG: 1, READY: 1, MERGED: 1, DONE: 1, CANCELLED: 1, unknown: 2 });
      assert.deepEqual(
        body.attention.map((item) => item.code),
        ['task.unknown_state', 'task.unknown_state', 'task.dangling_dependency'],
      );
      assert.match(body.attention[0]!.message, /every-state\/13.*"In progress"/);
      assert.match(body.attention[2]!.message, /every-state\/15.*every-state\/42/);
    });
  });

  it('reports BLOCKED and an Unmet dependency separately', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      ticket(root, 'epic', '01-foundation.md', { title: '01: Foundation', status: 'ACTIVE' });
      ticket(root, 'epic', '02-waiting-on-a-vendor.md', { title: '02: Waiting on a vendor', status: 'BLOCKED' });
      ticket(root, 'epic', '03-started-early.md', { title: '03: Started early', status: 'ACTIVE', blockedBy: '01, 02' });

      const body = await snapshot(daemon, root);
      const byId = Object.fromEntries(body.tasks!.inFlight.items.map((task) => [task.id, task]));
      assert.equal(byId['epic/02']!.state, 'BLOCKED');
      assert.deepEqual(byId['epic/02']!.unmetDependencies, []);
      assert.equal(byId['epic/03']!.state, 'ACTIVE');
      assert.deepEqual(byId['epic/03']!.unmetDependencies, ['epic/01', 'epic/02']);
    });
  });

  it('holds at most ten Tasks per section and reports the remainder', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      for (let n = 1; n <= 12; n++) ticket(root, 'big', `${String(n).padStart(2, '0')}-active.md`, { title: 'Active', status: 'ACTIVE' });
      for (let n = 13; n <= 23; n++) ticket(root, 'big', `${n}-ready.md`, { title: 'Ready', status: 'READY' });

      const body = await snapshot(daemon, root);
      assert.equal(body.tasks!.inFlight.items.length, 10);
      assert.equal(body.tasks!.inFlight.remainder, 2);
      assert.equal(body.tasks!.readyToStart.items.length, 10);
      assert.equal(body.tasks!.readyToStart.remainder, 1);
      assert.deepEqual(body.tasks!.readyToStart.items.at(-1)?.id, 'big/22');
    });
  });

  it('keeps two specs apart, and orders Tasks the same whatever order the files were written in', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      ticket(root, 'zeta', '01-z.md', { title: '01: Z', status: 'READY' });
      ticket(root, 'alpha', '02-b.md', { title: '02: B', status: 'READY' });
      ticket(root, 'alpha', '01-a.md', { title: '01: A', status: 'READY' });

      const first = await snapshot(daemon, root);
      assert.deepEqual(ids(first.tasks!.readyToStart), ['alpha/01', 'alpha/02', 'zeta/01']);
      assert.deepEqual(await snapshot(daemon, root), first);
    });
  });

  it('reads the tickets on every call, so an edit shows in the next snapshot', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      ticket(root, 'epic', '01-thing.md', { title: '01: Thing', status: 'READY' });
      assert.deepEqual(ids((await snapshot(daemon, root)).tasks!.readyToStart), ['epic/01']);

      ticket(root, 'epic', '01-thing.md', { title: '01: Thing', status: 'ACTIVE' });
      const body = await snapshot(daemon, root);
      assert.deepEqual(ids(body.tasks!.readyToStart), []);
      assert.deepEqual(ids(body.tasks!.inFlight), ['epic/01']);
    });
  });

  it('says so when the project has no local tracker to read Tasks from', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject('version: 1\n\nproject:\n  id: remote-tracker\n\ntracker:\n  provider: github\n');

      const body = await snapshot(daemon, root);
      assert.equal(body.tasks, null);
      assert.deepEqual(body.attention.map((item) => item.code), ['tasks.unavailable']);
    });
  });
});
