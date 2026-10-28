import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout } from 'node:timers/promises';
import { after, describe, it } from 'node:test';
import { wordMessage, type Params } from '@binnacle/core';
import { storePath } from '../src/home.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * Context pressure, through the daemon's HTTP API: each run's session's latest context and
 * compactions, and the `context.pressure` attention item an active Product session raises.
 * Claude Code's sessions are built from `fixtures/claude-code/grill-on-main.jsonl`, one call
 * that read 2 + 39,225 + 29,831 tokens of context; Codex's and Gemini CLI's are written here.
 */
type Line = Record<string, unknown> & { type: string; message?: Record<string, unknown> };
type Attention = { code: string; message: string; params: Params }[];
type Pressure = { context: { tokens: number; provenance: string } | null; compactions: { count: number; latest: { at: string; trigger: string | null; provenance: string } | null } } | null;
type Totals = { records: number; output: { tokens: number | null } };
type Run = { id: string; role: string; harness: string; taskId: string | null; contextPressure: Pressure; totals: Totals };
type Own = { taskId: string | null; taskTitle: string | null; role: string; totals: Totals } | null;
type Snapshot = { attention: Attention; activity: { running: { items: Run[] }; recent: Run[]; own?: Own } };

const GRILL = readFileSync(join(import.meta.dirname, 'fixtures', 'claude-code', 'grill-on-main.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as Line);
const GRILL_CONTEXT = 2 + 39225 + 29831;
const MODEL = 'claude-opus-5-5';
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

const threshold = (tokens: number): string => `\ntelemetry:\n  context_pressure:\n    tokens: ${tokens}\n`;

/** A project with the local tracker and one ticket, whose repository's `HEAD` has been on `main` since yesterday. */
function makeProject(manifest = ''): string {
  const root = temporary('binnacle-pressure-');
  mkdirSync(join(root, '.binnacle'), { recursive: true });
  writeFileSync(join(root, '.binnacle', 'project.yaml'), `version: 1\n\nproject:\n  id: pressure-project\n\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n${manifest}`);
  mkdirSync(join(root, 'docs', 'specs', 'epic', 'issues'), { recursive: true });
  writeFileSync(join(root, 'docs', 'specs', 'epic', 'issues', '01-first.md'), '# 01: First\n\nStatus: READY\n');
  gitAt(minutesAgo(24 * 60), root, 'init', '--quiet', '--initial-branch=main');
  gitAt(minutesAgo(24 * 60), root, 'add', '.');
  gitAt(minutesAgo(24 * 60), root, 'commit', '--quiet', '-m', 'initial');
  return root;
}

function gitAt(timestamp: string, cwd: string, ...args: string[]): void {
  const date = `@${Math.floor(Date.parse(timestamp) / 1000)} +0000`;
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    stdio: 'ignore',
    env: { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date },
  });
}

const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

/** The fixture's call at `timestamp`, as a message of its own. */
const call = (timestamp: string, id: string): Line[] =>
  GRILL.map((line) => ({ ...line, timestamp, ...(line.message && line.type === 'assistant' ? { message: { ...line.message, id: `${String(line.message.id)}-${id}` } } : {}) }));

/** A compaction boundary as Claude Code writes one, its metadata cut short. */
const boundary = (timestamp: string, uuid: string, trigger: string): Line => ({
  type: 'system',
  subtype: 'compact_boundary',
  content: CONTENT,
  isSidechain: false,
  uuid,
  timestamp,
  compactMetadata: { trigger, preTokens: 996850, postTokens: 23587 },
});

const claudeLines = (cwd: string, sessionId: string, lines: Line[]): string => lines.map((line) => `${JSON.stringify({ ...line, cwd, sessionId })}\n`).join('');

