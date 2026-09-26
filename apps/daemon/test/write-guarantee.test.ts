import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { after, it } from 'node:test';
import { operations } from '../src/operations.ts';
import { startTestDaemon } from '../src/testing.ts';

/**
 * The write guarantee (ADR-0020): no daemon operation writes into a project's repository,
 * nor into the harnesses' artifact directories it reads usage from. `binn init` is the only
 * code in Binnacle that writes into a repository, and it is not the daemon.
 *
 * The operation table is the list of what the daemon exposes, so an operation added later
 * is called here without this test naming it. Each is sent the fixture's `path`, plus its
 * entry in `INPUT` when it needs more; one that cannot answer 200 on that fails here, so
 * that it is never counted as covered without having run.
 */
const INPUT: Record<string, object> = {
  'checkpoint.record': { promoted: [] },
  'task.get': { id: 'first/01' },
  'usage.get': { task: 'first/01' },
};

const MANIFEST = `version: 1

project:
  id: write-guarantee

tracker:
  provider: local
  local:
    issues: docs/specs

knowledge:
  docs: docs
  adr: docs/adr
`;

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function git(root: string, args: string[]): void {
  execFileSync('git', ['-c', 'user.name=Binnacle Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: root });
}

function write(root: string, path: string, text: string): void {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}

/**
 * A committed repository with a staged change, an unstaged one, an untracked file, and a
 * tracked file whose timestamp moved after it was indexed: a `git status` allowed to take
 * its optional lock would refresh the index for that one.
 */
function makeRepository(): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-write-guarantee-')));
  roots.push(root);
  write(root, '.binnacle/project.yaml', MANIFEST);
  write(root, 'docs/roadmap.md', '# Roadmap\n\n| # | Epic | Status | Spec |\n| --- | --- | --- | --- |\n| 1 | First | tickets | [`first`](specs/first/spec.md) |\n\n## Current focus\n\nNext action: start ticket 01. `/binnacle:autopilot`\n');
  write(root, 'docs/specs/first/spec.md', '# Spec\n');
  write(root, 'docs/specs/first/issues/01-start.md', '# 01: Start\n\nStatus: READY\nBlocked by: None\n');
  write(root, 'docs/adr/ADR-0001-first.md', '# ADR-0001: First\n');
  write(root, 'CONTEXT.md', '# Context\n');
  git(root, ['init', '--quiet', '--initial-branch=main']);
  git(root, ['add', '.']);
  git(root, ['commit', '--quiet', '-m', 'Start the project']);

  write(root, 'docs/adr/ADR-0002-staged.md', '# ADR-0002: Staged\n');
  git(root, ['add', 'docs/adr/ADR-0002-staged.md']);
  write(root, 'docs/specs/first/issues/01-start.md', '# 01: Start\n\nStatus: ACTIVE\nBlocked by: None\n');
  write(root, 'notes.txt', 'untracked\n');
  const later = new Date(Date.now() + 60_000);
  utimesSync(join(root, 'CONTEXT.md'), later, later);
  return root;
}

/** A hash of every file under the repository, `.git` and its index included, by path. */
function contents(root: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files.set(relative(root, path), createHash('sha256').update(readFileSync(path)).digest('hex'));
  }
  return files;
}

/**
 * A Claude Code session with a subagent's beside it, and a Codex rollout of the repository,
 * from the fixtures cut from real ones. Every record's branch is read from the repository's reflog.
 */
function makeArtifacts(root: string): { claudeCode: string; codex: string } {
  const artifacts = { claudeCode: temporary('binnacle-write-guarantee-claude-'), codex: temporary('binnacle-write-guarantee-codex-') };
  const now = new Date().toISOString();
  const fixture = (harness: string, name: string, line: (record: Record<string, unknown>) => object): string =>
    readFileSync(join(import.meta.dirname, 'fixtures', harness, name), 'utf8')
      .trim()
      .split('\n')
      .map((text) => `${JSON.stringify(line(JSON.parse(text) as Record<string, unknown>))}\n`)
      .join('');
  const session = join(root.replace(/[^a-zA-Z0-9]/g, '-'), 'session');
  const claudeCode = (record: Record<string, unknown>): object => ({ ...record, cwd: root, sessionId: 'session', timestamp: now });
  write(artifacts.claudeCode, `${session}.jsonl`, fixture('claude-code', 'grill-on-main.jsonl', claudeCode));
  write(artifacts.claudeCode, join(session, 'subagents', 'agent-a.jsonl'), fixture('claude-code', 'subagent-in-worktree.jsonl', claudeCode));
  write(artifacts.claudeCode, join(session, 'subagents', 'agent-a.meta.json'), readFileSync(join(import.meta.dirname, 'fixtures', 'claude-code', 'subagent-in-worktree.meta.json'), 'utf8'));
  write(
    artifacts.codex,
    join('2026', '09', '07', 'rollout.jsonl'),
    fixture('codex', 'tool-calls.jsonl', (record) =>
      record.type === 'session_meta' ? { ...record, timestamp: now, payload: { ...(record.payload as object), cwd: root } } : { ...record, timestamp: now },
    ),
  );
  return artifacts;
}

function temporary(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  roots.push(root);
  return root;
}

it('no daemon operation nor static file changes the working tree, the index or anything else in the repository, or the artifacts it reads', async () => {
  const root = makeRepository();
  const artifacts = makeArtifacts(root);
  const dashboard = temporary('binnacle-write-guarantee-dashboard-');
  write(dashboard, 'index.html', '<!doctype html><title>Binnacle</title>');
  write(dashboard, '200.html', '<!doctype html><title>Binnacle</title>');
  write(dashboard, '_nuxt/entry.js', 'export {};');
  const daemon = await startTestDaemon({ artifacts, dashboard });
  try {
    const before = contents(root);
    const claudeCodeBefore = contents(artifacts.claudeCode);
    const codexBefore = contents(artifacts.codex);
    assert.ok(before.has(join('.git', 'index')));

    for (const name of Object.keys(operations)) {
      // Registered again before each, since one of them unregisters.
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      const result = await daemon.call(name, { path: root, ...INPUT[name] });
      assert.equal(result.status, 200, `${name}: ${JSON.stringify(result.body)}`);
      assert.deepEqual(contents(root), before, `${name} changed the repository`);
      assert.deepEqual(contents(artifacts.claudeCode), claudeCodeBefore, `${name} changed the Claude Code artifacts`);
      assert.deepEqual(contents(artifacts.codex), codexBefore, `${name} changed the Codex artifacts`);
    }
    // The dashboard's files, and the fallback for a client-side path.
    for (const path of ['/', '/_nuxt/entry.js', '/projects']) {
      assert.equal((await fetch(daemon.url(path))).status, 200, path);
      assert.deepEqual(contents(root), before, `${path} changed the repository`);
    }
    // The artifacts were read, not merely present.
    const snapshot = await daemon.call<{ usage: { today: { records: number } } }>('project.snapshot', { path: root });
    // One Claude Code message, one of its subagent's, and ten Codex calls.
    assert.equal(snapshot.body.usage.today.records, 12);
  } finally {
    await daemon.stop();
  }
});
