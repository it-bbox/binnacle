import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

type Prepared = {
  head: string;
  from: { commit: string | null; source: string };
  fallback: { reason: string; message: string } | null;
  commits: { count: number; items: { commit: string; subject: string }[]; remainder: number };
  transitions: { items: { id: string; from: string | null; to: string | null }[]; remainder: number } | null;
  targets: { type: string; path: string | null }[];
  attention: { code: string; message: string }[];
};
type Recorded = { head: string; promoted: { type: string; path: string }[]; diagnostics: { code: string; message: string }[] };
type Event = { type: string; projectPath: string | null; payload: Record<string, unknown> };

const MANIFEST = `version: 1

project:
  id: checkpoint-project

tracker:
  provider: local
  local:
    issues: work/tickets

knowledge:
  context: GLOSSARY.md
  docs: notes
  adr: notes/decisions
  specs: work/tickets
`;

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Binnacle Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
}

function commitAll(root: string, message: string): string {
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '--allow-empty', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

function write(root: string, path: string, text: string): void {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}

const ticketText = (title: string, status: string): string => `# ${title}\n\nStatus: ${status}\nBlocked by: None\n`;

/** Paths deliberately unlike this repository's, so that a target can only have come from the manifest. */
function makeRepository(manifest = MANIFEST): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-checkpoint-')));
  roots.push(root);
  write(root, '.binnacle/project.yaml', manifest);
  write(root, 'GLOSSARY.md', '# Glossary\n');
  write(root, 'notes/roadmap.md', '# Roadmap\n\n| # | Epic | Status | Spec |\n| --- | --- | --- | --- |\n| 1 | First | tickets | [`first`](specs/first/spec.md) |\n\n## Current focus\n\nNext action: start ticket 01. `/binnacle:autopilot`\n');
  write(root, 'notes/decisions/ADR-0001-first.md', '# ADR-0001: First\n');
  write(root, 'work/tickets/first/issues/01-start.md', ticketText('01: Start', 'READY'));
  git(root, ['init', '--quiet', '--initial-branch=main']);
  commitAll(root, 'Start the project');
  return root;
}

async function withDaemon(body: (daemon: TestDaemon) => Promise<void>): Promise<void> {
  const daemon = await startTestDaemon();
  try {
    await body(daemon);
  } finally {
    await daemon.stop();
  }
}

async function register(daemon: TestDaemon, root: string): Promise<void> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
}

