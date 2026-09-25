import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
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
  tasks: Unavailable;
  unassigned: Unavailable;
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

async function withDaemon(body: (daemon: TestDaemon, artifacts: string) => Promise<void>, options: { home?: string; ingestBudgetMs?: number } = {}): Promise<void> {
  const artifacts = temporary('binnacle-claude-projects-');
  const daemon = await startTestDaemon({ ...options, artifacts: { claudeCode: artifacts } });
  try {
    await body(daemon, artifacts);
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
      assert.deepEqual(body.harnesses, [{ harness: 'claude-code', level: 3, reason: null }]);
      assert.deepEqual(body.tasks, { available: false, reason: 'Not available in this version of Binnacle.' });
      assert.deepEqual(body.unassigned, { available: false, reason: 'Not available in this version of Binnacle.' });

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
      assert.deepEqual(partial.harnesses, [{ harness: 'claude-code', level: 3, reason: null }]);

      appendFileSync(file, `${two!.slice(40)}\n`);
      const complete = await usage(daemon, root);
      assert.equal(complete.today.records, 2);
      assert.deepEqual(complete.harnesses, [{ harness: 'claude-code', level: 3, reason: null }]);
      assert.equal(stored(daemon).length, 2);
    });
  });

  it('reports the level Claude Code reached for the project', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const none = makeProject(temporary('binnacle-usage-'));
      const [absent] = (await usage(daemon, none)).harnesses;
      assert.equal(absent?.level, null);
      assert.match(absent?.reason ?? '', new RegExp(artifacts));

      const unreported = makeProject(temporary('binnacle-usage-'));
      session(artifacts, unreported, 'unreported', lines(ABORTED, daysAgo(0), '-unreported', { usage: {} }));
      const level2 = await usage(daemon, unreported);
      assert.deepEqual(level2.harnesses, [{ harness: 'claude-code', level: 2, reason: null }]);
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

  it('carries the Claude Code artifact root in the runtime', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const { body } = await daemon.call<{ artifacts: { claudeCode: string } }>('daemon.status');
      assert.deepEqual(body.artifacts, { claudeCode: artifacts });
    });
    assert.deepEqual(resolveArtifactRoots({ CLAUDE_CONFIG_DIR: '/config/claude' }), { claudeCode: join('/config/claude', 'projects') });
    assert.deepEqual(resolveArtifactRoots({}), { claudeCode: join(homedir(), '.claude', 'projects') });
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

    const daemon = await startTestDaemon({ home, artifacts: { claudeCode: artifactRoot }, ingestBudgetMs: 0 });
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
      assert.deepEqual(body.harnesses, [{ harness: 'claude-code', level: 3, reason: null }]);
    });
  });
});
