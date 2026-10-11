import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
  start: string | null;
};
type Section = { items: SnapshotTask[]; remainder: number };
type Epic = { number: number; title: string; status: string; spec: string | null };
type Unavailable = { available: false; reason: string };
/** No `graphify` on the test daemon's search path, so no conflict risk is calculated. */
const NO_GRAPH = { available: false, reason: "graphify is not on the daemon's PATH, so no graph is built or read." };

type Snapshot = {
  checkout: { root: string; registered: boolean };
  git: { available: true; branch: string | null; commit: string | null; dirty: boolean } | { available: false };
  roadmap: { epics: Epic[]; focus: { text: string; truncated: boolean } | null; sections: string[] } | null;
  tasks: {
    inFlight: Section;
    readyToStart: Section;
    counts: Record<string, number>;
    parallel: { limit: number; mode: string; source: string; inProgress: number; free: number; provenance: string; impact: unknown };
  } | null;
  decisions: { items: { title: string | null; path: string }[]; remainder: number } | null;
  ci: Unavailable;
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
    '### Review',
    '',
    'Nothing found.',
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
const codes = (body: Snapshot, prefix: string): string[] => body.attention.map((item) => item.code).filter((code) => code.startsWith(prefix));

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
            questions: { asked: 0, unanswered: 0 },
            start: null,
            roles: { required: ['Developer', 'Reviewer'], source: 'default', suggested: [] },
          },
        ],
        remainder: 0,
      });
    });
  });

  it('lists what is in flight and what can start, at most ten each with a remainder, and counts every other state', async () => {
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
      // Enough more of each listed kind to pass the limit of ten: 12 in flight, 11 ready.
      for (let n = 1; n <= 7; n++) ticket(root, 'z-bulk', `0${n}-active.md`, { title: 'Active', status: 'ACTIVE' });
      for (let n = 8; n <= 15; n++) ticket(root, 'z-bulk', `${n}-ready.md`, { title: 'Ready', status: 'READY' });

      const body = await snapshot(daemon, root);
      assert.ok(body.tasks);
      assert.deepEqual(ids(body.tasks.inFlight), [
        'every-state/03',
        'every-state/04',
        'every-state/05',
        'every-state/06',
        'every-state/07',
        'z-bulk/01',
        'z-bulk/02',
        'z-bulk/03',
        'z-bulk/04',
        'z-bulk/05',
      ]);
      assert.equal(body.tasks.inFlight.remainder, 2);
      assert.deepEqual(ids(body.tasks.readyToStart), [
        'every-state/02',
        'every-state/12',
        'every-state/15',
        'z-bulk/08',
        'z-bulk/09',
        'z-bulk/10',
        'z-bulk/11',
        'z-bulk/12',
        'z-bulk/13',
        'z-bulk/14',
      ]);
      assert.equal(body.tasks.readyToStart.remainder, 1);
      assert.deepEqual(body.tasks.counts, { BACKLOG: 1, READY: 1, MERGED: 1, DONE: 1, CANCELLED: 1, unknown: 2 });
      const tasks = body.attention.filter((item) => item.code.startsWith('task.'));
      assert.deepEqual(
        tasks.map((item) => item.code),
        ['task.unknown_state', 'task.unknown_state', 'task.dangling_dependency'],
      );
      assert.match(tasks[0]!.message, /every-state\/13.*"In progress"/);
      assert.match(tasks[2]!.message, /every-state\/15.*every-state\/42/);
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

  it("computes the parallel capacity from the manifest's limit, counting every Task in flight, the ones past the list's limit too", async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject(`${MANIFEST}\nautomation:\n  max_parallel_development_tasks: 14\n`);
      for (let index = 1; index <= 12; index++) {
        const nn = String(index).padStart(2, '0');
        ticket(root, 'epic', `${nn}-busy.md`, { title: `${nn}: Busy`, status: 'ACTIVE' });
      }
      ticket(root, 'epic', '13-ready.md', { title: '13: Ready', status: 'READY' });

      const body = await snapshot(daemon, root);
      assert.equal(body.tasks!.inFlight.remainder, 2);
      assert.deepEqual(body.tasks!.parallel, { limit: 14, mode: 'number', source: 'manifest', inProgress: 12, free: 2, provenance: 'calculated', impact: NO_GRAPH });
    });
  });

  it('takes a parallel limit of two where the manifest writes none, and never gives less than nothing free', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      ticket(root, 'epic', '01-ready.md', { title: '01: Ready', status: 'READY' });
      assert.deepEqual((await snapshot(daemon, root)).tasks!.parallel, { limit: 2, mode: 'number', source: 'default', inProgress: 0, free: 2, provenance: 'calculated', impact: NO_GRAPH });

      for (const nn of ['02', '03', '04']) ticket(root, 'epic', `${nn}-busy.md`, { title: `${nn}: Busy`, status: 'READY_FOR_REVIEW' });
      assert.deepEqual((await snapshot(daemon, root)).tasks!.parallel, { limit: 2, mode: 'number', source: 'default', inProgress: 3, free: 0, provenance: 'calculated', impact: NO_GRAPH });
    });
  });

  it('raises review.missing for a DONE ticket without a Review unless it is triaged ready-for-human, the owner\'s to do', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      const dir = join(root, 'docs', 'specs', 'epic', 'issues');
      mkdirSync(dir, { recursive: true });
      for (const triage of ['ready-for-agent', 'ready-for-human']) {
        writeFileSync(join(dir, `${triage === 'ready-for-agent' ? '01' : '02'}-${triage}.md`), `# ${triage}\n\nStatus: DONE\nTriage: ${triage}\n\n**What to build:** it.\n`);
      }

      const missing = (await snapshot(daemon, root)).attention.filter((item) => item.code === 'review.missing');
      assert.deepEqual(missing.map((item) => item.message), ['epic/01 (docs/specs/epic/issues/01-ready-for-agent.md) is DONE, and its ticket records no Review under ## Comments.']);
    });
  });

  it('says so when a remote tracker declares no repository to read Tasks from', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject('version: 1\n\nproject:\n  id: remote-tracker\n\ntracker:\n  provider: github\n');

      const body = await snapshot(daemon, root);
      assert.equal(body.tasks, null);
      assert.deepEqual(codes(body, 'tracker.'), ['tracker.unavailable']);
    });
  });
});

