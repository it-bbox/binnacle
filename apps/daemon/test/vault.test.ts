import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, symlinkSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
  write(root, '.gitignore', 'graphify-out/\n');
  write(root, 'docs/roadmap.md', '# Roadmap\n\n| # | Epic | Status | Spec |\n| --- | --- | --- | --- |\n| 1 | Alpha | in progress | [`alpha`](specs/alpha/spec.md) |\n\n## Current focus\n\nAlpha.\n');
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

      // Product holds the roadmap; the snapshot and the daily come when one is served, and 90-Graphify with a graph.
      assert.deepEqual(readdirSync(join(vault, PROJECT)).sort(), ['Decisions', 'Product', 'Research', 'Specs']);
      assert.deepEqual(readdirSync(note(vault, 'Product')), ['roadmap.md']);
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
      assert.match(read(vault, 'Product/roadmap.md'), new RegExp(`^---\ngenerated-by: binnacle\nsource: docs/roadmap.md\ncommit: ${commit}\n`));
      assert.match(read(vault, 'Product/roadmap.md'), /\| 1 \| Alpha \| in progress \| \[\[Projects\/Vault Test\/Specs\/alpha\/spec\\\|`alpha`\]\] \|/);
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
      // Serving a snapshot and a daily with no vault set writes nothing either.
      assert.deepEqual(await vaultCodes(daemon, root), []);
      assert.equal((await daemon.call('daily.get', { path: root })).status, 200);
      assert.deepEqual(readdirSync(vault), []);

      setVault(daemon, vault);
      await until(() => existsSync(note(vault, 'Research/guide.md')), 'the projection after the setting');

      const other = temporary('binnacle-vault-other-');
      setVault(daemon, other);
      await until(() => existsSync(note(other, 'Research/guide.md')), 'the projection into the other vault');
    });
  });

  it('writes nothing through a folder that links out of the vault', async () => {
    const { root } = makeRepository();
    const vault = temporary('binnacle-vault-');
    const outside = temporary('binnacle-vault-outside-');
    mkdirSync(join(vault, PROJECT), { recursive: true });
    symlinkSync(outside, join(vault, PROJECT, 'Research'));
    await withDaemon(async (daemon) => {
      setVault(daemon, vault);
      await register(daemon, root);
      await until(() => existsSync(note(vault, 'Decisions/ADR-0001-first.md')), 'the projection');
      await settle();
      assert.deepEqual(readdirSync(outside), []);
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
      // Root writes anywhere, so a read-only directory is only unwritable for anyone else.
      if (process.getuid?.() !== 0) {
        const readOnly = join(parent, 'read-only');
        mkdirSync(readOnly, { mode: 0o555 });
        chmodSync(readOnly, 0o555);
        setVault(daemon, readOnly);
        assert.deepEqual(await vaultCodes(daemon, root), ['vault.unwritable']);
        await settle();
        assert.deepEqual(readdirSync(readOnly), []);
        chmodSync(readOnly, 0o755);
      }
      await settle();
      assert.deepEqual(readdirSync(parent).sort(), process.getuid?.() === 0 ? ['a-file'] : ['a-file', 'read-only']);
    });
  });

  it('writes the Product snapshot and daily notes from what was served, linked to the tickets and ADRs they name', async () => {
    const { root, commit } = makeRepository();
    const vault = temporary('binnacle-vault-');
    await withDaemon(async (daemon) => {
      setVault(daemon, vault);
      await register(daemon, root);
      await until(() => existsSync(note(vault, 'Product/roadmap.md')), 'the projection');
      assert.equal(existsSync(note(vault, 'Product/snapshot.md')), false);

      assert.equal((await daemon.call('project.snapshot', { path: root })).status, 200);
      const snapshot = read(vault, 'Product/snapshot.md');
      assert.match(snapshot, new RegExp(`^---\ngenerated-by: binnacle\nsource: project.snapshot\ncommit: ${commit}\nserved: \\d{4}-`));
      assert.match(snapshot, /\[\[Projects\/Vault Test\/Specs\/alpha\/01-one\|[^\]]*One\]\]/);
      assert.match(snapshot, /\[\[Projects\/Vault Test\/Decisions\/ADR-0001-first\|ADR-0001: First\]\]/);

      assert.equal((await daemon.call('daily.get', { path: root })).status, 200);
      const daily = read(vault, 'Product/daily.md');
      assert.match(daily, new RegExp(`^---\ngenerated-by: binnacle\nsource: daily.get\ncommit: ${commit}\nserved: \\d{4}-`));
      assert.match(daily, /Start/);
      assert.match(daily, /\[\[Projects\/Vault Test\/Specs\/alpha\/01-one\|[^\]]*One\]\]/);
      assert.match(daily, /\[\[Projects\/Vault Test\/Decisions\/ADR-0001-first\|ADR-0001: First\]\]/);
    });
  });

  it('writes Waiting for the owner into the snapshot and daily notes: the questions, the approvals and the owner’s Tasks', async () => {
    const { root } = makeRepository();
    write(root, 'docs/specs/alpha/issues/02-asked.md', '# 02: Asked\n\nStatus: ACTIVE\n\n## Comments\n\n### Question\n\nWhich way?\n');
    write(root, 'docs/specs/alpha/issues/03-review.md', '# 03: Review\n\nStatus: READY_FOR_REVIEW\n');
    write(root, 'docs/specs/alpha/issues/04-human.md', '# 04: Human\n\nStatus: READY\nTriage: ready-for-human\n');
    commitAll(root, 'Waiting for the owner');
    const vault = temporary('binnacle-vault-');
    await withDaemon(async (daemon) => {
      setVault(daemon, vault);
      await register(daemon, root);
      const expected = [
        '## Waiting for the owner',
        '### Questions',
        '- [[Projects/Vault Test/Specs/alpha/02-asked|alpha/02: Asked]]: Which way?',
        '### Approvals',
        '- [[Projects/Vault Test/Specs/alpha/03-review|alpha/03: Review]] — READY_FOR_REVIEW',
        '### The owner’s to start',
        '- [[Projects/Vault Test/Specs/alpha/04-human|alpha/04: Human]] — READY',
      ].join('\n\n');

      assert.equal((await daemon.call('project.snapshot', { path: root })).status, 200);
      assert.ok(read(vault, 'Product/snapshot.md').includes(expected), read(vault, 'Product/snapshot.md'));
      assert.equal((await daemon.call('daily.get', { path: root })).status, 200);
      assert.ok(read(vault, 'Product/daily.md').includes(expected), read(vault, 'Product/daily.md'));
    });
  });

  it('refreshes the roadmap note when main moves, and removes it with the roadmap', async () => {
    const { root } = makeRepository();
    const vault = temporary('binnacle-vault-');
    await withDaemon(async (daemon) => {
      setVault(daemon, vault);
      await register(daemon, root);
      await until(() => existsSync(note(vault, 'Product/roadmap.md')), 'the projection');
      write(root, 'docs/roadmap.md', '# Roadmap\n\nBeta next: [beta](specs/beta/spec.md).\n');
      const moved = commitAll(root, 'Move the roadmap');
      await until(() => read(vault, 'Product/roadmap.md').includes(moved), 'the roadmap refreshed');
      assert.match(read(vault, 'Product/roadmap.md'), /Beta next: \[\[Projects\/Vault Test\/Specs\/beta\/spec\|beta\]\]\./);

      git(root, ['rm', '--quiet', 'docs/roadmap.md']);
      commitAll(root, 'Drop the roadmap');
      await until(() => !existsSync(note(vault, 'Product/roadmap.md')), 'the roadmap note removed');
    });
  });

  it('projects the graph report after a successful run, keeps it after a failed one, and has none without a graph', async () => {
    const { root, commit } = makeRepository();
    const vault = temporary('binnacle-vault-');
    const bin = temporary('binnacle-vault-bin-');
    const graphify = (body: string): void => {
      writeFileSync(join(bin, 'graphify'), `#!/bin/sh\nmkdir -p graphify-out\n${body}\n`);
      chmodSync(join(bin, 'graphify'), 0o755);
    };
    // As Graphify does: the extract writes the graph, and only the report step writes the report.
    graphify(
      `if [ "$1" = cluster-only ]; then echo "# Report of $(git rev-parse HEAD)" > graphify-out/GRAPH_REPORT.md; else echo '{"nodes": [], "links": []}' > graphify-out/graph.json; fi`,
    );
    const daemon = await startTestDaemon({ vaultPollMs: POLL_MS, graphPollMs: POLL_MS, searchPath: bin });
    try {
      setVault(daemon, vault);
      await register(daemon, root);
      await until(() => existsSync(note(vault, '90-Graphify/GRAPH_REPORT.md')), 'the report projected');
      const report = read(vault, '90-Graphify/GRAPH_REPORT.md');
      assert.equal(report, `---\ngenerated-by: binnacle\nsource: graphify-out/GRAPH_REPORT.md\ncommit: ${commit}\n---\n# Report of ${commit}\n`);

      graphify('echo "# A broken report" > graphify-out/GRAPH_REPORT.md\necho "it broke" >&2\nexit 1');
      write(root, 'docs/guide.md', '# Guide\n\nMoved.\n');
      const moved = commitAll(root, 'Move');
      await until(async () => {
        const result = await daemon.call<{ graph: { lastRun: { commit: string } | null } }>('project.snapshot', { path: root });
        return result.body.graph.lastRun?.commit === moved && read(vault, 'Research/guide.md').includes(moved);
      }, 'the failed run and the projection of the move');
      await settle();
      assert.equal(read(vault, '90-Graphify/GRAPH_REPORT.md'), report);

      // A vault set after the failed run never gets the report the failed run left behind.
      const later = temporary('binnacle-vault-later-');
      setVault(daemon, later);
      await until(() => existsSync(join(later, PROJECT, 'Research/guide.md')), 'the projection into the later vault');
      await settle();
      assert.equal(existsSync(join(later, PROJECT, '90-Graphify')), false);
    } finally {
      await daemon.stop();
    }

    // Without graphify no run is recorded: no report note, and no attention item for it.
    const other = makeRepository();
    const second = temporary('binnacle-vault-');
    await withDaemon(async (daemon) => {
      setVault(daemon, second);
      await register(daemon, other.root);
      await until(() => existsSync(join(second, PROJECT, 'Product/roadmap.md')), 'the projection');
      await settle();
      assert.equal(existsSync(join(second, PROJECT, '90-Graphify')), false);
      const result = await daemon.call<Snapshot>('project.snapshot', { path: other.root });
      assert.deepEqual(result.body.attention.filter((item) => /^(vault|graph)\./.test(item.code)), []);
    });
  });
});
