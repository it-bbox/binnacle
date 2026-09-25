import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { isAlive, readRuntime } from '@binnacle/daemon';
import { offerFile, type Session } from '../src/init.ts';

const BINN = fileURLToPath(new URL('../src/bin.ts', import.meta.url));
/** The CLI package's directory: the marketplace `binn init` adds (ADR-0027). */
const PACKAGE = dirname(dirname(BINN));
const GIT = (process.env.PATH ?? '').split(delimiter).map((dir) => join(dir, 'git')).find(existsSync);

/** The environment minus anything that would point git at another repository. */
const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], {
    cwd,
    encoding: 'utf8',
    env: baseEnv,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

/** A temporary Git repository named `name`, with one commit so that "no commit made" can be checked. */
function makeRepository(t: TestContext, name: string, files: Record<string, string> = {}): string {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-init-')));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, name);
  mkdirSync(root);
  git(root, 'init', '--quiet', '--initial-branch=main');
  writeFileSync(join(root, 'README.md'), '# fixture\n');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'fixture');
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

type Home = { home: string; binnacleHome: string; bin: string };

/**
 * A temporary home whose `bin` is the whole PATH `binn init` sees: `git`, and a `claude`
 * only when a test puts one there, so the machine's own Claude Code is never run.
 */
function makeHome(t: TestContext): Home {
  const home = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-init-home-')));
  const binnacleHome = join(home, '.binnacle');
  const bin = join(home, 'bin');
  mkdirSync(bin);
  assert.ok(GIT, 'git is on PATH');
  symlinkSync(GIT, join(bin, 'git'));
  t.after(() => {
    const leftover = readRuntime(binnacleHome);
    if (leftover && isAlive(leftover.pid)) process.kill(leftover.pid, 'SIGKILL');
    rmSync(home, { recursive: true, force: true });
  });
  return { home, binnacleHome, bin };
}

/**
 * A fake `claude` first on PATH, recording each call's arguments one per line, tab-separated.
 * `plugin list --json` prints `listed`; any other call exits with `exitCode`.
 */
function fakeClaude(home: Home, listed: string[] = [], exitCode = 0): () => string[][] {
  const calls = join(home.home, 'claude-calls');
  const list = JSON.stringify(listed.map((id) => ({ id, scope: 'user', enabled: true })));
  // Shell builtins only: the PATH it runs with holds nothing but git and this script.
  writeFileSync(
    join(home.bin, 'claude'),
    `#!/bin/sh
for arg in "$@"; do printf '%s\\t' "$arg"; done >> '${calls}'
echo >> '${calls}'
if [ "$1 $2 $3" = "plugin list --json" ]; then printf '%s\\n' '${list}'; exit 0; fi
exit ${exitCode}
`,
  );
  chmodSync(join(home.bin, 'claude'), 0o755);
  return () =>
    existsSync(calls)
      ? readFileSync(calls, 'utf8').trimEnd().split('\n').map((line) => line.replace(/\t$/, '').split('\t'))
      : [];
}

function binnIn(home: Home) {
  return (cwd: string, input: string, ...args: string[]) =>
    spawnSync(process.execPath, [BINN, ...args], {
      cwd,
      input,
      encoding: 'utf8',
      env: { ...baseEnv, HOME: home.home, BINNACLE_HOME: home.binnacleHome, BINNACLE_PORT: '0', PATH: home.bin },
    });
}

const commits = (root: string): string => git(root, 'rev-list', '--all');
const manifestOf = (root: string): string => readFileSync(join(root, '.binnacle', 'project.yaml'), 'utf8');

test('binn --help lists binn init', () => {
  const result = spawnSync(process.execPath, [BINN, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /binn init \[path\]/);
});

test('binn init refuses a directory outside any Git repository and writes nothing', (t) => {
  const home = makeHome(t);
  const bare = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-init-bare-')));
  t.after(() => rmSync(bare, { recursive: true, force: true }));

  const result = binnIn(home)(bare, 'y\ny\n', 'init');
  assert.equal(result.status, 3, result.stdout);
  assert.match(result.stderr, /not inside a Git repository/);
  assert.equal(existsSync(join(bare, '.binnacle')), false);
});

test('a GitHub remote proposes the github tracker with its repository, from a subdirectory, at the repository root', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'shop-front', { 'CONTEXT.md': '# Context\n', 'src/app.ts': '' });
  git(root, 'remote', 'add', 'origin', 'git@github.com:Acme/Shop-Front.git');
  const before = commits(root);

  const result = binnIn(home)(join(root, 'src'), 'y\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    manifestOf(root),
    `version: 1

project:
  id: shop-front

tracker:
  provider: github
  repository: Acme/Shop-Front

knowledge:
  context: CONTEXT.md
`,
  );
  // The whole file is shown before the question.
  assert.ok(result.stdout.includes('repository: Acme/Shop-Front'), result.stdout);
  assert.equal(existsSync(join(root, 'src', '.binnacle')), false);

  // No daemon: the two commands are printed, and init carries on to its summary.
  assert.match(result.stdout, /binn daemon start/);
  assert.match(result.stdout, /binn project register/);
  assert.match(result.stdout, /created\s+\.binnacle\/project\.yaml/);
  assert.match(result.stdout, /Nothing was committed/);
  assert.equal(commits(root), before);
});

