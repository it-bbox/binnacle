import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { storePath } from '../src/home.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * Claude Code's OpenTelemetry, posted to the daemon as Claude Code's exporter posts it: OTLP
 * logs over HTTP, JSON-encoded, one `claude_code.api_request` event per call. The session's
 * artifact is built from the fixture `usage.test.ts` reads, cut from a real session.
 */
type FieldTotal = { tokens: number | null; partial: boolean; provenance: string | null };
type Totals = { records: number; input: FieldTotal; cachedInput: FieldTotal; cacheCreation: FieldTotal; output: FieldTotal; reasoning: FieldTotal };
type Run = { id: string; harness: string; active: { value: boolean }; totals: Totals };
type Snapshot = {
  usage: { last7Days: Totals; harnesses: { harness: string; level: number | null; reason: string | null }[] };
  activity: { running: { items: Run[] }; recent: Run[] };
};
type Line = Record<string, unknown> & { type: string; message?: Record<string, unknown> };

const GRILL = readFileSync(join(import.meta.dirname, 'fixtures', 'claude-code', 'grill-on-main.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as Line);
/** The fixture's one call, as Claude Code's artifact and its OpenTelemetry both report it. */
const CALL = { model: 'claude-opus-5-5', input: 2, cacheRead: 39225, cacheCreation: 29831, output: 137 };
const MARKER = 'MUST-NOT-BE-STORED';
const LOCAL_TRACKER = '\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n';

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
  const root = temporary('binnacle-otel-');
  mkdirSync(join(root, '.binnacle'), { recursive: true });
  writeFileSync(join(root, '.binnacle', 'project.yaml'), `version: 1\n\nproject:\n  id: otel-project\n${LOCAL_TRACKER}`);
  const ticket = join(root, 'docs', 'specs', 'epic', 'issues', '01-first.md');
  mkdirSync(dirname(ticket), { recursive: true });
  writeFileSync(ticket, '# 01: First\n\nStatus: READY\n');
  return root;
}

const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

/** The fixture's lines at `timestamp`, its message id suffixed with `id` and its request id `requestId`. */
const lines = (timestamp: string, id: string, requestId: string): Line[] =>
  GRILL.map((line) => ({
    ...line,
    timestamp,
    ...(line.type === 'assistant' ? { requestId, message: { ...line.message, id: `${String(line.message!.id)}${id}` } } : {}),
  }));

/** Writes, or extends, the session `sessionId` launched in `cwd` under Claude Code's artifact root. */
function artifact(artifacts: string, cwd: string, sessionId: string, records: Line[]): void {
  const dir = join(artifacts, cwd.replace(/[^a-zA-Z0-9]/g, '-'));
  mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, `${sessionId}.jsonl`), records.map((record) => `${JSON.stringify({ ...record, cwd, sessionId })}\n`).join(''));
}

type Event = { sessionId: string; timestamp: string; requestId?: string; model?: string; input?: number; cacheRead?: number; cacheCreation?: number; output?: number };

const string = (key: string, value: string) => ({ key, value: { stringValue: value } });
const int = (key: string, value: number) => ({ key, value: { intValue: String(value) } });

/** OTLP JSON logs as Claude Code exports them, one `claude_code.api_request` per event, with attributes Binnacle must not keep. */
function otlp(events: Event[], name = 'claude_code.api_request'): unknown {
  return {
    resourceLogs: [
      {
        resource: { attributes: [string('service.name', 'claude-code'), string('user.email', `${MARKER}@example.invalid`)] },
        scopeLogs: [
          {
            scope: { name: 'com.anthropic.claude_code.events', version: '2.1.280' },
            logRecords: events.map((event) => ({
              timeUnixNano: String(Date.parse(event.timestamp) * 1_000_000),
              body: { stringValue: name },
              attributes: [
                string('event.name', name.replace('claude_code.', '')),
                string('event.timestamp', event.timestamp),
                string('session.id', event.sessionId),
                string('prompt.id', `${MARKER}-prompt`),
                string('prompt', `${MARKER}: the prompt`),
                string('tool_input', `${MARKER}: the tool input`),
                ...(event.requestId === undefined ? [] : [string('request_id', event.requestId)]),
                string('model', event.model ?? CALL.model),
                int('input_tokens', event.input ?? CALL.input),
                int('output_tokens', event.output ?? CALL.output),
                int('cache_read_tokens', event.cacheRead ?? CALL.cacheRead),
                int('cache_creation_tokens', event.cacheCreation ?? CALL.cacheCreation),
                { key: 'cost_usd', value: { doubleValue: 0.12 } },
              ],
            })),
          },
        ],
      },
    ],
  };
}