/** Writes a Claude Code session launched in `cwd`, and returns its file. */
function claudeSession(artifacts: string, cwd: string, sessionId: string, lines: Line[]): string {
  const dir = join(artifacts, cwd.replace(/[^a-zA-Z0-9]/g, '-'));
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${sessionId}.jsonl`);
  writeFileSync(file, claudeLines(cwd, sessionId, lines));
  return file;
}

async function withDaemon(body: (daemon: TestDaemon, roots: { claudeCode: string; codex: string; geminiCli: string }) => Promise<void>): Promise<void> {
  const artifacts = { claudeCode: temporary('binnacle-claude-'), codex: temporary('binnacle-codex-'), geminiCli: temporary('binnacle-gemini-') };
  const daemon = await startTestDaemon({ artifacts });
  try {
    await body(daemon, artifacts);
  } finally {
    await daemon.stop();
  }
}

/** The snapshot, asked for by the harness session `session` when one is given, as the MCP server and `binn call` ask in Claude Code. */
async function snapshot(daemon: TestDaemon, root: string, session?: string): Promise<Snapshot> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
  const result = await daemon.call<Snapshot>('project.snapshot', { path: root, ...(session && { session }) });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

const pressure = (attention: Attention): Attention => attention.filter((item) => item.code === 'context.pressure');

/** A time as the message gives it, in this process's local time, which is the test daemon's: `15:30`. */
function clock(iso: string): string {
  const at = new Date(iso);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

/** A local date, as the message puts it before a start on another day than the latest activity. */
function day(iso: string): string {
  const at = new Date(iso);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

/** A session's start and latest activity, as the message names them. */
const times = (startedAt: string, lastActivityAt: string): string =>
  `started at ${day(startedAt) === day(lastActivityAt) ? '' : `${day(startedAt)} `}${clock(startedAt)}, latest activity ${clock(lastActivityAt)}`;
const SUGGESTION = 'Run /binnacle:checkpoint, then go on in a fresh session.';

describe('Context pressure', () => {
  it('raises context.pressure for an active Product session whose latest call reads at least the manifest’s threshold, and for no other', async () => {
    await withDaemon(async (daemon, { claudeCode }) => {
      const root = makeProject(threshold(60000));
      gitAt(minutesAgo(9), root, 'switch', '--quiet', '-c', 'feat/first');
      gitAt(minutesAgo(5), root, 'switch', '--quiet', 'main');
      const startedAt = minutesAgo(4);
      const lastActivityAt = minutesAgo(1);
      claudeSession(claudeCode, root, 'product', [...call(startedAt, 'started'), ...call(lastActivityAt, 'product')]);
      // Product work, but no longer active.
      claudeSession(claudeCode, root, 'idle', call(minutesAgo(11), 'idle'));
      // Active, and over the threshold, but the Task's.
      claudeSession(claudeCode, root, 'ticket', call(minutesAgo(7), 'ticket'));

      const body = await snapshot(daemon, root);
      const params = { session: 'product', harness: 'Claude Code', startedAt, lastActivityAt, tokens: GRILL_CONTEXT, threshold: 60000, thresholdSource: 'manifest', model: MODEL };
      const why = `in Claude Code, ${times(startedAt, lastActivityAt)}, read ${GRILL_CONTEXT} tokens of context in its latest call, at least telemetry.context_pressure.tokens, 60000. ${SUGGESTION}`;
      // Asked with no session of its own, it is neither this one nor another.
      assert.deepEqual(pressure(body.attention), [{ code: 'context.pressure', message: `The Product session ${why}`, params }]);
      const [running] = body.activity.running.items;
      assert.equal(running?.id, 'claude-code:msg_011CfLMEGjvuTXtzfiK6XfsV-started');
      // Binnacle's sum of the counts Claude Code reports.
      assert.deepEqual(running.contextPressure, { context: { tokens: GRILL_CONTEXT, provenance: 'calculated' }, compactions: { count: 0, latest: null } });

      // Asked by the session itself, then by another; the session's UUID never in the message.
      assert.deepEqual(pressure((await snapshot(daemon, root, 'product')).attention), [{ code: 'context.pressure', message: `This Product session ${why}`, params: { ...params, own: true } }]);
      assert.deepEqual(pressure((await snapshot(daemon, root, 'another')).attention), [{ code: 'context.pressure', message: `Another Product session ${why}`, params: { ...params, own: false } }]);
    });
  });

  it('names the session by its earliest run’s start, not its latest run’s', async () => {
    await withDaemon(async (daemon, { claudeCode }) => {
      const root = makeProject(threshold(60000));
      gitAt(minutesAgo(9), root, 'switch', '--quiet', '-c', 'feat/first');
      gitAt(minutesAgo(5), root, 'switch', '--quiet', 'main');
      // One session: a run on the Task's branch, then the Product run on `main`.
      const [startedAt, lastActivityAt] = [minutesAgo(8), minutesAgo(1)];
      claudeSession(claudeCode, root, 'long', [...call(startedAt, 'ticket'), ...call(minutesAgo(4), 'product'), ...call(lastActivityAt, 'latest')]);

      const body = await snapshot(daemon, root);
      assert.equal(body.activity.running.items.length + body.activity.recent.length, 2);
      assert.deepEqual(pressure(body.attention), [
        {
          code: 'context.pressure',
          message: `The Product session in Claude Code, ${times(startedAt, lastActivityAt)}, read ${GRILL_CONTEXT} tokens of context in its latest call, at least telemetry.context_pressure.tokens, 60000. ${SUGGESTION}`,
          params: { session: 'long', harness: 'Claude Code', startedAt, lastActivityAt, tokens: GRILL_CONTEXT, threshold: 60000, thresholdSource: 'manifest', model: MODEL },
        },
      ]);
    });
  });

  it('gives the asking session its latest run’s Task, title and role, with its tokens summed over its runs, and null for a session never stored', async () => {
    await withDaemon(async (daemon, { claudeCode }) => {
      const root = makeProject();
      gitAt(minutesAgo(9), root, 'switch', '--quiet', '-c', 'feat/first');
      gitAt(minutesAgo(5), root, 'switch', '--quiet', 'main');
      gitAt(minutesAgo(3), root, 'switch', '--quiet', 'feat/first');
      // One session: on the Task's branch, then a Product run on `main`, then back on the Task, where a subagent works too.
      claudeSession(claudeCode, root, 'mine', [...call(minutesAgo(8), 'ticket'), ...call(minutesAgo(4), 'product'), ...call(minutesAgo(2), 'back')]);
      const subagents = join(claudeCode, root.replace(/[^a-zA-Z0-9]/g, '-'), 'mine', 'subagents');
      mkdirSync(subagents, { recursive: true });
      writeFileSync(join(subagents, 'agent-a1.meta.json'), JSON.stringify({ agentType: 'general-purpose' }));
      writeFileSync(join(subagents, 'agent-a1.jsonl'), claudeLines(root, 'mine', call(minutesAgo(1), 'subagent').map((line) => ({ ...line, isSidechain: true, agentId: 'a1' }))));
      // Another session, whose latest run is the Product run on `main`.
      claudeSession(claudeCode, root, 'other', [...call(minutesAgo(7), 'other-ticket'), ...call(minutesAgo(4), 'other-product')]);

      const body = await snapshot(daemon, root, 'mine');
      const runs = [...body.activity.running.items, ...body.activity.recent];
      assert.ok(runs.some((run) => run.id.endsWith('-subagent')), 'the subagent is a run of its own');
      const mine = runs.filter((run) => ['-ticket', '-product', '-back'].some((end) => run.id.endsWith(end)) && !run.id.includes('other'));
      assert.equal(mine.length, 3);
      const own = body.activity.own;
      assert.ok(own);
      assert.deepEqual([own.taskId, own.taskTitle, own.role], ['epic/01', 'First', 'implementation']);
      // Summed over the session's own runs, the subagent's left out.
      assert.equal(own.totals.records, mine.reduce((total, run) => total + run.totals.records, 0));
      assert.equal(own.totals.output.tokens, mine.reduce((total, run) => total + run.totals.output.tokens!, 0));

      // The latest run, not the first nor any on a Task's branch.
      const other = (await snapshot(daemon, root, 'other')).activity.own;
      assert.deepEqual(other && [other.taskId, other.taskTitle, other.role], [null, null, 'product']);
      assert.equal((await snapshot(daemon, root, 'unknown')).activity.own, null);
      // Without a session of its own, `activity` has no `own` at all.
      assert.equal('own' in (await snapshot(daemon, root)).activity, false);
    });
  });

  it('dates the session’s start when it was another day than its latest activity, in English and in Russian', async () => {
    await withDaemon(async (daemon, { claudeCode }) => {
      const root = makeProject(threshold(60000));
      // Two days ago, before the repository's `HEAD` had a branch: a run of its own, still the session's.
      const [startedAt, lastActivityAt] = [minutesAgo(2 * 24 * 60), minutesAgo(1)];
      claudeSession(claudeCode, root, 'days', [...call(startedAt, 'first'), ...call(lastActivityAt, 'latest')]);

      const [item] = pressure((await snapshot(daemon, root)).attention);
      assert.ok(item);
      assert.equal(item.params.startedAt, startedAt);
      assert.match(item.message, new RegExp(`, started at ${day(startedAt)} ${clock(startedAt)}, latest activity ${clock(lastActivityAt)},`));
      assert.match(wordMessage('ru', item).text, new RegExp(`, начатая в ${day(startedAt)} ${clock(startedAt)}, последняя активность в ${clock(lastActivityAt)},`));
    });
  });

  it('reads 150 000 tokens as the threshold when the manifest states none', async () => {
    await withDaemon(async (daemon, { claudeCode }) => {
      const below = makeProject();
      claudeSession(claudeCode, below, 'below', call(minutesAgo(1), 'below'));
      assert.deepEqual(pressure((await snapshot(daemon, below)).attention), []);

      const over = makeProject();
      const heavy = call(minutesAgo(1), 'over').map((line) =>
        line.type === 'assistant' ? { ...line, message: { ...line.message, usage: { input_tokens: 2, cache_read_input_tokens: 150000, cache_creation_input_tokens: 0, output_tokens: 1 } } } : line,
      );
      claudeSession(claudeCode, over, 'over', heavy);
      const [item] = pressure((await snapshot(daemon, over)).attention);
      assert.match(item?.message ?? '', /read 150002 tokens of context in its latest call, at least the default threshold, 150000\./);
      assert.deepEqual([item?.params.threshold, item?.params.thresholdSource, item?.params.model], [150000, 'default', MODEL]);
    });
  });

  it('raises it for a Claude Code compaction after the last recorded checkpoint, naming its trigger, and not for one before it', async () => {
    await withDaemon(async (daemon, { claudeCode }) => {
      const root = makeProject();
      const compactedAt = minutesAgo(5);
      const [startedAt, lastActivityAt] = [minutesAgo(6), minutesAgo(1)];
      const file = claudeSession(claudeCode, root, 'compacted', [...call(startedAt, 'before'), boundary(compactedAt, 'b9151d72-35ae-462a-bf26-5ccb7807569f', 'auto'), ...call(lastActivityAt, 'after')]);

      // No checkpoint was ever recorded, so every compaction is after it.
      const first = await snapshot(daemon, root);
      assert.deepEqual(pressure(first.attention), [
        {
          code: 'context.pressure',
          message: `The Product session in Claude Code, ${times(startedAt, lastActivityAt)}, read ${GRILL_CONTEXT} tokens of context in its latest call, and compacted (auto) at ${compactedAt}, and no checkpoint has been recorded. ${SUGGESTION}`,
          params: { session: 'compacted', harness: 'Claude Code', startedAt, lastActivityAt, tokens: GRILL_CONTEXT, at: compactedAt, trigger: 'auto' },
        },
      ]);
      assert.deepEqual(first.activity.running.items[0]?.contextPressure?.compactions, { count: 1, latest: { at: compactedAt, trigger: 'auto', provenance: 'provider_reported' } });

      assert.equal((await daemon.call('checkpoint.record', { path: root, promoted: [] })).status, 200);
      assert.deepEqual(pressure((await snapshot(daemon, root)).attention), []);

      const checkpoint = (await daemon.call<{ events: { type: string; occurredAt: string }[] }>('event.list', { path: root })).body.events.find((event) => event.type === 'checkpoint')!;
      await setTimeout(5);
      const again = new Date().toISOString();
      const latest = new Date().toISOString();
      appendFileSync(file, claudeLines(root, 'compacted', [boundary(again, 'c0151d72-35ae-462a-bf26-5ccb7807569f', 'manual'), ...call(latest, 'again')]));
      assert.deepEqual(pressure((await snapshot(daemon, root)).attention), [
        {
          code: 'context.pressure',
          message: `The Product session in Claude Code, ${times(startedAt, latest)}, read ${GRILL_CONTEXT} tokens of context in its latest call, and compacted (manual) at ${again}, after the last checkpoint at ${checkpoint.occurredAt}. ${SUGGESTION}`,
          params: { session: 'compacted', harness: 'Claude Code', startedAt, lastActivityAt: latest, tokens: GRILL_CONTEXT, at: again, trigger: 'manual', checkpoint: checkpoint.occurredAt },
        },
      ]);
    });
  });

  it('raises it for a Codex rotation of its context window after the last checkpoint, with no trigger', async () => {
    await withDaemon(async (daemon, { codex }) => {
      const root = makeProject();
      const rotatedAt = minutesAgo(3);
      const [startedAt, lastActivityAt] = [minutesAgo(9), minutesAgo(1)];
      const counts = (ordinal: number, timestamp: string, input: number): Record<string, unknown> => ({
        timestamp,
        ordinal,
        type: 'event_msg',
        payload: { type: 'token_count', info: { total_token_usage: { input_tokens: input, cached_input_tokens: 0, output_tokens: 10, reasoning_output_tokens: 0 } } },
      });
      const rollout = [
        { timestamp: minutesAgo(10), ordinal: 0, type: 'session_meta', payload: { id: 'rotated', cwd: root, model_provider: 'openai', context_window: { window_id: 'window-1' } } },
        { timestamp: minutesAgo(10), ordinal: 1, type: 'turn_context', payload: { model: 'gpt-5.6-sol', cwd: root } },
        counts(2, startedAt, 1000),
        { timestamp: rotatedAt, ordinal: 3, type: 'compacted', payload: { message: CONTENT, window_id: 'window-2' } },
        counts(4, lastActivityAt, 1500),
      ];
      mkdirSync(join(codex, '2026', '10', '07'), { recursive: true });
      writeFileSync(join(codex, '2026', '10', '07', 'rollout-2026-10-07T09-00-00-rotated.jsonl'), rollout.map((line) => `${JSON.stringify(line)}\n`).join(''));

      const body = await snapshot(daemon, root);
      assert.deepEqual(pressure(body.attention), [
        {
          code: 'context.pressure',
          message: `The Product session in Codex, ${times(startedAt, lastActivityAt)}, read 500 tokens of context in its latest call, and compacted (trigger not reported) at ${rotatedAt}, and no checkpoint has been recorded. ${SUGGESTION}`,
          params: { session: 'rotated', harness: 'Codex', startedAt, lastActivityAt, tokens: 500, at: rotatedAt },
        },
      ]);
      // The latest call's input, the difference of the running totals, is Binnacle's calculation.
      assert.deepEqual(body.activity.running.items[0]?.contextPressure, {
        context: { tokens: 500, provenance: 'calculated' },
        compactions: { count: 1, latest: { at: rotatedAt, trigger: null, provenance: 'calculated' } },
      });
    });
  });

  it('raises nothing, and shows no pressure, for a harness that reveals neither a context nor a compaction', async () => {
    await withDaemon(async (daemon, { geminiCli }) => {
      const root = makeProject(threshold(1));
      const chats = join(geminiCli, 'project', 'chats');
      mkdirSync(chats, { recursive: true });
      writeFileSync(join(geminiCli, 'project', '.project_root'), root);
      const lines = [
        { sessionId: 'silent', startTime: minutesAgo(2), kind: 'main' },
        { id: 'e9f8a7b6-c5d4-4e3f-a2b1-c0d9e8f7a6b5', timestamp: minutesAgo(1), type: 'gemini', content: CONTENT, tokens: null, model: 'gemini-2.5-pro' },
      ];
      writeFileSync(join(chats, 'session-2026-10-07T09-00-silent.jsonl'), lines.map((line) => `${JSON.stringify(line)}\n`).join(''));

      const body = await snapshot(daemon, root);
      assert.equal(body.activity.running.items[0]?.harness, 'gemini-cli');
      assert.equal(body.activity.running.items[0]?.contextPressure, null);
      assert.deepEqual(pressure(body.attention), []);
    });
  });

  it('reads the compactions a store from before them was read past, once, and counts no record twice', async () => {
    const home = temporary('binnacle-pressure-home-');
    const claudeCode = temporary('binnacle-claude-');
    const root = makeProject();
    const compactedAt = minutesAgo(5);
    claudeSession(claudeCode, root, 'upgraded', [...call(minutesAgo(6), 'before'), boundary(compactedAt, 'f0151d72-35ae-462a-bf26-5ccb7807569f', 'auto'), ...call(minutesAgo(1), 'after')]);
    const first = await startTestDaemon({ home, artifacts: { claudeCode } });
    try {
      await snapshot(first, root);
    } finally {
      await first.stop();
    }
    // The store as a Binnacle without markers left it: the file read to its end, and no compaction kept.
    const db = new DatabaseSync(storePath(home));
    db.exec('drop table compaction');
    db.close();

    const second = await startTestDaemon({ home, artifacts: { claudeCode } });
    try {
      const body = await snapshot(second, root);
      assert.deepEqual(body.activity.running.items[0]?.contextPressure?.compactions, { count: 1, latest: { at: compactedAt, trigger: 'auto', provenance: 'provider_reported' } });
      const records = (await second.call<{ totals: { records: number } }>('usage.get', { path: root })).body.totals.records;
      assert.equal(records, 2);
    } finally {
      await second.stop();
    }
  });

  it('refuses a threshold that is not a positive number of tokens', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject(threshold(0));
      const result = await daemon.call<{ error: { code: string; details: { path: string }[] } }>('project.register', { path: root });
      assert.equal(result.body.error.code, 'manifest.invalid');
      assert.deepEqual(result.body.error.details.map((detail) => detail.path), ['telemetry.context_pressure.tokens']);
    });
  });
});

/** The fixture's call at `timestamp`, as a message of its own, by `model`. */
const callBy = (model: string, timestamp: string, id: string): Line[] =>
  call(timestamp, id).map((line) => (line.type === 'assistant' && line.message ? { ...line, message: { ...line.message, model } } : line));

const writeSettings = (daemon: TestDaemon, settings: unknown): void => writeFileSync(join(daemon.home, 'settings.json'), JSON.stringify(settings), { mode: 0o600 });

/** The one active Product session's threshold, with its source and model, or null when it raises nothing. */
async function warnedAt(daemon: TestDaemon, root: string): Promise<[unknown, unknown, unknown] | null> {
  const [item, ...rest] = pressure((await snapshot(daemon, root)).attention);
  assert.equal(rest.length, 0);
  return item === undefined ? null : [item.params.threshold, item.params.thresholdSource, item.params.model];
}

describe('Context-pressure thresholds per model (ADR-0046)', () => {
  it('warns a session at its model’s own number, another model at the machine’s default, and a manifest’s number wins over both', async () => {
    await withDaemon(async (daemon, { claudeCode }) => {
      const mine = makeProject();
      claudeSession(claudeCode, mine, 'mine', call(minutesAgo(1), 'mine'));
      const other = makeProject();
      claudeSession(claudeCode, other, 'other', callBy('other-model', minutesAgo(1), 'other'));

      // The machine's default, below the session's context, and the model's own number above it.
      writeSettings(daemon, { contextPressure: { tokens: 60000, models: { [MODEL]: 100000 } } });
      assert.equal(await warnedAt(daemon, mine), null);
      assert.deepEqual(await warnedAt(daemon, other), [60000, 'machine', 'other-model']);

      writeSettings(daemon, { contextPressure: { tokens: 100000, models: { [MODEL]: 65000 } } });
      const [item] = pressure((await snapshot(daemon, mine)).attention);
      assert.deepEqual([item?.params.threshold, item?.params.thresholdSource, item?.params.model], [65000, 'model', MODEL]);
      assert.match(item?.message ?? '', new RegExp(`read ${GRILL_CONTEXT} tokens of context in its latest call, at least the threshold for ${MODEL} on this machine, 65000\\.`));
      assert.match(wordMessage('ru', item!).text, new RegExp(`не меньше порога в 65000 токенов для ${MODEL} на этой машине\\.`));
      assert.equal(await warnedAt(daemon, other), null);

      // Only models, the default unset: 150 000.
      writeSettings(daemon, { contextPressure: { models: { [MODEL]: 200000 } } });
      assert.equal(await warnedAt(daemon, other), null);

      // A manifest's number, for every model.
      const own = makeProject(threshold(60000));
      claudeSession(claudeCode, own, 'own', call(minutesAgo(1), 'own'));
      assert.deepEqual(await warnedAt(daemon, own), [60000, 'manifest', MODEL]);
      const high = makeProject(threshold(200000));
      claudeSession(claudeCode, high, 'high', call(minutesAgo(1), 'high'));
      writeSettings(daemon, { contextPressure: { tokens: 1000, models: { [MODEL]: 1000 } } });
      assert.equal(await warnedAt(daemon, high), null);
    });
  });

  it('gives context_pressure.invalid for a value it cannot use, or a file it cannot read, and warns at 150 000', async () => {
    await withDaemon(async (daemon, { claudeCode }) => {
      const root = makeProject();
      claudeSession(claudeCode, root, 'mine', call(minutesAgo(1), 'mine'));
      const codes = async (own = root): Promise<string[]> =>
        (await snapshot(daemon, own)).attention.map((item) => item.code).filter((code) => code.startsWith('context') || code.startsWith('parallel'));
      for (const bad of [60000, { tokens: 999 }, { tokens: 60000, models: { [MODEL]: 999 } }, { tokens: 60000, models: [] }, { tokens: 150000.5 }, { models: { '': 60000 } }]) {
        writeSettings(daemon, { contextPressure: bad, parallelLimit: 3 });
        assert.deepEqual(await codes(), ['context_pressure.invalid'], JSON.stringify(bad));
      }
      const [item] = (await snapshot(daemon, root)).attention.filter((entry) => entry.code === 'context_pressure.invalid');
      assert.match(item?.message ?? '', /contextPressure in .*settings\.json is not, so the context-pressure threshold is 150000\./);
      assert.equal(wordMessage('ru', item!).english, false);

      writeFileSync(join(daemon.home, 'settings.json'), '{ "contextPressure": ');
      assert.deepEqual((await codes()).sort(), ['context_pressure.invalid', 'parallel_limit.invalid']);

      // The fallback warns at 150 000, as with no setting.
      const over = makeProject();
      const heavy = call(minutesAgo(1), 'heavy').map((line) =>
        line.type === 'assistant' ? { ...line, message: { ...line.message, usage: { input_tokens: 2, cache_read_input_tokens: 150000, cache_creation_input_tokens: 0, output_tokens: 1 } } } : line,
      );
      claudeSession(claudeCode, over, 'heavy', heavy);
      writeSettings(daemon, { contextPressure: { tokens: 'many' } });
      assert.deepEqual(await warnedAt(daemon, over), [150000, 'default', MODEL]);

      // A manifest's number is read without the machine's settings, so they raise nothing there.
      const own = makeProject(threshold(60000));
      claudeSession(claudeCode, own, 'own', call(minutesAgo(1), 'own'));
      assert.deepEqual(await codes(own), ['context.pressure']);
    });
  });
});

type Thresholds = { tokens: number; models: Record<string, number>; source: 'machine' | 'default' };
type Informed = Thresholds & { recentModels: string[]; overrides: { path: string; name: string; tokens: number }[] };
type Failure = { error: { code: string; message: string; params?: Params } };

describe('Context-pressure thresholds through the daemon', () => {
  const file = (daemon: TestDaemon): string => join(daemon.home, 'settings.json');

  it('gives the default, 150 000, with no numbers per model, when nothing is set', async () => {
    await withDaemon(async (daemon) => {
      const result = await daemon.call<Informed>('context_pressure.get');
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.deepEqual(result.body, { tokens: 150000, models: {}, source: 'default', recentModels: [], overrides: [] });
    });
  });

  it('writes the default and the numbers per model, keeping every other key of the file, the Parallel limit included, owner-only', async () => {
    await withDaemon(async (daemon) => {
      writeSettings(daemon, { obsidian: { vaultPath: '/vault' }, parallelLimit: 3, other: 1 });
      const set = await daemon.call<Thresholds>('context_pressure.set', { tokens: 200000, models: { [MODEL]: 400000, 'gpt-5.6-sol': 120000 } });
      assert.equal(set.status, 200, JSON.stringify(set.body));
      assert.deepEqual(set.body, { tokens: 200000, models: { [MODEL]: 400000, 'gpt-5.6-sol': 120000 }, source: 'machine' });
      const written = JSON.parse(readFileSync(file(daemon), 'utf8'));
      assert.deepEqual(written, { obsidian: { vaultPath: '/vault' }, parallelLimit: 3, other: 1, contextPressure: { tokens: 200000, models: { [MODEL]: 400000, 'gpt-5.6-sol': 120000 } } });
      assert.equal(statSync(file(daemon)).mode & 0o777, 0o600);
      assert.equal((await daemon.call<{ limit: number }>('parallel.get')).body.limit, 3);

      // A name that would be a prototype's is kept as a name, and is read back as one.
      const named = JSON.parse('{ "tokens": 150000, "models": { "__proto__": 90000 } }') as object;
      assert.equal((await daemon.call('context_pressure.set', named)).status, 200);
      const read = (await daemon.call<Informed>('context_pressure.get')).body;
      assert.ok(Object.hasOwn(read.models, '__proto__'));
      assert.deepEqual([read.tokens, read.source], [150000, 'machine']);
    });
  });

  it('refuses a value that is not one, naming the rule and what breaks it, writing nothing', async () => {
    await withDaemon(async (daemon) => {
      writeSettings(daemon, { parallelLimit: 3, contextPressure: { tokens: 200000, models: {} } });
      const before = readFileSync(file(daemon), 'utf8');
      const refused: [object, RegExp][] = [
        [{}, /nothing, given for tokens, is not\./],
        [{ tokens: 200000 }, /nothing, given for models, is not\./],
        [{ tokens: 999, models: {} }, /999, given for tokens, is not\./],
        [{ tokens: 1500.5, models: {} }, /1500\.5, given for tokens, is not\./],
        [{ tokens: '200000', models: {} }, /a string, given for tokens, is not\./],
        [{ tokens: 200000, models: [] }, /a list, given for models, is not\./],
        [{ tokens: 200000, models: { [MODEL]: 0 } }, /0, given for a model's number, is not\./],
        [{ tokens: 200000, models: { [MODEL]: null } }, /null, given for a model's number, is not\./],
        [{ tokens: 200000, models: { ' ': 5000 } }, /a model name is blank or longer than 200 characters\./],
        [{ tokens: 200000, models: { ['m'.repeat(201)]: 5000 } }, /a model name is blank or longer than 200 characters\./],
      ];
      for (const [body, why] of refused) {
        const result = await daemon.call<Failure>('context_pressure.set', body);
        assert.equal(result.status, 400, JSON.stringify(body));
        assert.equal(result.body.error.code, 'context_pressure.invalid');
        assert.match(result.body.error.message, /each a whole number of at least 1000; /);
        assert.match(result.body.error.message, why);
        assert.equal(wordMessage('ru', result.body.error).english, false, JSON.stringify(body));
      }
      assert.equal(readFileSync(file(daemon), 'utf8'), before);
    });
  });

  it('refuses to rewrite a settings file it cannot read as a JSON object, leaving it as it is', async () => {
    await withDaemon(async (daemon) => {
      for (const text of ['{ "parallelLimit": ', '[1, 2]']) {
        writeFileSync(file(daemon), text);
        const result = await daemon.call<Failure>('context_pressure.set', { tokens: 200000, models: {} });
        assert.equal(result.status, 409);
        assert.equal(result.body.error.code, 'settings.unreadable');
        assert.equal(readFileSync(file(daemon), 'utf8'), text);
      }
    });
  });

  it("needs the daemon's token, as every operation does", async () => {
    await withDaemon(async (daemon) => {
      for (const token of [null, 'not-the-token']) assert.equal((await daemon.call('context_pressure.set', { tokens: 200000, models: {} }, { token })).status, 401);
      assert.equal((await daemon.call('context_pressure.get', {}, { token: null })).status, 401);
    });
  });

  it('gives the models of the last seven days across registered projects, and the projects whose manifest overrides the thresholds', async () => {
    await withDaemon(async (daemon, { claudeCode }) => {
      const plain = makeProject();
      claudeSession(claudeCode, plain, 'recent', [...call(minutesAgo(2), 'recent'), ...callBy('other-model', minutesAgo(1), 'other')]);
      claudeSession(claudeCode, plain, 'old', callBy('old-model', minutesAgo(10 * 24 * 60), 'old'));
      const own = makeProject(threshold(250000));
      claudeSession(claudeCode, own, 'own', callBy('gpt-5.6-sol', minutesAgo(3), 'own'));
      // The snapshot registers each project and imports its sessions.
      await snapshot(daemon, plain);
      await snapshot(daemon, own);

      const body = (await daemon.call<Informed>('context_pressure.get')).body;
      assert.deepEqual(body.recentModels, [MODEL, 'gpt-5.6-sol', 'other-model']);
      assert.deepEqual(body.overrides, [{ path: own, name: 'pressure-project', tokens: 250000 }]);
    });
  });
});