test('a GitLab remote on its own host proposes gitlab with the full project path and the host', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'billing', { 'docs/adr/ADR-0001.md': '# ADR\n' });
  git(root, 'remote', 'add', 'upstream', 'https://gitlab.example.com/platform/payments/billing.git');

  const result = binnIn(home)(root, 'y\n', 'init', root);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    manifestOf(root),
    `version: 1

project:
  id: billing

tracker:
  provider: gitlab
  repository: platform/payments/billing
  host: gitlab.example.com

knowledge:
  docs: docs
  adr: docs/adr
`,
  );
});

test('no forge remote proposes the local tracker, only the knowledge that exists, and the Matt Pocock workflow', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'notes', {
    'CONTEXT.md': '# Context\n',
    'docs/specs/first/spec.md': '# Spec\n',
    'docs/agents/issue-tracker.md': '# Issue tracker\n',
  });
  git(root, 'remote', 'add', 'origin', 'https://git.example.org/me/notes.git');

  const result = binnIn(home)(root, 'yes\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    manifestOf(root),
    `version: 1

project:
  id: notes

tracker:
  provider: local
  local:
    issues: docs/specs

knowledge:
  context: CONTEXT.md
  docs: docs
  specs: docs/specs

workflow:
  provider: matt-pocock
`,
  );
});

test('an existing manifest with problems is reported, left alone, and not offered for registration', (t) => {
  const home = makeHome(t);
  const existing = 'version: 1\n\nproject:\n  id: kept\n\ntracker:\n  provider: jira\n';
  const root = makeRepository(t, 'kept', { '.binnacle/project.yaml': existing });

  const result = binnIn(home)(root, 'y\ny\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(manifestOf(root), existing);
  assert.match(result.stdout, /manifest\.invalid/);
  assert.match(result.stdout, /tracker\.provider/);
  assert.match(result.stdout, /skipped\s+project registration: no usable manifest/);
});

test('a valid existing manifest is reported with its warnings and left alone', (t) => {
  const home = makeHome(t);
  const existing = 'version: 1\nproject:\n  id: kept\nfuture_section: {}\n';
  const root = makeRepository(t, 'kept', { '.binnacle/project.yaml': existing });

  const result = binnIn(home)(root, 'y\ny\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(manifestOf(root), existing);
  assert.match(result.stdout, /exists and is valid/);
  assert.match(result.stdout, /future_section: unknown key/);
});

test('closed stdin is a no to every step, and writes nothing', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home);
  const root = makeRepository(t, 'quiet', { 'CONTEXT.md': '# Context\n' });

  const result = binnIn(home)(root, '', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(root, '.binnacle')), false);
  assert.match(result.stdout, /declined\s+create \.binnacle\/project\.yaml/);
  assert.match(result.stdout, /declined\s+the binnacle plugin/);
  assert.deepEqual(calls(), [['plugin', 'list', '--json']]);
  assert.equal(git(root, 'status', '--porcelain'), '?? CONTEXT.md\n');
});

test('registration with a running daemon', async (t) => {
  const home = makeHome(t);
  const binn = binnIn(home);
  const root = makeRepository(t, 'tracked');
  assert.equal(binn(root, '', 'daemon', 'start').status, 0);
  t.after(() => binn(root, '', 'daemon', 'stop'));

  // A declined manifest leaves nothing to register, so registration is not asked here; the
  // next subtest declines it on its own.
  await t.test('declining every step writes nothing and registers nothing', () => {
    const result = binn(root, 'n\nn\n', 'init');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(root, '.binnacle')), false);
    assert.equal(git(root, 'status', '--porcelain'), '');
    assert.match(binn(root, '', 'project', 'list').stdout, /No projects/);
  });

  await t.test('declining registration skips only registration', () => {
    const result = binn(root, 'y\nn\n', 'init');
    assert.equal(result.status, 0, result.stderr);
    assert.match(manifestOf(root), /id: tracked/);
    assert.match(result.stdout, /declined\s+project registration/);
    assert.match(binn(root, '', 'project', 'list').stdout, /No projects/);
  });

  await t.test('confirming registers the project through project.register', () => {
    const before = commits(root);
    const result = binn(root, 'y\n', 'init');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ran\s+project\.register/);
    const list = binn(root, '', 'project', 'list');
    assert.match(list.stdout, /tracked/);
    assert.ok(list.stdout.includes(root), list.stdout);
    assert.equal(commits(root), before);
  });
});

