import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { storePath } from '../src/home.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * Gemini CLI's sessions, through the daemon's HTTP API. Its artifact root, Gemini CLI's
 * `~/.gemini/tmp`, is a temporary directory holding a project temp directory per launch
 * directory, each with its `.project_root`, and every session in it is built from
 * `packages/adapters/test/fixtures/gemini-cli`: three calls, the last with no tokens.
 */
type FieldTotal = { tokens: number | null; partial: boolean; provenance: string | null };
type Totals = { records: number; input: FieldTotal; cachedInput: FieldTotal; cacheCreation: FieldTotal; output: FieldTotal; reasoning: FieldTotal };
type Level = { harness: string; level: number | null; reason: string | null };

const SESSION = readFileSync(join(import.meta.dirname, '..', '..', '..', 'packages', 'adapters', 'test', 'fixtures', 'gemini-cli', 'session.jsonl'), 'utf8')
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
  const root = temporary('binnacle-gemini-project-');
  mkdirSync(join(root, '.binnacle'), { recursive: true });
  writeFileSync(join(root, '.binnacle', 'project.yaml'), 'version: 1\n\nproject:\n  id: gemini-project\n');
  return root;
}

/** When every session's messages were written. */
const AN_HOUR_AGO = new Date(Date.now() - 3_600_000);

/**
 * Gemini CLI's OTLP JSON logs of session `sessionId`: a `gemini_cli.api_response` per call,
 * with the counts it names.
 */
function geminiOtlp(sessionId: string, events: { timestamp: string; counts: Record<string, number> }[]): unknown {
  const attribute = (key: string, value: string | number) => ({ key, value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: value } });
  const logRecords = events.map((event) => ({
    timeUnixNano: String(Date.parse(event.timestamp) * 1_000_000),
    attributes: [
      attribute('event.name', 'gemini_cli.api_response'),
      attribute('event.timestamp', event.timestamp),
      attribute('session.id', sessionId),
      attribute('model', 'gemini-2.5-pro'),
      ...Object.entries(event.counts).map(([key, value]) => attribute(key, value)),
    ],
  }));
  return { resourceLogs: [{ resource: { attributes: [attribute('service.name', 'gemini-cli')] }, scopeLogs: [{ scope: { name: 'gemini-cli' }, logRecords }] }] };
}

/**
 * Writes Gemini CLI's project temp directory `slug` for sessions launched in `cwd`, with its
 * `.project_root`, and session `id` in it, its messages an hour ago: a subagent's under its
 * parent's directory when `parent` is given. Returns the file.
 */
function geminiSession(root: string, slug: string, cwd: string, id: string, parent?: string): string {
  mkdirSync(join(root, slug), { recursive: true });
  writeFileSync(join(root, slug, '.project_root'), cwd);
  const dir = join(root, slug, 'chats', ...(parent === undefined ? [] : [parent]));
  mkdirSync(dir, { recursive: true });
  const file = join(dir, parent === undefined ? `session-2026-10-07T09-00-${id}.jsonl` : `${id}.jsonl`);
  const timestamp = AN_HOUR_AGO.toISOString();
  const placed = SESSION.map((line) =>
    typeof line.sessionId === 'string' ? { ...line, sessionId: id } : typeof line.id === 'string' ? { ...line, id: `${String(line.id)}-${id}`, timestamp } : line,
  );
  writeFileSync(file, placed.map((line) => `${JSON.stringify(line)}\n`).join(''));
  return file;
}

async function withDaemon(body: (daemon: TestDaemon, geminiCli: string) => Promise<void>): Promise<void> {
  const geminiCli = temporary('binnacle-gemini-tmp-');
  const daemon = await startTestDaemon({ artifacts: { claudeCode: join(geminiCli, 'no-claude'), codex: join(geminiCli, 'no-codex'), geminiCli } });
  try {
    await body(daemon, geminiCli);
  } finally {
    await daemon.stop();
  }
}

