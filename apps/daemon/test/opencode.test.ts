import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { storePath } from '../src/home.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * opencode's sessions, through the daemon's HTTP API. Its artifact root, opencode's data
 * directory, is a temporary directory holding an `opencode.db` with the tables opencode keeps
 * its sessions, messages and parts in (v1.18.35, `packages/core/src/session/sql.ts`), in WAL
 * mode as opencode opens it, and only the columns Binnacle reads.
 */
type FieldTotal = { tokens: number | null; partial: boolean; provenance: string | null };
type Totals = { records: number; input: FieldTotal; cachedInput: FieldTotal; cacheCreation: FieldTotal; output: FieldTotal; reasoning: FieldTotal };
type Level = { harness: string; level: number | null; reason: string | null };

const NO_EXPORT = 'opencode exports no OpenTelemetry, so its calls are read from its database once each has finished, and it is never seen live.';

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
  const root = temporary('binnacle-opencode-project-');
  mkdirSync(join(root, '.binnacle'), { recursive: true });
  writeFileSync(join(root, '.binnacle', 'project.yaml'), 'version: 1\n\nproject:\n  id: opencode-project\n');
  return root;
}

/** When every step was written. */
const AN_HOUR_AGO = Date.now() - 3_600_000;

/** opencode's database in its data directory `root`, created with its tables when it is not there yet. */
function database(root: string): DatabaseSync {
  const db = new DatabaseSync(join(root, 'opencode.db'));
  db.exec(`
    pragma journal_mode = wal;
    create table if not exists session (id text primary key, project_id text not null, parent_id text, directory text not null, title text not null);
    create table if not exists message (id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
    create table if not exists part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
  `);
  return db;
}

/**
 * Writes session `id`, launched in `cwd`, to opencode's database in `root`: a user message
 * and an assistant message with two steps, a text part between them, and a subagent's session
 * when `parent` is given.
 */
function opencodeSession(root: string, cwd: string, id: string, parent: string | null = null): void {
  const db = database(root);
  try {
    db.prepare('insert into session values (?, ?, ?, ?, ?)').run(id, 'prj', parent, cwd, 'MUST-NOT-BE-STORED');
    const message = (messageId: string, data: object): void => {
      db.prepare('insert into message values (?, ?, ?, ?, ?)').run(messageId, id, AN_HOUR_AGO, AN_HOUR_AGO, JSON.stringify(data));
    };
    const part = (partId: string, messageId: string, seconds: number, data: object): void => {
      db.prepare('insert into part values (?, ?, ?, ?, ?, ?)').run(partId, messageId, id, AN_HOUR_AGO + seconds * 1000, AN_HOUR_AGO, JSON.stringify(data));
    };
    message(`msg_user_${id}`, { role: 'user', time: { created: AN_HOUR_AGO }, agent: 'build', model: { providerID: 'anthropic', modelID: 'claude-sonnet-4-5' } });
    part(`prt_prompt_${id}`, `msg_user_${id}`, 0, { type: 'text', text: 'MUST-NOT-BE-STORED' });
    message(`msg_${id}`, {
      role: 'assistant',
      time: { created: AN_HOUR_AGO },
      parentID: `msg_user_${id}`,
      modelID: 'claude-sonnet-4-5',
      providerID: 'anthropic',
      mode: 'build',
      agent: 'build',
      path: { cwd, root: cwd },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    });
    part(`prt_a_${id}`, `msg_${id}`, 5, { type: 'step-finish', reason: 'tool-calls', cost: 0, tokens: { input: 2_400, output: 320, reasoning: 64, cache: { read: 12_288, write: 540 } } });
    part(`prt_text_${id}`, `msg_${id}`, 6, { type: 'text', text: 'MUST-NOT-BE-STORED' });
    part(`prt_b_${id}`, `msg_${id}`, 9, { type: 'step-finish', reason: 'stop', cost: 0, tokens: { input: 180, output: 96, reasoning: 0, cache: { read: 14_000, write: 0 } } });
  } finally {
    db.close();
  }
}