async function post(daemon: TestDaemon, path: string, body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }): Promise<{ status: number; body: unknown }> {
  const response = await fetch(daemon.url(path), { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

async function withDaemon(body: (daemon: TestDaemon, artifacts: string) => Promise<void>): Promise<void> {
  const home = temporary('binnacle-otel-home-');
  const artifacts = temporary('binnacle-otel-projects-');
  const daemon = await startTestDaemon({ home, artifacts: { claudeCode: artifacts, codex: join(home, 'no-codex') } });
  try {
    await body(daemon, artifacts);
  } finally {
    await daemon.stop();
  }
}

async function snapshot(daemon: TestDaemon, root: string): Promise<Snapshot> {
  const result = await daemon.call<Snapshot>('project.snapshot', { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

async function totals(daemon: TestDaemon, root: string): Promise<Totals> {
  const result = await daemon.call<{ totals: Totals }>('usage.get', { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.totals;
}

async function register(daemon: TestDaemon, root: string): Promise<void> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
}

function stored(daemon: TestDaemon, table = 'ingested_record'): Record<string, unknown>[] {
  const db = new DatabaseSync(storePath(daemon.home), { readOnly: true });
  try {
    return db.prepare(`select * from ${table} order by timestamp`).all() as Record<string, unknown>[];
  } finally {
    db.close();
  }
}

describe('Claude Code’s OpenTelemetry', () => {
  it('turns a posted api_request into a record usage.get counts, with its tokens as reported, and stores none of its other attributes', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject();
      artifact(artifacts, root, 'live', lines(minutesAgo(60 * 24), '-earlier', 'req_earlier'));
      await register(daemon, root);
      assert.equal((await totals(daemon, root)).records, 1);

      const posted = await post(daemon, '/v1/logs', otlp([{ sessionId: 'live', timestamp: minutesAgo(1), requestId: 'req_live', input: 5, output: 7 }]));
      assert.deepEqual(posted, { status: 200, body: {} });

      const after = await totals(daemon, root);
      assert.equal(after.records, 2);
      assert.equal(after.input.tokens, 2 + 5);
      assert.equal(after.output.tokens, 137 + 7);
      assert.equal(after.input.provenance, 'provider_reported');
      // Claude Code's event carries no thinking tokens: not reported, never zero.
      assert.equal(after.reasoning.partial, true);

      const record = stored(daemon).find((row) => row.source === 'opentelemetry')!;
      assert.equal(record.session_id, 'live');
      assert.equal(record.cwd, root);
      assert.equal(record.project_path, root);
      assert.equal(record.model, CALL.model);
      assert.equal(record.request_id, 'req_live');
      assert.equal(stored(daemon).find((row) => row.source === 'artifact')?.request_id, 'req_earlier');

      assert.doesNotMatch(JSON.stringify([stored(daemon), stored(daemon, 'unattributed_record')]), new RegExp(MARKER));
      for (const path of [storePath(daemon.home), `${storePath(daemon.home)}-wal`]) {
        let bytes = '';
        try {
          bytes = readFileSync(path, 'latin1');
        } catch {
          continue;
        }
        assert.ok(!bytes.includes(MARKER), `${path} holds an attribute it must not`);
      }
    });
  });

  it('counts a call posted and present in its artifact once, by its request id or else by model, tokens and time, whichever arrives first, and an unmatched event too', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject();
      const call = minutesAgo(30);
      artifact(artifacts, root, 'both', lines(minutesAgo(60), '-first', 'req_first'));
      await register(daemon, root);

      // Posted before the artifact has it, then the artifact catches up.
      await post(daemon, '/v1/logs', otlp([{ sessionId: 'both', timestamp: call, requestId: 'req_second' }]));
      assert.equal((await totals(daemon, root)).records, 2);
      artifact(artifacts, root, 'both', lines(call, '-second', 'req_second'));
      assert.equal((await totals(daemon, root)).records, 2);

      // Already in the artifact, then posted: by request id, and, without one, by model, tokens and a timestamp a second off.
      await post(daemon, '/v1/logs', otlp([{ sessionId: 'both', timestamp: minutesAgo(60), requestId: 'req_first' }]));
      await post(daemon, '/v1/logs', otlp([{ sessionId: 'both', timestamp: new Date(Date.parse(call) + 1000).toISOString() }]));
      // A resent batch is the same events again.
      await post(daemon, '/v1/logs', otlp([{ sessionId: 'both', timestamp: call, requestId: 'req_second' }]));
      const once = await totals(daemon, root);
      assert.equal(once.records, 2);
      assert.equal(once.output.tokens, 2 * 137);
      // The artifact's record is the one kept: it reports the thinking tokens the event does not.
      assert.equal(once.reasoning.tokens, 2 * 18);
      assert.equal(once.reasoning.partial, false);

      // A call the artifact does not have: another request id, or other counts without one.
      await post(daemon, '/v1/logs', otlp([{ sessionId: 'both', timestamp: call, requestId: 'req_other' }, { sessionId: 'both', timestamp: call, output: 1 }]));
      const unmatched = await totals(daemon, root);
      assert.equal(unmatched.records, 4);
      assert.equal(unmatched.output.tokens, 3 * 137 + 1);
    });
  });

  it('matches by model, tokens and time when only one side has a request id, and not beyond a few seconds', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject();
      const call = minutesAgo(30);
      // The artifact's call has no request id; the event has one.
      artifact(artifacts, root, 'partial', lines(call, '-plain', '').map(({ requestId: _id, ...line }) => line as Line));
      await register(daemon, root);
      await post(daemon, '/v1/logs', otlp([{ sessionId: 'partial', timestamp: call, requestId: 'req_plain' }]));
      assert.equal((await totals(daemon, root)).records, 1);

      await post(daemon, '/v1/logs', otlp([{ sessionId: 'partial', timestamp: new Date(Date.parse(call) + 10_000).toISOString() }]));
      assert.equal((await totals(daemon, root)).records, 2);
    });
  });

  it('keeps an event whose session has no artifact yet in no project, and attributes it once the artifact arrives', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject();
      await register(daemon, root);
      await post(daemon, '/v1/logs', otlp([{ sessionId: 'early', timestamp: minutesAgo(2), requestId: 'req_early' }]));

      assert.equal((await totals(daemon, root)).records, 0);
      assert.equal(stored(daemon).length, 0);
      assert.equal(stored(daemon, 'unattributed_record').length, 1);

      artifact(artifacts, root, 'early', lines(minutesAgo(5), '-before', 'req_before'));
      const joined = await totals(daemon, root);
      assert.equal(joined.records, 2);
      assert.deepEqual(
        stored(daemon).map((row) => [row.source, row.cwd, row.project_path]),
        [
          ['artifact', root, root],
          ['opentelemetry', root, root],
        ],
      );
      assert.equal(stored(daemon, 'unattributed_record').length, 0);
    });
  });

  it('shows a session as running from its event, and Claude Code at level 4 while its events arrive', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject();
      artifact(artifacts, root, 'resumed', lines(minutesAgo(60 * 24), '-yesterday', 'req_yesterday'));
      await register(daemon, root);
      const before = await snapshot(daemon, root);
      assert.deepEqual(before.activity.running.items, []);
      assert.equal(before.activity.recent.length, 1);
      assert.deepEqual(before.usage.harnesses[0], { harness: 'claude-code', level: 3, reason: null });

      await post(daemon, '/v1/logs', otlp([{ sessionId: 'resumed', timestamp: minutesAgo(0), requestId: 'req_now' }]));
      const after = await snapshot(daemon, root);
      assert.deepEqual(
        after.activity.running.items.map((run) => [run.id, run.harness, run.active.value, run.totals.records]),
        [[before.activity.recent[0]!.id, 'claude-code', true, 2]],
      );
      assert.deepEqual(after.usage.harnesses[0], { harness: 'claude-code', level: 4, reason: null });
    });
  });

  it('keeps the records of a store written before records had a source, as artifact records, and counts an event beside them', async () => {
    const home = temporary('binnacle-otel-home-');
    const root = makeProject();
    const db = new DatabaseSync(storePath(home));
    db.exec(`create table ingested_record (id integer primary key autoincrement, harness text not null, natural_key text not null,
      project_path text not null, session_id text not null, subagent_id text, parent_session text, source_ref text not null,
      timestamp text not null, cwd text not null, branch text, branch_source text, provider text, model text, input integer,
      cached_input integer, cache_creation integer, output integer, reasoning integer, provenance text not null,
      ingested_at text not null, unique (harness, natural_key))`);
    db.prepare(`insert into ingested_record (harness, natural_key, project_path, session_id, source_ref, timestamp, cwd, model, input, output, provenance, ingested_at)
      values ('claude-code', 'msg_old', ?, 'old', 'file', ?, ?, ?, 2, 137, 'provider_reported', ?)`).run(root, minutesAgo(60), root, CALL.model, minutesAgo(60));
    db.close();

    const artifacts = temporary('binnacle-otel-projects-');
    const daemon = await startTestDaemon({ home, artifacts: { claudeCode: artifacts, codex: join(home, 'no-codex') } });
    try {
      await register(daemon, root);
      await post(daemon, '/v1/logs', otlp([{ sessionId: 'old', timestamp: minutesAgo(1), requestId: 'req_new' }]));
      assert.deepEqual(
        stored(daemon).map((row) => [row.natural_key, row.source, row.request_id]),
        [
          ['msg_old', 'artifact', null],
          ['otel:req_new', 'opentelemetry', 'req_new'],
        ],
      );
      assert.equal((await totals(daemon, root)).records, 2);
    } finally {
      await daemon.stop();
    }
  });

  it('answers metrics and traces and stores nothing of them, ignores other events, and refuses another encoding with 415', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject();
      artifact(artifacts, root, 'other', lines(minutesAgo(60), '-only', 'req_only'));
      await register(daemon, root);

      for (const path of ['/v1/metrics', '/v1/traces']) assert.deepEqual(await post(daemon, path, { resourceMetrics: [], resourceSpans: [] }), { status: 200, body: {} });
      assert.equal((await post(daemon, '/v1/logs', otlp([{ sessionId: 'other', timestamp: minutesAgo(1) }], 'claude_code.user_prompt'))).status, 200);
      assert.equal((await post(daemon, '/v1/logs', otlp([{ sessionId: 'other', timestamp: minutesAgo(1) }]), { 'content-type': 'application/json; charset=utf-8' })).status, 200);
      assert.equal((await totals(daemon, root)).records, 2);

      const protobuf = await post(daemon, '/v1/logs', 'binary', { 'content-type': 'application/x-protobuf' });
      assert.equal(protobuf.status, 415);
      assert.equal((protobuf.body as { error: { code: string } }).error.code, 'request.unsupported_media_type');
      assert.equal((await post(daemon, '/v1/logs', otlp([]), { 'content-type': 'application/json', 'content-encoding': 'gzip' })).status, 415);
      assert.equal((await post(daemon, '/v1/logs', '{not json', { 'content-type': 'application/json' })).status, 400);
      assert.equal((await fetch(daemon.url('/v1/logs'))).status, 405);
      assert.equal((await post(daemon, '/v1/logs', otlp([]), { 'content-type': 'application/json', origin: 'http://evil.example' })).status, 403);
      assert.equal((await totals(daemon, root)).records, 2);
    });
  });
});