const REPOSITORY_MANIFEST = `${MANIFEST}
knowledge:
  docs: docs
  adr: docs/adr
`;

/** Real Git, real commits; `date` pins the commit date, which is what orders the ADRs. */
function git(root: string, args: string[], date?: string): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Binnacle Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args],
    { cwd: root, encoding: 'utf8', env: date ? { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date } : process.env },
  ).trim();
}

function commitAll(root: string, message: string, date?: string): void {
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', message], date);
}

/** A committed repository with a roadmap and one ADR, so that nothing in it calls for attention. */
function makeRepository(options: { manifest?: string; roadmap?: string | null } = {}): string {
  const root = makeProject(options.manifest ?? REPOSITORY_MANIFEST);
  git(root, ['init', '--quiet', '--initial-branch=main']);
  if (options.roadmap !== null) roadmap(root, options.roadmap ?? roadmapText([]));
  adr(root, 'ADR-0001-first.md', 'ADR-0001: First');
  commitAll(root, 'Start the project', '2025-01-01T12:00:00Z');
  return root;
}

function roadmap(root: string, text: string): void {
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'roadmap.md'), text);
}

function adr(root: string, file: string, title: string): void {
  mkdirSync(join(root, 'docs', 'adr'), { recursive: true });
  writeFileSync(join(root, 'docs', 'adr', file), `# ${title}\n\n**Status:** Accepted\n`);
}

/** In the shape of this repository's own `docs/roadmap.md`. */
function roadmapText(rows: string[], focus: string = 'Next action: implement ticket 03. `/binnacle:autopilot`'): string {
  return [
    '# Roadmap',
    '',
    '**Status vocabulary:** `not started` → `spec` → `tickets` → `in progress` → `done`.',
    '',
    '## v1',
    '',
    '| # | Epic | Status | Spec |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    'Epics are ordered by dependency.',
    '',
    '## Current focus',
    '',
    focus,
    '',
    '## Later',
    '',
    '- something deferred',
    '',
    '## Keeping this current',
    '',
    'Update the status column.',
    '',
  ].join('\n');
}

