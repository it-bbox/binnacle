import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { resolveArtifactRoots, storePath } from '../src/home.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * Claude Code usage in the Product Snapshot, through the daemon's HTTP API. The artifact
 * root is a temporary directory, and every session in it is built from the fixtures in
 * `fixtures/claude-code`, which are cut from real sessions of this repository: only the
 * working directory, the session id, the timestamps and, where a test needs more than one
 * message, the message id are changed.
 */
type FieldTotal = { tokens: number | null; partial: boolean; provenance: string | null };
type Totals = { records: number; input: FieldTotal; cachedInput: FieldTotal; cacheCreation: FieldTotal; output: FieldTotal; reasoning: FieldTotal };
type Unavailable = { available: false; reason: string };
type Usage = {
  importing: { incomplete: boolean; windowStart: string | null };
  today: Totals;
  last7Days: Totals;
  byModel: { items: { model: string | null; totals: Totals }[]; remainder: number };
  byProvider: { items: { provider: string | null; totals: Totals }[]; remainder: number };
  tasks: { items: { id: string; title: string | null; totals: Totals }[]; remainder: number } | Unavailable;
  unassigned: Totals | Unavailable;
  byRole: Record<Role, Totals> | Unavailable;
  harnesses: { harness: string; level: number | null; reason: string | null }[];
};
type Role = 'product' | 'implementation' | 'review' | 'rework' | 'unknown';
type Line = Record<string, unknown> & { type: string; message?: Record<string, unknown> };

const FIXTURES = join(import.meta.dirname, 'fixtures', 'claude-code');
const fixture = (name: string): Line[] =>
  readFileSync(join(FIXTURES, name), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Line);
/** A user prompt, then one message in three records, one per content block, then Claude Code's own `<synthetic>` error message. */
const GRILL = fixture('grill-on-main.jsonl');
/** One message in two records, whose usage has no `output_tokens_details`. */
const ABORTED = fixture('aborted-mid-stream.jsonl');

const MARKER = 'MUST-NOT-BE-STORED';

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function temporary(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  roots.push(root);
  return root;
}

function makeProject(root: string, manifest = ''): string {
  mkdirSync(join(root, '.binnacle'), { recursive: true });
  writeFileSync(join(root, '.binnacle', 'project.yaml'), `version: 1\n\nproject:\n  id: usage-project\n${manifest}`);
  return root;
}

/** Claude Code's directory name for a launch directory. */
const directoryFor = (path: string): string => path.replace(/[^a-zA-Z0-9]/g, '-');

/** Local noon `days` days ago, as Claude Code writes a timestamp. */
function daysAgo(days: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12).toISOString();
}

const localDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** The fixture's lines at `timestamp`, with `id` appended to every message id so that each copy is a message of its own. */
function lines(source: Line[], timestamp: string, id = '', message: Record<string, unknown> = {}): Line[] {
  return source.map((line) => ({
    ...line,
    timestamp,
    ...(line.message && line.type === 'assistant' ? { message: { ...line.message, id: `${String(line.message.id)}${id}`, ...message } } : {}),
  }));
}

