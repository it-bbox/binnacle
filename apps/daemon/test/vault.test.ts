import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * The vault projection (ADR-0036): with `obsidian.vaultPath` in the Binnacle home's
 * `settings.json`, the daemon renders each registered project's committed default branch
 * into `Projects/<Project>/` of that vault. Checked through what a person could see: the
 * vault's files, and the snapshot's attention.
 */
type Snapshot = { attention: { code: string; message: string }[] };

const POLL_MS = 40;
const PROJECT = 'Projects/Vault Test';
const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function temporary(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  roots.push(root);
  return root;
}

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Binnacle Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' }).trim();
}

function write(root: string, path: string, text: string): void {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}

function commitAll(root: string, message: string): string {
  git(root, ['add', '--all']);
  git(root, ['commit', '--quiet', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

function makeRepository(): { root: string; commit: string } {
  const root = temporary('binnacle-vault-repo-');
  write(
    root,
    '.binnacle/project.yaml',
    'version: 1\n\nproject:\n  id: vault\n  name: Vault Test\n\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n\nknowledge:\n  docs: docs\n  adr: docs/adr\n  specs: docs/specs\n',
  );
  write(root, 'docs/roadmap.md', '# Roadmap\n');
  write(root, 'docs/guide.md', '# Guide\n\nSee [the decision](adr/ADR-0001-first.md#context), [the web](https://example.com/a.md) and ![a picture](picture.png).\n');
  write(root, 'docs/operations/run.md', '# Run\n\n| Step | See |\n| --- | --- |\n| one | [guide](../guide.md) |\n');
  write(root, 'docs/adr/ADR-0001-first.md', '# ADR-0001: First\n\n## Context\n');
  write(root, 'docs/specs/alpha/spec.md', '# Spec: Alpha\n\nTickets: [one](issues/01-one.md).\n');
  write(root, 'docs/specs/alpha/issues/01-one.md', '# 01: One\n\nStatus: READY\nSpec: [alpha](../spec.md)\n');
  write(root, 'docs/specs/beta/spec.md', '# Spec: Beta\n');
  write(root, 'docs/specs/beta/issues/01-two.md', '# 01: Two\n\nStatus: READY\n');
  git(root, ['init', '--quiet', '--initial-branch=main']);
  return { root, commit: commitAll(root, 'Start') };
}

const setVault = (daemon: TestDaemon, vault: unknown): void =>
  writeFileSync(join(daemon.home, 'settings.json'), JSON.stringify({ obsidian: { vaultPath: vault } }), { mode: 0o600 });

const note = (vault: string, path: string): string => join(vault, PROJECT, path);
const read = (vault: string, path: string): string => readFileSync(note(vault, path), 'utf8');

async function until(condition: () => Promise<boolean> | boolean, what: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting until ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, POLL_MS * 8));

async function withDaemon(body: (daemon: TestDaemon) => Promise<void>): Promise<void> {
  const daemon = await startTestDaemon({ vaultPollMs: POLL_MS });
  try {
    await body(daemon);
  } finally {
    await daemon.stop();
  }
}

async function register(daemon: TestDaemon, root: string): Promise<void> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
}

async function vaultCodes(daemon: TestDaemon, root: string): Promise<string[]> {
  const result = await daemon.call<Snapshot>('project.snapshot', { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.attention.filter((item) => item.code.startsWith('vault.')).map((item) => item.code);
}

describe('the vault projection', () => {
  it('projects Specs, Decisions and Research from the default branch, with Obsidian links and the generated marker', async () => {
    const { root, commit } = makeRepository();
    const vault = temporary('binnacle-vault-');
    await withDaemon(async (daemon) => {
      setVault(daemon, vault);
      await register(daemon, root);
      await until(() => existsSync(note(vault, 'Research/guide.md')), 'the projection');
      await settle();

      assert.deepEqual(readdirSync(join(vault, PROJECT)).sort(), ['Decisions', 'Research', 'Specs']);
      assert.deepEqual(readdirSync(note(vault, 'Specs')).sort(), ['alpha', 'beta']);
      assert.deepEqual(readdirSync(note(vault, 'Specs/alpha')).sort(), ['01-one.md', 'spec.md']);
      assert.deepEqual(readdirSync(note(vault, 'Decisions')), ['ADR-0001-first.md']);
      // The roadmap is Product's, and the ADRs and specs have their own folders.
      assert.deepEqual(readdirSync(note(vault, 'Research')).sort(), ['guide.md', 'operations']);

      assert.equal(
        read(vault, 'Decisions/ADR-0001-first.md'),
        `---\ngenerated-by: binnacle\nsource: docs/adr/ADR-0001-first.md\ncommit: ${commit}\n---\n# ADR-0001: First\n\n## Context\n`,
      );
      assert.match(read(vault, 'Research/guide.md'), /See \[\[Projects\/Vault Test\/Decisions\/ADR-0001-first#context\|the decision\]\], \[the web\]\(https:\/\/example\.com\/a\.md\) and !\[a picture\]\(picture\.png\)\./);
      assert.match(read(vault, 'Research/operations/run.md'), /\| one \| \[\[Projects\/Vault Test\/Research\/guide\\\|guide\]\] \|/);
      assert.match(read(vault, 'Specs/alpha/spec.md'), /Tickets: \[\[Projects\/Vault Test\/Specs\/alpha\/01-one\|one\]\]\./);
      assert.match(read(vault, 'Specs/alpha/01-one.md'), /Spec: \[\[Projects\/Vault Test\/Specs\/alpha\/spec\|alpha\]\]/);
      assert.deepEqual(await vaultCodes(daemon, root), []);
    });
  });

  it("leaves a human's note, and a file without the marker at a generated note's path, byte for byte", async () => {
    const { root } = makeRepository();
    const vault = temporary('binnacle-vault-');
    const mine = '# Mine\n\nMy own thoughts.\n';
    const squatter = '# Not generated\n';
    write(vault, `${PROJECT}/Decisions/mine.md`, mine);
    write(vault, `${PROJECT}/Decisions/ADR-0001-first.md`, squatter);
    await withDaemon(async (daemon) => {
      setVault(daemon, vault);
      await register(daemon, root);
      await until(() => existsSync(note(vault, 'Research/guide.md')), 'the projection');
      git(root, ['rm', '--quiet', '-r', 'docs/adr']);
      const dropped = commitAll(root, 'Drop the ADRs');
      await until(() => read(vault, 'Specs/alpha/spec.md').includes(dropped), 'the projection of the second commit');

      assert.equal(read(vault, 'Decisions/mine.md'), mine);
      assert.equal(read(vault, 'Decisions/ADR-0001-first.md'), squatter);
    });
  });

  it('removes the notes of a spec removed from main, and nothing else', async () => {
    const { root } = makeRepository();
    const vault = temporary('binnacle-vault-');
    write(vault, `${PROJECT}/Specs/beta/mine.md`, '# Mine\n');
    await withDaemon(async (daemon) => {
      setVault(daemon, vault);
      await register(daemon, root);
      await until(() => existsSync(note(vault, 'Specs/beta/spec.md')), 'the projection');

      git(root, ['rm', '--quiet', '-r', 'docs/specs/alpha']);
      commitAll(root, 'Drop alpha');
      await until(() => !existsSync(note(vault, 'Specs/alpha')), 'the spec removed');

      assert.equal(existsSync(note(vault, 'Specs/beta/01-two.md')), true);
      assert.equal(read(vault, 'Specs/beta/mine.md'), '# Mine\n');
    });
  });

  it('never projects an uncommitted change in the registered checkout', async () => {
    const { root } = makeRepository();
    const vault = temporary('binnacle-vault-');
    write(root, 'docs/guide.md', '# Guide\n\nUncommitted.\n');
    write(root, 'docs/draft.md', '# Draft\n');
    await withDaemon(async (daemon) => {
      setVault(daemon, vault);
      await register(daemon, root);
      await until(() => existsSync(note(vault, 'Research/guide.md')), 'the projection');
      await settle();

      assert.doesNotMatch(read(vault, 'Research/guide.md'), /Uncommitted/);
      assert.equal(existsSync(note(vault, 'Research/draft.md')), false);
    });
  });

  it('writes nothing and raises nothing with no setting, and takes a setting up without a restart', async () => {
    const { root } = makeRepository();
    const vault = temporary('binnacle-vault-');
    await withDaemon(async (daemon) => {
      await register(daemon, root);
      await settle();
      assert.deepEqual(readdirSync(vault), []);
      assert.deepEqual(await vaultCodes(daemon, root), []);

      setVault(daemon, vault);
      await until(() => existsSync(note(vault, 'Research/guide.md')), 'the projection after the setting');
    });
  });

  it('is vault.unwritable for a path that does not exist or is not a directory', async () => {
    const { root } = makeRepository();
    const parent = temporary('binnacle-vault-');
    const file = join(parent, 'a-file');
    writeFileSync(file, 'not a vault\n');
    await withDaemon(async (daemon) => {
      await register(daemon, root);
      setVault(daemon, join(parent, 'missing'));
      assert.deepEqual(await vaultCodes(daemon, root), ['vault.unwritable']);
      setVault(daemon, file);
      assert.deepEqual(await vaultCodes(daemon, root), ['vault.unwritable']);
      await settle();
      assert.deepEqual(readdirSync(parent), ['a-file']);
    });
  });
});
