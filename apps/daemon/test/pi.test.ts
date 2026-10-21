import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { storePath } from '../src/home.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * pi's sessions, through the daemon's HTTP API. Its artifact root, pi's `~/.pi/agent/sessions`,
 * is a temporary directory holding a directory per launch directory, named as pi names it,
 * and every session in it is built from `packages/adapters/test/fixtures/pi`: seven calls, the
 * first failed before its provider reported anything.
 */
type FieldTotal = { tokens: number | null; partial: boolean; provenance: string | null };
type Totals = { records: number; input: FieldTotal; cachedInput: FieldTotal; cacheCreation: FieldTotal; output: FieldTotal; reasoning: FieldTotal };
type Level = { harness: string; level: number | null; reason: string | null };

const NO_EXPORT_CODE = { code: 'harness.no_export', params: { kind: 'session_files', harness: 'pi' } };
const NO_EXPORT = 'pi has no built-in OpenTelemetry export, so Binnacle counts it only from its session files, each call once it has finished.';

const SESSION = readFileSync(join(import.meta.dirname, '..', '..', '..', 'packages', 'adapters', 'test', 'fixtures', 'pi', 'session.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as Record<string, unknown>);

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
  const root = temporary('binnacle-pi-project-');
  mkdirSync(join(root, '.binnacle'), { recursive: true });
  writeFileSync(join(root, '.binnacle', 'project.yaml'), 'version: 1\n\nproject:\n  id: pi-project\n');
  return root;
}

/** When every session's entries were written: a second apart, from an hour ago. */
const AN_HOUR_AGO = Date.now() - 3_600_000;

/** pi's directory name for a launch directory. */
const piDirectory = (cwd: string): string => `--${cwd.replace(/^[/\\]/, '').replace(/[/\\:]/g, '-')}--`;

/** The fixture's lines as session `id` launched in `cwd`, its entry ids made its own. */
function placed(cwd: string, id: string): string {
  return SESSION.map((line, index) =>
    line.type === 'session' ? { ...line, id, cwd } : { ...line, id: `${String(line.id)}-${id}`, timestamp: new Date(AN_HOUR_AGO + index * 1000).toISOString() },
  )
    .map((line) => `${JSON.stringify(line)}\n`)
    .join('');
}

/** Writes `content` as a session file of pi's for `cwd` under `root`, and returns the file. */
function piSession(root: string, cwd: string, id: string, content: string): string {
  mkdirSync(join(root, piDirectory(cwd)), { recursive: true });
  const file = join(root, piDirectory(cwd), `2026-10-08T12-50-30-499Z_${id}.jsonl`);
  writeFileSync(file, content);
  return file;
}

async function withDaemon(body: (daemon: TestDaemon, pi: string) => Promise<void>): Promise<void> {
  const pi = temporary('binnacle-pi-sessions-');
  const daemon = await startTestDaemon({ artifacts: { pi } });
  try {
    await body(daemon, pi);
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
  (await call<{ usage: { harnesses: Level[] } }>(daemon, 'project.snapshot', root)).usage.harnesses.find((item) => item.harness === 'pi');

function stored(daemon: TestDaemon): Record<string, unknown>[] {
  const db = new DatabaseSync(storePath(daemon.home), { readOnly: true });
  try {
    return db.prepare('select * from ingested_record order by timestamp').all() as Record<string, unknown>[];
  } finally {
    db.close();
  }
}

/** The fixture's calls in `sessions` sessions: six with tokens each, one with none. */
function calls(sessions: number): Totals {
  const field = (tokens: number): FieldTotal => ({ tokens: tokens * sessions, partial: true, provenance: 'calculated' });
  return {
    records: 7 * sessions,
    input: field(3143 + 412 + 900 + 96 + 4 + 3300),
    cachedInput: field(3072 + 2048 + 3354),
    cacheCreation: field(1210),
    output: field(11 + 208 + 75 + 140 + 1 + 420),
    reasoning: field(64),
  };
}

describe('pi usage', () => {
  it('reads a project’s pi sessions, a forked session’s copied calls once, and reaches level 3 with why not 4', async () => {
    await withDaemon(async (daemon, pi) => {
      const root = makeProject();
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      assert.deepEqual(await level(daemon, root), { harness: 'pi', level: null, reason: `No pi session of this project was found under ${pi}.`, code: 'harness.no_sessions', params: { harness: 'pi', path: pi } });

      const main = placed(root, 'main');
      piSession(pi, root, 'main', main);
      // A fork copies the entries before it, under its own header.
      piSession(pi, root, 'fork', main.replace(/"id":"main"/, '"id":"fork"'));
      // A session launched in a subdirectory is the project's.
      piSession(pi, join(root, 'apps'), 'inner', placed(join(root, 'apps'), 'inner'));
      // One launched elsewhere, its directory named like the project's, is never stored.
      piSession(pi, `${root}-other`, 'other', placed(`${root}-other`, 'other'));

      const usage = await call<{ totals: Totals }>(daemon, 'usage.get', root);
      assert.deepEqual(usage.totals, calls(2));
      assert.deepEqual(await level(daemon, root), { harness: 'pi', level: 3, reason: NO_EXPORT, ...NO_EXPORT_CODE });

      const rows = stored(daemon);
      assert.equal(rows.length, 14);
      assert.ok(rows.every((row) => row.harness === 'pi' && row.provenance === 'calculated' && row.project_path === root && row.subagent_id === null));
      assert.equal(rows.filter((row) => row.cwd === join(root, 'apps')).length, 7);
      assert.deepEqual([...new Set(rows.map((row) => `${String(row.provider)}/${String(row.model)}`))].sort(), ['anthropic/claude-opus-4-8', 'anthropic/claude-sonnet-5', 'anthropic/claude-sonnet-5-20261001', 'null/null', 'openai/gpt-6.1-sol']);
      assert.doesNotMatch(JSON.stringify(rows), /MUST-NOT-BE-STORED/);
    });
  });

  it('says which file it could not read in its level, and keeps what came before the line', async () => {
    await withDaemon(async (daemon, pi) => {
      const root = makeProject();
      const file = piSession(pi, root, 'broken', placed(root, 'broken'));
      appendFileSync(file, 'not json\n');
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      assert.deepEqual(await level(daemon, root), {
        harness: 'pi',
        level: 1,
        reason: `pi could not read ${file} at line 18: not a JSON line, and nothing after it is counted, however the file grows, until Binnacle can read that line.`,
        code: 'telemetry.unreadable',
      });
      assert.equal(stored(daemon).length, 7);
    });
  });
});