/** Writes a session launched in `cwd` under the artifact root, and returns its file. */
function session(artifacts: string, cwd: string, sessionId: string, records: Line[], directory = directoryFor(cwd)): string {
  const dir = join(artifacts, directory);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${sessionId}.jsonl`);
  writeFileSync(file, records.map((record) => `${JSON.stringify({ ...record, cwd, sessionId })}\n`).join(''));
  return file;
}

/** Runs `body` against a daemon whose Claude Code, Codex and Gemini CLI artifact roots are temporary directories. */
async function withDaemon(
  body: (daemon: TestDaemon, artifacts: string, codex: string, geminiCli: string) => Promise<void>,
  options: { home?: string; ingestBudgetMs?: number; settledAfterMs?: number } = {},
): Promise<void> {
  const artifacts = temporary('binnacle-claude-projects-');
  const codex = temporary('binnacle-codex-sessions-');
  const geminiCli = temporary('binnacle-gemini-tmp-');
  const daemon = await startTestDaemon({ ...options, artifacts: { claudeCode: artifacts, codex, geminiCli } });
  try {
    await body(daemon, artifacts, codex, geminiCli);
  } finally {
    await daemon.stop();
  }
}

async function usage(daemon: TestDaemon, root: string): Promise<Usage> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
  return snapshotUsage(daemon, root);
}

async function snapshotUsage(daemon: TestDaemon, root: string): Promise<Usage> {
  const result = await daemon.call<{ usage: Usage }>('project.snapshot', { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.usage;
}

function stored(daemon: TestDaemon): Record<string, unknown>[] {
  const db = new DatabaseSync(storePath(daemon.home), { readOnly: true });
  try {
    return db.prepare('select * from ingested_record order by timestamp').all() as Record<string, unknown>[];
  } finally {
    db.close();
  }
}

const reported = (tokens: number): FieldTotal => ({ tokens, partial: false, provenance: 'provider_reported' });
const NONE: FieldTotal = { tokens: null, partial: false, provenance: null };
const GRILL_TOTALS: Totals = {
  records: 1,
  input: reported(2),
  cachedInput: reported(39225),
  cacheCreation: reported(29831),
  // 137, not 155: the 18 thinking tokens are a part of it, never added to it.
  output: reported(137),
  reasoning: reported(18),
};

describe('Claude Code usage in the Product Snapshot', () => {
  it('counts a message Claude Code records once per content block once, with its token fields as reported', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'));
      session(artifacts, root, 'grill', lines(GRILL, daysAgo(0)));

      const body = await usage(daemon, root);
      assert.deepEqual(body.today, GRILL_TOTALS);
      assert.deepEqual(body.last7Days, GRILL_TOTALS);
      assert.deepEqual(body.byModel, { items: [{ model: 'claude-opus-5-5', totals: GRILL_TOTALS }], remainder: 0 });
      assert.deepEqual(body.harnesses[0], { harness: 'claude-code', level: 3, reason: null });
      // This project declares no tracker, so nothing can be attributed to a Task.
      assert.deepEqual(body.tasks, { available: false, reason: 'This project declares no tracker.provider.' });
      assert.deepEqual(body.unassigned, { available: false, reason: 'This project declares no tracker.provider.' });

      const records = stored(daemon);
      assert.equal(records.length, 1);
      assert.equal(records[0]!.natural_key, 'msg_011CfLMEGjvuTXtzfiK6XfsV');
      assert.equal(records[0]!.harness, 'claude-code');
      assert.equal(records[0]!.provider, null);
      assert.equal(records[0]!.model, 'claude-opus-5-5');
      assert.equal(records[0]!.branch, 'main');
      assert.equal(records[0]!.branch_source, 'harness');
      assert.equal(records[0]!.cwd, root);
    });
  });

  it('never stores message content, tool input or tool output', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'));
      const file = session(artifacts, root, 'grill', [...lines(GRILL, daysAgo(0)), ...lines(ABORTED, daysAgo(0))]);
      assert.match(readFileSync(file, 'utf8'), new RegExp(MARKER));

      assert.equal((await usage(daemon, root)).today.records, 2);
      assert.doesNotMatch(JSON.stringify(stored(daemon)), new RegExp(MARKER));
      // Nor anywhere in the database's files, the write-ahead log included.
      for (const path of [storePath(daemon.home), `${storePath(daemon.home)}-wal`]) {
        let bytes = '';
        try {
          bytes = readFileSync(path, 'latin1');
        } catch {
          continue;
        }
        assert.ok(!bytes.includes(MARKER), `${path} holds content`);
      }
    });
  });

  it('gives a field no record reports as null, and one only some records report as partial', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'));
      session(artifacts, root, 'aborted', lines(ABORTED, daysAgo(0)));

      const alone = await usage(daemon, root);
      assert.equal(alone.today.records, 1);
      assert.deepEqual(alone.today.reasoning, NONE);
      assert.deepEqual(alone.today.output, reported(2));

      session(artifacts, root, 'grill', lines(GRILL, daysAgo(0)));
      const both = await usage(daemon, root);
      assert.equal(both.today.records, 2);
      assert.deepEqual(both.today.reasoning, { tokens: 18, partial: true, provenance: 'provider_reported' });
      assert.deepEqual(both.today.output, reported(139));
    });
  });

  it('counts today and the last seven days in local calendar days, and skips records older than the window', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'));
      session(artifacts, root, 'history', [
        ...lines(GRILL, daysAgo(0), '-today'),
        ...lines(ABORTED, daysAgo(6), '-six'),
        ...lines(GRILL, daysAgo(7), '-seven'),
        ...lines(GRILL, daysAgo(89), '-eighty-nine'),
        ...lines(GRILL, daysAgo(90), '-ninety'),
      ]);

      const body = await usage(daemon, root);
      assert.equal(body.today.records, 1);
      assert.equal(body.last7Days.records, 2);
      assert.deepEqual(body.last7Days.output, reported(139));
      const now = new Date();
      assert.deepEqual(body.importing, { incomplete: false, windowStart: localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89)) });
      assert.deepEqual(
        stored(daemon).map((record) => record.natural_key),
        ['msg_011CfLMEGjvuTXtzfiK6XfsV-eighty-nine', 'msg_011CfLMEGjvuTXtzfiK6XfsV-seven', 'msg_011CfQGNrVrPXXM5Kt7SPr4S-six', 'msg_011CfLMEGjvuTXtzfiK6XfsV-today'],
      );
    });
  });

  it('takes the window from telemetry.import.window_days', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), '\ntelemetry:\n  import:\n    window_days: 5\n');
      session(artifacts, root, 'history', [...lines(GRILL, daysAgo(0), '-today'), ...lines(ABORTED, daysAgo(4), '-four'), ...lines(ABORTED, daysAgo(5), '-five')]);

      const body = await usage(daemon, root);
      assert.equal(body.last7Days.records, 2);
      const now = new Date();
      assert.equal(body.importing.windowStart, localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 4)));
    });
  });

  it('lists the last seven days by model, at most ten with a remainder', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'));
      const models = Array.from({ length: 12 }, (_, index) => `model-${String(index).padStart(2, '0')}`);
      session(artifacts, root, 'models', [
        // Without the `<synthetic>` message, which would otherwise take the model's name.
        ...models.flatMap((model) => lines(GRILL.slice(0, 4), daysAgo(1), `-${model}`, { model })),
        // The largest comes first, whatever its name.
        ...lines(ABORTED, daysAgo(1), '-big', { model: 'model-11' }),
      ]);

      const { byModel } = await usage(daemon, root);
      assert.deepEqual(
        byModel.items.map((item) => [item.model, item.totals.records]),
        [['model-11', 2], ...models.slice(0, 9).map((model) => [model, 1])],
      );
      assert.equal(byModel.remainder, 2);
    });
  });

  it('stores a record only when its own cwd lies in a registered project', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const parent = temporary('binnacle-usage-');
      const root = makeProject(join(parent, 'project'));
      // Its directory name starts with the project's, which only makes it a candidate.
      session(artifacts, join(parent, 'project-other'), 'sibling', lines(GRILL, daysAgo(0), '-sibling'));
      session(artifacts, root, 'here', lines(GRILL, daysAgo(0), '-here'));
      // Launched in the project, with records whose own cwd is elsewhere.
      const moved = join(artifacts, directoryFor(root), 'moved.jsonl');
      writeFileSync(moved, lines(ABORTED, daysAgo(0), '-moved').map((line) => `${JSON.stringify({ ...line, cwd: '/somewhere/else', sessionId: 'moved' })}\n`).join(''));
      // Launched in a subdirectory of the project.
      session(artifacts, join(root, 'apps', 'cli'), 'nested', lines(ABORTED, daysAgo(0), '-nested'));

      const body = await usage(daemon, root);
      assert.equal(body.today.records, 2);
      assert.deepEqual(stored(daemon).map((record) => record.natural_key).sort(), ['msg_011CfLMEGjvuTXtzfiK6XfsV-here', 'msg_011CfQGNrVrPXXM5Kt7SPr4S-nested']);
    });
  });

  it('counts nothing twice across calls, and each call reads only what was appended since the last', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'));
      const file = session(artifacts, root, 'growing', lines(GRILL, daysAgo(0)));
      assert.deepEqual((await usage(daemon, root)).today, GRILL_TOTALS);
      assert.deepEqual((await usage(daemon, root)).today, GRILL_TOTALS);

      // What was already read is never read again: overwriting it with a line that is not
      // JSON, of the same length, changes nothing.
      const text = readFileSync(file, 'utf8');
      const first = text.slice(0, text.indexOf('\n'));
      writeFileSync(file, `${'x'.repeat(Buffer.byteLength(first))}${text.slice(first.length)}`);
      // A line still being written is left until it is complete.
      const [one, two] = lines(ABORTED, daysAgo(0)).map((line) => JSON.stringify({ ...line, cwd: root, sessionId: 'growing' }));
      appendFileSync(file, `${one}\n${two!.slice(0, 40)}`);

      const partial = await usage(daemon, root);
      assert.equal(partial.today.records, 2);
      assert.deepEqual(partial.harnesses[0], { harness: 'claude-code', level: 3, reason: null });

      appendFileSync(file, `${two!.slice(40)}\n`);
      const complete = await usage(daemon, root);
      assert.equal(complete.today.records, 2);
      assert.deepEqual(complete.harnesses[0], { harness: 'claude-code', level: 3, reason: null });
      assert.equal(stored(daemon).length, 2);
    });
  });

  it('reports the level Claude Code reached for the project', async () => {
    await withDaemon(async (daemon, artifacts, codex) => {
      const none = makeProject(temporary('binnacle-usage-'));
      const [absent, codexAbsent] = (await usage(daemon, none)).harnesses;
      assert.equal(absent?.level, null);
      assert.match(absent?.reason ?? '', new RegExp(artifacts));
      assert.equal(codexAbsent?.harness, 'codex');
      assert.equal(codexAbsent?.level, null);
      assert.match(codexAbsent?.reason ?? '', new RegExp(`No Codex session of this project was found under ${codex}`));

      const unreported = makeProject(temporary('binnacle-usage-'));
      session(artifacts, unreported, 'unreported', lines(ABORTED, daysAgo(0), '-unreported', { usage: {} }));
      const level2 = await usage(daemon, unreported);
      assert.deepEqual(level2.harnesses[0], { harness: 'claude-code', level: 2, reason: null });
      assert.deepEqual(level2.today.input, NONE);

      const broken = makeProject(temporary('binnacle-usage-'));
      const file = session(artifacts, broken, 'broken', lines(GRILL, daysAgo(0), '-broken'));
      appendFileSync(file, 'not json\n');
      const level1 = await usage(daemon, broken);
      assert.equal(level1.harnesses[0]?.level, 1);
      assert.match(level1.harnesses[0]?.reason ?? '', new RegExp(`${file}.*line 6`));
      // What came before the unreadable line still counts.
      assert.equal(level1.today.records, 1);
    });
  });

  it('carries the Claude Code, Codex, Gemini CLI and opencode artifact roots in the runtime', async () => {
    await withDaemon(async (daemon, artifacts, codex, geminiCli) => {
      const { body } = await daemon.call<{ artifacts: { claudeCode: string; codex: string; geminiCli: string; opencode: string } }>('daemon.status');
      assert.deepEqual(body.artifacts, { claudeCode: artifacts, codex, geminiCli, opencode: join(daemon.home, 'no-opencode-data') });
    });
    assert.deepEqual(resolveArtifactRoots({ CLAUDE_CONFIG_DIR: '/config/claude', CODEX_HOME: '/config/codex', GEMINI_CLI_HOME: '/config/gemini', XDG_DATA_HOME: '/data' }), {
      claudeCode: join('/config/claude', 'projects'),
      codex: join('/config/codex', 'sessions'),
      geminiCli: join('/config/gemini', '.gemini', 'tmp'),
      opencode: join('/data', 'opencode'),
    });
    assert.deepEqual(resolveArtifactRoots({}), {
      claudeCode: join(homedir(), '.claude', 'projects'),
      codex: join(homedir(), '.codex', 'sessions'),
      geminiCli: join(homedir(), '.gemini', 'tmp'),
      opencode: join(homedir(), '.local', 'share', 'opencode'),
    });
  });
});

const window = (days: number | string): string => `\ntelemetry:\n  import:\n    window_days: ${days}\n`;

/** Calls the snapshot until the import is complete, as a caller that came back later would. */
async function untilImported(daemon: TestDaemon, root: string): Promise<Usage> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const body = await snapshotUsage(daemon, root);
    if (!body.importing.incomplete) return body;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('the import never completed');
}

describe('the import window, the time budget and re-reading', () => {
  it('imports everything on disk when the window is all', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), window('all'));
      session(artifacts, root, 'history', [...lines(GRILL, daysAgo(0), '-today'), ...lines(ABORTED, daysAgo(400), '-old')]);

      const body = await usage(daemon, root);
      assert.deepEqual(body.importing, { incomplete: false, windowStart: null });
      assert.equal(body.last7Days.records, 1);
      assert.equal(stored(daemon).length, 2);
    });
  });

  it('refuses a window that is neither a positive number of days nor all', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject(temporary('binnacle-usage-'), window('forever'));
      const { status, body } = await daemon.call<{ error: { details?: { path: string }[] } }>('project.register', { path: root });
      assert.equal(status, 400);
      assert.deepEqual(body.error.details?.map((detail) => detail.path), ['telemetry.import.window_days']);
    });
  });

  it('imports the older records still on disk when the window widens, and counts none twice', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), window(5));
      session(artifacts, root, 'history', [
        ...lines(GRILL, daysAgo(0), '-today'),
        ...lines(ABORTED, daysAgo(20), '-twenty'),
        ...lines(GRILL, daysAgo(200), '-two-hundred'),
      ]);
      await usage(daemon, root);
      assert.equal(stored(daemon).length, 1);

      makeProject(root, window(30));
      await snapshotUsage(daemon, root);
      assert.deepEqual(stored(daemon).map((record) => record.natural_key), ['msg_011CfQGNrVrPXXM5Kt7SPr4S-twenty', 'msg_011CfLMEGjvuTXtzfiK6XfsV-today']);

      // Narrowing again keeps what was imported; widening to all brings the rest.
      makeProject(root, window(5));
      await snapshotUsage(daemon, root);
      makeProject(root, window('all'));
      const body = await snapshotUsage(daemon, root);
      assert.equal(stored(daemon).length, 3);
      assert.equal(body.today.records, 1);
    });
  });

  it('re-reads a file that shrank from the start, and counts none of it twice', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'));
      const file = session(artifacts, root, 'rewritten', [...lines(GRILL, daysAgo(0), '-kept'), ...lines(ABORTED, daysAgo(0), '-dropped')]);
      assert.equal((await usage(daemon, root)).today.records, 2);

      // Rewritten shorter, with a message the first read never saw.
      writeFileSync(file, lines(ABORTED, daysAgo(0), '-new').map((line) => `${JSON.stringify({ ...line, cwd: root, sessionId: 'rewritten' })}\n`).join(''));
      assert.equal((await snapshotUsage(daemon, root)).today.records, 3);
      assert.equal(stored(daemon).length, 3);
    });
  });

  it('answers within its time budget while the import continues in the background, then completes', async () => {
    await withDaemon(
      async (daemon, artifacts) => {
        const root = makeProject(temporary('binnacle-usage-'));
        for (let index = 0; index < 5; index += 1) session(artifacts, root, `session-${index}`, lines(GRILL, daysAgo(index), `-${index}`));

        const first = await usage(daemon, root);
        assert.equal(first.importing.incomplete, true);
        assert.ok(first.last7Days.records < 5);

        const done = await untilImported(daemon, root);
        assert.equal(done.last7Days.records, 5);
        assert.equal(stored(daemon).length, 5);
      },
      { ingestBudgetMs: 0 },
    );
  });

  it('starts an import for every registered project when the daemon starts', async () => {
    const home = temporary('binnacle-home-');
    const root = makeProject(temporary('binnacle-usage-'));
    let artifactRoot = '';
    await withDaemon(
      async (daemon, artifacts) => {
        artifactRoot = artifacts;
        assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      },
      { home },
    );
    session(artifactRoot, root, 'before-start', lines(GRILL, daysAgo(1)));

    const daemon = await startTestDaemon({ home, artifacts: { claudeCode: artifactRoot, codex: join(home, 'no-codex-sessions') }, ingestBudgetMs: 0 });
    try {
      // No call has been made: the records are there because the start imported them.
      for (let attempt = 0; attempt < 200 && stored(daemon).length === 0; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(stored(daemon).length, 1);
      assert.equal((await snapshotUsage(daemon, root)).importing.incomplete, false);
    } finally {
      await daemon.stop();
    }
  });

  it('imports the history of a project registered later under its own window', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const first = makeProject(temporary('binnacle-usage-'));
      session(artifacts, first, 'first', lines(GRILL, daysAgo(0), '-first'));
      assert.equal((await usage(daemon, first)).today.records, 1);

      const later = makeProject(temporary('binnacle-usage-'), window(30));
      session(artifacts, later, 'later', [...lines(ABORTED, daysAgo(20), '-twenty'), ...lines(GRILL, daysAgo(40), '-forty')]);
      const body = await usage(daemon, later);
      assert.equal(body.last7Days.records, 0);
      assert.deepEqual(
        stored(daemon).filter((record) => record.project_path === later).map((record) => record.natural_key),
        ['msg_011CfQGNrVrPXXM5Kt7SPr4S-twenty'],
      );
    });
  });

  it('imports the history of a project registered later whose sessions an earlier project had already read past', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const parent = temporary('binnacle-usage-');
      const first = makeProject(join(parent, 'project'));
      // Its Claude Code directory name starts with the first project's, so the first one's import reads it.
      const later = makeProject(join(parent, 'project-later'));
      session(artifacts, later, 'later', lines(GRILL, daysAgo(0), '-later'));
      assert.equal((await usage(daemon, first)).today.records, 0);

      assert.equal((await usage(daemon, later)).today.records, 1);
    });
  });

  it('still counts the records of an artifact that was deleted', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'));
      const file = session(artifacts, root, 'deleted', lines(GRILL, daysAgo(0)));
      assert.deepEqual((await usage(daemon, root)).today, GRILL_TOTALS);

      rmSync(file);
      const body = await snapshotUsage(daemon, root);
      assert.deepEqual(body.today, GRILL_TOTALS);
      assert.deepEqual(body.harnesses[0], { harness: 'claude-code', level: 3, reason: null });
    });
  });
});

type Attention = { code: string; message: string }[];

async function snapshotWithAttention(daemon: TestDaemon, root: string): Promise<{ usage: Usage; attention: Attention }> {
  const result = await daemon.call<{ usage: Usage; attention: Attention }>('project.snapshot', { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

const unreadable = (attention: Attention): Attention => attention.filter((item) => item.code === 'telemetry.unreadable');

describe('unreadable artifacts', () => {
  /** Claude Code's lines with a field it did not write before, at the top and in the usage, as a newer version might add. */
  const newer = (source: Line[]): Line[] =>
    source.map((line) =>
      line.message && isUsage(line.message.usage)
        ? { ...line, fieldFromANewerVersion: true, message: { ...line.message, usage: { ...line.message.usage, counter_from_a_newer_version: 7 } } }
        : { ...line, fieldFromANewerVersion: true },
    );
  const isUsage = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

  /** A message whose first record has lost its usage, as a format change might drop it. */
  const withoutUsage = (source: Line[]): Line[] =>
    source.map((line, index) => {
      if (index > 0 || !line.message) return line;
      const { usage: _usage, ...message } = line.message;
      return { ...line, message };
    });

  /** The grill message (lines 1 to 5), the aborted one (lines 6 and 7), and the grill message again (lines 8 to 12). */
  const sessionLines = (aborted: Line[]): Line[] => [...newer(lines(GRILL, daysAgo(0))), ...aborted, ...lines(GRILL, daysAgo(0), '-after')];

  it('stops a file at a line without the usage it needs, keeps what came before, and reads on from that line once it is readable', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'));
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      const file = session(artifacts, root, 'drifted', sessionLines(withoutUsage(lines(ABORTED, daysAgo(0)))));

      const broken = await snapshotWithAttention(daemon, root);
      // Fields Claude Code did not write before are ignored; nothing at or after the failing line counts.
      assert.deepEqual(broken.usage.today, GRILL_TOTALS);
      assert.equal(broken.usage.harnesses[0]?.level, 1);
      const [item, ...others] = unreadable(broken.attention);
      assert.deepEqual(others, []);
      assert.match(item?.message ?? '', new RegExp(`^Claude Code .*${file} at line 6: an assistant record without usage`));
      assert.equal(broken.usage.harnesses[0]?.reason, item?.message);

      // Still unreadable: still reported, and nothing counted twice.
      const again = await snapshotWithAttention(daemon, root);
      assert.equal(again.usage.today.records, 1);
      assert.equal(unreadable(again.attention).length, 1);

      // Repaired, the file is read on from the line it stopped at, and the item clears.
      session(artifacts, root, 'drifted', sessionLines(lines(ABORTED, daysAgo(0))));
      const repaired = await snapshotWithAttention(daemon, root);
      assert.equal(repaired.usage.today.records, 3);
      assert.deepEqual(repaired.usage.harnesses[0], { harness: 'claude-code', level: 3, reason: null });
      assert.deepEqual(unreadable(repaired.attention), []);
      assert.equal(stored(daemon).length, 3);
    });
  });

  it('names the first unreadable file of the project and counts the others in one item, and keeps the level at 1 while the import runs on', async () => {
    await withDaemon(
      async (daemon, artifacts) => {
        const root = makeProject(temporary('binnacle-usage-'));
        assert.equal((await daemon.call('project.register', { path: root })).status, 200);
        const first = session(artifacts, root, 'drifted-1', sessionLines(withoutUsage(lines(ABORTED, daysAgo(0)))));
        session(artifacts, root, 'drifted-2', withoutUsage(lines(ABORTED, daysAgo(0), '-2')));

        let body = await snapshotWithAttention(daemon, root);
        for (let attempt = 0; attempt < 200 && unreadable(body.attention).length === 0; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          body = await snapshotWithAttention(daemon, root);
        }
        // The failing files are read again on every call, so the import is running here too.
        assert.equal(body.usage.importing.incomplete, true);
        assert.equal(body.usage.harnesses[0]?.level, 1);
        const [item, ...others] = unreadable(body.attention);
        assert.deepEqual(others, []);
        assert.match(item?.message ?? '', new RegExp(`${first} at line 6: .*1 other file`));

        rmSync(join(dirname(first), 'drifted-2.jsonl'));
        session(artifacts, root, 'drifted-1', sessionLines(lines(ABORTED, daysAgo(0))));
        const repaired = await untilImported(daemon, root);
        assert.deepEqual(repaired.harnesses[0], { harness: 'claude-code', level: 3, reason: null });
        assert.deepEqual(unreadable((await snapshotWithAttention(daemon, root)).attention), []);
      },
      { ingestBudgetMs: 0 },
    );
  });
});

// The daemon runs in this process and reads its environment: a token the developer has set
// would otherwise reach the loopback GitHub stand-in.
delete process.env.BINNACLE_GITHUB_TOKEN;

const LOCAL_TRACKER = '\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n';

/** Writes `docs/specs/<spec>/issues/<file>` with a title and a state, as the local tracker reads it. */
function ticket(root: string, spec: string, file: string, title: string, state = 'READY'): void {
  const path = join(root, 'docs', 'specs', spec, 'issues', file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `# ${file.slice(0, 2)}: ${title}\n\nStatus: ${state}\n`);
}

