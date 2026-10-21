import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { storePath } from '../src/home.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * ZCode's sessions, through the daemon's HTTP API. Its artifact root, the directory of ZCode's
 * database, is a temporary directory holding a `db.sqlite` with the `session` and
 * `model_usage` tables ticket 06 recorded (ZCode 3.14.4), in WAL mode, and only the columns
 * Binnacle reads beside a few it must not.
 */
type FieldTotal = { tokens: number | null; partial: boolean; provenance: string | null };
type Totals = { records: number; input: FieldTotal; cachedInput: FieldTotal; cacheCreation: FieldTotal; output: FieldTotal; reasoning: FieldTotal };
type Level = { harness: string; level: number | null; reason: string | null };
type Run = { harness: string; provider: string | null; model: string | null; parentRunId: string | null; totals: Totals };

const NO_EXPORT_CODE = { code: 'harness.no_export', params: { kind: 'database', harness: 'ZCode' } };
const NO_EXPORT = 'ZCode documents no OpenTelemetry export, so Binnacle counts it only from its database, each call once it has finished.';
const PROVIDER = 'account:zai-individual-coding-plan';

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
  const root = temporary('binnacle-zcode-project-');
  mkdirSync(join(root, '.binnacle'), { recursive: true });
  mkdirSync(join(root, 'docs', 'specs'), { recursive: true });
  // A tracker, so that the snapshot's activity, where its runs are, can be read.
  writeFileSync(join(root, '.binnacle', 'project.yaml'), 'version: 1\n\nproject:\n  id: zcode-project\n\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n');
  return root;
}

/** When every call completed. */
const AN_HOUR_AGO = Date.now() - 3_600_000;

/** ZCode's database in `root`, created with its tables when it is not there yet. */
function database(root: string): DatabaseSync {
  const db = new DatabaseSync(join(root, 'db.sqlite'));
  db.exec(`
    pragma journal_mode = wal;
    create table if not exists session (id text primary key, parent_id text, directory text not null, title text, time_created integer, time_updated integer, task_type text);
    create table if not exists model_usage (
      id text primary key, session_id text not null, turn_id text, query_source text, provider_id text, model_id text, variant text,
      status text, started_at integer, completed_at integer, input_tokens integer, output_tokens integer, reasoning_tokens integer,
      cache_creation_input_tokens integer, cache_read_input_tokens integer, raw_usage_json text
    );
  `);
  return db;
}

/**
 * Writes session `id`, launched in `cwd`, to ZCode's database in `root`: a call of the agent's
 * and the one that titles it, and a subagent's session when `parent` is given.
 */
function zcodeSession(root: string, cwd: string, id: string, parent: string | null = null): void {
  const db = database(root);
  try {
    db.prepare('insert into session values (?, ?, ?, ?, ?, ?, ?)').run(id, parent, cwd, 'MUST-NOT-BE-STORED', AN_HOUR_AGO, AN_HOUR_AGO, 'interactive');
    const call = (callId: string, source: string, seconds: number, tokens: [number, number, number, number, number]): void => {
      db.prepare('insert into model_usage values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        callId, id, 'turn', source, PROVIDER, 'GLM-5.3', 'max', 'completed', AN_HOUR_AGO + seconds * 1000 - 3000, AN_HOUR_AGO + seconds * 1000, ...tokens, 'MUST-NOT-BE-STORED',
      );
    };
    call(`usage_main_${id}`, 'main_turn', 5, [24_244, 59, 16, 0, 19_456]);
    call(`usage_title_${id}`, 'session_title', 9, [900, 12, 0, 0, 0]);
  } finally {
    db.close();
  }
}

