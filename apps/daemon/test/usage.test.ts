import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { resolveArtifactRoots, storePath } from '../src/home.ts';
import { openStore } from '../src/store.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';
import { projectCheckouts, runs } from '../src/usage.ts';

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
  tasks: { items: { id: string; title: string | null; totals: Totals }[]; remainder: number } | Unavailable;
  unassigned: Totals | Unavailable;
  harnesses: { harness: string; level: number | null; reason: string | null }[];
};
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

/** Runs `body` against a daemon whose Claude Code and Codex artifact roots are temporary directories. */
async function withDaemon(
  body: (daemon: TestDaemon, artifacts: string, codex: string) => Promise<void>,
  options: { home?: string; ingestBudgetMs?: number } = {},
): Promise<void> {
  const artifacts = temporary('binnacle-claude-projects-');
  const codex = temporary('binnacle-codex-sessions-');
  const daemon = await startTestDaemon({ ...options, artifacts: { claudeCode: artifacts, codex } });
  try {
    await body(daemon, artifacts, codex);
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

  it('carries the Claude Code and Codex artifact roots in the runtime', async () => {
    await withDaemon(async (daemon, artifacts, codex) => {
      const { body } = await daemon.call<{ artifacts: { claudeCode: string; codex: string } }>('daemon.status');
      assert.deepEqual(body.artifacts, { claudeCode: artifacts, codex });
    });
    assert.deepEqual(resolveArtifactRoots({ CLAUDE_CONFIG_DIR: '/config/claude', CODEX_HOME: '/config/codex' }), {
      claudeCode: join('/config/claude', 'projects'),
      codex: join('/config/codex', 'sessions'),
    });
    assert.deepEqual(resolveArtifactRoots({}), { claudeCode: join(homedir(), '.claude', 'projects'), codex: join(homedir(), '.codex', 'sessions') });
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
// The daemon runs in this process and reads its environment: a token the developer has set
// would otherwise reach the loopback GitHub stand-in.
delete process.env.BINNACLE_GITHUB_TOKEN;

const LOCAL_TRACKER = '\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n';

/** Writes `docs/specs/<spec>/issues/<file>` with a title and a state, as the local tracker reads it. */
function ticket(root: string, spec: string, file: string, title: string): void {
  const path = join(root, 'docs', 'specs', spec, 'issues', file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `# ${file.slice(0, 2)}: ${title}\n\nStatus: READY\n`);
}

/** Local noon `days` days ago, `minute` minutes on. */
const at = (days: number, minute: number): string => new Date(Date.parse(daysAgo(days)) + minute * 60_000).toISOString();

/** The fixture's lines as Claude Code writes them on `branch`, which it records as `gitBranch`. */
const onBranch = (branch: string, source: Line[]): Line[] => source.map((line) => ({ ...line, gitBranch: branch }));

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'ignore' });
}

function repository(root: string): string {
  git(root, 'init', '--quiet', '--initial-branch=main');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'initial');
  return root;
}

const NO_RECORDS: Totals = { records: 0, input: NONE, cachedInput: NONE, cacheCreation: NONE, output: NONE, reasoning: NONE };
const available = <T>(section: T | Unavailable): T => {
  assert.ok(!(typeof section === 'object' && section !== null && 'available' in section), JSON.stringify(section));
  return section as T;
};
const taskRecords = (body: Pick<Usage, 'tasks'>): [string, string | null, number][] =>
  available(body.tasks).items.map((item) => [item.id, item.title, item.totals.records]);