/** Local noon `days` days ago, `minute` minutes on. */
const at = (days: number, minute: number): string => new Date(Date.parse(daysAgo(days)) + minute * 60_000).toISOString();

/** The fixture's lines as Claude Code writes them on `branch`, which it records as `gitBranch`. */
const onBranch = (branch: string, source: Line[]): Line[] => source.map((line) => ({ ...line, gitBranch: branch }));

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'ignore' });
}

/**
 * Makes `root` a repository whose `HEAD` reflog begins on `main` at `since`, then switches to
 * each branch at its time, in order. The reflog is where a record's branch comes from; the one
 * Claude Code wrote attributes nothing (ADR-0030).
 */
function repository(root: string, since: string, ...switches: [at: string, branch: string][]): string {
  gitAt(since, root, 'init', '--quiet', '--initial-branch=main');
  gitAt(since, root, 'add', '.');
  gitAt(since, root, 'commit', '--quiet', '-m', 'initial');
  for (const [time, branch] of switches) gitAt(time, root, 'switch', '--quiet', '-C', branch);
  return root;
}

const NO_RECORDS: Totals = { records: 0, input: NONE, cachedInput: NONE, cacheCreation: NONE, output: NONE, reasoning: NONE };
const available = <T>(section: T | Unavailable): T => {
  assert.ok(!(typeof section === 'object' && section !== null && 'available' in section), JSON.stringify(section));
  return section as T;
};
const taskRecords = (body: Pick<Usage, 'tasks'>): [string, string | null, number][] =>
  available(body.tasks).items.map((item) => [item.id, item.title, item.totals.records]);

/** What a forge stand-in received: each request's path and query, and the token header it carried. */
type FakeForge = { base: string; requests: { url: URL; token: string | undefined }[]; close(): Promise<void> };

/**
 * A loopback stand-in for a forge at the network boundary: `serve` answers a request with
 * a list, or with undefined for a 404. Every request is kept with its token.
 */
async function fakeForge(serve: (url: URL) => unknown[] | undefined, status = 200): Promise<FakeForge> {
  const fake: FakeForge = { base: '', requests: [], close: async () => {} };
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://x');
    fake.requests.push({ url, token: request.headers.authorization ?? (request.headers['private-token'] as string | undefined) });
    const body = serve(url);
    response.writeHead(body === undefined ? 404 : status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body !== undefined && status === 200 ? body : { message: 'Server Error' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  fake.base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  fake.close = () => new Promise((resolve) => server.close(() => resolve()));
  return fake;
}

/**
 * GitHub's issue list for `octo/repo`, serving `issues`, or `status` with no issues, and
 * whatever `forge` serves for the rest, its pull requests and their reviews.
 */
function fakeGitHub(issues: { number: number; title: string }[], status = 200, forge: (url: URL) => unknown[] | undefined = () => undefined): Promise<FakeForge> {
  const body = issues.map(({ number, title }) => ({
    number,
    title,
    state: 'open',
    state_reason: null,
    body: 'Status: READY',
    labels: [],
    html_url: `https://github.com/octo/repo/issues/${number}`,
  }));
  return fakeForge((url) => (url.pathname === '/repos/octo/repo/issues' ? body : forge(url)), status);
}
const githubTracker = (host: string): string => `\ntracker:\n  provider: github\n  repository: octo/repo\n  host: ${host}\n`;

describe('Observed runs and Task attribution in the Product Snapshot', () => {
  it('splits a session where it switches branch, and gives each part to the Task its branch maps to, largest first', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      ticket(root, 'epic', '02-second.md', 'Second');
      repository(root, at(2, 0), [at(1, 0), 'feat/first'], [at(1, 1), 'feat/second'], [at(1, 2), 'feat/first'], [at(1, 3), 'main']);
      session(artifacts, root, 'switching', [
        ...lines(GRILL, at(1, 0), '-first'),
        ...lines(ABORTED, at(1, 1), '-second'),
        ...lines(GRILL, at(1, 2), '-back'),
        ...lines(ABORTED, at(1, 3), '-main'),
        // Outside the last seven days.
        ...lines(GRILL, at(7, 0), '-old'),
      ]);

      const body = await usage(daemon, root);
      // Two of Grill's messages are fewer tokens than one of Aborted's, which comes first.
      assert.deepEqual(taskRecords(body), [['epic/02', 'Second', 1], ['epic/01', 'First', 2]]);
      assert.deepEqual(available(body.tasks).items[1]!.totals.output, reported(2 * 137));
      assert.equal(available(body.tasks).remainder, 0);
      assert.equal(available(body.unassigned).records, 1);
      assert.equal(body.last7Days.records, 4);
    });
  });

  it('gives no branch to a worktree that no longer exists, whether Claude Code wrote main or a Task’s branch there, so its runs are unknown and unassigned', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      repository(root, at(1, 0));
      // A worktree where Claude Code puts its own, on the branch made for it, removed with that
      // branch after the merge, before Binnacle read it.
      const removed = (name: string, records: Line[]): void => {
        const worktree = join(root, '.claude', 'worktrees', name);
        gitAt(at(1, 10), root, 'worktree', 'add', '--quiet', '-b', `worktree-${name}`, worktree);
        session(artifacts, worktree, name, records);
        git(root, 'worktree', 'remove', worktree);
        git(root, 'branch', '-d', `worktree-${name}`);
      };
      removed('agent-main', onBranch('main', lines(GRILL, at(0, 0), '-main')));
      removed('agent-ticket', onBranch('feat/first', lines(GRILL, at(0, 1), '-ticket')));
      await register(daemon, root);

      const body = await usageGet<ProjectUsage>(daemon, root);
      assert.deepEqual(taskRecords(body), []);
      assert.equal(available(body.unassigned).records, 2);
      const byRole = available(body.byRole);
      assert.deepEqual([byRole.product.records, byRole.implementation.records, byRole.unknown.records], [0, 0, 2]);
      assert.deepEqual((await usageGet<TaskUsage>(daemon, root, 'epic/01')).runs, { items: [], remainder: 0 });
      // Stored as Claude Code wrote it: the rule applies when runs are read.
      assert.deepEqual(
        stored(daemon).map((row) => [row.natural_key, row.branch, row.branch_source]),
        [
          ['msg_011CfLMEGjvuTXtzfiK6XfsV-main', 'main', 'harness'],
          ['msg_011CfLMEGjvuTXtzfiK6XfsV-ticket', 'feat/first', 'harness'],
        ],
      );
    });
  });

  it('counts a session in a linked worktree outside the project’s directory while that worktree exists', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const parent = temporary('binnacle-usage-');
      const root = makeProject(join(parent, 'project'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      repository(root, at(1, 0));
      const outside = join(parent, 'elsewhere');
      gitAt(at(1, 10), root, 'worktree', 'add', '--quiet', '-b', 'feat/first', outside);
      session(artifacts, outside, 'outside', lines(GRILL, daysAgo(0), '-outside'));
      session(artifacts, join(outside, 'docs'), 'nested', lines(ABORTED, daysAgo(0), '-nested'));
      // A directory beside it that is no worktree of the project.
      session(artifacts, join(parent, 'unrelated'), 'unrelated', lines(GRILL, daysAgo(0), '-unrelated'));

      const body = await usage(daemon, root);
      assert.deepEqual(taskRecords(body), [['epic/01', 'First', 2]]);
      assert.equal(body.today.records, 2);
    });
  });

  it('leaves a branch that maps to no Task, or to several, unassigned', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      ticket(root, 'one', '01-shared.md', 'Shared once');
      ticket(root, 'two', '01-shared.md', 'Shared twice');
      repository(root, at(1, 0), [at(0, 0), 'feat/shared'], [at(0, 1), 'feat/nothing'], [at(0, 2), 'main'], [at(0, 3), 'feat/first']);
      session(artifacts, root, 'several', [
        ...lines(GRILL, at(0, 0), '-shared'),
        ...lines(GRILL, at(0, 1), '-nothing'),
        ...lines(GRILL, at(0, 2), '-main'),
        ...lines(ABORTED, at(0, 3), '-first'),
      ]);

      const body = await usage(daemon, root);
      assert.deepEqual(taskRecords(body), [['epic/01', 'First', 1]]);
      assert.equal(available(body.unassigned).records, 3);
      assert.deepEqual(available(body.unassigned).output, reported(3 * 137));
    });
  });

  it('lists at most ten Tasks, with a remainder', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      const numbers = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
      for (const number of numbers) ticket(root, 'epic', `${number}-task-${number}.md`, `Task ${number}`);
      repository(root, at(1, 0), ...numbers.map((number, index): [string, string] => [at(0, index), `feat/task-${number}`]));
      session(artifacts, root, 'many', numbers.flatMap((number, index) => lines(GRILL, at(0, index), `-${number}`)));

      const tasks = available((await usage(daemon, root)).tasks);
      // Equal totals go by id.
      assert.deepEqual(tasks.items.map((item) => item.id), numbers.slice(0, 10).map((number) => `epic/${number}`));
      assert.equal(tasks.remainder, 2);
    });
  });

  it('maps a branch to a GitHub issue by its number, when the tracker holds it', async () => {
    const github = await fakeGitHub([{ number: 7, title: 'Seven' }]);
    try {
      await withDaemon(async (daemon, artifacts) => {
        const root = makeProject(temporary('binnacle-usage-'), githubTracker(github.base));
        // The issue was renamed between the first two branches: its number still names it.
        repository(root, at(1, 0), [at(0, 0), 'feat/7-seven'], [at(0, 1), 'feat/7-renamed'], [at(0, 2), 'feat/8-no-such-issue']);
        session(artifacts, root, 'issues', [...lines(GRILL, at(0, 0), '-seven'), ...lines(GRILL, at(0, 1), '-renamed'), ...lines(GRILL, at(0, 2), '-eight')]);

        const body = await usage(daemon, root);
        assert.deepEqual(taskRecords(body), [['#7', 'Seven', 2]]);
        assert.equal(available(body.unassigned).records, 1);
      });
    } finally {
      await github.close();
    }
  });

  it('makes Tasks and unassigned unavailable with the tracker’s reason when it cannot be read, and still answers the totals', async () => {
    const github = await fakeGitHub([], 500);
    try {
      await withDaemon(async (daemon, artifacts) => {
        const root = makeProject(temporary('binnacle-usage-'), githubTracker(github.base));
        session(artifacts, root, 'unreadable', lines(GRILL, daysAgo(0)));

        assert.equal((await daemon.call('project.register', { path: root })).status, 200);
        const { body } = await daemon.call<{ usage: Usage; attention: { code: string; message: string }[] }>('project.snapshot', { path: root });
        const tracker = body.attention.filter((item) => item.code.startsWith('tracker.'));
        assert.equal(tracker.length, 1);
        const unavailable = { available: false, reason: tracker[0]!.message };
        assert.deepEqual(body.usage.tasks, unavailable);
        assert.deepEqual(body.usage.unassigned, unavailable);
        assert.deepEqual(body.usage.today, GRILL_TOTALS);
      });
    } finally {
      await github.close();
    }
  });

  it('gives a run on the default branch the product role, on a Task’s branch implementation, and unknown otherwise', async () => {
    await withDaemon(async (daemon, artifacts) => {
      // One record on the first branch, two on the second, four and eight on the others.
      const branches = ['trunk', 'main', 'feat/first', 'feat/nothing'];
      const switches = branches.map((branch, index): [string, string] => [at(1, index), branch]);
      const trunk = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(trunk, 'epic', '01-first.md', 'First');
      repository(trunk, at(2, 0), ...switches);
      // `origin/HEAD` names the default branch, here not `main`.
      git(trunk, 'update-ref', 'refs/remotes/origin/trunk', 'HEAD');
      git(trunk, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk');
      const plain = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(plain, 'epic', '01-first.md', 'First');
      repository(plain, at(2, 0), ...switches);

      const roles = async (root: string): Promise<Record<string, number>> => {
        const records = switches.flatMap(([time], index) =>
          Array.from({ length: 2 ** index }, (_, copy) => lines(ABORTED, time, `-${index}-${copy}-${root}`)).flat(),
        );
        session(artifacts, root, 'roles', records);
        await register(daemon, root);
        const byRole = available((await usageGet<ProjectUsage>(daemon, root)).byRole);
        return Object.fromEntries(Object.entries(byRole).map(([role, totals]) => [role, totals.records]));
      };
      assert.deepEqual(await roles(trunk), { product: 1, implementation: 4, review: 0, rework: 0, unknown: 2 + 8 });
      // Without `origin/HEAD`, the default branch is `main`.
      assert.deepEqual(await roles(plain), { product: 2, implementation: 4, review: 0, rework: 0, unknown: 1 + 8 });
    });
  });
});

