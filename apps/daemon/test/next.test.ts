import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * The snapshot's `next` through the daemon's HTTP API: the roadmap's Next action, its two
 * attention items, and Binnacle's Suggested step beside it as alternatives, each of its eight
 * rules on a fixture where exactly that rule applies (ADR-0032), with the values its description
 * names in `params`, which core words in Russian. Runs come from Claude Code
 * sessions, cut from real ones, that a real repository's reflog puts on their Tasks' branches.
 */
type Alternative = { kind: string; tasks: string[]; params: Record<string, string | number>; command: string | null; description: string; provenance: string };
type Next = { action: { description: string; command: string } | null; alternatives: Alternative[] | { available: false; reason: string } };
type Snapshot = {
  roadmap: { current: { number: number } | null } | null;
  next: Next;
  attention: { code: string; message: string }[];
  tasks: { inFlight: { items: { id: string; questions: { asked: number; unanswered: number } | null }[] } } | null;
};
type Line = Record<string, unknown> & { type: string; message?: Record<string, unknown> };

const GRILL = readFileSync(join(import.meta.dirname, 'fixtures', 'claude-code', 'grill-on-main.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line) as Line);

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function temporary(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  roots.push(root);
  return root;
}

function write(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

const manifest = (workflow = 'matt-pocock', limit?: number): string => `version: 1

project:
  id: next-project

tracker:
  provider: local
  local:
    issues: docs/specs

knowledge:
  docs: docs

workflow:
  provider: ${workflow}
${limit === undefined ? '' : `\nautomation:\n  max_parallel_development_tasks: ${limit}\n`}`;

const row = (number: number, title: string, status: string, spec: string | null): string =>
  `| ${number} | ${title} | ${status} | ${spec === null ? '—' : `[\`${spec}\`](specs/${spec}/spec.md)`} |`;

const AUTOPILOT = 'Next action: run the epic. `/binnacle:autopilot`';
/** A Next action no alternative agrees with, so that none is left out. */
const DAILY = 'Next action: see what changed. `/binnacle:daily`';

function roadmap(rows: string[], focus: string | null): string {
  const lines = ['# Roadmap', '', '| # | Epic | Status | Spec |', '| --- | --- | --- | --- |', ...rows, ''];
  if (focus !== null) lines.push('## Current focus', '', focus, '');
  lines.push('## Later', '', '- something', '');
  return lines.join('\n');
}

/** A project whose roadmap has `rows` and `focus`, under `workflow` and a parallel `limit`. */
function makeProject(rows: string[], focus: string | null = DAILY, workflow?: string, limit?: number): string {
  const root = temporary('binnacle-next-');
  write(root, '.binnacle/project.yaml', manifest(workflow, limit));
  write(root, 'docs/roadmap.md', roadmap(rows, focus));
  return root;
}

/** `docs/specs/<spec>/issues/<file>` with its title and header lines; returns its path. */
function ticket(root: string, spec: string, file: string, ...header: string[]): string {
  const path = `docs/specs/${spec}/issues/${file}`;
  write(root, path, [`# ${file.slice(0, 2)}: ${file.slice(3, -3)}`, '', ...header, '', '**What to build:** it.', ''].join('\n'));
  return path;
}

/** Git, with the reflog entries it writes dated `timestamp`. */
function gitAt(timestamp: string, cwd: string, ...args: string[]): void {
  const date = `@${Math.floor(Date.parse(timestamp) / 1000)} +0000`;
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    stdio: 'ignore',
    env: { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date },
  });
}

/** `root` as a repository whose `HEAD` reflog begins on `main` at `since`, then switches to each branch at its time. */
function repository(root: string, since: string, ...switches: [at: string, branch: string][]): void {
  gitAt(since, root, 'init', '--quiet', '--initial-branch=main');
  gitAt(since, root, 'add', '.');
  gitAt(since, root, 'commit', '--quiet', '-m', 'initial');
  for (const [time, branch] of switches) gitAt(time, root, 'switch', '--quiet', '-C', branch);
}

