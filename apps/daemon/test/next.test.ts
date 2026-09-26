import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * The snapshot's `next` through the daemon's HTTP API: the roadmap's Next action, its two
 * attention items, and Binnacle's Suggested step beside it, each of its eight rules on a
 * fixture where exactly that rule applies (ADR-0032). Runs come from Claude Code sessions,
 * cut from real ones, that a real repository's reflog puts on their Tasks' branches.
 */
type Step = { rule: number; description: string; command: string | null; task: string | null; provenance: string };
type Next = { action: { description: string; command: string } | null; suggested: Step | null | { available: false; reason: string } };
type Snapshot = { next: Next; attention: { code: string; message: string }[] };
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

const manifest = (workflow = 'matt-pocock'): string => `version: 1

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
`;

const row = (number: number, title: string, status: string, spec: string | null): string =>
  `| ${number} | ${title} | ${status} | ${spec === null ? '—' : `[\`${spec}\`](specs/${spec}/spec.md)`} |`;

const AUTOPILOT = 'Next action: run the epic. `/binnacle:autopilot`';

function roadmap(rows: string[], focus: string | null = AUTOPILOT): string {
  const lines = ['# Roadmap', '', '| # | Epic | Status | Spec |', '| --- | --- | --- | --- |', ...rows, ''];
  if (focus !== null) lines.push('## Current focus', '', focus, '');
  lines.push('## Later', '', '- something', '');
  return lines.join('\n');
}

/** A project whose roadmap has `rows` and `focus`, under `workflow`. */
function makeProject(rows: string[], focus: string | null = AUTOPILOT, workflow?: string): string {
  const root = temporary('binnacle-next-');
  write(root, '.binnacle/project.yaml', manifest(workflow));
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

function suggested(body: Snapshot): Step {
  const step = body.next.suggested;
  assert.ok(step !== null && !('available' in step), JSON.stringify(step));
  return step;
}

describe('the Next action', () => {
  it("is the focus's last paragraph: the code span it ends with is the command, the text before it the description, whose own code spans stay text", async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject(
        [row(1, 'First', 'in progress', 'first')],
        'Tickets 01 and 02 are done.\n\nNext action: start `first/03`, from a fresh\nsession. `/mattpocock-skills:implement docs/specs/first/issues/03-third.md`',
      );
      ticket(root, 'first', '03-third.md', 'Status: READY');

      const body = await snapshot(daemon, root);
      assert.deepEqual(body.next.action, {
        description: 'start `first/03`, from a fresh session.',
        command: '/mattpocock-skills:implement docs/specs/first/issues/03-third.md',
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
        ['DONE', '`/mattpocock-skills:implement docs/specs/first/issues/01-first.md`'],
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
});

describe('the Suggested step', () => {
  it('1: an implementation run of a Task is active, so that Task is being worked on, with no command', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-worked.md', 'Status: ACTIVE');
      repository(root, minutesAgo(60), [minutesAgo(3), 'feat/worked']);
      session(artifacts, root, 'working', minutesAgo(1));

      const step = suggested(await snapshot(daemon, root));
      assert.equal(step.rule, 1);
      assert.equal(step.task, 'first/01');
      assert.equal(step.command, null);
      assert.equal(step.provenance, 'calculated');
      assert.match(step.description, /first\/01/);
    });
  });

  it("1 is never a Product session's active run: its own run does not turn the step into waiting", async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-ready.md', 'Status: READY');
      repository(root, minutesAgo(60));
      session(artifacts, root, 'product', minutesAgo(1));

      const step = suggested(await snapshot(daemon, root));
      assert.equal(step.rule, 3);
      assert.equal(step.command, '/binnacle:autopilot');
    });
  });

  it('2: a Task is In progress with no active run, so resume it with its start command', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-done.md', 'Status: DONE');
      const idle = ticket(root, 'first', '02-idle.md', 'Status: ACTIVE');

      const step = suggested(await snapshot(daemon, root));
      assert.equal(step.rule, 2);
      assert.equal(step.task, 'first/02');
      assert.equal(step.command, `/mattpocock-skills:implement ${idle}`);
    });
  });

  it('2 also resumes a READY Task whose attributed run is no longer active, In progress from runs', async () => {
    await withDaemon(async (daemon, artifacts) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      const idle = ticket(root, 'first', '01-idle.md', 'Status: READY');
      const yesterday = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
      repository(root, minutesAgo(3 * 24 * 60), [yesterday, 'feat/idle']);
      session(artifacts, root, 'abandoned', new Date(Date.parse(yesterday) + 60_000).toISOString());

      const step = suggested(await snapshot(daemon, root));
      assert.equal(step.rule, 2);
      assert.equal(step.command, `/mattpocock-skills:implement ${idle}`);
    });
  });

  it('3: the current epic is at tickets or in progress and one of its READY Tasks has no Unmet dependency, so /binnacle:autopilot', async () => {
    await withDaemon(async (daemon) => {
      for (const status of ['tickets', 'in progress']) {
        const root = makeProject([row(1, 'Old', 'done', 'old'), row(2, 'First', status, 'first')]);
        ticket(root, 'old', '01-old.md', 'Status: READY');
        ticket(root, 'first', '01-ready.md', 'Status: READY');
        ticket(root, 'first', '02-waits.md', 'Status: READY', 'Blocked by: 01');

        const step = suggested(await snapshot(daemon, root));
        assert.equal(step.rule, 3, status);
        assert.equal(step.command, '/binnacle:autopilot');
        assert.equal(step.task, null);
        assert.match(step.description, /Epic 2/);
      }
    });
  });

  it('4: every READY Task of the current epic waits on an Unmet dependency, so nothing can start, and it says on what, with no command', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-later.md', 'Status: BACKLOG');
      ticket(root, 'first', '02-waits.md', 'Status: READY', 'Blocked by: 01');

      const step = suggested(await snapshot(daemon, root));
      assert.equal(step.rule, 4);
      assert.equal(step.command, null);
      assert.match(step.description, /first\/02 waits on first\/01/);
    });
  });

  it('5: every Task of the current epic is DONE or CANCELLED, so close the epic in a Product session', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      ticket(root, 'first', '01-done.md', 'Status: DONE');
      ticket(root, 'first', '02-cancelled.md', 'Status: CANCELLED');

      const step = suggested(await snapshot(daemon, root));
      assert.equal(step.rule, 5);
      assert.equal(step.command, '/binnacle:product');
    });
  });

  it('6: the current epic is not started, so grill it', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'Old', 'done', 'old'), row(2, 'Next', 'not started', null)]);
      ticket(root, 'old', '01-old.md', 'Status: DONE');

      const step = suggested(await snapshot(daemon, root));
      assert.equal(step.rule, 6);
      assert.equal(step.command, '/mattpocock-skills:grill-with-docs');
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
        const step = suggested(await snapshot(daemon, makeProject([row(1, 'First', status, spec)])));
        assert.equal(step.rule, 7, `${status} ${spec}`);
        assert.equal(step.command, command);
      }
    });
  });

  it('8: every epic is done, and it says so with no command', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'done', 'first')]);
      ticket(root, 'first', '01-done.md', 'Status: DONE');

      const step = suggested(await snapshot(daemon, root));
      assert.equal(step.rule, 8);
      assert.equal(step.command, null);
      assert.equal(step.provenance, 'calculated');
    });
  });

  it('gives no command under any other workflow.provider, and keeps its description', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')], AUTOPILOT, 'none');
      ticket(root, 'first', '01-ready.md', 'Status: READY');
      ticket(root, 'first', '02-idle.md', 'Status: ACTIVE');

      const step = suggested(await snapshot(daemon, root));
      assert.equal(step.rule, 2);
      assert.equal(step.command, null);
      assert.match(step.description, /first\/02/);

      const planning = suggested(await snapshot(daemon, makeProject([row(1, 'First', 'not started', null)], AUTOPILOT, 'none')));
      assert.equal(planning.rule, 6);
      assert.equal(planning.command, null);
    });
  });

  it('is unavailable, with the reason, when the tracker cannot be read', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject([row(1, 'First', 'in progress', 'first')]);
      write(root, '.binnacle/project.yaml', manifest().replace('    issues: docs/specs\n', ''));

      const body = await snapshot(daemon, root);
      assert.deepEqual(body.next.suggested, { available: false, reason: 'tracker.provider is local, and this project declares no tracker.local.issues.' });
      assert.deepEqual(body.next.action, { description: 'run the epic.', command: '/binnacle:autopilot' });
    });
  });
});