async function withDaemon(body: (daemon: TestDaemon, opencode: string) => Promise<void>): Promise<void> {
  const opencode = temporary('binnacle-opencode-data-');
  const daemon = await startTestDaemon({ artifacts: { opencode } });
  try {
    await body(daemon, opencode);
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
  (await call<{ usage: { harnesses: Level[] } }>(daemon, 'project.snapshot', root)).usage.harnesses.find((entry) => entry.harness === 'opencode');

function stored(daemon: TestDaemon): Record<string, unknown>[] {
  const db = new DatabaseSync(storePath(daemon.home), { readOnly: true });
  try {
    return db.prepare('select * from ingested_record order by timestamp').all() as Record<string, unknown>[];
  } finally {
    db.close();
  }
}

/** The fixture's two steps in `sessions` sessions. */
function calls(sessions: number): Totals {
  const field = (tokens: number): FieldTotal => ({ tokens: tokens * sessions, partial: false, provenance: 'calculated' });
  return {
    records: 2 * sessions,
    input: field(2_400 + 180),
    cachedInput: field(12_288 + 14_000),
    cacheCreation: field(540),
    output: field(320 + 64 + 96),
    reasoning: field(64),
  };
}

describe('opencode usage', () => {
  it('reads a project’s opencode sessions and its subagents’, and reaches level 3, saying why not 4', async () => {
    await withDaemon(async (daemon, opencode) => {
      const root = makeProject();
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      assert.deepEqual(await level(daemon, root), { harness: 'opencode', level: null, reason: `No opencode session of this project was found under ${opencode}.` });

      opencodeSession(opencode, root, 'ses_main');
      // A subagent it started, and a session launched in a subdirectory, are the project's.
      opencodeSession(opencode, root, 'ses_helper', 'ses_main');
      opencodeSession(opencode, join(root, 'apps'), 'ses_inner');
      // A session launched elsewhere is never stored.
      opencodeSession(opencode, temporary('binnacle-elsewhere-'), 'ses_elsewhere');

      const usage = await call<{ totals: Totals }>(daemon, 'usage.get', root);
      assert.deepEqual(usage.totals, calls(3));
      assert.deepEqual(await level(daemon, root), { harness: 'opencode', level: 3, reason: NO_EXPORT });

      const rows = stored(daemon);
      assert.equal(rows.length, 6);
      assert.ok(rows.every((row) => row.harness === 'opencode' && row.provider === 'anthropic' && row.provenance === 'calculated' && row.project_path === root));
      const helper = rows.filter((row) => row.subagent_id !== null);
      assert.equal(helper.length, 2);
      assert.ok(helper.every((row) => row.subagent_id === 'ses_helper' && row.session_id === 'ses_main' && row.parent_session === 'ses_main' && row.cwd === root));
      assert.equal(rows.filter((row) => row.cwd === join(root, 'apps')).length, 2);
      assert.doesNotMatch(JSON.stringify(rows), /MUST-NOT-BE-STORED/);

      // A session written since is read by the next call.
      opencodeSession(opencode, root, 'ses_later');
      assert.deepEqual((await call<{ totals: Totals }>(daemon, 'usage.get', root)).totals, calls(4));
    });
  });

  it('says which step it could not read in its project’s level, keeping the steps before it, and other projects’ sessions are read on', async () => {
    await withDaemon(async (daemon, opencode) => {
      const root = makeProject();
      const other = makeProject();
      opencodeSession(opencode, root, 'ses_broken');
      opencodeSession(opencode, other, 'ses_other');
      const db = database(opencode);
      db.prepare('update part set data = ? where id = ?').run('{"type":"step-finish", cut', 'prt_b_ses_broken');
      db.close();
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      assert.equal((await daemon.call('project.register', { path: other })).status, 200);
      assert.deepEqual(await level(daemon, root), {
        harness: 'opencode',
        level: 1,
        reason: `opencode could not read ${join(opencode, 'opencode.db')} at step prt_b_ses_broken: a part that is not JSON, and nothing after it in its session is counted until Binnacle can read that step.`,
      });
      assert.equal((await call<{ totals: Totals }>(daemon, 'usage.get', root)).totals.records, 1);
      assert.deepEqual((await call<{ totals: Totals }>(daemon, 'usage.get', other)).totals, calls(1));
      assert.deepEqual(await level(daemon, other), { harness: 'opencode', level: 3, reason: NO_EXPORT });
    });
  });

  it('says so in its level when the database cannot be read', async () => {
    await withDaemon(async (daemon, opencode) => {
      const root = makeProject();
      writeFileSync(join(opencode, 'opencode.db'), 'not a database');
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      const found = await level(daemon, root);
      assert.equal(found?.level, 1);
      assert.match(found?.reason ?? '', new RegExp(`^opencode could not read ${join(opencode, 'opencode.db')} \\(`));
    });
  });
});