const row = (number: number, epic: string, status: string, spec: string | null): string =>
  `| ${number} | ${epic} | ${status} | ${spec === null ? '—' : `[\`${spec}\`](specs/${spec}/spec.md)`} |`;

describe('the roadmap in the Product Snapshot', () => {
  it('returns the epic table, the current focus as written and every other section by heading only', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository({
        roadmap: roadmapText(
          [row(1, 'Core and persistence', 'done', 'core'), row(2, 'MCP and Product Snapshot', 'in progress', 'snapshot'), row(3, 'Telemetry', 'not started', null)],
          'Tickets 01 and 02 are done.\n\nNext action: implement ticket 03. `/binnacle:autopilot`',
        ),
      });
      ticket(root, 'core', '01-store.md', { title: '01: Store', status: 'DONE' });
      ticket(root, 'snapshot', '01-tasks.md', { title: '01: Tasks', status: 'ACTIVE' });

      const body = await snapshot(daemon, root);
      assert.deepEqual(body.roadmap, {
        epics: [
          { number: 1, title: 'Core and persistence', status: 'done', spec: 'core' },
          { number: 2, title: 'MCP and Product Snapshot', status: 'in progress', spec: 'snapshot' },
          { number: 3, title: 'Telemetry', status: 'not started', spec: null },
        ],
        focus: { text: 'Tickets 01 and 02 are done.\n\nNext action: implement ticket 03. `/binnacle:autopilot`', truncated: false },
        sections: ['v1', 'Later', 'Keeping this current'],
      });
      assert.deepEqual(body.attention, []);
    });
  });

  it('leaves out a row that does not parse, with a diagnostic, and never repairs it', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository({
        roadmap: roadmapText([
          row(1, 'Core', 'done', 'core'),
          row(2, 'Wrong status', 'Done', 'wrong-status'),
          '| 3 | Missing a cell | not started |',
          row(Number.NaN, 'No number', 'not started', null),
          '| 5 | Not a spec link | spec | [`five`](specs/five/README.md) |',
          row(6, 'Telemetry', 'not started', null),
        ]),
      });

      const body = await snapshot(daemon, root);
      assert.deepEqual(
        body.roadmap?.epics.map((epic) => epic.number),
        [1, 6],
      );
      const invalid = body.attention.filter((item) => item.code === 'roadmap.row_invalid');
      assert.equal(invalid.length, 4);
      assert.match(invalid[0]!.message, /"Done"/);
      assert.match(invalid[1]!.message, /3 cells/);
      assert.match(invalid[2]!.message, /"NaN"/);
      assert.match(invalid[3]!.message, /specs\/five\/README\.md/);
    });
  });

  it('is absent with a diagnostic when the project has no roadmap, and the other sections are still there', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository({ roadmap: null });
      ticket(root, 'epic', '01-thing.md', { title: '01: Thing', status: 'READY' });

      const body = await snapshot(daemon, root);
      assert.equal(body.roadmap, null);
      assert.deepEqual(codes(body, 'roadmap.'), ['roadmap.missing']);
      assert.deepEqual(ids(body.tasks!.readyToStart), ['epic/01']);
    });
  });

  it('cuts a current focus over the limit, and says it did', async () => {
    await withDaemon(async (daemon) => {
      const long = `Next action: ${'x'.repeat(3000)}`;
      const root = makeRepository({ roadmap: roadmapText([], long) });
      assert.deepEqual((await snapshot(daemon, root)).roadmap?.focus, { text: long.slice(0, 2000), truncated: true });

      const exact = long.slice(0, 2000);
      roadmap(root, roadmapText([], exact));
      assert.deepEqual((await snapshot(daemon, root)).roadmap?.focus, { text: exact, truncated: false });
    });
  });

  it('reports, on every call, each epic whose roadmap status disagrees with its tickets or that lacks a spec link', async () => {
    await withDaemon(async (daemon) => {
      const rows = (first: string): string[] => [
        row(1, 'Done too early', first, 'a'),
        row(2, 'Not started, but sliced', 'not started', 'b'),
        row(3, 'In progress, but finished', 'in progress', 'c'),
        row(4, 'Sliced, but finished', 'tickets', 'd'),
        row(5, 'Specified without a link', 'spec', null),
        row(6, 'Consistent', 'in progress', 'e'),
        row(7, 'Sliced, no tickets yet', 'tickets', 'f'),
        row(8, 'An idea', 'not started', null),
      ];
      const root = makeRepository({ roadmap: roadmapText(rows('done')) });
      ticket(root, 'a', '01-one.md', { title: '01: One', status: 'DONE' });
      ticket(root, 'a', '02-two.md', { title: '02: Two', status: 'READY' });
      ticket(root, 'b', '01-one.md', { title: '01: One', status: 'BACKLOG' });
      ticket(root, 'c', '01-one.md', { title: '01: One', status: 'DONE' });
      ticket(root, 'c', '02-two.md', { title: '02: Two', status: 'CANCELLED' });
      ticket(root, 'd', '01-one.md', { title: '01: One', status: 'DONE' });
      ticket(root, 'e', '01-one.md', { title: '01: One', status: 'DONE' });
      ticket(root, 'e', '02-two.md', { title: '02: Two', status: 'ACTIVE' });

      const body = await snapshot(daemon, root);
      assert.deepEqual(body.attention.map((item) => item.code), [
        'roadmap.status_mismatch',
        'roadmap.status_mismatch',
        'roadmap.status_mismatch',
        'roadmap.status_mismatch',
        'roadmap.spec_missing',
      ]);
      const [done, notStarted, inProgress, tickets, specMissing] = body.attention.map((item) => item.message);
      assert.match(done!, /Epic 1 .*done.*a\/02/);
      assert.match(notStarted!, /Epic 2 .*not started/);
      assert.match(inProgress!, /Epic 3 .*in progress/);
      assert.match(tickets!, /Epic 4 .*tickets/);
      assert.match(specMissing!, /Epic 5 .*spec/);

      // Nothing is stored: correcting the roadmap clears its item on the next call.
      roadmap(root, roadmapText(rows('in progress')));
      assert.deepEqual(
        (await snapshot(daemon, root)).attention.map((item) => item.message).filter((message) => /Epic 1 /.test(message)),
        [],
      );
    });
  });
});

describe('recent decisions, Git and the unavailable sections', () => {
  it('lists the five most recently committed ADRs with title and path, and counts the rest', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      const order = ['0003', '0002', '0005', '0006', '0004'];
      order.forEach((number, day) => {
        adr(root, `ADR-${number}-decision.md`, `ADR-${number}: Decision ${number}`);
        commitAll(root, `Record ADR-${number}`, `2026-01-${String(day + 10).padStart(2, '0')}T12:00:00Z`);
      });
      // A later edit makes an old ADR fresh again.
      writeFileSync(join(root, 'docs', 'adr', 'ADR-0002-decision.md'), '# ADR-0002: Decision 0002, amended\n');
      commitAll(root, 'Amend ADR-0002', '2026-02-01T12:00:00Z');

      const body = await snapshot(daemon, root);
      assert.deepEqual(body.decisions, {
        items: [
          { title: 'ADR-0002: Decision 0002, amended', path: 'docs/adr/ADR-0002-decision.md' },
          { title: 'ADR-0004: Decision 0004', path: 'docs/adr/ADR-0004-decision.md' },
          { title: 'ADR-0006: Decision 0006', path: 'docs/adr/ADR-0006-decision.md' },
          { title: 'ADR-0005: Decision 0005', path: 'docs/adr/ADR-0005-decision.md' },
          { title: 'ADR-0003: Decision 0003', path: 'docs/adr/ADR-0003-decision.md' },
        ],
        remainder: 1,
      });
    });
  });

  it("describes the caller's own checkout, and reads a linked worktree's roadmap and tickets from that worktree", async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository({ roadmap: roadmapText([row(1, 'Core', 'in progress', null)]) });
      writeFileSync(join(root, '.git', 'info', 'exclude'), '.claude/worktrees/\n');
      const worktree = join(root, '.claude', 'worktrees', 'probe');
      git(root, ['worktree', 'add', '--quiet', '-b', 'feat/probe', worktree]);
      roadmap(worktree, roadmapText([row(1, 'Core', 'done', null)]));
      ticket(worktree, 'epic', '01-thing.md', { title: '01: Thing', status: 'READY' });

      const main = await snapshot(daemon, root);
      assert.deepEqual(main.checkout, { root, registered: true });
      assert.ok(main.git.available);
      assert.equal(main.git.branch, 'main');
      assert.equal(main.roadmap?.epics[0]?.status, 'in progress');
      assert.deepEqual(ids(main.tasks!.readyToStart), []);

      const result = await daemon.call<Snapshot>('project.snapshot', { path: worktree });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.deepEqual(result.body.checkout, { root: worktree, registered: false });
      assert.ok(result.body.git.available);
      assert.equal(result.body.git.branch, 'feat/probe');
      assert.equal(result.body.git.dirty, true);
      assert.equal(result.body.roadmap?.epics[0]?.status, 'done');
      assert.deepEqual(ids(result.body.tasks!.readyToStart), ['epic/01']);
    });
  });

  // Usage has its own tests, in usage.test.ts.
  // Waiting for the owner has its own tests, in pending.test.ts.
  it('marks CI state as unavailable, with no content', async () => {
    await withDaemon(async (daemon) => {
      const body = await snapshot(daemon, makeRepository());
      assert.deepEqual(Object.keys(body.ci).sort(), ['available', 'reason']);
      assert.equal(body.ci.available, false);
    });
  });

  it('carries manifest warnings and a tracker-remote mismatch into the attention list', async () => {
    await withDaemon(async (daemon) => {
      const manifest = 'version: 1\n\nproject:\n  id: remote-tracker\n  colour: blue\n\ntracker:\n  provider: github\n\nknowledge:\n  adr: docs/adr\n';
      const root = makeRepository({ manifest, roadmap: null });
      git(root, ['remote', 'add', 'origin', 'https://git.example.com/example/project.git']);

      const body = await snapshot(daemon, root);
      assert.deepEqual(body.attention.map((item) => item.code), [
        'manifest.warning',
        'tracker.remote_mismatch',
        'tracker.unavailable',
        // The roadmap is expected on every tracker (ADR-0025), and this project declares no knowledge.docs.
        'roadmap.missing',
      ]);
      assert.match(body.attention[0]!.message, /project\.colour/);
    });
  });
});
