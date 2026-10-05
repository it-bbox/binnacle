import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * The daemon keeps the graph current (ADR-0036): a fake `graphify` on the daemon's search
 * path records each call and writes a small `graph.json`, commits move `main`, and what a
 * person could see — the snapshot, the fake's calls, the files — is checked after the poll.
 */
type Graph = {
  available: boolean;
  reason: string | null;
  builtFrom: { commit: string; at: string } | null;
  behind: boolean | null;
  lastRun: { commit: string; at: string; outcome: 'built' | 'failed'; reason: string | null } | null;
};
type Snapshot = { graph: Graph; attention: { code: string; message: string }[] };

const POLL_MS = 40;
const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function temporary(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  roots.push(root);
  return root;
}

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Binnacle Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' }).trim();
}

function commit(root: string, file: string): string {
  writeFileSync(join(root, file), `${file}\n`);
  git(root, ['add', file]);
  git(root, ['commit', '--quiet', '-m', `Add ${file}`]);
  return git(root, ['rev-parse', 'HEAD']);
}

function makeRepository({ ignored = true, capability = '' } = {}): string {
  const root = temporary('binnacle-graph-');
  mkdirSync(join(root, '.binnacle'));
  writeFileSync(join(root, '.binnacle', 'project.yaml'), `version: 1\n\nproject:\n  id: graph\n\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n${capability}`);
  if (ignored) writeFileSync(join(root, '.gitignore'), 'graphify-out/\n');
  git(root, ['init', '--quiet', '--initial-branch=main']);
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'Start']);
  return root;
}

const WRITE_GRAPH = 'mkdir -p graphify-out && echo "{\\"nodes\\": []}" > graphify-out/graph.json';

/** A directory holding a fake `graphify` that logs its directory and arguments, then runs `body`. */
function fakeGraphify(body = `${WRITE_GRAPH}\n[ "$1" = cluster-only ] && echo "# Report" > graphify-out/GRAPH_REPORT.md; true`): { dir: string; log: string; replace(body: string): void } {
  const dir = temporary('binnacle-graph-bin-');
  const log = join(dir, 'calls.log');
  const replace = (text: string): void => {
    writeFileSync(join(dir, 'graphify'), `#!/bin/sh\necho "$PWD $*" >> '${log}'\n${text}\n`);
    chmodSync(join(dir, 'graphify'), 0o755);
  };
  replace(body);
  return { dir, log, replace };
}

const calls = (log: string): string[] => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : []);