async function prepare(daemon: TestDaemon, path: string): Promise<Prepared> {
  const result = await daemon.call<Prepared>('checkpoint.prepare', { path });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

async function record(daemon: TestDaemon, path: string, promoted: { type: string; path: string }[]): Promise<Recorded> {
  const result = await daemon.call<Recorded>('checkpoint.record', { path, promoted });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

async function events(daemon: TestDaemon, type: string): Promise<Event[]> {
  return (await daemon.call<{ events: Event[] }>('event.list')).body.events.filter((event) => event.type === type);
}

describe('the checkpoint', () => {
  it('returns the promotion targets with the manifest\'s paths, the delta and the attention items, and records nothing', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      await register(daemon, root);
      // A daily is not a checkpoint: the checkpoint's delta does not start from it.
      await daemon.call('daily.get', { path: root });

      const body = await prepare(daemon, root);
      assert.deepEqual(body.targets, [
        { type: 'vocabulary', path: 'GLOSSARY.md' },
        { type: 'trade_off', path: 'notes/decisions' },
        { type: 'new_work', path: 'work/tickets' },
        { type: 'product_rule', path: 'work/tickets' },
        { type: 'position', path: 'notes/roadmap.md' },
        // No instruction file at the root.
        { type: 'trap', path: null },
      ]);
      assert.equal(body.fallback?.reason, 'no_baseline');
      assert.match(body.fallback!.message, /No checkpoint has been recorded/);
      assert.deepEqual(body.from, { commit: null, source: 'fallback' });
      assert.deepEqual(body.commits.items.map((commit) => commit.subject), ['Start the project']);
      assert.deepEqual(body.attention, []);

      assert.deepEqual(await events(daemon, 'checkpoint'), []);
      assert.equal((await events(daemon, 'daily')).length, 1);
    });
  });

  it('starts from the head the last checkpoint recorded, and so does the next daily', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      await register(daemon, root);
      commitAll(root, 'Before the checkpoint');

      write(root, 'GLOSSARY.md', '# Glossary\n\n**Term** — a word.\n');
      write(root, 'work/tickets/first/issues/01-start.md', ticketText('01: Start', 'DONE'));
      const head = commitAll(root, 'Promote the session');
      const promoted = [
        { type: 'vocabulary', path: 'GLOSSARY.md' },
        { type: 'new_work', path: 'work/tickets/first/issues/01-start.md' },
      ];
      const recorded = await record(daemon, root, promoted);
      assert.equal(recorded.head, head);
      assert.deepEqual(recorded.promoted, promoted);
      assert.deepEqual(recorded.diagnostics, []);

      const checkpoints = await events(daemon, 'checkpoint');
      assert.equal(checkpoints.length, 1);
      assert.equal(checkpoints[0]!.projectPath, root);
      assert.deepEqual(checkpoints[0]!.payload, { head, promoted });
      // Binnacle wrote nothing and committed nothing (ADR-0020).
      assert.equal(git(root, ['status', '--porcelain', '--untracked-files=all']), '');
      assert.equal(git(root, ['rev-parse', 'HEAD']), head);

      // Nothing since: the promotions are behind the recorded head.
      const next = await prepare(daemon, root);
      assert.equal(next.fallback, null);
      assert.deepEqual(next.from, { commit: head, source: 'checkpoint' });
      assert.equal(next.commits.count, 0);
      assert.deepEqual(next.transitions?.items, []);

      commitAll(root, 'After the checkpoint');
      const after = await prepare(daemon, root);
      assert.deepEqual(after.commits.items.map((commit) => commit.subject), ['After the checkpoint']);

      const daily = await daemon.call<Prepared>('daily.get', { path: root });
      assert.deepEqual(daily.body.from, { commit: head, source: 'checkpoint' });
      assert.deepEqual(daily.body.commits.items.map((commit) => commit.subject), ['After the checkpoint']);
    });
  });

  it('records a promoted path that is still uncommitted, and says so for each one', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      const head = git(root, ['rev-parse', 'HEAD']);
      await register(daemon, root);
      write(root, 'GLOSSARY.md', '# Glossary\n\n**Term** — not committed yet.\n');
      write(root, 'notes/decisions/ADR-0002-second.md', '# ADR-0002: Second\n');

      const promoted = [
        { type: 'vocabulary', path: 'GLOSSARY.md' },
        { type: 'trade_off', path: 'notes/decisions/ADR-0002-second.md' },
        { type: 'position', path: 'notes/roadmap.md' },
        // A typo is not a clean promotion.
        { type: 'new_work', path: 'work/tickets/first/issues/02-typo.md' },
      ];
      const recorded = await record(daemon, root, promoted);
      assert.equal(recorded.head, head);
      assert.deepEqual(recorded.diagnostics.map((item) => item.code), ['checkpoint.uncommitted', 'checkpoint.uncommitted', 'checkpoint.path_missing']);
      assert.match(recorded.diagnostics[0]!.message, /^GLOSSARY\.md /);
      assert.match(recorded.diagnostics[1]!.message, /^notes\/decisions\/ADR-0002-second\.md /);
      assert.match(recorded.diagnostics[2]!.message, /^work\/tickets\/first\/issues\/02-typo\.md /);
      assert.deepEqual((await events(daemon, 'checkpoint'))[0]?.payload, { head, promoted });
    });
  });

  it('refuses promoted items it cannot use, and records nothing', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      await register(daemon, root);
      for (const promoted of [
        undefined,
        [{ type: 'gossip', path: 'GLOSSARY.md' }],
        [{ type: 'vocabulary', path: '' }],
        [{ type: 'vocabulary', path: '/etc/passwd' }],
        [{ type: 'vocabulary', path: '../outside.md' }],
      ]) {
        const refused = await daemon.call<{ error: { code: string } }>('checkpoint.record', { path: root, promoted });
        assert.equal(refused.status, 400, JSON.stringify(promoted));
        assert.equal(refused.body.error.code, 'request.invalid');
      }
      assert.deepEqual(await events(daemon, 'checkpoint'), []);

      // Nothing promoted is still a checkpoint.
      assert.deepEqual((await record(daemon, root, [])).promoted, []);
    });
  });

  it('names the root instruction file as the trap target, AGENTS.md first, and records a trap', async () => {
    await withDaemon(async (daemon) => {
      const trap = async (files: Record<string, string>): Promise<string | null | undefined> => {
        const root = makeRepository();
        for (const [name, text] of Object.entries(files)) write(root, name, text);
        commitAll(root, 'Add the instruction files');
        await register(daemon, root);
        return (await prepare(daemon, root)).targets.find((target) => target.type === 'trap')?.path;
      };
      assert.equal(await trap({ 'AGENTS.md': '# Agents\n' }), 'AGENTS.md');
      assert.equal(await trap({ 'AGENTS.md': '# Agents\n', 'CLAUDE.md': '@AGENTS.md\n' }), 'AGENTS.md');
      assert.equal(await trap({ 'CLAUDE.md': '# Claude\n' }), 'CLAUDE.md');
      assert.equal(await trap({}), null);

      const root = makeRepository();
      write(root, 'AGENTS.md', '# Agents\n\n- Run `pnpm build` before `pnpm test`.\n');
      commitAll(root, 'Promote a trap');
      await register(daemon, root);
      const recorded = await record(daemon, root, [{ type: 'trap', path: 'AGENTS.md' }]);
      assert.deepEqual(recorded.promoted, [{ type: 'trap', path: 'AGENTS.md' }]);
      assert.deepEqual(recorded.diagnostics, []);
    });
  });

  it('gives a null path for a target this project does not declare', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository('version: 1\n\nproject:\n  id: bare-project\n');
      await register(daemon, root);

      const body = await prepare(daemon, root);
      assert.deepEqual(
        body.targets.map((target) => target.path),
        [null, null, null, null, null, null],
      );
      assert.ok(body.attention.some((item) => item.code === 'tracker.unavailable'));
    });
  });
});