/** A loopback stand-in for GitHub's issue list, serving `issues` for `octo/repo`, or `status` with no issues. */
async function fakeGitHub(issues: { number: number; title: string }[], status = 200): Promise<{ base: string; close(): Promise<void> }> {
  const server = createServer((request, response) => {
    const found = new URL(request.url ?? '/', 'http://x').pathname === '/repos/octo/repo/issues';
    response.writeHead(found ? status : 404, { 'content-type': 'application/json' });
    const body = issues.map(({ number, title }) => ({
      number,
      title,
      state: 'open',
      state_reason: null,
      body: 'Status: READY',
      labels: [],
      html_url: `https://github.com/octo/repo/issues/${number}`,
    }));
    response.end(JSON.stringify(found && status === 200 ? body : { message: 'Server Error' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
const githubTracker = (host: string): string => `\ntracker:\n  provider: github\n  repository: octo/repo\n  host: ${host}\n`;

describe('Observed runs and Task attribution in the Product Snapshot', () => {
  it('splits a session where it switches branch, and gives each part to the Task its branch maps to, largest first', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      ticket(root, 'epic', '02-second.md', 'Second');
      session(artifacts, root, 'switching', [
        ...onBranch('feat/first', lines(GRILL, at(1, 0), '-first')),
        ...onBranch('feat/second', lines(ABORTED, at(1, 1), '-second')),
        ...onBranch('feat/first', lines(GRILL, at(1, 2), '-back')),
        ...onBranch('main', lines(ABORTED, at(1, 3), '-main')),
        // Outside the last seven days.
        ...onBranch('feat/first', lines(GRILL, at(7, 0), '-old')),
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

  it('attributes a run in a worktree that no longer exists by the branch Claude Code recorded', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      // Where Claude Code puts its worktrees, removed after the merge with its branch.
      session(artifacts, join(root, '.claude', 'worktrees', 'agent-gone'), 'gone', onBranch('feat/first', lines(GRILL, daysAgo(0))));

      const body = await usage(daemon, root);
      assert.deepEqual(taskRecords(body), [['epic/01', 'First', 1]]);
      assert.deepEqual(body.unassigned, NO_RECORDS);
    });
  });

  it('counts a session in a linked worktree outside the project’s directory while that worktree exists', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const parent = temporary('binnacle-usage-');
      const root = makeProject(join(parent, 'project'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      repository(root);
      const outside = join(parent, 'elsewhere');
      git(root, 'worktree', 'add', '--quiet', '-b', 'feat/first', outside);
      session(artifacts, outside, 'outside', onBranch('feat/first', lines(GRILL, daysAgo(0), '-outside')));
      session(artifacts, join(outside, 'apps'), 'nested', onBranch('feat/first', lines(ABORTED, daysAgo(0), '-nested')));
      // A directory beside it that is no worktree of the project.
      session(artifacts, join(parent, 'unrelated'), 'unrelated', onBranch('feat/first', lines(GRILL, daysAgo(0), '-unrelated')));

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
      session(artifacts, root, 'several', [
        ...onBranch('feat/shared', lines(GRILL, at(0, 0), '-shared')),
        ...onBranch('feat/nothing', lines(GRILL, at(0, 1), '-nothing')),
        ...onBranch('main', lines(GRILL, at(0, 2), '-main')),
        ...onBranch('feat/first', lines(ABORTED, at(0, 3), '-first')),
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
      session(artifacts, root, 'many', numbers.flatMap((number, index) => onBranch(`feat/task-${number}`, lines(GRILL, at(0, index), `-${number}`))));

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
        session(artifacts, root, 'issues', [
          ...onBranch('feat/7-seven', lines(GRILL, at(0, 0), '-seven')),
          // Renamed since: the number still names the issue.
          ...onBranch('feat/7-renamed', lines(GRILL, at(0, 1), '-renamed')),
          ...onBranch('feat/8-no-such-issue', lines(GRILL, at(0, 2), '-eight')),
        ]);

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
        session(artifacts, root, 'unreadable', onBranch('feat/7-seven', lines(GRILL, daysAgo(0))));

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

  /**
   * `usage.get` shows only a Task's runs, so a run with no Task — `unknown`, or `product` on a
   * default branch no Task's branch is — is in no answer; `usage.get`'s own test shows the
   * roles it can. This reads the runs the daemon derives from what it ingested, through the
   * function `usage.get` uses, over the daemon's own store and a real repository.
   */
  it('gives a run on the default branch the product role, on a Task’s branch implementation, and unknown otherwise', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const trunk = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      ticket(trunk, 'epic', '01-first.md', 'First');
      repository(trunk);
      // `origin/HEAD` names the default branch, here not `main`.
      git(trunk, 'update-ref', 'refs/remotes/origin/trunk', 'HEAD');
      git(trunk, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk');
      const plain = makeProject(temporary('binnacle-usage-'), LOCAL_TRACKER);
      repository(plain);

      const branches = ['trunk', 'main', 'feat/first', 'feat/nothing'];
      for (const root of [trunk, plain]) {
        session(artifacts, root, 'roles', branches.flatMap((branch, index) => onBranch(branch, lines(ABORTED, at(0, index), `-${index}-${root}`))));
        await usage(daemon, root);
      }

      const tasks = [{ id: 'epic/01', title: 'First', ticket: 'docs/specs/epic/issues/01-first.md' }];
      const store = openStore(daemon.home);
      try {
        const roles = async (root: string): Promise<[string | null, string, string | null][]> =>
          (await runs(store.usage(root, at(1, 0)), root, tasks, false, await projectCheckouts(root))).map((run) => [run.branch, run.role, run.taskId]);
        const expected: [string, string, string | null][] = [
          ['trunk', 'product', null],
          ['main', 'unknown', null],
          ['feat/first', 'implementation', 'epic/01'],
          ['feat/nothing', 'unknown', null],
        ];
        assert.deepEqual(await roles(trunk), expected);
        // Without `origin/HEAD`, the default branch is `main`.
        assert.deepEqual(await roles(plain), [
          ['trunk', 'unknown', null],
          ['main', 'product', null],
          ['feat/first', 'implementation', 'epic/01'],
          ['feat/nothing', 'unknown', null],
        ]);
      } finally {
        store.close();
      }
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
  startedAt: string;
  lastActivityAt: string;
  active: { value: boolean; provenance: string };
  totals: Totals;
};
type ProjectUsage = Pick<Usage, 'importing' | 'tasks' | 'unassigned'> & { totals: Totals };
type TaskUsage = Pick<Usage, 'importing'> & { task: { id: string; title: string | null }; totals: Totals; runs: { items: Run[]; remainder: number } };

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
      session(artifacts, root, 'window', [
        // Older than the snapshot's week, still in the window.
        ...onBranch('feat/first', lines(GRILL, at(20, 0), '-old')),
        ...onBranch('feat/second', lines(ABORTED, at(0, 0), '-second')),
        ...onBranch('main', lines(GRILL, at(0, 1), '-main')),
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
      // One run that began before the last seven days: its id is still its first record's.
      session(artifacts, root, 'long', [...onBranch('feat/first', lines(GRILL, at(9, 0), '-nine')), ...onBranch('feat/first', lines(ABORTED, at(1, 0), '-one'))]);
      session(artifacts, root, 'recent', onBranch('feat/first', lines(GRILL, recent, '-recent')));
      session(artifacts, root, 'other', onBranch('feat/second', lines(GRILL, at(0, 0), '-other')));
      await register(daemon, root);

      // The id in any form `task.get` takes.
      const body = await usageGet<TaskUsage>(daemon, root, 'epic/1');
      assert.deepEqual(body.task, { id: 'epic/01', title: 'First' });
      assert.equal(body.totals.records, 3);
      assert.deepEqual(body.totals.output, reported(2 * 137 + 2));
      const run = { harness: 'claude-code', provider: null, model: 'claude-opus-5-5', role: 'implementation', branch: 'feat/first', branchSource: 'harness', taskId: 'epic/01', parentRunId: null };
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
        session(artifacts, root, `task-${number}`, onBranch(`feat/task-${number}`, lines(GRILL, at(1, Number(number)), `-${number}`)));
      }
      // Eleven more runs of the first Task, a session each.
      for (const number of numbers.slice(1)) session(artifacts, root, `again-${number}`, onBranch('feat/task-01', lines(ABORTED, at(0, Number(number)), `-again-${number}`)));
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
      repository(root);
      // `origin/HEAD` names the default branch, here the first Task's.
      git(root, 'update-ref', 'refs/remotes/origin/feat/first', 'HEAD');
      git(root, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/feat/first');
      session(artifacts, root, 'roles', [...onBranch('feat/first', lines(GRILL, at(0, 0), '-first')), ...onBranch('feat/second', lines(GRILL, at(0, 1), '-second'))]);
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
      session(artifacts, root, 'main', onBranch('main', lines(GRILL, daysAgo(0))));
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
        session(artifacts, root, 'unreadable', onBranch('feat/7-seven', lines(GRILL, daysAgo(0))));
        await register(daemon, root);

        const body = await usageGet<ProjectUsage>(daemon, root);
        assert.deepEqual(body.totals, GRILL_TOTALS);
        assert.equal((body.tasks as Unavailable).available, false);
        assert.deepEqual(body.unassigned, body.tasks);

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
      assert.deepEqual(body.harnesses.map((item) => item.harness), ['claude-code', 'codex']);
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

  it('stops reading a rollout at a total that decreases, and keeps what came before it', async () => {
    await withDaemon(async (daemon, _artifacts, codex) => {
      const root = makeProject(temporary('binnacle-usage-'));
      const records = movedTo(TOOL_CALLS, daysAgo(0));
      const at58 = records.findIndex((record) => record.ordinal === 58);
      const info = records[at58]!.payload.info as { total_token_usage: Record<string, number> };
      const lowered = { ...records[at58]!, payload: { ...records[at58]!.payload, info: { ...info, total_token_usage: { ...info.total_token_usage, output_tokens: 1 } } } };
      const file = rollout(codex, root, 'decreasing', [...records.slice(0, at58), lowered, ...records.slice(at58 + 1)]);

      const body = await usage(daemon, root);
      assert.equal(body.harnesses[1]?.level, 1);
      assert.match(body.harnesses[1]?.reason ?? '', new RegExp(`${file}.*line 10`));
      assert.equal(body.today.records, 3);
    });
  });

  it('recovers a run’s branch from the reflog of the checkout its cwd names, matched by time', async () => {
    await withDaemon(async (daemon, _artifacts, codex) => {
      const parent = temporary('binnacle-usage-');
      const root = makeProject(join(parent, 'project'), LOCAL_TRACKER);
      ticket(root, 'epic', '01-first.md', 'First');
      ticket(root, 'epic', '02-second.md', 'Second');
      gitAt(at(1, 0), root, 'init', '--quiet', '--initial-branch=main');
      gitAt(at(1, 0), root, 'add', '.');
      gitAt(at(1, 0), root, 'commit', '--quiet', '-m', 'initial');
      gitAt(at(1, 10), root, 'switch', '--quiet', '-c', 'feat/first');
      gitAt(at(1, 20), root, 'switch', '--quiet', 'main');
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