/** A Claude Code session launched in `cwd`, whose one message is at `timestamp`. */
function session(artifacts: string, cwd: string, sessionId: string, timestamp: string): void {
  const records = GRILL.map((line) => ({
    ...line,
    cwd,
    sessionId,
    timestamp,
    ...(line.message && line.type === 'assistant' ? { message: { ...line.message, id: `${String(line.message.id)}-${sessionId}` } } : {}),
  }));
  write(join(artifacts, cwd.replace(/[^a-zA-Z0-9]/g, '-')), `${sessionId}.jsonl`, records.map((record) => `${JSON.stringify(record)}\n`).join(''));
}

const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

async function withDaemon(body: (daemon: TestDaemon, artifacts: string) => Promise<void>): Promise<void> {
  const artifacts = temporary('binnacle-next-claude-');
  const daemon = await startTestDaemon({ artifacts: { claudeCode: artifacts, codex: join(artifacts, 'no-codex') } });
  try {
    await body(daemon, artifacts);
  } finally {
    await daemon.stop();
  }
}

async function snapshot(daemon: TestDaemon, root: string): Promise<Snapshot> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
  const result = await daemon.call<Snapshot>('project.snapshot', { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

const nextCodes = (body: Snapshot): string[] => body.attention.map((item) => item.code).filter((code) => code.startsWith('next_action.'));

/** The alternatives, which are never more than three. */
function alternatives(body: Snapshot): Alternative[] {
  const list = body.next.alternatives;
  assert.ok(Array.isArray(list), JSON.stringify(list));
  assert.ok(list.length <= 3, JSON.stringify(list));
  for (const alternative of list) assert.equal(alternative.provenance, 'calculated');
  return list;
}

const kinds = (list: Alternative[]): string[] => list.map((alternative) => alternative.kind);

describe('the Next action', () => {
  it("is the focus's last paragraph: the code span it ends with is the command, the text before it the description, whose own code spans stay text", async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject(
        [row(1, 'First', 'in progress', 'first')],
        'Tickets 01 and 02 are done.\n\nNext action: start `first/03`, from a fresh\nsession. `/binnacle:task run docs/specs/first/issues/03-third.md`',
      );
      ticket(root, 'first', '03-third.md', 'Status: READY');

      const body = await snapshot(daemon, root);
      assert.deepEqual(body.next.action, {
        description: 'start `first/03`, from a fresh session.',
        command: '/binnacle:task run docs/specs/first/issues/03-third.md',
      });
      assert.deepEqual(nextCodes(body), []);
    });
  });

  it('is missing, and an attention item, when the roadmap has no focus, or its last paragraph ends in prose or does not start with "Next action:"', async () => {
    await withDaemon(async (daemon) => {
      const rows = [row(1, 'First', 'in progress', 'first')];
      for (const focus of [
        null,
        'Next action: run the epic with `/binnacle:autopilot`.',
        'Next action: run the epic. `/binnacle:autopilot`\n\nThen close it.',
        'Run the epic. `/binnacle:autopilot`',
      ]) {
        const body = await snapshot(daemon, makeProject(rows, focus));
        assert.equal(body.next.action, null, String(focus));
        assert.deepEqual(nextCodes(body), ['next_action.missing'], String(focus));
      }
    });
  });

  it('is stale, and an attention item, when its command names a DONE or CANCELLED Task by ticket path or by id', async () => {
    await withDaemon(async (daemon) => {
      const rows = [row(1, 'First', 'in progress', 'first')];
      const cases: [string, string][] = [
        ['DONE', '`/binnacle:task run docs/specs/first/issues/01-first.md`'],
        ['DONE', '`/binnacle:task first/01`'],
        ['CANCELLED', '`/binnacle:task first/01`'],
      ];
      for (const [state, command] of cases) {
        const root = makeProject(rows, `Next action: take the first ticket. ${command}`);
        ticket(root, 'first', '01-first.md', `Status: ${state}`);
        ticket(root, 'first', '02-second.md', 'Status: READY');

        const body = await snapshot(daemon, root);
        assert.equal(body.next.action?.command, command.slice(1, -1));
        assert.deepEqual(nextCodes(body), ['next_action.stale'], command);
        assert.match(body.attention.find((item) => item.code === 'next_action.stale')!.message, new RegExp(`first/01 .*${state}`));
      }

      // Naming a Task that is not finished is the course, not a stale one.
      const root = makeProject(rows, 'Next action: take the second ticket. `/binnacle:task first/02`');
      ticket(root, 'first', '01-first.md', 'Status: DONE');
      ticket(root, 'first', '02-second.md', 'Status: READY');
      assert.deepEqual(nextCodes(await snapshot(daemon, root)), []);
    });
  });

  it('is stale when it runs autopilot on an epic, by number or spec slug, whose tickets are all DONE, CANCELLED or ready-for-human, and says why', async () => {
    await withDaemon(async (daemon) => {
      const rows = [row(1, 'Old', 'done', 'old'), row(2, 'First', 'in progress', 'first')];
      for (const command of ['`/binnacle:autopilot 2`', '`binnacle-autopilot first`', '`$binnacle-autopilot first`']) {
        const root = makeProject(rows, `Next action: run the epic. ${command}`);
        ticket(root, 'first', '01-done.md', 'Status: DONE');
        ticket(root, 'first', '02-cancelled.md', 'Status: CANCELLED');
        ticket(root, 'first', '03-demo.md', 'Status: READY', 'Triage: ready-for-human');

        const body = await snapshot(daemon, root);
        assert.deepEqual(nextCodes(body), ['next_action.stale'], command);
        const message = body.attention.find((item) => item.code === 'next_action.stale')!.message;
        assert.match(message, /Epic 2 \(First\)/, command);
        assert.match(message, /no ticket .*left for an agent/, command);
        assert.match(message, /first\/03 is ready-for-human/, command);
      }

      // Both reasons at once are one item, which gives both.
      const root = makeProject(rows, 'Next action: run the epic. `/binnacle:autopilot first first/01`');
      ticket(root, 'first', '01-done.md', 'Status: DONE');
      const both = (await snapshot(daemon, root)).attention.filter((item) => item.code === 'next_action.stale');
      assert.equal(both.length, 1);
      assert.match(both[0]!.message, /names finished work: first\/01 .*; it also runs Epic 2 \(First\)/);
    });
  });

  it('is not stale while one Task of the epic is left for an agent, one with an unanswered question included, nor for an epic with no tickets', async () => {
    await withDaemon(async (daemon) => {
      const rows = [row(1, 'First', 'in progress', 'first'), row(2, 'Second', 'tickets', 'second')];
      const setUp = (command: string): string => {
        const root = makeProject(rows, `Next action: run the epic. \`${command}\``);
        ticket(root, 'first', '01-done.md', 'Status: DONE');
        ticket(root, 'first', '02-demo.md', 'Status: READY', 'Triage: ready-for-human');
        return root;
      };

      const ready = setUp('/binnacle:autopilot 1');
      ticket(ready, 'first', '03-agent.md', 'Status: READY', 'Triage: ready-for-agent');
      assert.deepEqual(nextCodes(await snapshot(daemon, ready)), []);

      const asked = setUp('/binnacle:autopilot first');
      const path = ticket(asked, 'first', '03-asked.md', 'Status: ACTIVE');
      write(asked, path, `${readFileSync(join(asked, path), 'utf8')}\n## Comments\n\n### Question\n\nWhich one?\n`);
      const withQuestion = await snapshot(daemon, asked);
      assert.deepEqual(withQuestion.tasks?.inFlight.items.map((task) => [task.id, task.questions]), [['first/03', { asked: 1, unanswered: 1 }]]);
      assert.deepEqual(nextCodes(withQuestion), []);

      assert.deepEqual(nextCodes(await snapshot(daemon, setUp('/binnacle:autopilot 2'))), []);
      assert.deepEqual(nextCodes(await snapshot(daemon, setUp('binnacle-autopilot second'))), []);
    });
  });
});

