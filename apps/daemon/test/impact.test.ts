import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * The conflict risk between Tasks, through the snapshot: a fixed `graph.json` in the
 * registered checkout, a fake `graphify` on the daemon's search path so that the graph is
 * available, tickets that name modules by path or by name, and one Task on a branch with a
 * diff. The Suggested step's `parallel` alternative is checked against the same graph, with
 * an implementation run made active by a Claude Code session on the worked Task's branch.
 */
type Risk = 'high' | 'medium' | 'low' | 'unknown';
type Pair = { tasks: [string, string]; risk: Risk; modules: string[]; reason: string; provenance: string };
type TaskImpact = { id: string; modules: string[]; from: 'branch' | 'ticket'; provenance: string };
type Impact = { available: true; tasks: TaskImpact[]; pairs: Pair[]; provenance: string } | { available: false; reason: string };
type Alternative = { kind: string; tasks: string[] };
type Snapshot = { tasks: { parallel: { impact: Impact } }; next: { alternatives: Alternative[] } };
type Line = Record<string, unknown> & { type: string; message?: Record<string, unknown> };

const GRILL = readFileSync(join(import.meta.dirname, 'fixtures', 'claude-code', 'grill-on-main.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as Line);

/** `src/a.ts` calls into `src/b.ts`; `src/c.ts` and `src/d.ts` stand alone, the second written from `./`. NetworkX's node-link form, as Graphify writes it. */
const GRAPH = {
  directed: true,
  nodes: [
    { id: 'a', label: 'a.ts', file_type: 'code', source_file: 'src/a.ts' },
    { id: 'a_run', label: 'run()', file_type: 'code', source_file: 'src/a.ts' },
    { id: 'b', label: 'b.ts', file_type: 'code', source_file: 'src/b.ts' },
    { id: 'b_help', label: 'help()', file_type: 'code', source_file: 'src/b.ts' },
    { id: 'c', label: 'c.ts', file_type: 'code', source_file: 'src/c.ts' },
    { id: 'd', label: 'd.ts', file_type: 'code', source_file: './src/d.ts' },
  ],
  links: [
    { source: 'a', target: 'a_run', relation: 'contains' },
    { source: 'b', target: 'b_help', relation: 'contains' },
    { source: 'a_run', target: 'b_help', relation: 'calls' },
  ],
};

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

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'ignore' });
}

/** A repository on `main` with the manifest, a roadmap whose epic is in progress, the sources, and the graph unless `graph` is false. */
function makeProject({ graph = true } = {}): string {
  const root = temporary('binnacle-impact-');
  write(root, '.binnacle/project.yaml', 'version: 1\n\nproject:\n  id: impact\n\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n\nknowledge:\n  docs: docs\n\nworkflow:\n  provider: matt-pocock\n');
  write(root, 'docs/roadmap.md', '# Roadmap\n\n| # | Epic | Status | Spec |\n| --- | --- | --- | --- |\n| 1 | First | in progress | [`first`](specs/first/spec.md) |\n\n## Current focus\n\nNext action: see. `/binnacle:daily`\n');
  write(root, '.gitignore', 'graphify-out/\n');
  for (const file of ['a', 'b', 'c', 'd']) write(root, `src/${file}.ts`, `export const ${file} = 1;\n`);
  if (graph) write(root, 'graphify-out/graph.json', JSON.stringify(GRAPH));
  git(root, 'init', '--quiet', '--initial-branch=main');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'Start');
  return root;
}

/** `docs/specs/first/issues/<file>`, with `text` as its body. */
function ticket(root: string, file: string, state: string, text: string): void {
  write(root, `docs/specs/first/issues/${file}`, `# ${file.slice(0, 2)}: ${file.slice(3, -3)}\n\nStatus: ${state}\n\n**What to build:** ${text}\n`);
}