async function snapshot(daemon: TestDaemon, root: string): Promise<Snapshot> {
  const result = await daemon.call<Snapshot>('project.snapshot', { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

async function until(condition: () => Promise<boolean> | boolean, what: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting until ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, POLL_MS * 8));
const graphCodes = (body: Snapshot): string[] => body.attention.map((item) => item.code).filter((code) => code.startsWith('graph.'));

async function withDaemon(searchPath: string, body: (daemon: TestDaemon) => Promise<void>, home?: string): Promise<void> {
  const daemon = await startTestDaemon({ searchPath, graphPollMs: POLL_MS, ...(home === undefined ? {} : { home }) });
  try {
    await body(daemon);
  } finally {
    await daemon.stop();
  }
}

describe('the daemon keeps the graph current', () => {
  it('builds code-only once per move of the default branch, and the snapshot names the commit', async () => {
    const root = makeRepository();
    const fake = fakeGraphify();
    await withDaemon(fake.dir, async (daemon) => {
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      const first = git(root, ['rev-parse', 'HEAD']);
      await until(async () => (await snapshot(daemon, root)).graph.builtFrom?.commit === first, 'the first build');

      const second = commit(root, 'a.txt');
      await until(async () => (await snapshot(daemon, root)).graph.builtFrom?.commit === second, 'the build of the new commit');
      await settle();

      // Each run extracts code-only, then builds the report with no model naming communities.
      const run = [`${root} extract . --code-only`, `${root} cluster-only . --no-label`];
      assert.deepEqual(calls(fake.log), [...run, ...run]);
      assert.equal(existsSync(join(root, 'graphify-out', 'GRAPH_REPORT.md')), true);
      const { graph, attention } = await snapshot(daemon, root);
      assert.equal(graph.available, true);
      assert.equal(graph.reason, null);
      assert.equal(graph.behind, false);
      assert.equal(graph.lastRun?.outcome, 'built');
      assert.equal(graph.lastRun?.commit, second);
      assert.deepEqual(graphCodes({ graph, attention }), []);
    });
  });

  it('runs nothing while the registered checkout is on another branch, and says the graph is behind', async () => {
    const root = makeRepository();
    git(root, ['checkout', '--quiet', '-b', 'feat/other']);
    const fake = fakeGraphify();
    await withDaemon(fake.dir, async (daemon) => {
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      await settle();
      assert.deepEqual(calls(fake.log), []);
      const { graph } = await snapshot(daemon, root);
      assert.equal(graph.behind, true);
      assert.equal(graph.lastRun, null);
    });
  });

  it('follows several commits during a run with at most one more run', async () => {
    const root = makeRepository();
    const fake = fakeGraphify('sleep 1; mkdir -p graphify-out && echo "{}" > graphify-out/graph.json');
    await withDaemon(fake.dir, async (daemon) => {
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      await until(() => calls(fake.log).length === 1, 'the first run starts');
      commit(root, 'a.txt');
      commit(root, 'b.txt');
      const last = commit(root, 'c.txt');
      await until(async () => (await snapshot(daemon, root)).graph.builtFrom?.commit === last, 'the build of the last commit');
      await settle();
      assert.equal(calls(fake.log).length, 4);
    });
  });

  it('reports a failed run with its reason, keeps the previous graph and says it is behind', async () => {
    const root = makeRepository();
    const fake = fakeGraphify();
    await withDaemon(fake.dir, async (daemon) => {
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      const first = git(root, ['rev-parse', 'HEAD']);
      await until(async () => (await snapshot(daemon, root)).graph.builtFrom?.commit === first, 'the first build');
      const graphBefore = readFileSync(join(root, 'graphify-out', 'graph.json'), 'utf8');

      fake.replace('echo "tree-sitter grammar missing for .zig" >&2; exit 3');
      const second = commit(root, 'a.txt');
      await until(async () => (await snapshot(daemon, root)).graph.lastRun?.commit === second, 'the failed run');

      const body = await snapshot(daemon, root);
      assert.equal(body.graph.lastRun?.outcome, 'failed');
      assert.match(body.graph.lastRun?.reason ?? '', /tree-sitter grammar missing/);
      assert.equal(body.graph.builtFrom?.commit, first);
      assert.equal(body.graph.behind, true);
      assert.equal(body.graph.available, true);
      const failed = body.attention.find((item) => item.code === 'graph.update_failed');
      assert.match(failed?.message ?? '', /tree-sitter grammar missing/);
      assert.equal(readFileSync(join(root, 'graphify-out', 'graph.json'), 'utf8'), graphBefore);

      // A failed commit is not retried every minute: only a new move runs again. A failed extract builds no report.
      await settle();
      assert.equal(calls(fake.log).length, 3);
    });
  });

  it('reports a failed report as a failed run, with its reason, and keeps the graph the extract wrote', async () => {
    const root = makeRepository();
    const fake = fakeGraphify(`if [ "$1" = cluster-only ]; then echo "community detection failed" >&2; exit 4; fi\n${WRITE_GRAPH}`);
    await withDaemon(fake.dir, async (daemon) => {
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      const first = git(root, ['rev-parse', 'HEAD']);
      await until(async () => (await snapshot(daemon, root)).graph.lastRun?.commit === first, 'the failed run');

      const body = await snapshot(daemon, root);
      assert.deepEqual(calls(fake.log), [`${root} extract . --code-only`, `${root} cluster-only . --no-label`]);
      assert.equal(body.graph.lastRun?.outcome, 'failed');
      assert.match(body.graph.lastRun?.reason ?? '', /cluster-only.*community detection failed/);
      assert.match(body.attention.find((item) => item.code === 'graph.update_failed')?.message ?? '', /community detection failed/);
      assert.equal(existsSync(join(root, 'graphify-out', 'graph.json')), true);
      assert.equal(body.graph.available, true);
    });
  });

  it('runs nothing when Git does not ignore the output directory, and says so', async () => {
    const root = makeRepository({ ignored: false });
    const fake = fakeGraphify();
    await withDaemon(fake.dir, async (daemon) => {
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      await settle();
      assert.deepEqual(calls(fake.log), []);
      const body = await snapshot(daemon, root);
      assert.deepEqual(graphCodes(body), ['graph.not_ignored']);
      assert.match(body.attention.find((item) => item.code === 'graph.not_ignored')!.message, /graphify-out/);
      assert.equal(existsSync(join(root, 'graphify-out')), false);
    });
  });

  it('is not available, with a reason telling a missing graphify from a capability declared false, and no attention item', async () => {
    const root = makeRepository();
    const empty = temporary('binnacle-graph-empty-');
    await withDaemon(empty, async (daemon) => {
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      await settle();
      const body = await snapshot(daemon, root);
      assert.equal(body.graph.available, false);
      assert.match(body.graph.reason ?? '', /graphify is not on the daemon's PATH/);
      assert.deepEqual(graphCodes(body), []);
    });

    const declined = makeRepository({ ignored: false, capability: '\ncapabilities:\n  graphify: false\n' });
    const fake = fakeGraphify();
    await withDaemon(fake.dir, async (daemon) => {
      assert.equal((await daemon.call('project.register', { path: declined })).status, 200);
      await settle();
      assert.deepEqual(calls(fake.log), []);
      const body = await snapshot(daemon, declined);
      assert.equal(body.graph.available, false);
      assert.match(body.graph.reason ?? '', /capabilities\.graphify is false/);
      assert.deepEqual(graphCodes(body), []);
    });
  });

  it('keeps the last run across a daemon restart', async () => {
    const root = makeRepository();
    const fake = fakeGraphify();
    const home = temporary('binnacle-graph-home-');
    const head = git(root, ['rev-parse', 'HEAD']);
    await withDaemon(
      fake.dir,
      async (daemon) => {
        assert.equal((await daemon.call('project.register', { path: root })).status, 200);
        await until(async () => (await snapshot(daemon, root)).graph.lastRun?.commit === head, 'the first build');
      },
      home,
    );
    // Restarted without graphify, so nothing runs again and the run read back is the one recorded.
    await withDaemon(
      temporary('binnacle-graph-empty-'),
      async (daemon) => {
        const { graph } = await snapshot(daemon, root);
        assert.equal(graph.lastRun?.commit, head);
        assert.equal(graph.lastRun?.outcome, 'built');
        assert.equal(graph.builtFrom?.commit, head);
      },
      home,
    );
  });
});