describe("the Suggested step's alternatives", () => {
  it('1: an implementation run of a Task is active, so wait for it, with no command, and nothing beside it when no Task is ready', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-worked.md', 'Status: ACTIVE');
      repository(root, minutesAgo(60), [minutesAgo(3), 'feat/worked']);
      session(artifacts, root, 'working', minutesAgo(1));

      const [wait, ...rest] = alternatives(await snapshot(daemon, root));
      assert.deepEqual(rest, []);
      assert.equal(wait!.kind, 'wait');
      assert.deepEqual(wait!.tasks, ['first/01']);
      assert.equal(wait!.command, null);
      assert.match(wait!.description, /first\/01/);
      assert.deepEqual(wait!.params, { task: 'first/01 (worked)' });
    });
  });

  it('1 is followed by parallel when a place is free and a Task is ready: one ready Task with its start command, several named with none', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-worked.md', 'Status: ACTIVE');
      const ready = ticket(root, 'first', '02-ready.md', 'Status: READY');
      repository(root, minutesAgo(60), [minutesAgo(3), 'feat/worked']);
      session(artifacts, root, 'working', minutesAgo(1));

      const list = alternatives(await snapshot(daemon, root));
      assert.deepEqual(kinds(list), ['wait', 'parallel']);
      assert.deepEqual(list[1]!.tasks, ['first/02']);
      assert.equal(list[1]!.command, `/binnacle:task run ${ready}`);
      assert.match(list[1]!.description, /first\/02/);
      assert.deepEqual(list[1]!.params, { task: 'first/02 (ready)' });

      ticket(root, 'first', '03-also.md', 'Status: READY');
      const several = alternatives(await snapshot(daemon, root));
      assert.deepEqual(kinds(several), ['wait', 'parallel']);
      assert.deepEqual(several[1]!.tasks, ['first/02', 'first/03']);
      assert.equal(several[1]!.command, null);
      assert.deepEqual(several[1]!.params, { tasks: 'first/02 (ready), first/03 (also)' });
    });
  });

  it('1 is not followed by parallel when no place is free', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')], DAILY, 'matt-pocock', 1);
      ticket(root, 'first', '01-worked.md', 'Status: ACTIVE');
      ticket(root, 'first', '02-ready.md', 'Status: READY');
      repository(root, minutesAgo(60), [minutesAgo(3), 'feat/worked']);
      session(artifacts, root, 'working', minutesAgo(1));

      assert.deepEqual(kinds(alternatives(await snapshot(daemon, root))), ['wait']);
    });
  });

  it('1 waits only on a Task the board places In progress: a DONE Task with an active implementation run is not waited on', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-merged.md', 'Status: DONE');
      ticket(root, 'first', '02-worked.md', 'Status: ACTIVE');
      // The DONE Task's run is the latest, so without the rule it would be the one named.
      repository(root, minutesAgo(60), [minutesAgo(8), 'feat/worked'], [minutesAgo(5), 'feat/merged']);
      session(artifacts, root, 'working', minutesAgo(7));
      session(artifacts, root, 'merged', minutesAgo(2));

      const [wait] = alternatives(await snapshot(daemon, root));
      assert.equal(wait!.kind, 'wait');
      assert.deepEqual(wait!.tasks, ['first/02']);
      assert.doesNotMatch(wait!.description, /first\/01/);
      assert.deepEqual(wait!.params, { task: 'first/02 (worked)' });
    });
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-merged.md', 'Status: DONE');
      repository(root, minutesAgo(60), [minutesAgo(3), 'feat/merged']);
      session(artifacts, root, 'merged', minutesAgo(1));

      // Falls through to the next rule that applies.
      assert.deepEqual(kinds(alternatives(await snapshot(daemon, root))), ['close']);
    });
  });

  it("1 is never a Product session's active run: its own run does not turn the step into waiting", async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-ready.md', 'Status: READY');
      repository(root, minutesAgo(60));
      session(artifacts, root, 'product', minutesAgo(1));

      assert.deepEqual(kinds(alternatives(await snapshot(daemon, root))), ['autopilot', 'byHand']);
    });
  });

  it('2: a Task is In progress with no active run, so resume it with its start command', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-done.md', 'Status: DONE');
      const idle = ticket(root, 'first', '02-idle.md', 'Status: ACTIVE');

      const list = alternatives(await snapshot(daemon, root));
      assert.deepEqual(kinds(list), ['resume']);
      assert.deepEqual(list[0]!.tasks, ['first/02']);
      assert.equal(list[0]!.command, `/binnacle:task run ${idle}`);
      assert.deepEqual(list[0]!.params, { task: 'first/02 (idle)' });
    });
  });

  it('2 also resumes a READY Task whose attributed run is no longer active, In progress from runs', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      const idle = ticket(root, 'first', '01-idle.md', 'Status: READY');
      const yesterday = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      repository(root, minutesAgo(3 * 24 * 60), [yesterday, 'feat/idle']);
      session(artifacts, root, 'abandoned', new Date(Date.parse(yesterday) + 60_000).toISOString());

      const list = alternatives(await snapshot(daemon, root));
      assert.deepEqual(kinds(list), ['resume']);
      assert.equal(list[0]!.command, `/binnacle:task run ${idle}`);
    });
  });

  it('3: the current epic is at tickets or in progress and one of its READY Tasks has no Unmet dependency, so autopilot, and beside it that Task by hand', async () => {
    await withDaemon(async (daemon) => {
      for (const status of ['tickets', 'in progress']) {
        const root = makeProject([row(1, 'Old', 'done', 'old'), row(2, 'First', status, 'first')]);
        ticket(root, 'old', '01-old.md', 'Status: READY');
        const ready = ticket(root, 'first', '01-ready.md', 'Status: READY');
        ticket(root, 'first', '02-waits.md', 'Status: READY', 'Blocked by: 01');

        const [autopilot, byHand, ...rest] = alternatives(await snapshot(daemon, root));
        assert.deepEqual(rest, [], status);
        assert.equal(autopilot!.kind, 'autopilot');
        assert.equal(autopilot!.command, '/binnacle:autopilot');
        assert.deepEqual(autopilot!.tasks, []);
        assert.match(autopilot!.description, /Epic 2/);
        assert.deepEqual(autopilot!.params, { epic: 2, title: 'First' });
        assert.equal(byHand!.kind, 'byHand');
        assert.deepEqual(byHand!.tasks, ['first/01']);
        assert.equal(byHand!.command, `/binnacle:task run ${ready}`);
        assert.deepEqual(byHand!.params, { task: 'first/01 (ready)' });
      }
    });
  });

  it('3 names several ready Tasks by hand with no command, so that no order is implied', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-ready.md', 'Status: READY');
      ticket(root, 'first', '02-also.md', 'Status: READY');

      const [, byHand] = alternatives(await snapshot(daemon, root));
      assert.equal(byHand!.kind, 'byHand');
      assert.deepEqual(byHand!.tasks, ['first/01', 'first/02']);
      assert.equal(byHand!.command, null);
      assert.match(byHand!.description, /first\/01.*first\/02/);
      assert.deepEqual(byHand!.params, { tasks: 'first/01 (ready), first/02 (also)' });
    });
  });

  it("3 leaves a ready-for-human Task to the owner: alone, it is one alternative naming it as the owner's, with no command", async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')], AUTOPILOT);
      ticket(root, 'first', '01-demo.md', 'Status: READY', 'Triage: ready-for-human');
      ticket(root, 'first', '02-after.md', 'Status: READY', 'Blocked by: 01');

      const list = alternatives(await snapshot(daemon, root));
      assert.deepEqual(kinds(list), ['owner']);
      assert.deepEqual(list[0]!.tasks, ['first/01']);
      assert.equal(list[0]!.command, null);
      assert.match(list[0]!.description, /first\/01.*ready-for-human.*owner/);
      assert.deepEqual(list[0]!.params, { task: 'first/01 (demo)' });
    });
  });

  it('3 counts only the ready Tasks not triaged ready-for-human for autopilot and byHand, and a Task with no triage as before', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-demo.md', 'Status: READY', 'Triage: ready-for-human');
      const agent = ticket(root, 'first', '02-agent.md', 'Status: READY', 'Triage: ready-for-agent');

      const [autopilot, byHand, ...rest] = alternatives(await snapshot(daemon, root));
      assert.deepEqual(rest, []);
      assert.equal(autopilot!.kind, 'autopilot');
      assert.equal(byHand!.kind, 'byHand');
      assert.deepEqual(byHand!.tasks, ['first/02']);
      assert.equal(byHand!.command, `/binnacle:task run ${agent}`);

      ticket(root, 'first', '03-untriaged.md', 'Status: READY');
      const [, both] = alternatives(await snapshot(daemon, root));
      assert.deepEqual(both!.tasks, ['first/02', 'first/03']);
      assert.equal(both!.command, null);
    });
  });

  it('1 is not followed by parallel for a ready-for-human Task, and names only the others when there are some', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-worked.md', 'Status: ACTIVE');
      ticket(root, 'first', '02-demo.md', 'Status: READY', 'Triage: ready-for-human');
      repository(root, minutesAgo(60), [minutesAgo(3), 'feat/worked']);
      session(artifacts, root, 'working', minutesAgo(1));

      assert.deepEqual(kinds(alternatives(await snapshot(daemon, root))), ['wait']);

      const untriaged = ticket(root, 'first', '03-untriaged.md', 'Status: READY');
      const list = alternatives(await snapshot(daemon, root));
      assert.deepEqual(kinds(list), ['wait', 'parallel']);
      assert.deepEqual(list[1]!.tasks, ['first/03']);
      assert.equal(list[1]!.command, `/binnacle:task run ${untriaged}`);
    });
  });

  it('4: every READY Task of the current epic waits on an Unmet dependency, so nothing can start, and it says on what, with no command', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-later.md', 'Status: BACKLOG');
      ticket(root, 'first', '02-waits.md', 'Status: READY', 'Blocked by: 01');

      const list = alternatives(await snapshot(daemon, root));
      assert.deepEqual(kinds(list), ['blocked']);
      assert.deepEqual(list[0]!.tasks, ['first/02']);
      assert.equal(list[0]!.command, null);
      assert.match(list[0]!.description, /first\/02 waits on first\/01/);
      assert.deepEqual(list[0]!.params, { epic: 1, title: 'First', waits: 'first/02 (first/01)' });
    });
  });

  it('5: every Task of the current epic is DONE or CANCELLED, so close the epic in a Product session', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-done.md', 'Status: DONE');
      ticket(root, 'first', '02-cancelled.md', 'Status: CANCELLED');

      const list = alternatives(await snapshot(daemon, root));
      assert.deepEqual(kinds(list), ['close']);
      assert.equal(list[0]!.command, '/binnacle:product');
      assert.deepEqual(list[0]!.params, { epic: 1, title: 'First' });
    });
  });

  it('6: the current epic is not started, so plan it by grilling', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'Old', 'done', 'old'), row(2, 'Next', 'not started', null)]);
      ticket(root, 'old', '01-old.md', 'Status: DONE');

      const list = alternatives(await snapshot(daemon, root));
      assert.deepEqual(kinds(list), ['plan']);
      assert.equal(list[0]!.command, '/mattpocock-skills:grill-with-docs');
      assert.deepEqual(list[0]!.params, { need: 'grilling', epic: 2, title: 'Next' });
    });
  });

  it('7: the current epic needs its spec, or its tickets', async () => {
    await withDaemon(async (daemon) => {
      const cases: [string, string | null, string][] = [
        ['spec', null, '/mattpocock-skills:to-spec'],
        ['spec', 'first', '/mattpocock-skills:to-tickets'],
        ['tickets', 'first', '/mattpocock-skills:to-tickets'],
      ];
      for (const [status, spec, command] of cases) {
        const list = alternatives(await snapshot(daemon, makeProject([row(1, 'First', status, spec)])));
        assert.deepEqual(kinds(list), ['plan'], `${status} ${spec}`);
        assert.equal(list[0]!.command, command);
        assert.deepEqual(list[0]!.params, { need: spec === null ? 'spec' : 'tickets', epic: 1, title: 'First' }, `${status} ${spec}`);
      }
    });
  });

  it('takes the epic furthest along as current, though one not started is above it, and the earlier row between equals', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(11, 'Old', 'done', 'old'), row(12, 'Audit', 'not started', null), row(17, 'Release', 'tickets', 'release')]);
      ticket(root, 'old', '01-old.md', 'Status: DONE');
      const path = ticket(root, 'release', '01-ready.md', 'Status: READY');

      const body = await snapshot(daemon, root);
      assert.equal(body.roadmap?.current?.number, 17);
      const [autopilot, byHand] = alternatives(body);
      assert.deepEqual(kinds(alternatives(body)), ['autopilot', 'byHand']);
      assert.match(autopilot!.description, /^Epic 17 \(Release\)/);
      assert.equal(byHand!.command, `/binnacle:task run ${path}`);

      ticket(root, 'now', '01-ready.md', 'Status: READY');
      const order: [string[], number][] = [
        [[row(12, 'Audit', 'not started', null), row(13, 'Spec', 'spec', 'spec'), row(17, 'Release', 'tickets', 'release'), row(18, 'Now', 'in progress', 'now')], 18],
        [[row(12, 'Audit', 'not started', null), row(13, 'Spec', 'spec', 'spec'), row(17, 'Release', 'tickets', 'release')], 17],
        [[row(12, 'Audit', 'not started', null), row(13, 'Spec', 'spec', 'spec')], 13],
        [[row(17, 'Release', 'tickets', 'release'), row(18, 'Now', 'tickets', 'now')], 17],
        [[row(11, 'Old', 'done', 'old'), row(12, 'Audit', 'not started', null), row(14, 'Other', 'not started', null)], 12],
      ];
      for (const [rows, current] of order) {
        write(root, 'docs/roadmap.md', roadmap(rows, DAILY));
        assert.equal((await snapshot(daemon, root)).roadmap?.current?.number, current, rows.join('\n'));
      }

      write(root, 'docs/roadmap.md', roadmap([row(11, 'Old', 'done', 'old'), row(17, 'Release', 'done', 'release')], DAILY));
      assert.equal((await snapshot(daemon, root)).roadmap?.current, null);
    });
  });

  it('8: every epic is done, and it says so with no command', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'done', 'first')]);
      ticket(root, 'first', '01-done.md', 'Status: DONE');

      const list = alternatives(await snapshot(daemon, root));
      assert.deepEqual(kinds(list), ['finished']);
      assert.equal(list[0]!.command, null);
      assert.deepEqual(list[0]!.params, {});
    });
  });

  it('names the roadmap skill to plan when the roadmap lists no epic, under any workflow.provider, and is empty without a roadmap', async () => {
    await withDaemon(async (daemon) => {
      for (const workflow of ['matt-pocock', 'none']) {
        const list = alternatives(await snapshot(daemon, makeProject([], DAILY, workflow)));
        assert.deepEqual(kinds(list), ['plan'], workflow);
        assert.equal(list[0]!.command, '/binnacle:roadmap', workflow);
        assert.deepEqual(list[0]!.params, { need: 'epics' }, workflow);
      }

      const root = makeProject([]);
      rmSync(join(root, 'docs/roadmap.md'));
      assert.deepEqual(alternatives(await snapshot(daemon, root)), []);
    });
  });

  it("leaves out an alternative whose command is the Next action's, and none without a Next action", async () => {
    await withDaemon(async (daemon) => {
      const rows = [row(1, 'First', 'in progress', 'first')];
      const setUp = (focus: string | null): { root: string; ready: string } => {
        const root = makeProject(rows, focus);
        return { root, ready: ticket(root, 'first', '01-ready.md', 'Status: READY') };
      };

      assert.deepEqual(kinds(alternatives(await snapshot(daemon, setUp(AUTOPILOT).root))), ['byHand']);

      const byHand = setUp(null);
      write(byHand.root, 'docs/roadmap.md', roadmap(rows, `Next action: take it. \`/binnacle:task run ${byHand.ready}\``));
      assert.deepEqual(kinds(alternatives(await snapshot(daemon, byHand.root))), ['autopilot']);

      const none = await snapshot(daemon, setUp(null).root);
      assert.equal(none.next.action, null);
      assert.deepEqual(kinds(alternatives(none)), ['autopilot', 'byHand']);
    });
  });

  it("keeps Binnacle's own commands under any other workflow.provider, and leaves out only Matt Pocock's", async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')], DAILY, 'none');
      ticket(root, 'first', '01-ready.md', 'Status: READY');
      const idle = ticket(root, 'first', '02-idle.md', 'Status: ACTIVE');
      const resume = alternatives(await snapshot(daemon, root));
      assert.deepEqual(kinds(resume), ['resume']);
      assert.equal(resume[0]!.command, `/binnacle:task run ${idle}`);

      const epic = makeProject([row(1, 'First', 'in progress', 'first')], DAILY, 'none');
      const ready = ticket(epic, 'first', '01-ready.md', 'Status: READY');
      const both = alternatives(await snapshot(daemon, epic));
      assert.deepEqual(both.map((alternative) => [alternative.kind, alternative.command]), [
        ['autopilot', '/binnacle:autopilot'],
        ['byHand', `/binnacle:task run ${ready}`],
      ]);

      const closing = makeProject([row(1, 'First', 'in progress', 'first')], DAILY, 'none');
      ticket(closing, 'first', '01-done.md', 'Status: DONE');
      assert.equal(alternatives(await snapshot(daemon, closing))[0]!.command, '/binnacle:product');

      for (const [status, spec] of [['not started', null], ['spec', null], ['spec', 'first']] as const) {
        const planning = alternatives(await snapshot(daemon, makeProject([row(1, 'First', status, spec)], DAILY, 'none')));
        assert.deepEqual(kinds(planning), ['plan']);
        assert.equal(planning[0]!.command, null, status);
        assert.match(planning[0]!.description, /Epic 1 \(First\)/);
      }
    });
  });

  it('is unavailable, with the reason, when the tracker cannot be read', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')], AUTOPILOT);
      write(root, '.binnacle/project.yaml', manifest().replace('    issues: docs/specs\n', ''));

      const body = await snapshot(daemon, root);
      assert.deepEqual(body.next.alternatives, {
        available: false,
        reason: 'tracker.provider is local, and this project declares no tracker.local.issues.',
        code: 'tracker.unavailable',
        params: { kind: 'issues' },
      });
      assert.deepEqual(body.next.action, { description: 'run the epic.', command: '/binnacle:autopilot' });
    });
  });
});