/** A Claude Code session launched in `cwd`, active now: after its checkout switched branch, so that the reflog puts it there. */
function session(artifacts: string, cwd: string): void {
  const timestamp = new Date().toISOString();
  const records = GRILL.map((line) => ({
    ...line,
    cwd,
    sessionId: 'working',
    timestamp,
    ...(line.message && line.type === 'assistant' ? { message: { ...line.message, id: `${String(line.message.id)}-working` } } : {}),
  }));
  write(join(artifacts, cwd.replace(/[^a-zA-Z0-9]/g, '-')), 'working.jsonl', records.map((record) => `${JSON.stringify(record)}\n`).join(''));
}

/** A `graphify` that does nothing, so that the daemon finds the tool and reads the graph a test wrote. */
function fakeGraphify(): string {
  const dir = temporary('binnacle-impact-bin-');
  writeFileSync(join(dir, 'graphify'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(dir, 'graphify'), 0o755);
  return dir;
}

async function withDaemon(body: (daemon: TestDaemon, artifacts: string) => Promise<void>, { graphify = true } = {}): Promise<void> {
  const artifacts = temporary('binnacle-impact-claude-');
  const daemon = await startTestDaemon({ artifacts: { claudeCode: artifacts, codex: join(artifacts, 'no-codex') }, ...(graphify ? { searchPath: fakeGraphify() } : {}) });
  try {
    await body(daemon, artifacts);
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

function available(body: Snapshot): Extract<Impact, { available: true }> {
  const impact = body.tasks.parallel.impact;
  assert.equal(impact.available, true, JSON.stringify(impact));
  return impact as Extract<Impact, { available: true }>;
}

function pair(impact: Extract<Impact, { available: true }>, a: string, b: string): Pair {
  const found = impact.pairs.find((item) => item.tasks.includes(a) && item.tasks.includes(b));
  assert.ok(found, `no pair ${a} and ${b} in ${JSON.stringify(impact.pairs)}`);
  return found;
}

describe('the conflict risk between Tasks', () => {
  it('reads each ready Task from the modules its ticket names, and rates each pair high, medium, low or unknown, all calculated', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      ticket(root, '01-alpha.md', 'READY', 'change `src/a.ts`.');
      ticket(root, '02-alpha-too.md', 'READY', 'and a.ts, by its name.');
      ticket(root, '03-beta.md', 'READY', 'touch src/b.ts.');
      ticket(root, '04-delta.md', 'READY', 'edit (src/d.ts).');
      ticket(root, '05-vague.md', 'READY', 'make things better.');

      const impact = available(await snapshot(daemon, root));
      assert.equal(impact.provenance, 'calculated');
      assert.deepEqual(
        impact.tasks.map(({ id, modules, from }) => ({ id, modules, from })),
        [
          { id: 'first/01', modules: ['src/a.ts'], from: 'ticket' },
          { id: 'first/02', modules: ['src/a.ts'], from: 'ticket' },
          { id: 'first/03', modules: ['src/b.ts'], from: 'ticket' },
          { id: 'first/04', modules: ['src/d.ts'], from: 'ticket' },
          { id: 'first/05', modules: [], from: 'ticket' },
        ],
      );
      assert.equal(impact.pairs.length, 10);
      for (const item of [...impact.tasks, ...impact.pairs]) assert.equal(item.provenance, 'calculated');

      const high = pair(impact, 'first/01', 'first/02');
      assert.equal(high.risk, 'high');
      assert.deepEqual(high.modules, ['src/a.ts']);
      assert.match(high.reason, /src\/a\.ts/);

      const medium = pair(impact, 'first/01', 'first/03');
      assert.equal(medium.risk, 'medium');
      assert.deepEqual(medium.modules, ['src/a.ts', 'src/b.ts']);
      assert.match(medium.reason, /neighbour/);

      assert.equal(pair(impact, 'first/01', 'first/04').risk, 'low');
      assert.equal(pair(impact, 'first/03', 'first/04').risk, 'low');

      for (const other of ['first/01', 'first/02', 'first/03', 'first/04']) {
        const unknown = pair(impact, other, 'first/05');
        assert.equal(unknown.risk, 'unknown');
        assert.match(unknown.reason, /first\/05/);
      }
    });
  });

  it('reads a Task on a branch from its diff against the default branch, not from its ticket', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      ticket(root, '01-alpha.md', 'READY', 'change `src/a.ts`.');
      ticket(root, '02-branched.md', 'ACTIVE', 'change src/d.ts.');
      git(root, 'add', '.');
      git(root, 'commit', '--quiet', '-m', 'Tickets');
      git(root, 'switch', '--quiet', '-c', 'feat/branched');
      write(root, 'src/a.ts', 'export const a = 2;\n');
      write(root, 'notes.txt', 'not a module\n');
      git(root, 'add', '.');
      git(root, 'commit', '--quiet', '-m', 'Work');
      git(root, 'switch', '--quiet', 'main');

      const impact = available(await snapshot(daemon, root));
      assert.deepEqual(impact.tasks.find((task) => task.id === 'first/02'), { id: 'first/02', modules: ['src/a.ts'], from: 'branch', provenance: 'calculated' });
      assert.equal(pair(impact, 'first/01', 'first/02').risk, 'high');
    });
  });

  it('is not available without a graph, and says why', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject({ graph: false });
      ticket(root, '01-alpha.md', 'READY', 'change `src/a.ts`.');
      const impact = (await snapshot(daemon, root)).tasks.parallel.impact;
      assert.equal(impact.available, false);
      assert.match((impact as { reason: string }).reason, /graph\.json/);
    });
    await withDaemon(
      async (daemon) => {
        const impact = (await snapshot(daemon, makeProject())).tasks.parallel.impact;
        assert.equal(impact.available, false);
        assert.match((impact as { reason: string }).reason, /graphify is not on/);
      },
      { graphify: false },
    );
  });

  it('is not available when graph.json cannot be read as a graph', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      write(root, 'graphify-out/graph.json', '{ not json');
      const impact = (await snapshot(daemon, root)).tasks.parallel.impact;
      assert.equal(impact.available, false);
      assert.match((impact as { reason: string }).reason, /graph\.json/);
    });
  });
});