type Run = {
  id: string;
  harness: string;
  provider: string | null;
  model: string | null;
  role: string;
  branch: string | null;
  branchSource: string | null;
  taskId: string | null;
  parentRunId: string | null;
  checkout: string | null;
  startedAt: string;
  lastActivityAt: string;
  active: { value: boolean; provenance: string };
  totals: Totals;
};
type Derived = {
  perCompletedTask:
    | { provenance: string; items: { id: string; title: string | null; runs: number; totals: Totals }[]; remainder: number; mean: Totals | null; withoutRuns: number }
    | Unavailable;
  runsPerTask:
    | { provenance: string; items: { id: string; title: string | null; runs: number; subagentRuns: number }[]; remainder: number; mean: { runs: number; subagentRuns: number } | null }
    | Unavailable;
  weekly: { provenance: string; items: { week: string; totals: Totals }[] };
};
type ProjectUsage = Pick<Usage, 'importing' | 'tasks' | 'unassigned'> & {
  totals: Totals;
  byRole: Record<Role, Totals> | Unavailable;
  derived: Derived;
};
type TaskUsage = Pick<Usage, 'importing'> & {
  task: { id: string; title: string | null };
  totals: Totals;
  byRole: Record<'implementation' | 'review' | 'rework', Totals>;
  reworkUnread: string | null;
  runs: { items: Run[]; remainder: number };
};

async function usageGet<T>(daemon: TestDaemon, root: string, task?: string): Promise<T> {
  const result = await daemon.call<T>('usage.get', { path: root, ...(task === undefined ? {} : { task }) });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

async function register(daemon: TestDaemon, root: string): Promise<void> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
}

describe('usage.get', () => {
  it('gives the project’s totals over the whole window, by Task and unassigned', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      ticket(root, 'epic', '02-second.md', 'Second');
      repository(root, at(21, 0), [at(20, 0), 'feat/first'], [at(0, 0), 'feat/second'], [at(0, 1), 'main']);
      session(artifacts, root, 'window', [
        // Older than the snapshot's week, still in the window.
        ...lines(GRILL, at(20, 0), '-old'),
        ...lines(ABORTED, at(0, 0), '-second'),
        ...lines(GRILL, at(0, 1), '-main'),
      ]);
      await register(daemon, root);

      const body = await usageGet<ProjectUsage>(daemon, root);
      assert.equal(body.importing.incomplete, false);
      assert.equal(body.totals.records, 3);
      assert.deepEqual(taskRecords(body), [['epic/02', 'Second', 1], ['epic/01', 'First', 1]]);
      assert.equal(available(body.tasks).remainder, 0);
      assert.deepEqual(available(body.unassigned), GRILL_TOTALS);
    });
  });

  it('gives a Task’s totals and its runs, newest first, each run grouped over the whole window', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      ticket(root, 'epic', '02-second.md', 'Second');
      const recent = new Date(Date.now() - 60_000).toISOString();
      // On the first Task's branch, but for a minute on the second's.
      repository(root, at(10, 0), [at(9, 0), 'feat/first'], [at(1, 30), 'feat/second'], [at(1, 31), 'feat/first']);
      // One run that began before the last seven days: its id is still its first record's.
      session(artifacts, root, 'long', [...lines(GRILL, at(9, 0), '-nine'), ...lines(ABORTED, at(1, 0), '-one')]);
      session(artifacts, root, 'recent', lines(GRILL, recent, '-recent'));
      session(artifacts, root, 'other', lines(GRILL, at(1, 30), '-other'));
      await register(daemon, root);

      // The id in any form `task.get` takes.
      const body = await usageGet<TaskUsage>(daemon, root, 'epic/1');
      assert.deepEqual(body.task, { id: 'epic/01', title: 'First' });
      assert.equal(body.totals.records, 3);
      assert.deepEqual(body.totals.output, reported(2 * 137 + 2));
      const run = { harness: 'claude-code', provider: null, model: 'claude-opus-5-5', role: 'implementation', branch: 'feat/first', branchSource: 'reflog', taskId: 'epic/01', parentRunId: null, checkout: root };
      assert.deepEqual(body.runs, {
        items: [
          { ...run, id: 'claude-code:msg_011CfLMEGjvuTXtzfiK6XfsV-recent', startedAt: recent, lastActivityAt: recent, active: { value: true, provenance: 'calculated' }, totals: GRILL_TOTALS },
          {
            ...run,
            id: 'claude-code:msg_011CfLMEGjvuTXtzfiK6XfsV-nine',
            startedAt: at(9, 0),
            lastActivityAt: at(1, 0),
            active: { value: false, provenance: 'calculated' },
            totals: {
              records: 2,
              input: reported(2 + 4),
              cachedInput: reported(39225 + 167306),
              cacheCreation: reported(29831 + 994),
              output: reported(137 + 2),
              reasoning: { tokens: 18, partial: true, provenance: 'provider_reported' },
            },
          },
        ],
        remainder: 0,
      });
      // The same runs, the same ids, on the next call.
      assert.deepEqual((await usageGet<TaskUsage>(daemon, root, 'epic/01')).runs, body.runs);
    });
  });

  it('lists at most ten Tasks and ten runs, with a remainder', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      const numbers = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
      for (const number of numbers) {
        ticket(root, 'epic', `${number}-task-${number}.md`, `Task ${number}`);
        session(artifacts, root, `task-${number}`, lines(GRILL, at(1, Number(number)), `-${number}`));
      }
      // Eleven more runs of the first Task, a session each.
      for (const number of numbers.slice(1)) session(artifacts, root, `again-${number}`, lines(ABORTED, at(0, Number(number)), `-again-${number}`));
      repository(root, at(2, 0), ...numbers.map((number): [string, string] => [at(1, Number(number)), `feat/task-${number}`]), [at(0, 0), 'feat/task-01']);
      await register(daemon, root);

      const tasks = available((await usageGet<ProjectUsage>(daemon, root)).tasks);
      assert.equal(tasks.items.length, 10);
      assert.equal(tasks.remainder, 2);
      assert.equal(tasks.items[0]!.id, 'epic/01');

      const task = await usageGet<TaskUsage>(daemon, root, 'epic/01');
      assert.equal(task.totals.records, 12);
      assert.equal(task.runs.remainder, 2);
      assert.deepEqual(
        task.runs.items.map((item) => item.startedAt),
        numbers.slice(2).reverse().map((number) => at(0, Number(number))),
      );
    });
  });

  it('gives a run on the default branch the product role even on a Task’s branch, and one on another Task’s branch implementation', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      ticket(root, 'epic', '02-second.md', 'Second');
      repository(root, at(2, 0), [at(1, 0), 'feat/first'], [at(1, 1), 'feat/second']);
      // `origin/HEAD` names the default branch, here the first Task's.
      git(root, 'update-ref', 'refs/remotes/origin/feat/first', 'HEAD');
      git(root, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/feat/first');
      session(artifacts, root, 'roles', [...lines(GRILL, at(1, 0), '-first'), ...lines(GRILL, at(1, 1), '-second')]);
      await register(daemon, root);

      const roles = async (task: string): Promise<[string, string | null][]> =>
        (await usageGet<TaskUsage>(daemon, root, task)).runs.items.map((item) => [item.role, item.taskId]);
      assert.deepEqual(await roles('epic/01'), [['product', 'epic/01']]);
      assert.deepEqual(await roles('epic/02'), [['implementation', 'epic/02']]);
    });
  });

  it('answers an unknown Task with task.not_found, and a Task with no runs with an empty list', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      session(artifacts, root, 'main', lines(GRILL, daysAgo(0)));
      await register(daemon, root);

      const missing = await daemon.call<{ error: { code: string } }>('usage.get', { path: root, task: 'epic/99' });
      assert.equal(missing.status, 404);
      assert.equal(missing.body.error.code, 'task.not_found');
      const invalid = await daemon.call<{ error: { code: string } }>('usage.get', { path: root, task: 7 });
      assert.equal(invalid.status, 400);
      assert.equal(invalid.body.error.code, 'request.invalid');

      const empty = await usageGet<TaskUsage>(daemon, root, 'epic/01');
      assert.deepEqual(empty.runs, { items: [], remainder: 0 });
      assert.deepEqual(empty.totals, NO_RECORDS);
    });
  });

  it('makes Tasks and unassigned unavailable when the tracker cannot be read, still answers the totals, and refuses a Task', async () => {
    const github = await fakeGitHub([], 500);
    try {
      await withDaemon(async (daemon, artifacts) => {
        const root = makeProject(temporary('binnacle-usage-'), githubTracker(github.base));
        session(artifacts, root, 'unreadable', lines(GRILL, daysAgo(0)));
        await register(daemon, root);

        const body = await usageGet<ProjectUsage>(daemon, root);
        assert.deepEqual(body.totals, GRILL_TOTALS);
        assert.equal((body.tasks as Unavailable).available, false);
        assert.deepEqual(body.unassigned, body.tasks);
        assert.deepEqual(body.byRole, body.tasks);
        // The derived metrics that need the tracker are unavailable as well; the weekly trend does not need it.
        assert.deepEqual(body.derived.perCompletedTask, body.tasks);
        assert.deepEqual(body.derived.runsPerTask, body.tasks);
        assert.deepEqual(
          body.derived.weekly.items.map((item) => item.totals),
          [GRILL_TOTALS],
        );

        const refused = await daemon.call<{ error: { code: string } }>('usage.get', { path: root, task: '#7' });
        assert.equal(refused.status, 503);
        assert.match(refused.body.error.code, /^tracker\./);
      });
    } finally {
      await github.close();
    }
  });
});

