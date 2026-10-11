import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { storePath } from '../src/home.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * The informer beside the Parallel limit, through the daemon's HTTP API: over every registered
 * project, the most runs active at once and, for each usage limit Claude Code hit, how many runs
 * were active then. Claude Code's calls are `fixtures/claude-code/grill-on-main.jsonl`'s one call;
 * its usage limits are the synthetic records it writes with `"error":"rate_limit"`.
 */
type Line = Record<string, unknown> & { type: string; message?: Record<string, unknown> };
type Informer = {
  mostActive: { runs: number; at: string | null; provenance: string };
  usageLimits: { at: string; harness: string; limit: string | null; active: number; provenance: string }[];
  notReporting: string[];
};
type Totals = { records: number };

const GRILL = readFileSync(join(import.meta.dirname, 'fixtures', 'claude-code', 'grill-on-main.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as Line);
const CONTENT = 'MUST-NOT-BE-STORED';

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function temporary(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  roots.push(root);
  return root;
}

function makeProject(id: string): string {
  const root = temporary('binnacle-informer-');
  mkdirSync(join(root, '.binnacle'), { recursive: true });
  writeFileSync(join(root, '.binnacle', 'project.yaml'), `version: 1\n\nproject:\n  id: ${id}\n`);
  return root;
}

const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

/** The fixture's call at `timestamp`, as a message of its own. */
const call = (timestamp: string, id: string): Line[] =>
  GRILL.map((line) => ({ ...line, timestamp, ...(line.message && line.type === 'assistant' ? { message: { ...line.message, id: `${String(line.message.id)}-${id}` } } : {}) }));

/** A synthetic record as Claude Code writes one for an API error, here `error`, cut short. */
const synthetic = (timestamp: string, uuid: string, error: string): Line => ({
  type: 'assistant',
  uuid,
  isSidechain: false,
  timestamp,
  message: {
    id: `synthetic-${uuid}`,
    model: '<synthetic>',
    role: 'assistant',
    type: 'message',
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    content: [{ type: 'text', text: CONTENT }],
  },
  requestId: `req-${uuid}`,
  ...(error === 'rate_limit' ? { quotaLimits: { status: 'rejected', rateLimitType: 'five_hour' } } : {}),
  error,
  isApiErrorMessage: true,
  apiErrorStatus: error === 'rate_limit' ? 429 : 500,
});

/** Writes a Claude Code session launched in `cwd`. */
function claudeSession(artifacts: string, cwd: string, sessionId: string, lines: Line[]): void {
  const dir = join(artifacts, cwd.replace(/[^a-zA-Z0-9]/g, '-'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sessionId}.jsonl`), lines.map((line) => `${JSON.stringify({ ...line, cwd, sessionId })}\n`).join(''));
}

/** Writes a Gemini CLI session of `root` with one call at `timestamp`. */
function geminiSession(artifacts: string, root: string, timestamp: string): void {
  const chats = join(artifacts, 'project', 'chats');
  mkdirSync(chats, { recursive: true });
  writeFileSync(join(artifacts, 'project', '.project_root'), root);
  const lines = [
    { sessionId: 'gemini', startTime: timestamp, kind: 'main' },
    { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', timestamp, type: 'gemini', content: CONTENT, tokens: { input: 10, output: 5 }, model: 'gemini-2.5-pro' },
  ];
  writeFileSync(join(chats, 'session-gemini.jsonl'), lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
}

async function withDaemon(body: (daemon: TestDaemon, artifacts: { claudeCode: string; geminiCli: string }) => Promise<void>): Promise<void> {
  const artifacts = { claudeCode: temporary('binnacle-claude-'), geminiCli: temporary('binnacle-gemini-') };
  const daemon = await startTestDaemon({ artifacts });
  try {
    await body(daemon, artifacts);
  } finally {
    await daemon.stop();
  }
}

/** Registers `root` and takes its snapshot, which imports its sessions; its records of the last seven days. */
async function imported(daemon: TestDaemon, root: string): Promise<number> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
  const result = await daemon.call<{ usage: { last7Days: Totals } }>('project.snapshot', { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.usage.last7Days.records;
}

async function informer(daemon: TestDaemon): Promise<Informer> {
  const result = await daemon.call<{ informer: Informer }>('parallel.get');
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.informer;
}

describe('the usage-limit informer', () => {
  it('gives each usage limit Claude Code hit with the runs active then, and the most runs active at once, over every registered project', async () => {
    await withDaemon(async (daemon, { claudeCode }) => {
      const first = makeProject('informer-first');
      const second = makeProject('informer-second');
      // A run is active within ten minutes of its latest record.
      claudeSession(claudeCode, first, 'one', [...call(minutesAgo(60), 'one-a'), ...call(minutesAgo(52), 'one-b')]);
      claudeSession(claudeCode, second, 'two', [...call(minutesAgo(58), 'two-a'), ...call(minutesAgo(50), 'two-b'), synthetic(minutesAgo(49), 'limit-two', 'rate_limit')]);
      claudeSession(claudeCode, second, 'four', call(minutesAgo(61), 'four'));
      claudeSession(claudeCode, first, 'three', [...call(minutesAgo(30), 'three'), synthetic(minutesAgo(29), 'limit-three', 'rate_limit'), synthetic(minutesAgo(28), 'failed', 'server_error')]);
      // A session whose first prompt hit the limit, with no call before it: active then all the same.
      claudeSession(claudeCode, first, 'five', [synthetic(minutesAgo(15), 'limit-five', 'rate_limit')]);

      // The synthetic records give no record: three calls in the first project, three in the second.
      assert.equal(await imported(daemon, first), 3);
      assert.equal(await imported(daemon, second), 3);

      const body = await informer(daemon);
      // Fifty-eight minutes ago, `one`, `two` and `four` were all active.
      assert.deepEqual(body.mostActive, { runs: 3, at: minutesAgoOf(body.mostActive.at, 58), provenance: 'calculated' });
      assert.deepEqual(body.usageLimits, [
        { at: minutesAgoOf(body.usageLimits[0]?.at ?? null, 49), harness: 'claude-code', limit: 'five_hour', active: 2, provenance: 'calculated' },
        { at: minutesAgoOf(body.usageLimits[1]?.at ?? null, 29), harness: 'claude-code', limit: 'five_hour', active: 1, provenance: 'calculated' },
        { at: minutesAgoOf(body.usageLimits[2]?.at ?? null, 15), harness: 'claude-code', limit: 'five_hour', active: 1, provenance: 'calculated' },
      ]);
      assert.deepEqual(body.notReporting, []);

      // Only the usage limits are kept as markers, and nothing of their content.
      const db = new DatabaseSync(storePath(daemon.home), { readOnly: true });
      try {
        assert.equal(db.prepare('select count(*) as n from usage_limit').get()!.n, 3);
        assert.equal(db.prepare('select count(*) as n from compaction').get()!.n, 0);
        assert.doesNotMatch(JSON.stringify(db.prepare('select * from usage_limit').all()), new RegExp(CONTENT));
      } finally {
        db.close();
      }
    });
  });

  it('lists a harness that records no usage limit as not reporting it, and counts nothing for a machine with no runs', async () => {
    await withDaemon(async (daemon, { geminiCli }) => {
      assert.deepEqual(await informer(daemon), { mostActive: { runs: 0, at: null, provenance: 'calculated' }, usageLimits: [], notReporting: [] });
      const root = makeProject('informer-gemini');
      geminiSession(geminiCli, root, minutesAgo(5));
      assert.equal(await imported(daemon, root), 1);
      const body = await informer(daemon);
      assert.equal(body.mostActive.runs, 1);
      assert.deepEqual(body.usageLimits, []);
      assert.deepEqual(body.notReporting, ['gemini-cli']);
    });
  });
});

/** `at` when it lies within a second of `minutes` minutes ago, so that the test names the moment it means. */
function minutesAgoOf(at: string | null, minutes: number): string | null {
  assert.ok(at !== null && Math.abs(Date.parse(at) - Date.parse(minutesAgo(minutes))) < 5_000, `${at} is not ${minutes} minutes ago`);
  return at;
}