async function withDaemon(body: (daemon: TestDaemon, zcode: string) => Promise<void>): Promise<void> {
  const zcode = temporary('binnacle-zcode-db-');
  const daemon = await startTestDaemon({ artifacts: { zcode } });
  try {
    await body(daemon, zcode);
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
  (await call<{ usage: { harnesses: Level[] } }>(daemon, 'project.snapshot', root)).usage.harnesses.find((entry) => entry.harness === 'zcode');

function stored(daemon: TestDaemon): Record<string, unknown>[] {
  const db = new DatabaseSync(storePath(daemon.home), { readOnly: true });
  try {
    return db.prepare('select * from ingested_record order by timestamp').all() as Record<string, unknown>[];
  } finally {
    db.close();
  }
}

/** The fixture's two calls in `sessions` sessions. */
function calls(sessions: number): Totals {
  const field = (tokens: number): FieldTotal => ({ tokens: tokens * sessions, partial: false, provenance: 'calculated' });
  return {
    records: 2 * sessions,
    input: field(24_244 - 19_456 + 900),
    cachedInput: field(19_456),
    cacheCreation: field(0),
    output: field(59 + 12),
    reasoning: field(16),
  };
}

describe('ZCode usage', () => {
  it('reads a project’s ZCode sessions and its subagents’ as runs, with provider and model apart, and reaches level 3, saying why not 4', async () => {
    await withDaemon(async (daemon, zcode) => {
      const root = makeProject();
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      assert.deepEqual(await level(daemon, root), { harness: 'zcode', level: null, reason: `No ZCode session of this project was found under ${zcode}.`, code: 'harness.no_sessions', params: { harness: 'ZCode', path: zcode } });

      zcodeSession(zcode, root, 'sess_main');
      // A subagent it started, and a session launched in a subdirectory, are the project's.
      zcodeSession(zcode, root, 'sess_helper', 'sess_main');
      zcodeSession(zcode, join(root, 'apps'), 'sess_inner');
      // A session launched elsewhere is never stored.
      zcodeSession(zcode, temporary('binnacle-elsewhere-'), 'sess_elsewhere');

      assert.deepEqual((await call<{ totals: Totals }>(daemon, 'usage.get', root)).totals, calls(3));
      const { recent } = (await call<{ activity: { recent: Run[] } }>(daemon, 'project.snapshot', root)).activity;
      assert.equal(recent.length, 3);
      assert.ok(recent.every((run) => run.harness === 'zcode' && run.provider === PROVIDER && run.model === 'GLM-5.3'));
      assert.equal(recent.filter((run) => run.parentRunId !== null).length, 1);
      assert.deepEqual(await level(daemon, root), { harness: 'zcode', level: 3, reason: NO_EXPORT, ...NO_EXPORT_CODE });

      const rows = stored(daemon);
      assert.equal(rows.length, 6);
      assert.ok(rows.every((row) => row.harness === 'zcode' && row.provider === PROVIDER && row.model === 'GLM-5.3' && row.provenance === 'calculated' && row.project_path === root));
      const helper = rows.filter((row) => row.subagent_id !== null);
      assert.equal(helper.length, 2);
      assert.ok(helper.every((row) => row.subagent_id === 'sess_helper' && row.session_id === 'sess_main' && row.parent_session === 'sess_main'));
      assert.doesNotMatch(JSON.stringify(rows), /MUST-NOT-BE-STORED/);

      // A session written since is read by the next call.
      zcodeSession(zcode, root, 'sess_later');
      assert.deepEqual((await call<{ totals: Totals }>(daemon, 'usage.get', root)).totals, calls(4));
    });
  });

  it('says which call it could not read in its project’s level, keeping the calls before it, and other projects’ sessions are read on', async () => {
    await withDaemon(async (daemon, zcode) => {
      const root = makeProject();
      const other = makeProject();
      zcodeSession(zcode, root, 'sess_broken');
      zcodeSession(zcode, other, 'sess_other');
      const db = database(zcode);
      db.prepare('update model_usage set completed_at = ? where id = ?').run('soon', 'usage_title_sess_broken');
      db.close();
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      assert.equal((await daemon.call('project.register', { path: other })).status, 200);
      assert.deepEqual(await level(daemon, root), {
        harness: 'zcode',
        level: 1,
        reason: `ZCode could not read ${join(zcode, 'db.sqlite')} at call usage_title_sess_broken: a call without the time it completed, and nothing after it in its session is counted until Binnacle can read that call.`,
        code: 'telemetry.unreadable',
      });
      assert.equal((await call<{ totals: Totals }>(daemon, 'usage.get', root)).totals.records, 1);
      assert.deepEqual((await call<{ totals: Totals }>(daemon, 'usage.get', other)).totals, calls(1));
      assert.deepEqual(await level(daemon, other), { harness: 'zcode', level: 3, reason: NO_EXPORT, ...NO_EXPORT_CODE });
    });
  });

  it('says so in its level when the database cannot be read', async () => {
    await withDaemon(async (daemon, zcode) => {
      const root = makeProject();
      writeFileSync(join(zcode, 'db.sqlite'), 'not a database');
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      const found = await level(daemon, root);
      assert.equal(found?.level, 1);
      assert.match(found?.reason ?? '', new RegExp(`^ZCode could not read ${join(zcode, 'db.sqlite')} \\(`));
    });
  });
});