type CodexLine = { timestamp: string; ordinal: number; type: string; payload: Record<string, unknown> };

/**
 * One turn of a real Codex rollout: its session meta, a turn context, a prompt, a tool call
 * and its output, the per-call usage record Codex also writes, and eleven token counts, the
 * last of them repeating the total before it. See `fixtures/codex`.
 */
const TOOL_CALLS = readFileSync(join(import.meta.dirname, 'fixtures', 'codex', 'tool-calls.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as CodexLine);
const TOKEN_COUNTS = TOOL_CALLS.filter((record) => record.payload.type === 'token_count');
const [META, CONTEXT] = TOOL_CALLS as [CodexLine, CodexLine];

const calculated = (tokens: number): FieldTotal => ({ tokens, partial: false, provenance: 'calculated' });
/** The session's last total, as ten differences: the eleventh count repeats the tenth. */
const TOOL_CALLS_TOTALS: Totals = {
  records: 10,
  // Codex's 359,975 input tokens include the 280,704 read from cache.
  input: calculated(359975 - 280704),
  cachedInput: calculated(280704),
  cacheCreation: NONE,
  output: calculated(1876),
  reasoning: calculated(425),
};

/** Writes the rollout of session `id`, launched in `cwd`, under Codex's root, and returns its file. */
function rollout(root: string, cwd: string, id: string, records: CodexLine[]): string {
  const dir = join(root, '2026', '09', '07');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `rollout-2026-09-07T20-39-35-${id}.jsonl`);
  const placed = records.map((record) =>
    record.type === 'session_meta' ? { ...record, payload: { ...record.payload, id, session_id: id, cwd } } : record.type === 'turn_context' ? { ...record, payload: { ...record.payload, cwd } } : record,
  );
  writeFileSync(file, placed.map((record) => `${JSON.stringify(record)}\n`).join(''));
  return file;
}

/** The records moved so that the first is at `start`, keeping the time between them. */
function movedTo(records: CodexLine[], start: string): CodexLine[] {
  const shift = Date.parse(start) - Date.parse(records[0]!.timestamp);
  return records.map((record) => ({ ...record, timestamp: new Date(Date.parse(record.timestamp) + shift).toISOString() }));
}

const timed = (record: CodexLine, timestamp: string): CodexLine => ({ ...record, timestamp });

/** Git, with the reflog entries it writes dated `timestamp`. */
function gitAt(timestamp: string, cwd: string, ...args: string[]): void {
  const date = `@${Math.floor(Date.parse(timestamp) / 1000)} +0000`;
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    stdio: 'ignore',
    env: { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date },
  });
}

describe('Codex usage in the Product Snapshot', () => {
  it('turns running totals into differences and input into what was not read from cache, and counts a repeated total once', async () => {
    await withDaemon(async (daemon, _artifacts, codex) => {
      const root = makeProject(temporary('binnacle-usage-'));
      const records = movedTo(TOOL_CALLS, daysAgo(0));
      // Up to the third token count; the rest is appended later.
      const file = rollout(codex, root, 'tool-calls', records.slice(0, 9));
      // A session launched elsewhere is never stored.
      rollout(codex, temporary('binnacle-elsewhere-'), 'elsewhere', records);

      const first = await usage(daemon, root);
      assert.equal(first.today.records, 3);
      assert.deepEqual(first.today.input, calculated(101001 - 33152));
      assert.deepEqual(first.today.cachedInput, calculated(33152));

      appendFileSync(file, records.slice(9).map((record) => `${JSON.stringify(record)}\n`).join(''));
      const body = await snapshotUsage(daemon, root);
      assert.deepEqual(body.today, TOOL_CALLS_TOTALS);
      assert.deepEqual(body.byModel, { items: [{ model: 'gpt-5.6-sol', totals: TOOL_CALLS_TOTALS }], remainder: 0 });
      assert.deepEqual(body.harnesses.map((item) => item.harness), ['claude-code', 'codex', 'gemini-cli', 'opencode']);
      assert.deepEqual(body.harnesses[1], { harness: 'codex', level: 3, reason: null });

      const rows = stored(daemon);
      assert.equal(rows.length, 10);
      assert.ok(rows.every((row) => row.harness === 'codex' && row.provider === 'openai' && row.provenance === 'calculated' && row.cwd === root));
      const { natural_key, session_id, model, branch, input, cached_input, cache_creation, output, reasoning } = rows[0]!;
      assert.deepEqual(
        { natural_key, session_id, model, branch, input, cached_input, cache_creation, output, reasoning },
        { natural_key: 'tool-calls:33', session_id: 'tool-calls', model: 'gpt-5.6-sol', branch: null, input: 33332, cached_input: 0, cache_creation: null, output: 304, reasoning: 76 },
      );
      assert.doesNotMatch(JSON.stringify(rows), new RegExp(MARKER));
    });
  });

  it('takes each call’s model from the turn context in force', async () => {
    await withDaemon(async (daemon, _artifacts, codex) => {
      const root = makeProject(temporary('binnacle-usage-'));
      const records = movedTo(TOOL_CALLS, daysAgo(0));
      const at58 = records.findIndex((record) => record.ordinal === 58);
      const switched = { ...CONTEXT, ordinal: 57, timestamp: records[at58 - 1]!.timestamp, payload: { ...CONTEXT.payload, model: 'gpt-6-astra' } };
      rollout(codex, root, 'switched', [...records.slice(0, at58), switched, ...records.slice(at58)]);

      const body = await usage(daemon, root);
      assert.deepEqual(body.byModel.items.map((item) => [item.model, item.totals.records]), [['gpt-6-astra', 7], ['gpt-5.6-sol', 3]]);
    });
  });

  it('lists the last seven days by provider, with the records whose artifacts state none in a row of their own', async () => {
    await withDaemon(async (daemon, artifacts, codex) => {
      const root = makeProject(temporary('binnacle-usage-'));
      // Codex states its provider; Claude Code states none.
      rollout(codex, root, 'openai', movedTo(TOOL_CALLS, daysAgo(0)));
      session(artifacts, root, 'unstated', [...lines(GRILL, daysAgo(6), '-week'), ...lines(ABORTED, daysAgo(8), '-older')]);

      const body = await usage(daemon, root);
      assert.deepEqual(body.byProvider, {
        items: [
          { provider: 'openai', totals: TOOL_CALLS_TOTALS },
          // Not the record eight days old, which is still stored.
          { provider: null, totals: GRILL_TOTALS },
        ],
        remainder: 0,
      });
      assert.equal(stored(daemon).length, 12);
    });
  });

  it('stops reading a rollout at a total that decreases, keeps what came before it, and says so in telemetry.unreadable', async () => {
    await withDaemon(async (daemon, _artifacts, codex) => {
      const root = makeProject(temporary('binnacle-usage-'));
      const records = movedTo(TOOL_CALLS, daysAgo(0));
      const at58 = records.findIndex((record) => record.ordinal === 58);
      const info = records[at58]!.payload.info as { total_token_usage: Record<string, number> };
      const lowered = { ...records[at58]!, payload: { ...records[at58]!.payload, info: { ...info, total_token_usage: { ...info.total_token_usage, output_tokens: 1 } } } };
      const file = rollout(codex, root, 'decreasing', [...records.slice(0, at58), lowered, ...records.slice(at58 + 1)]);

      const body = await usage(daemon, root);
      assert.equal(body.harnesses[1]?.level, 1);
      assert.match(body.harnesses[1]?.reason ?? '', new RegExp(`^Codex could not read ${file} at line 10: .*nothing after it is counted, however the file grows`));
      assert.equal(body.today.records, 3);
      assert.equal(body.harnesses[0]?.harness, 'claude-code');
      assert.notEqual(body.harnesses[0]?.level, 1);

      // Codex appends to its rollout: the file is read again from its start, and stops at the same line.
      appendFileSync(file, `${JSON.stringify(records.at(-1))}\n`);
      const snapshot = await snapshotWithAttention(daemon, root);
      assert.equal(snapshot.usage.today.records, 3);
      assert.deepEqual(unreadable(snapshot.attention).map((item) => item.message), [snapshot.usage.harnesses[1]?.reason]);

      // Another project's rollout is not this one's to report.
      const other = makeProject(temporary('binnacle-usage-'));
      assert.equal((await usage(daemon, other)).harnesses[1]?.level, null);
    });
  });

  it('recovers a run’s branch from the reflog of the checkout its cwd names, matched by time', async () => {
    await withDaemon(async (daemon, _artifacts, codex) => {
      const parent = temporary('binnacle-usage-');
      const root = makeProject(join(parent, 'project'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      ticket(root, 'epic', '02-second.md', 'Second');
      repository(root, at(1, 0), [at(1, 10), 'feat/first'], [at(1, 20), 'main']);
      const linked = join(parent, 'linked');
      gitAt(at(1, 30), root, 'worktree', 'add', '--quiet', '-b', 'feat/second', linked);
      gitAt(at(1, 40), root, 'switch', '--quiet', '--detach');
      gitAt(at(1, 50), root, 'switch', '--quiet', 'main');

      const [before, onMain, onFirst, back, detached] = TOKEN_COUNTS as [CodexLine, CodexLine, CodexLine, CodexLine, CodexLine];
      rollout(codex, root, 'switching', [
        timed(META, at(2, 0)),
        timed(CONTEXT, at(2, 0)),
        // Before the reflog begins, so it has no answer.
        timed(before, at(2, 0)),
        timed(onMain, at(1, 5)),
        timed(onFirst, at(1, 15)),
        timed(back, at(1, 25)),
        timed(detached, at(1, 45)),
      ]);
      // The linked worktree's own reflog answers, while the main checkout is on main.
      rollout(codex, linked, 'linked', [timed(META, at(1, 35)), timed(CONTEXT, at(1, 35)), timed(before, at(1, 35))]);

      const body = await usage(daemon, root);
      assert.deepEqual(taskRecords(body), [['epic/01', 'First', 1], ['epic/02', 'Second', 1]]);
      assert.equal(available(body.unassigned).records, 4);
      assert.deepEqual(
        stored(daemon).map((row) => [row.natural_key, row.branch, row.branch_source]),
        [
          ['switching:33', null, null],
          ['switching:42', 'main', 'reflog'],
          ['switching:51', 'feat/first', 'reflog'],
          ['switching:58', 'main', 'reflog'],
          ['linked:33', 'feat/second', 'reflog'],
          // A detached HEAD is no branch.
          ['switching:65', null, null],
        ],
      );
    });
  });
});

/**
 * Cut from a real subagent's session: the task it was given, then one message in four
 * records, of which the first three carry the output counted so far and the last the
 * message's final usage. Its `.meta.json` holds the description the parent gave it. The
 * subagent's worktree was made on `worktree-agent-…`, and the subagent switched it to
 * `feat/checkpoint` before that message; Claude Code wrote `main`, the parent's branch, into its task.
 */
const SUBAGENT = fixture('subagent-in-worktree.jsonl');
const SUBAGENT_META = readFileSync(join(FIXTURES, 'subagent-in-worktree.meta.json'), 'utf8');
const SUBAGENT_ID = 'aa8633a64ffc4a92a';
const SUBAGENT_RUN = 'claude-code:msg_011CfM38sqJQkJUVVYv1KJgk';
const SUBAGENT_TOTALS: Totals = {
  records: 1,
  input: reported(2),
  cachedInput: reported(135842),
  cacheCreation: reported(1667),
  // The last record's 1421, not the 32 the earlier ones carried.
  output: reported(1421),
  reasoning: reported(0),
};

/** Writes a subagent's session beside its parent's, launched in `parentCwd`, with its `.meta.json`, as Claude Code does. */
function subagent(artifacts: string, parentCwd: string, parentSession: string, cwd: string, records: Line[]): string {
  const dir = join(artifacts, directoryFor(parentCwd), parentSession, 'subagents');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `agent-${SUBAGENT_ID}.meta.json`), SUBAGENT_META);
  const file = join(dir, `agent-${SUBAGENT_ID}.jsonl`);
  writeFileSync(file, records.map((record) => `${JSON.stringify({ ...record, cwd, sessionId: parentSession })}\n`).join(''));
  return file;
}