async function call<T>(daemon: TestDaemon, operation: string, root: string): Promise<T> {
  const result = await daemon.call<T>(operation, { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

const harnesses = async (daemon: TestDaemon, root: string): Promise<Level[]> =>
  (await call<{ usage: { harnesses: Level[] } }>(daemon, 'project.snapshot', root)).usage.harnesses;

function stored(daemon: TestDaemon): Record<string, unknown>[] {
  const db = new DatabaseSync(storePath(daemon.home), { readOnly: true });
  try {
    return db.prepare('select * from ingested_record order by timestamp').all() as Record<string, unknown>[];
  } finally {
    db.close();
  }
}

/** The fixture's calls in `sessions` sessions: two with tokens each, one with none. */
function calls(sessions: number): Totals {
  const field = (tokens: number): FieldTotal => ({ tokens: tokens * sessions, partial: true, provenance: 'calculated' });
  return {
    records: 3 * sessions,
    input: field(12480 - 8192 + (13050 - 12288 + 40)),
    cachedInput: field(8192 + 12288),
    cacheCreation: { tokens: null, partial: false, provenance: null },
    output: field(312 + 120 + 96),
    reasoning: field(120),
  };
}

describe('Gemini CLI usage', () => {
  it('reads a project’s Gemini CLI sessions and its subagents’, and reaches level 3', async () => {
    await withDaemon(async (daemon, geminiCli) => {
      const root = makeProject();
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      assert.deepEqual((await harnesses(daemon, root))[2], { harness: 'gemini-cli', level: null, reason: `No Gemini CLI session of this project was found under ${geminiCli}.`, code: 'harness.no_sessions', params: { harness: 'Gemini CLI', path: geminiCli } });

      geminiSession(geminiCli, 'gemini-project', root, 'main');
      // A subagent launched by it, and a session launched in a subdirectory, are the project's.
      geminiSession(geminiCli, 'gemini-project', root, 'helper', 'main');
      geminiSession(geminiCli, 'apps', join(root, 'apps'), 'inner');
      // A session launched elsewhere is never stored.
      geminiSession(geminiCli, 'elsewhere', temporary('binnacle-elsewhere-'), 'elsewhere');

      const usage = await call<{ totals: Totals }>(daemon, 'usage.get', root);
      assert.deepEqual(usage.totals, calls(3));
      assert.deepEqual((await harnesses(daemon, root))[2], { harness: 'gemini-cli', level: 3, reason: null });

      const rows = stored(daemon);
      assert.equal(rows.length, 9);
      assert.ok(rows.every((row) => row.harness === 'gemini-cli' && row.provider === null && row.provenance === 'calculated' && row.project_path === root));
      const helper = rows.filter((row) => row.subagent_id !== null);
      assert.equal(helper.length, 3);
      assert.ok(helper.every((row) => row.subagent_id === 'helper' && row.session_id === 'main' && row.parent_session === 'main' && row.cwd === root));
      assert.equal(rows.filter((row) => row.cwd === join(root, 'apps')).length, 3);
      assert.doesNotMatch(JSON.stringify(rows), /MUST-NOT-BE-STORED/);
    });
  });

  it('gives a run’s context growth, null for the call written without tokens and partial without cache creation', async () => {
    await withDaemon(async (daemon, geminiCli) => {
      const root = makeProject();
      // Runs need a tracker read for their Tasks.
      appendFileSync(join(root, '.binnacle', 'project.yaml'), '\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n');
      geminiSession(geminiCli, 'gemini-project', root, 'main');
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);

      type Context = { tokens: number | null; partial: boolean };
      const usage = await call<{ derived: { contextGrowth: { items: { first: Context; latest: Context; largest: Context }[] } } }>(daemon, 'usage.get', root);
      const [run, ...others] = usage.derived.contextGrowth.items;
      assert.deepEqual(others, []);
      // Input not read from cache with what was: the prompt count and the tool-use prompt.
      assert.deepEqual(run, {
        ...run,
        first: { tokens: 12480, partial: true },
        latest: { tokens: null, partial: false },
        largest: { tokens: 13050 + 40, partial: true },
      });
    });
  });

  it('counts a call once when it is both in its session file and posted as an event, and attributes the event the file does not have', async () => {
    await withDaemon(async (daemon, geminiCli) => {
      const root = makeProject();
      const at = (seconds: number): string => new Date(AN_HOUR_AGO.getTime() + seconds * 1000).toISOString();
      // Posted before the session file is read: they wait in no project for it.
      const events = [
        // The fixture's first call, as Gemini CLI exports it, stamped a moment after its file did.
        { timestamp: at(2), counts: { input_token_count: 12480, cached_content_token_count: 8192, tool_token_count: 0, output_token_count: 312, thoughts_token_count: 120 } },
        // A call the file does not have yet.
        { timestamp: at(30), counts: { input_token_count: 100, cached_content_token_count: 0, tool_token_count: 0, output_token_count: 10, thoughts_token_count: 0 } },
      ];
      const response = await fetch(daemon.url('/v1/logs'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(geminiOtlp('both', events)) });
      assert.equal(response.status, 200);

      geminiSession(geminiCli, 'gemini-project', root, 'both');
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      const usage = await call<{ totals: Totals }>(daemon, 'usage.get', root);
      assert.equal(usage.totals.records, 4);
      assert.equal(usage.totals.input.tokens, calls(1).input.tokens! + 100);
    });
  });

  it('says which file it could not read in its level, and keeps what came before the line', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      const geminiCli = (await call<{ artifacts: { geminiCli: string } }>(daemon, 'daemon.status', root)).artifacts.geminiCli;
      const file = geminiSession(geminiCli, 'gemini-project', root, 'broken');
      appendFileSync(file, 'not json\n');
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      const [, , level] = await harnesses(daemon, root);
      assert.equal(level?.level, 1);
      assert.equal(level?.reason, `Gemini CLI could not read ${file} at line 11: not a JSON line, and nothing after it is counted, however the file grows, until Binnacle can read that line.`);
      assert.equal(stored(daemon).length, 3);
    });
  });
});