test('the plugin: Claude Code adds the package as a marketplace and installs binnacle from it, at user scope, in that order', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home);
  const root = makeRepository(t, 'plugged');

  // No manifest, so no registration question: the second answer is the plugin's.
  const result = binnIn(home)(root, 'n\ny\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const add = ['plugin', 'marketplace', 'add', PACKAGE, '--scope', 'user'];
  const install = ['plugin', 'install', 'binnacle@binnacle', '--scope', 'user'];
  assert.deepEqual(calls(), [['plugin', 'list', '--json'], add, install]);
  // Both commands are shown before the question, and summarised after.
  const question = result.stdout.indexOf('Install the binnacle plugin?');
  for (const args of [add, install]) {
    const shown = result.stdout.indexOf(`claude ${args.join(' ')}`);
    assert.ok(shown >= 0 && shown < question, result.stdout);
  }
  assert.match(result.stdout, /ran\s+claude plugin marketplace add/);
  assert.match(result.stdout, /ran\s+claude plugin install binnacle@binnacle/);
  // Claude Code's settings files are Claude Code's to write: binn init writes none.
  assert.equal(existsSync(join(home.home, '.claude')), false);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('the plugin: a failed marketplace add is reported, and the install is not attempted', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home, [], 1);
  const root = makeRepository(t, 'unplugged');

  const result = binnIn(home)(root, 'n\ny\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    calls().map((call) => call.slice(0, 2)),
    [
      ['plugin', 'list'],
      ['plugin', 'marketplace'],
    ],
  );
  assert.match(result.stdout, /failed\s+claude plugin marketplace add/);
});

test('the plugin: skipped and reported when Claude Code already lists it', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home, ['other@somewhere', 'binnacle@binnacle']);
  const root = makeRepository(t, 'listed');

  const result = binnIn(home)(root, 'n\ny\ny\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls(), [['plugin', 'list', '--json']]);
  assert.match(result.stdout, /skipped\s+the binnacle plugin: Claude Code already lists binnacle@binnacle/);
});

test('the plugin: skipped and reported for a project that provides its own binnacle plugin', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home);
  const root = makeRepository(t, 'binnacle-itself', {
    '.claude/skills/binnacle/.claude-plugin/plugin.json': '{ "name": "binnacle" }\n',
  });

  const result = binnIn(home)(root, 'n\ny\ny\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls(), []);
  assert.match(result.stdout, /skipped\s+the binnacle plugin: the project provides its own, at \.claude\/skills\/binnacle/);
});

test('the plugin: declined runs nothing but the listing', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home);
  const root = makeRepository(t, 'declined');

  const result = binnIn(home)(root, 'n\nn\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls(), [['plugin', 'list', '--json']]);
  assert.match(result.stdout, /declined\s+the binnacle plugin/);
});

test('the plugin: without Claude Code on PATH nothing is offered and nothing runs', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'no-claude');

  const result = binnIn(home)(root, 'n\ny\ny\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Install the binnacle plugin/);
  assert.match(result.stdout, /skipped\s+the binnacle plugin: Claude Code is not detected/);
});

/**
 * The writing rules, below the subprocess seam: no step of this ticket extends a file, so
 * the append and JSON branches are reached here until the harness and Matt Pocock steps
 * (tickets 09 and 11) reach them through `binn init` itself.
 */
test('the writing rules: create, append only at the end, never rewrite JSON, and a no writes nothing', async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-init-writes-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'notes.md'), '# Notes');
  writeFileSync(join(root, 'mcp.json'), '{}\n');

  const answers: boolean[] = [];
  const session: Session = { root, ask: async () => answers.shift() ?? false, say: () => {}, outcomes: [] };

  answers.push(false);
  await offerFile(session, 'new/file.toml', 'a = 1\n');
  assert.equal(existsSync(join(root, 'new')), false);

  answers.push(true);
  await offerFile(session, 'new/file.toml', 'a = 1\n');
  assert.equal(readFileSync(join(root, 'new', 'file.toml'), 'utf8'), 'a = 1\n');

  answers.push(true);
  await offerFile(session, 'notes.md', '## Added\n');
  assert.equal(readFileSync(join(root, 'notes.md'), 'utf8'), '# Notes\n## Added\n');

  answers.push(true);
  await offerFile(session, 'mcp.json', '{ "binnacle": {} }\n');
  assert.equal(readFileSync(join(root, 'mcp.json'), 'utf8'), '{}\n');
  assert.equal(answers.length, 1, 'a JSON file is never even asked about');
});