/** A repository whose reflog began yesterday on `main`, with a linked worktree on `feat/first` under it, where Claude Code puts its own. */
function repositoryWithWorktree(root: string): string {
  repository(root, at(1, 0));
  const worktree = join(root, '.claude', 'worktrees', `agent-${SUBAGENT_ID}`);
  gitAt(at(1, 10), root, 'worktree', 'add', '--quiet', '-b', 'feat/first', worktree);
  return worktree;
}

describe('Subagent runs', () => {
  it('counts a subagent on its parent’s branch as a run of its own, linked to the run that started it', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      repository(root, at(1, 0), [at(1, 10), 'feat/first']);
      session(artifacts, root, 'parent', lines(GRILL, at(0, 0), '-parent'));
      const file = subagent(artifacts, root, 'parent', root, lines(SUBAGENT, at(0, 1)));
      assert.match(readFileSync(file, 'utf8'), new RegExp(MARKER));
      await register(daemon, root);

      const body = await usageGet<TaskUsage>(daemon, root, 'epic/01');
      assert.equal(body.totals.records, 2);
      assert.deepEqual(
        body.runs.items.map((run) => [run.id, run.parentRunId, run.role, run.taskId, run.totals]),
        [
          [SUBAGENT_RUN, 'claude-code:msg_011CfLMEGjvuTXtzfiK6XfsV-parent', 'implementation', 'epic/01', SUBAGENT_TOTALS],
          ['claude-code:msg_011CfLMEGjvuTXtzfiK6XfsV-parent', null, 'implementation', 'epic/01', GRILL_TOTALS],
        ],
      );

      const records = stored(daemon);
      assert.deepEqual(
        records.map((record) => [record.session_id, record.subagent_id, record.parent_session]),
        [
          ['parent', null, null],
          ['parent', SUBAGENT_ID, 'parent'],
        ],
      );
      // Neither the content of the subagent's session nor the description in its `.meta.json`.
      assert.match(SUBAGENT_META, /SUBAGENT-DESCRIPTION-MUST-NOT-BE-STORED/);
      assert.doesNotMatch(JSON.stringify(records), new RegExp(MARKER));
    });
  });

  it('attributes a subagent in a worktree on a ticket branch to its own Task by that worktree’s reflog, while its parent on main stays Product work', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      const worktree = repositoryWithWorktree(root);
      // Claude Code writes one branch per process: the parent's `main` into the subagent's
      // records, and the subagent's `feat/first` into its parent's for a while.
      session(artifacts, root, 'parent', [
        ...onBranch('main', lines(GRILL, at(0, 0), '-before')),
        ...onBranch('feat/first', lines(ABORTED, at(0, 2), '-after')),
      ]);
      subagent(artifacts, root, 'parent', worktree, onBranch('main', lines(SUBAGENT, at(0, 1))));
      await register(daemon, root);

      const snapshot = await snapshotUsage(daemon, root);
      assert.deepEqual(taskRecords(snapshot), [['epic/01', 'First', 1]]);
      assert.equal(available(snapshot.unassigned).records, 2);

      const body = await usageGet<TaskUsage>(daemon, root, 'epic/01');
      assert.deepEqual(body.totals, SUBAGENT_TOTALS);
      assert.deepEqual(
        body.runs.items.map((run) => [run.id, run.parentRunId, run.role, run.branch, run.branchSource]),
        // Started while its parent's run began with the message before it.
        [[SUBAGENT_RUN, 'claude-code:msg_011CfLMEGjvuTXtzfiK6XfsV-before', 'implementation', 'feat/first', 'reflog']],
      );
      const byRole = available((await usageGet<ProjectUsage>(daemon, root)).byRole);
      assert.deepEqual([byRole.product.records, byRole.implementation.records, byRole.unknown.records], [2, 1, 0]);
    });
  });
});

describe('Implementation, review and rework', () => {
  it('reads review and rework runs from the Task branch’s commits, and splits a run that crosses the Review there', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      repository(root, at(1, 0), [at(1, 10), 'feat/first']);
      const commit = (time: string, file: string, text: string): void => {
        appendFileSync(join(root, file), text);
        gitAt(time, root, 'add', '.');
        gitAt(time, root, 'commit', '--quiet', '-m', file);
      };
      commit(at(0, 10), 'work.txt', 'the change\n');
      // The Review is recorded in a commit of its own, and a fix follows it.
      commit(at(0, 20), 'docs/specs/epic/issues/01-first.md', '\n## Comments\n\n### Review\n\nOne finding.\n');
      commit(at(0, 40), 'work.txt', 'the fix\n');

      // One session from before the Review to after it, which is split there.
      session(artifacts, root, 'parent', [...lines(GRILL, at(0, 0), '-before'), ...lines(ABORTED, at(0, 30), '-after')]);
      // A subagent after the last commit changing anything but the ticket, and ending before the Review: the reviewer.
      subagent(artifacts, root, 'parent', root, lines(SUBAGENT, at(0, 15)));
      // A subagent that started before that commit is implementation work, even after it.
      subagent(artifacts, root, 'early', root, [...lines(SUBAGENT, at(0, 5), '-early'), ...lines(SUBAGENT, at(0, 12), '-later')]);
      await register(daemon, root);

      const task = await usageGet<TaskUsage>(daemon, root, 'epic/01');
      const after = `claude-code:${String(ABORTED.find((line) => line.type === 'assistant')!.message!.id)}-after`;
      assert.deepEqual(
        task.runs.items.map((run) => [run.id, run.role, run.parentRunId, run.startedAt]),
        [
          [after, 'rework', null, at(0, 30)],
          [SUBAGENT_RUN, 'review', 'claude-code:msg_011CfLMEGjvuTXtzfiK6XfsV-before', at(0, 15)],
          [`${SUBAGENT_RUN}-early`, 'implementation', null, at(0, 5)],
          ['claude-code:msg_011CfLMEGjvuTXtzfiK6XfsV-before', 'implementation', null, at(0, 0)],
        ],
      );
      const byRole = {
        // The parent's first record and the early subagent's two.
        implementation: { records: 3, input: reported(6), cachedInput: reported(310909), cacheCreation: reported(33165), output: reported(2979), reasoning: reported(18) },
        review: SUBAGENT_TOTALS,
        rework: ABORTED_TOTALS,
      };
      assert.deepEqual(task.byRole, byRole);

      const brief = await daemon.call<{ byRole: unknown }>('task.get', { path: root, id: 'epic/01' });
      assert.equal(brief.status, 200, JSON.stringify(brief.body));
      assert.deepEqual(brief.body.byRole, byRole);

      const records = (roles: Record<string, Totals>): Record<string, number> => Object.fromEntries(Object.entries(roles).map(([role, totals]) => [role, totals.records]));
      const project = { product: 0, implementation: 3, review: 1, rework: 1, unknown: 0 };
      assert.deepEqual(records(available((await usageGet<ProjectUsage>(daemon, root)).byRole)), project);
      assert.deepEqual(records(available((await snapshotUsage(daemon, root)).byRole)), project);

      // Merged, and its branch deleted: the default branch still holds the Review.
      gitAt(at(0, 50), root, 'switch', '--quiet', 'main');
      gitAt(at(0, 50), root, 'merge', '--quiet', '--no-ff', '-m', 'merge', 'feat/first');
      gitAt(at(0, 50), root, 'branch', '--quiet', '-d', 'feat/first');
      assert.deepEqual((await usageGet<TaskUsage>(daemon, root, 'epic/01')).byRole, byRole);
    });
  });

  it('reads every run of a Task with no Review as implementation', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      repository(root, at(1, 0), [at(1, 10), 'feat/first']);
      session(artifacts, root, 'parent', lines(GRILL, at(0, 0)));
      subagent(artifacts, root, 'parent', root, lines(SUBAGENT, at(0, 15)));
      await register(daemon, root);

      const task = await usageGet<TaskUsage>(daemon, root, 'epic/01');
      assert.deepEqual(task.runs.items.map((run) => run.role), ['implementation', 'implementation']);
      assert.deepEqual(task.byRole.review, NO_RECORDS);
      assert.deepEqual(task.byRole.rework, NO_RECORDS);
      assert.equal(task.reworkUnread, null);
    });
  });
});