describe("the Suggested step's parallel alternative, with a graph", () => {
  /** first/01 is worked on, naming src/a.ts; the ready Tasks are a neighbour, a stranger, the same module and nothing. */
  function worked(root: string): void {
    ticket(root, '01-worked.md', 'ACTIVE', 'change `src/a.ts`.');
    ticket(root, '02-neighbour.md', 'READY', 'change `src/b.ts`.');
    ticket(root, '03-stranger.md', 'READY', 'change `src/d.ts`.');
    ticket(root, '04-same.md', 'READY', 'change `src/a.ts` too.');
    ticket(root, '05-vague.md', 'READY', 'something.');
    git(root, 'switch', '--quiet', '-c', 'feat/worked');
  }

  it('is offered only for a ready Task whose risk with every Task in flight is low', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject();
      worked(root);
      session(artifacts, root);

      const body = await snapshot(daemon, root);
      assert.deepEqual(
        body.next.alternatives.map((item) => [item.kind, item.tasks]),
        [
          ['wait', ['first/01']],
          ['parallel', ['first/03']],
        ],
      );
    });
  });

  it('is not offered when no ready Task is low with the work in flight', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject();
      worked(root);
      rmSync(join(root, 'docs/specs/first/issues/03-stranger.md'));
      session(artifacts, root);

      assert.deepEqual(
        (await snapshot(daemon, root)).next.alternatives.map((item) => item.kind),
        ['wait'],
      );
    });
  });

  it('is unchanged from the parallel limit alone without a graph', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject({ graph: false });
      worked(root);
      session(artifacts, root);

      assert.deepEqual(
        (await snapshot(daemon, root)).next.alternatives.map((item) => [item.kind, item.tasks]),
        [
          ['wait', ['first/01']],
          ['parallel', ['first/02', 'first/03', 'first/04', 'first/05']],
        ],
      );
    });
  });
});
