import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { trajectory, trajectorySummaries } from '../../../packages/adapters/test/fixtures/antigravity.ts';
import { storePath } from '../src/home.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';
import { ANTIGRAVITY_NO_TOKENS } from '../src/usage.ts';

/**
 * Antigravity's sessions, through the daemon's HTTP API, as ticket 06 found them: an encrypted
 * `.pb` file per conversation under `~/.gemini/antigravity/conversations`, and its window
 * state, `state.vscdb`, whose trajectory summaries name each conversation's workspace.
 */
type Level = { harness: string; level: number | null; reason: string | null };
type Run = { harness: string; model: string | null; startedAt: string; role: string };

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function temporary(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  roots.push(root);
  return root;
}

function makeProject(): string {
  const root = temporary('binnacle-antigravity-project-');
  mkdirSync(join(root, '.binnacle'), { recursive: true });
  mkdirSync(join(root, 'docs', 'specs'), { recursive: true });
  writeFileSync(join(root, '.binnacle', 'project.yaml'), 'version: 1\n\nproject:\n  id: antigravity-project\n\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n');
  return root;
}

/** When every conversation started. */
const AN_HOUR_AGO = new Date(Math.floor(Date.now() / 1000) * 1000 - 3_600_000);

/** Antigravity's conversations, each launched in its workspace, as its files in `antigravity` and its window state at `state`. */
function conversations(antigravity: string, state: string, workspaces: Record<string, string | null>): void {
  mkdirSync(join(antigravity, 'conversations'), { recursive: true });
  for (const id of Object.keys(workspaces)) {
    const file = join(antigravity, 'conversations', `${id}.pb`);
    writeFileSync(file, Buffer.from('encrypted, read by no one'));
    utimesSync(file, AN_HOUR_AGO, AN_HOUR_AGO);
  }
  const db = new DatabaseSync(state);
  try {
    db.exec('create table if not exists ItemTable (key text unique on conflict replace, value blob)');
    const entries = Object.entries(workspaces).map(([id, workspace]) => trajectory(id, workspace === null ? null : pathToFileURL(workspace).href));
    db.prepare('insert into ItemTable values (?, ?)').run('antigravityUnifiedStateSync.trajectorySummaries', trajectorySummaries(entries));
  } finally {
    db.close();
  }
}

async function withDaemon(body: (daemon: TestDaemon, antigravity: string, state: string) => Promise<void>): Promise<void> {
  const antigravity = temporary('binnacle-antigravity-');
  const state = join(temporary('binnacle-antigravity-state-'), 'state.vscdb');
  const daemon = await startTestDaemon({ artifacts: { antigravity, antigravityState: state } });
  try {
    await body(daemon, antigravity, state);
  } finally {
    await daemon.stop();
  }
}

async function call<T>(daemon: TestDaemon, operation: string, root: string): Promise<T> {
  const result = await daemon.call<T>(operation, { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

const level = async (daemon: TestDaemon, root: string): Promise<Level | undefined> =>
  (await call<{ usage: { harnesses: Level[] } }>(daemon, 'project.snapshot', root)).usage.harnesses.find((entry) => entry.harness === 'antigravity');

function stored(daemon: TestDaemon): Record<string, unknown>[] {
  const db = new DatabaseSync(storePath(daemon.home), { readOnly: true });
  try {
    return db.prepare('select * from ingested_record order by session_id').all() as Record<string, unknown>[];
  } finally {
    db.close();
  }
}

describe('Antigravity usage', () => {
  it('shows a project’s Antigravity sessions as runs at level 2, saying it has no tokens', async () => {
    await withDaemon(async (daemon, antigravity, state) => {
      const root = makeProject();
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      assert.deepEqual(await level(daemon, root), { harness: 'antigravity', level: null, reason: `No Antigravity session of this project was found under ${antigravity}.` });

      conversations(antigravity, state, {
        'c0000000-0000-4000-8000-000000000001': root,
        'c0000000-0000-4000-8000-000000000002': join(root, 'apps'),
        // Another workspace's, and one with none, are never stored.
        'c0000000-0000-4000-8000-000000000003': temporary('binnacle-elsewhere-'),
        'c0000000-0000-4000-8000-000000000004': null,
      });

      const usage = await call<{ totals: { records: number; input: { tokens: number | null } } }>(daemon, 'usage.get', root);
      assert.equal(usage.totals.records, 2);
      assert.equal(usage.totals.input.tokens, null);

      const snapshot = await call<{ activity: { recent: Run[] }; usage: { harnesses: Level[] } }>(daemon, 'project.snapshot', root);
      assert.deepEqual(
        snapshot.activity.recent.map(({ harness, model, startedAt }) => ({ harness, model, startedAt })),
        [0, 1].map(() => ({ harness: 'antigravity', model: null, startedAt: AN_HOUR_AGO.toISOString() })),
      );
      assert.deepEqual(
        snapshot.usage.harnesses.find((entry) => entry.harness === 'antigravity'),
        { harness: 'antigravity', level: 2, reason: `${ANTIGRAVITY_NO_TOKENS}.` },
      );

      const rows = stored(daemon);
      assert.deepEqual(
        rows.map(({ session_id, cwd, model, provider, input, output }) => ({ session_id, cwd, model, provider, input, output })),
        [
          { session_id: 'c0000000-0000-4000-8000-000000000001', cwd: root, model: null, provider: null, input: null, output: null },
          { session_id: 'c0000000-0000-4000-8000-000000000002', cwd: join(root, 'apps'), model: null, provider: null, input: null, output: null },
        ],
      );
      assert.doesNotMatch(JSON.stringify(rows), /MUST-NOT-BE-STORED/);
    });
  });

  it('puts the project at level 1 with the reason when the window state cannot be read', async () => {
    await withDaemon(async (daemon, antigravity, state) => {
      const root = makeProject();
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      conversations(antigravity, state, { 'c0000000-0000-4000-8000-000000000001': root });
      const db = new DatabaseSync(state);
      db.prepare('insert into ItemTable values (?, ?)').run('antigravityUnifiedStateSync.trajectorySummaries', 'not base64!');
      db.close();

      assert.deepEqual(await level(daemon, root), {
        harness: 'antigravity',
        level: 1,
        reason: `Antigravity could not read ${state}: its trajectory summaries are not base64 of a protobuf.`,
      });
    });
  });
});