describe('Rework after a review on GitHub or GitLab', () => {
  const TOKEN = 'ghp_reviewsAreReadWithThis';

  /** Runs `body` with `name` set to `value` in the daemon's environment, which runs in this process. */
  async function withToken(name: string, value: string | undefined, body: () => Promise<void>): Promise<void> {
    const before = process.env[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
    try {
      await body();
    } finally {
      if (before === undefined) delete process.env[name];
      else process.env[name] = before;
    }
  }

  /** Issue #7 worked on feat/7-seven by one session, before and after `minute` 20 of today. */
  async function workedOnSeven(daemon: TestDaemon, artifacts: string, tracker: string): Promise<string> {
    const root = makeProject(temporary('binnacle-usage-'), tracker);
    repository(root, at(1, 0), [at(1, 10), 'feat/7-seven']);
    session(artifacts, root, 'seven', [...lines(GRILL, at(0, 0), '-before'), ...lines(ABORTED, at(0, 30), '-after')]);
    await register(daemon, root);
    return root;
  }

  const BEFORE = 'claude-code:msg_011CfLMEGjvuTXtzfiK6XfsV-before';
  const AFTER = `claude-code:${String(ABORTED.find((line) => line.type === 'assistant')!.message!.id)}-after`;

  /** Pull request 20 has feat/7-seven as its head, with `reviews`. */
  const pulls =
    (reviews: { state: string; submitted_at: string }[]) =>
    (url: URL): unknown[] | undefined => {
      if (url.pathname === '/repos/octo/repo/pulls') return url.searchParams.get('head') === 'octo:feat/7-seven' ? [{ number: 20 }] : [];
      if (url.pathname === '/repos/octo/repo/pulls/20/reviews') return reviews;
      return undefined;
    };

  it('counts the work after a review that requested changes on the pull request as rework, and splits the run there', async () => {
    const github = await fakeGitHub([{ number: 7, title: 'Seven' }], 200, pulls([
      { state: 'COMMENTED', submitted_at: at(0, 10) },
      { state: 'CHANGES_REQUESTED', submitted_at: at(0, 20) },
      { state: 'CHANGES_REQUESTED', submitted_at: at(0, 25) },
    ]));
    try {
      await withToken('BINNACLE_GITHUB_TOKEN', TOKEN, () =>
        withDaemon(async (daemon, artifacts) => {
          const root = await workedOnSeven(daemon, artifacts, githubTracker(github.base));
          const task = await usageGet<TaskUsage>(daemon, root, '#7');
          assert.deepEqual(task.runs.items.map((run) => [run.id, run.role]), [[AFTER, 'rework'], [BEFORE, 'implementation']]);
          const byRole = { implementation: GRILL_TOTALS, review: NO_RECORDS, rework: ABORTED_TOTALS };
          assert.deepEqual(task.byRole, byRole);
          assert.equal(task.reworkUnread, null);

          const brief = await daemon.call<{ byRole: unknown; reworkUnread: unknown }>('task.get', { path: root, id: '#7' });
          assert.equal(brief.status, 200, JSON.stringify(brief.body));
          assert.deepEqual([brief.body.byRole, brief.body.reworkUnread], [byRole, null]);
          assert.equal(available((await snapshotUsage(daemon, root)).byRole).rework.records, 1);

          // Read with the tracker's token, the pull request found by its head.
          const forge = github.requests.filter(({ url }) => url.pathname.startsWith('/repos/octo/repo/pulls'));
          assert.ok(forge.length > 0);
          assert.ok(forge.every(({ token }) => token === `Bearer ${TOKEN}`));
        }),
      );
    } finally {
      await github.close();
    }
  });

  it('counts no rework before a review requests changes', async () => {
    const github = await fakeGitHub([{ number: 7, title: 'Seven' }], 200, pulls([
      { state: 'COMMENTED', submitted_at: at(0, 10) },
      { state: 'APPROVED', submitted_at: at(0, 20) },
    ]));
    try {
      await withToken('BINNACLE_GITHUB_TOKEN', TOKEN, () =>
        withDaemon(async (daemon, artifacts) => {
          const root = await workedOnSeven(daemon, artifacts, githubTracker(github.base));
          const task = await usageGet<TaskUsage>(daemon, root, '#7');
          assert.deepEqual(task.runs.items.map((run) => run.role), ['implementation']);
          assert.deepEqual(task.byRole.rework, NO_RECORDS);
          assert.equal(task.reworkUnread, null);
        }),
      );
    } finally {
      await github.close();
    }
  });

  it('says why rework is not read without a token, and asks the forge nothing for it', async () => {
    const github = await fakeGitHub([{ number: 7, title: 'Seven' }], 200, pulls([{ state: 'CHANGES_REQUESTED', submitted_at: at(0, 20) }]));
    try {
      await withToken('BINNACLE_GITHUB_TOKEN', undefined, () =>
        withDaemon(async (daemon, artifacts) => {
          const root = await workedOnSeven(daemon, artifacts, githubTracker(github.base));
          const task = await usageGet<TaskUsage>(daemon, root, '#7');
          assert.deepEqual(task.runs.items.map((run) => run.role), ['implementation']);
          assert.match(task.reworkUnread ?? '', /^Without a token for GitHub, the reviews on #7's pull request are not read/);
          const brief = await daemon.call<{ reworkUnread: unknown }>('task.get', { path: root, id: '#7' });
          assert.equal(brief.body.reworkUnread, task.reworkUnread);
          assert.deepEqual(github.requests.filter(({ url }) => url.pathname.includes('/pulls')), []);
        }),
      );
    } finally {
      await github.close();
    }
  });

  it('says why rework is not read when no pull request has the branch as its head, or the forge refuses', async () => {
    const github = await fakeGitHub([{ number: 7, title: 'Seven' }], 200, (url) => (url.pathname === '/repos/octo/repo/pulls' ? [] : undefined));
    try {
      await withToken('BINNACLE_GITHUB_TOKEN', TOKEN, () =>
        withDaemon(async (daemon, artifacts) => {
          const root = await workedOnSeven(daemon, artifacts, githubTracker(github.base));
          const task = await usageGet<TaskUsage>(daemon, root, '#7');
          assert.deepEqual(task.runs.items.map((run) => run.role), ['implementation']);
          assert.equal(task.reworkUnread, "No pull request on GitHub has feat/7-seven as its head. So #7's rework is not read.");
        }),
      );
    } finally {
      await github.close();
    }

    const refusing = await fakeGitHub([{ number: 7, title: 'Seven' }]);
    try {
      await withToken('BINNACLE_GITHUB_TOKEN', TOKEN, () =>
        withDaemon(async (daemon, artifacts) => {
          const root = await workedOnSeven(daemon, artifacts, githubTracker(refusing.base));
          const task = await usageGet<TaskUsage>(daemon, root, '#7');
          assert.match(task.reworkUnread ?? '', /^GitHub has nothing at octo\/repo .* with pull requests visible to this request \(404\); a token was used\. So #7's rework is not read\.$/);
          assert.ok(!task.reworkUnread!.includes(TOKEN));
        }),
      );
    } finally {
      await refusing.close();
    }
  });

  it('counts the work after a reviewer requested changes on the GitLab merge request as rework', async () => {
    const issue = { iid: 7, title: 'Seven', state: 'opened', description: 'Status: READY', labels: [], web_url: 'https://gitlab.com/octo/repo/-/issues/7' };
    const gitlab = await fakeForge((url) => {
      const project = '/projects/octo%2Frepo';
      if (url.pathname === `${project}/issues`) return [issue];
      if (url.pathname === `${project}/merge_requests`) return url.searchParams.get('source_branch') === 'feat/7-seven' ? [{ iid: 3 }] : [];
      if (url.pathname === `${project}/merge_requests/3/notes`) {
        return [
          { system: true, body: 'approved this merge request', created_at: at(0, 10) },
          { system: false, body: 'requested changes', created_at: at(0, 15) },
          { system: true, body: 'requested changes', created_at: at(0, 20) },
        ];
      }
      return undefined;
    });
    try {
      await withToken('BINNACLE_GITLAB_TOKEN', 'glpat-reviewsAreReadWithThis', () =>
        withDaemon(async (daemon, artifacts) => {
          const tracker = `\ntracker:\n  provider: gitlab\n  repository: octo/repo\n  host: ${gitlab.base}\n`;
          const root = await workedOnSeven(daemon, artifacts, tracker);
          const task = await usageGet<TaskUsage>(daemon, root, '#7');
          assert.deepEqual(task.runs.items.map((run) => [run.id, run.role]), [[AFTER, 'rework'], [BEFORE, 'implementation']]);
          assert.deepEqual(task.byRole, { implementation: GRILL_TOTALS, review: NO_RECORDS, rework: ABORTED_TOTALS });
          assert.equal(task.reworkUnread, null);
        }),
      );
    } finally {
      await gitlab.close();
    }
  });
});

describe('The unfinished tail of a Claude Code file', () => {
  it('stores a file’s last message only once a later one has started, or the file has settled, with the usage of its last record', async () => {
    await withDaemon(
      async (daemon, artifacts) => {
        const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
        ticket(root, 'epic', '01-first.md', 'First');
        repository(root, at(1, 0), [at(1, 10), 'feat/first']);
        session(artifacts, root, 'parent', lines(GRILL, at(0, 0), '-parent'));
        const records = lines(SUBAGENT, at(0, 1));
        // The task and the first two records of its message, which carry the output counted so far.
        const file = subagent(artifacts, root, 'parent', root, records.slice(0, 3));
        await register(daemon, root);
        const runs = async (): Promise<[string, number | null][]> =>
          (await usageGet<TaskUsage>(daemon, root, 'epic/01')).runs.items.map((run) => [run.id, run.totals.output.tokens]);
        // Each file's last message is still being written, as far as the daemon can tell.
        assert.deepEqual(await runs(), []);

        const append = (lines: Line[]): void =>
          appendFileSync(file, lines.map((line) => `${JSON.stringify({ ...line, cwd: root, sessionId: 'parent' })}\n`).join(''));
        append(records.slice(3));
        assert.deepEqual(await runs(), []);
        // A later message has started, so the one before it is finished.
        append(lines(ABORTED, at(0, 2), '-later').map((line) => ({ ...line, isSidechain: true, agentId: SUBAGENT_ID })));
        assert.deepEqual(await runs(), [[SUBAGENT_RUN, 1421]]);

        // Files unwritten for long enough are finished.
        const settled = new Date(Date.now() - 2 * 3_600_000);
        for (const path of [file, join(artifacts, directoryFor(root), 'parent.jsonl')]) utimesSync(path, settled, settled);
        assert.deepEqual(await runs(), [
          [SUBAGENT_RUN, 1421 + 2],
          ['claude-code:msg_011CfLMEGjvuTXtzfiK6XfsV-parent', 137],
        ]);
        assert.equal(stored(daemon).length, 3);
      },
      { settledAfterMs: 3_600_000 },
    );
  });
});

describe('Where a record’s branch comes from', () => {
  it('takes a Claude Code record’s branch from the reflog of the checkout it names, never from the branch Claude Code wrote', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      const worktree = repositoryWithWorktree(root);
      session(artifacts, worktree, 'wrong', onBranch('main', lines(GRILL, at(0, 0), '-in-worktree')));
      session(artifacts, root, 'leaked', onBranch('feat/first', lines(GRILL, at(0, 1), '-in-root')));
      // Older than the reflog, which has no answer: the branch Claude Code wrote is stored, and credits no Task.
      session(artifacts, root, 'older', onBranch('feat/first', lines(ABORTED, at(2, 0), '-older')));
      const body = await usage(daemon, root);

      assert.deepEqual(taskRecords(body), [['epic/01', 'First', 1]]);
      assert.deepEqual(
        stored(daemon).map((row) => [row.natural_key, row.branch, row.branch_source]),
        [
          ['msg_011CfQGNrVrPXXM5Kt7SPr4S-older', 'feat/first', 'harness'],
          ['msg_011CfLMEGjvuTXtzfiK6XfsV-in-worktree', 'feat/first', 'reflog'],
          ['msg_011CfLMEGjvuTXtzfiK6XfsV-in-root', 'main', 'reflog'],
        ],
      );
    });
  });

  it('attributes nothing by a branch Claude Code wrote that the store holds from ADR-0028’s order, though the reflog would answer', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      repository(root, at(1, 0), [at(1, 10), 'feat/first']);
      session(artifacts, root, 'stored', lines(GRILL, at(0, 0)));
      await register(daemon, root);
      assert.deepEqual(taskRecords(await usageGet<ProjectUsage>(daemon, root)), [['epic/01', 'First', 1]]);

      // The record as a daemon that took Claude Code's branch first stored it: a fixture, since
      // there is no API for an earlier release's store. A record is ingested once, so nothing rewrites it.
      const db = new DatabaseSync(storePath(daemon.home));
      db.exec("update ingested_record set branch = 'main', branch_source = 'harness'");
      db.close();

      const body = await usageGet<ProjectUsage>(daemon, root);
      assert.deepEqual(taskRecords(body), []);
      const byRole = available(body.byRole);
      assert.deepEqual([byRole.product.records, byRole.implementation.records, byRole.unknown.records], [0, 0, 1]);
    });
  });

  it('keeps a worktree’s run on its Task after the worktree and its branch are removed, when a snapshot read it before', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      const worktree = repositoryWithWorktree(root);
      // Claude Code writes its parent's `main`, so only the worktree's reflog names the ticket.
      subagent(artifacts, root, 'parent', worktree, onBranch('main', lines(SUBAGENT, at(0, 1))));
      await register(daemon, root);

      // Autopilot's order after a merge: the snapshot until the import is complete, then the removal.
      await untilImported(daemon, root);
      git(root, 'worktree', 'remove', worktree);
      git(root, 'branch', '-d', 'feat/first');

      const body = await usageGet<TaskUsage>(daemon, root, 'epic/01');
      // Its checkout is gone, and the registered one that still contains its path is not where it ran.
      assert.deepEqual(
        body.runs.items.map((run) => [run.id, run.role, run.branch, run.branchSource, run.checkout]),
        [[SUBAGENT_RUN, 'implementation', 'feat/first', 'reflog', null]],
      );
    });
  });

  it('stores the branch a Codex session started on where the reflog has no answer, and attributes nothing by it', async () => {
    await withDaemon(async (daemon, _artifacts, codex) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      const records = movedTo(TOOL_CALLS, daysAgo(0));
      // As Codex writes it; the fixture drops the repository's URL.
      const meta = { ...records[0]!, payload: { ...records[0]!.payload, git: { commit_hash: 'c0ffee', branch: 'feat/first' } } };
      rollout(codex, root, 'started-on-first', [meta, ...records.slice(1)]);

      const body = await usage(daemon, root);
      assert.deepEqual(taskRecords(body), []);
      assert.equal(available(body.unassigned).records, 10);
      assert.ok(stored(daemon).every((row) => row.branch === 'feat/first' && row.branch_source === 'harness'));
    });
  });
});

type ActivityRun = Run & { taskTitle: string | null };
type Activity = { running: { items: ActivityRun[]; remainder: number }; recent: ActivityRun[] };

async function activity(daemon: TestDaemon, root: string): Promise<Activity | Unavailable> {
  const result = await daemon.call<{ activity: Activity | Unavailable }>('project.snapshot', { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.activity;
}

const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

describe('What is running now, in the Product Snapshot', () => {
  it('splits the project’s runs at telemetry’s recency into running and recent, latest activity first, each as usage.get gives it with its Task’s title', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      repository(root, at(2, 0), [at(1, 0), 'feat/first']);
      const now = minutesAgo(1);
      const nine = minutesAgo(9);
      const eleven = minutesAgo(11);
      session(artifacts, root, 'now', lines(GRILL, now, '-now'));
      session(artifacts, root, 'nine', lines(GRILL, nine, '-nine'));
      session(artifacts, root, 'eleven', lines(GRILL, eleven, '-eleven'));
      // Started yesterday, and still at it: a run is running by its latest activity.
      session(artifacts, root, 'long', [...lines(GRILL, at(1, 30), '-started'), ...lines(ABORTED, minutesAgo(2), '-latest')]);
      session(artifacts, root, 'yesterday', lines(GRILL, at(1, 40), '-yesterday'));
      await register(daemon, root);

      const body = available(await activity(daemon, root));
      const id = (suffix: string): string => `claude-code:msg_011CfLMEGjvuTXtzfiK6XfsV-${suffix}`;
      assert.deepEqual(body.running.items.map((run) => run.id), [id('now'), id('started'), id('nine')]);
      assert.equal(body.running.remainder, 0);
      assert.deepEqual(body.recent.map((run) => run.id), [id('eleven'), id('yesterday')]);
      assert.ok(body.running.items.every((run) => run.active.value));
      assert.ok(body.recent.every((run) => !run.active.value));

      const runs = new Map((await usageGet<TaskUsage>(daemon, root, 'epic/01')).runs.items.map((run) => [run.id, run]));
      for (const run of [...body.running.items, ...body.recent]) assert.deepEqual(run, { ...runs.get(run.id), taskTitle: 'First' });
    });
  });

  it('lists at most ten runs running now, with a remainder, and the ten latest other runs', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      repository(root, at(2, 0));
      for (let minute = 0; minute < 11; minute++) {
        session(artifacts, root, `running-${minute}`, lines(GRILL, minutesAgo(1 + minute / 2), `-running-${minute}`));
        session(artifacts, root, `recent-${minute}`, lines(GRILL, at(1, minute), `-recent-${minute}`));
      }
      await register(daemon, root);

      const body = available(await activity(daemon, root));
      assert.equal(body.running.items.length, 10);
      assert.equal(body.running.remainder, 1);
      assert.deepEqual(
        body.recent.map((run) => run.lastActivityAt),
        Array.from({ length: 10 }, (_, index) => at(1, 10 - index)),
      );
    });
  });

  it('names each running run’s checkout, and its Task or its role: a Task’s run in a linked worktree, a Product session on the default branch, and an unassigned run', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      const worktree = repositoryWithWorktree(root);
      const spike = join(root, '.claude', 'worktrees', 'spike');
      gitAt(at(1, 20), root, 'worktree', 'add', '--quiet', '-b', 'spike', spike);
      session(artifacts, worktree, 'ticket', lines(GRILL, minutesAgo(1), '-ticket'));
      session(artifacts, root, 'product', lines(GRILL, minutesAgo(2), '-product'));
      session(artifacts, spike, 'spike', lines(GRILL, minutesAgo(3), '-spike'));
      await register(daemon, root);

      const body = available(await activity(daemon, root));
      assert.deepEqual(
        body.running.items.map((run) => [run.taskId, run.taskTitle, run.role, run.branch, run.checkout, run.harness, run.model]),
        [
          ['epic/01', 'First', 'implementation', 'feat/first', worktree, 'claude-code', 'claude-opus-5-5'],
          [null, null, 'product', 'main', root, 'claude-code', 'claude-opus-5-5'],
          [null, null, 'unknown', 'spike', spike, 'claude-code', 'claude-opus-5-5'],
        ],
      );
    });
  });

  it('is unavailable, with the tracker’s reason, when the tracker cannot be read', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'));
      repository(root, at(1, 0));
      session(artifacts, root, 'product', lines(GRILL, minutesAgo(1)));
      await register(daemon, root);

      assert.deepEqual(await activity(daemon, root), { available: false, reason: 'This project declares no tracker.provider.' });
    });
  });
});

/** One message of Aborted: it reports no reasoning. */
const ABORTED_TOTALS: Totals = { records: 1, input: reported(4), cachedInput: reported(167306), cacheCreation: reported(994), output: reported(2), reasoning: NONE };

/** Local midnight of the Monday `weeks` weeks before this week's. */
function monday(weeks: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - 7 * weeks);
}

describe('Derived metrics in usage.get', () => {
  it('gives each DONE Task’s totals and runs, and their mean per field, leaving out the DONE Tasks without runs, each part calculated', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First', 'DONE');
      ticket(root, 'epic', '02-second.md', 'Second', 'DONE');
      ticket(root, 'epic', '03-third.md', 'Third', 'DONE');
      ticket(root, 'epic', '04-fourth.md', 'Fourth');
      repository(root, at(3, 0), [at(2, 0), 'feat/first'], [at(2, 1), 'feat/second'], [at(2, 2), 'feat/fourth'], [at(2, 3), 'main']);
      session(artifacts, root, 'work', [
        ...lines(GRILL, at(2, 0), '-first'),
        ...lines(ABORTED, at(2, 1), '-second'),
        ...lines(GRILL, at(2, 2), '-fourth'),
        ...lines(GRILL, at(2, 3), '-main'),
      ]);
      await register(daemon, root);

      const { derived } = await usageGet<ProjectUsage>(daemon, root);
      assert.deepEqual(available(derived.perCompletedTask), {
        provenance: 'calculated',
        // Largest totals first; the READY Task is not a completed one.
        items: [
          { id: 'epic/02', title: 'Second', runs: 1, totals: ABORTED_TOTALS },
          { id: 'epic/01', title: 'First', runs: 1, totals: GRILL_TOTALS },
        ],
        remainder: 0,
        // Over the two with runs: the third is counted apart, never as a zero.
        // A mean is Binnacle's arithmetic over reported totals: calculated.
        mean: {
          records: 1,
          input: calculated((2 + 4) / 2),
          cachedInput: calculated((39225 + 167306) / 2),
          cacheCreation: calculated((29831 + 994) / 2),
          output: calculated((137 + 2) / 2),
          // Only the first Task reports it: its mean is over that one, and partial.
          reasoning: { tokens: 18, partial: true, provenance: 'calculated' },
        },
        withoutRuns: 1,
      });
    });
  });

  it('gives no mean when no DONE Task has runs', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First', 'DONE');
      repository(root, at(1, 0));
      session(artifacts, root, 'main', lines(GRILL, at(0, 0)));
      await register(daemon, root);

      const { derived } = await usageGet<ProjectUsage>(daemon, root);
      assert.deepEqual(available(derived.perCompletedTask), { provenance: 'calculated', items: [], remainder: 0, mean: null, withoutRuns: 1 });
      assert.deepEqual(available(derived.runsPerTask), { provenance: 'calculated', items: [], remainder: 0, mean: null });
    });
  });

  it('counts each Task’s runs, the subagents’ among them apart, most runs first, and their mean', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First', 'DONE');
      ticket(root, 'epic', '02-second.md', 'Second');
      repository(root, at(1, 0), [at(1, 10), 'feat/second'], [at(1, 20), 'feat/first']);
      session(artifacts, root, 'second', lines(GRILL, at(1, 10), '-second'));
      session(artifacts, root, 'parent', lines(GRILL, at(0, 0), '-parent'));
      subagent(artifacts, root, 'parent', root, lines(SUBAGENT, at(0, 1)));
      await register(daemon, root);

      const { derived } = await usageGet<ProjectUsage>(daemon, root);
      assert.deepEqual(available(derived.runsPerTask), {
        provenance: 'calculated',
        items: [
          { id: 'epic/01', title: 'First', runs: 2, subagentRuns: 1 },
          { id: 'epic/02', title: 'Second', runs: 1, subagentRuns: 0 },
        ],
        remainder: 0,
        mean: { runs: 1.5, subagentRuns: 0.5 },
      });
      // The subagent's run is one of the DONE Task's two.
      assert.deepEqual(
        available(derived.perCompletedTask).items.map((item) => [item.id, item.runs, item.totals.records]),
        [['epic/01', 2, 2]],
      );
    });
  });

  it('totals each calendar week from Monday in local time, oldest first, an empty week included, with null and partial fields as the totals give them', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      const minuteBefore = (date: Date): string => new Date(date.getTime() - 60_000).toISOString();
      session(artifacts, root, 'weeks', [
        ...lines(GRILL, new Date(monday(3).getTime() + 12 * 3_600_000).toISOString(), '-old'),
        // The last minute of a Sunday, then the first of the Monday after it.
        ...lines(ABORTED, minuteBefore(monday(0)), '-sunday'),
        ...lines(GRILL, monday(0).toISOString(), '-monday-first'),
        ...lines(ABORTED, monday(0).toISOString(), '-monday-second'),
      ]);
      await register(daemon, root);

      // The helper's Monday is one, and this week's.
      assert.equal(monday(0).getDay(), 1);
      assert.ok(Date.now() - monday(0).getTime() < 7 * 24 * 3_600_000);

      const { derived } = await usageGet<ProjectUsage>(daemon, root);
      assert.equal(derived.weekly.provenance, 'calculated');
      assert.deepEqual(derived.weekly.items, [
        { week: localDate(monday(3)), totals: GRILL_TOTALS },
        { week: localDate(monday(2)), totals: NO_RECORDS },
        // Aborted reports no reasoning: null, never zero.
        { week: localDate(monday(1)), totals: ABORTED_TOTALS },
        // Only one of the two reports it: partial.
        {
          week: localDate(monday(0)),
          totals: {
            records: 2,
            input: reported(2 + 4),
            cachedInput: reported(39225 + 167306),
            cacheCreation: reported(29831 + 994),
            output: reported(137 + 2),
            reasoning: { tokens: 18, partial: true, provenance: 'provider_reported' },
          },
        },
      ]);
    });
  });
});
