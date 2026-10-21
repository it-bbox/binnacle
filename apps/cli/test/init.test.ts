import assert from 'node:assert/strict';
import { execFile, spawn, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test, type TestContext } from 'node:test';
import { isAlive, readManifest, readRuntime, readToken } from '@binnacle/daemon';
import { callOperation } from '../src/client.ts';
import { fakeSystemctl } from './fake-systemctl.ts';

const BINN = fileURLToPath(new URL('../src/bin.ts', import.meta.url));
/** Preloaded, it makes stdin read as a terminal: `binn init` writes nothing without one (ADR-0034). */
const TERMINAL = fileURLToPath(new URL('./terminal-shim.ts', import.meta.url));
/** The CLI package's directory: the marketplace `binn init` adds (ADR-0027). */
const PACKAGE = dirname(dirname(BINN));
const GIT = (process.env.PATH ?? '').split(delimiter).map((dir) => join(dir, 'git')).find(existsSync);

/**
 * The environment minus anything that would point git at another repository, minus a
 * tracker token the developer has set, which would otherwise reach the loopback stand-ins,
 * and minus the harnesses' artifact roots, which would show this machine's own sessions.
 */
const baseEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !key.startsWith('GIT_') && !/^BINNACLE_(GITHUB|GITLAB)_TOKEN$/.test(key) && key !== 'CLAUDE_CONFIG_DIR' && key !== 'CODEX_HOME',
  ),
);

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

/** `env`: what a test adds to the environment `binn` runs with. */
type Home = { home: string; binnacleHome: string; bin: string; env?: NodeJS.ProcessEnv };

/**
 * A temporary home whose `bin` is the whole PATH `binn init` sees: `git`, and whatever fake
 * harness executables a test puts there, so no harness of this machine is detected or run.
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

/** A harness "installed" by its executable on PATH. */
function installExecutable(home: Home, name: string): void {
  writeFileSync(join(home.bin, name), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
}

/** A harness "installed" by its user configuration directory. */
function installUserDirectory(home: Home, relative: string): void {
  mkdirSync(join(home.home, relative), { recursive: true });
}

/**
 * `binn init` checks the tracker a new manifest declares, and a proposal from a real remote
 * declares a real host. Every request but one to loopback goes to a proxy that refuses it, so
 * that the tests stay offline and such a check fails at once as `tracker.unreachable`.
 */
const OFFLINE = { NODE_USE_ENV_PROXY: '1', HTTPS_PROXY: 'http://127.0.0.1:9', HTTP_PROXY: 'http://127.0.0.1:9', NO_PROXY: '127.0.0.1,localhost' };

/** The environment every `binn` in these tests runs with: offline, in the temporary home, with only `home.bin` on PATH. */
const envFor = (home: Home): NodeJS.ProcessEnv => ({
  ...baseEnv,
  ...OFFLINE,
  HOME: home.home,
  BINNACLE_HOME: home.binnacleHome,
  BINNACLE_PORT: '0',
  PATH: home.bin,
  XDG_CONFIG_HOME: join(home.home, '.config'),
  ...home.env,
});

/** `binn` run with piped input, which reads as a terminal unless `terminal` is false. */
function binnIn(home: Home, terminal = true) {
  return (cwd: string, input: string, ...args: string[]) =>
    spawnSync(process.execPath, [...(terminal ? ['--import', TERMINAL] : []), BINN, ...args], {
      cwd,
      input,
      encoding: 'utf8',
      env: envFor(home),
    });
}

const commits = (root: string): string => git(root, 'rev-list', '--all');
const read = (root: string, relative: string): string => readFileSync(join(root, relative), 'utf8');
const manifestOf = (root: string): string => read(root, '.binnacle/project.yaml');
const windowSection = (window: string): string => `\ntelemetry:\n  import:\n    window_days: ${window}\n`;
/** The one question about the plan, and what each of its answers writes. */
const PLAN_QUESTION = 'Write this plan? [Y/n]';
/** The planning conventions and the block, in place, so that init plans none of them. */
const CONVENTIONS_IN_PLACE = {
  'docs/agents/issue-tracker.md': '# Issue tracker\n\n## Ticket header\n',
  'docs/agents/triage-labels.md': '# Triage Labels\n',
  'docs/agents/domain.md': '# Domain Docs\n',
  'AGENTS.md': '## Agent skills\n',
};

test('binn --help lists binn init', () => {
  const result = spawnSync(process.execPath, [BINN, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /binn init \[--window <days\|all>\] \[--language <en\|ru>\] \[--autostart <yes\|no>\] \[--skip-harness <id>\]\.\.\. \[path\]/);
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

  const result = binnIn(home)(join(root, 'src'), '\n\n\n', 'init');

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
  docs: docs
  language: en

workflow:
  provider: matt-pocock
${windowSection('90')}`,
  );
  // The whole file is shown before the one question.
  const shown = result.stdout.indexOf('repository: Acme/Shop-Front');
  assert.ok(shown >= 0 && shown < result.stdout.indexOf(PLAN_QUESTION), result.stdout);
  assert.equal(existsSync(join(root, 'src', '.binnacle')), false);

  // No daemon: the two commands are printed, and init carries on to its summary.
  assert.match(result.stdout, /binn daemon start/);
  assert.match(result.stdout, /binn project register/);
  assert.match(result.stdout, /created\s+\.binnacle\/project\.yaml/);
  // The new manifest's tracker is checked, here against the refusing proxy.
  assert.match(result.stdout, /failed\s+tracker check: tracker\.unreachable/);
  assert.match(result.stdout, /Nothing was committed/);
  assert.equal(commits(root), before);
});

test('a GitLab remote on its own host proposes gitlab with the full project path and the host', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'billing', { 'docs/adr/ADR-0001.md': '# ADR\n' });
  git(root, 'remote', 'add', 'upstream', 'https://gitlab.example.com/platform/payments/billing.git');

  const result = binnIn(home)(root, '\n\n\n', 'init', root);

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
  language: en

workflow:
  provider: matt-pocock
${windowSection('90')}`,
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

  const result = binnIn(home)(root, '\n\nyes\n', 'init');

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
  language: en

workflow:
  provider: matt-pocock
${windowSection('90')}`,
  );
});

test('an existing manifest with problems is reported, left alone, and not offered for registration', (t) => {
  const home = makeHome(t);
  const existing = 'version: 1\n\nproject:\n  id: kept\n\ntracker:\n  provider: jira\n';
  const root = makeRepository(t, 'kept', { '.binnacle/project.yaml': existing });

  const result = binnIn(home)(root, '\n', 'init');

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

  const result = binnIn(home)(root, '\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(manifestOf(root), existing);
  assert.match(result.stdout, /exists and is valid/);
  assert.match(result.stdout, /future_section: unknown key/);
});

test('the end of input at the plan is a no to all of it, and writes nothing', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home);
  installUserDirectory(home, '.codex');
  const codexToml = 'model = "o3"\n';
  const root = makeRepository(t, 'quiet', { 'CONTEXT.md': '# Context\n', '.codex/config.toml': codexToml });

  const result = binnIn(home)(root, '', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(root, '.binnacle')), false);
  assert.equal(existsSync(join(root, '.mcp.json')), false);
  assert.equal(read(root, '.codex/config.toml'), codexToml);
  assert.match(result.stdout, /declined\s+create \.binnacle\/project\.yaml/);
  assert.match(result.stdout, /declined\s+create \.mcp\.json/);
  assert.match(result.stdout, /declined\s+append to \.codex\/config\.toml/);
  assert.match(result.stdout, /declined\s+the binnacle plugin/);
  assert.deepEqual(calls(), [['plugin', 'list', '--json']]);
  assert.equal(git(root, 'status', '--porcelain'), '?? .codex/\n?? CONTEXT.md\n');
});

test('init exits after its summary while stdin is still open, as in a terminal', async (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'open-stdin');

  const child = spawn(process.execPath, [BINN, 'init'], { cwd: root, env: envFor(home) });
  t.after(() => child.kill('SIGKILL'));
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  // The default window and language, then a no to the plan; stdin is never ended.
  child.stdin.write('\n\nn\n');

  const code = await Promise.race([
    new Promise((resolve) => child.on('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 10_000, 'still running').unref()),
  ]);
  assert.equal(code, 0, output);
  assert.match(output, /Nothing was committed/);
});

test('one question covers the whole plan: Enter writes exactly the planned files, and nothing else is asked', (t) => {
  const home = makeHome(t);
  fakeClaude(home);
  installUserDirectory(home, '.codex');
  const root = makeRepository(t, 'planned', {
    'docs/agents/issue-tracker.md': '# Issue tracker\n',
    '.codex/config.toml': 'model = "o3"\n',
  });
  const before = commits(root);

  // The window answer, then Enter for the plan.
  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  // Every file, and every addition, is in the plan before the question, which is asked once.
  const question = result.stdout.indexOf(PLAN_QUESTION);
  assert.equal(result.stdout.split(PLAN_QUESTION).length, 2, result.stdout);
  assert.doesNotMatch(result.stdout, /\[y\/N\]/);
  for (const heading of [
    'Create .binnacle/project.yaml',
    'Create .mcp.json',
    'Append to the end of .codex/config.toml',
    'Append to the end of docs/agents/issue-tracker.md',
    'claude plugin install binnacle@binnacle',
  ]) {
    const shown = result.stdout.indexOf(heading);
    assert.ok(shown >= 0 && shown < question, `${heading}\n${result.stdout}`);
  }
  assert.match(manifestOf(root), /window_days: 90/);
  assert.ok(existsSync(join(root, '.mcp.json')));
  assert.match(read(root, '.codex/config.toml'), /^model = "o3"\n\[mcp_servers\.binnacle\]/);
  assert.match(read(root, 'docs/agents/issue-tracker.md'), /## Ticket header/);
  // The fixtures are untracked, so what shows is what the plan added to them and beside them.
  assert.equal(git(root, 'status', '--porcelain'), '?? .binnacle/\n?? .codex/\n?? .mcp.json\n?? AGENTS.md\n?? docs/\n');
  assert.equal(commits(root), before);
});

test('n declines the whole plan: nothing is written and nothing runs', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home);
  const root = makeRepository(t, 'declined-plan', { 'docs/agents/issue-tracker.md': '# Issue tracker\n' });

  const result = binnIn(home)(root, '\n\nn\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /The plan was declined\. Nothing is written\./);
  assert.match(result.stdout, /declined\s+create \.binnacle\/project\.yaml/);
  assert.match(result.stdout, /declined\s+the binnacle plugin/);
  assert.deepEqual(calls(), [['plugin', 'list', '--json']]);
  // Only the untracked fixture.
  assert.equal(git(root, 'status', '--porcelain'), '?? docs/\n');
  assert.equal(read(root, 'docs/agents/issue-tracker.md'), '# Issue tracker\n');
});

test('with stdin not a terminal the plan is shown and nothing is written', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home);
  const root = makeRepository(t, 'piped', { 'docs/agents/issue-tracker.md': '# Issue tracker\n' });

  // Answers that would accept the plan at a terminal.
  const result = binnIn(home, false)(root, '\n\n\ny\ny\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('Create .binnacle/project.yaml'), result.stdout);
  assert.ok(result.stdout.includes('Create .mcp.json'), result.stdout);
  assert.ok(result.stdout.includes('claude plugin install binnacle@binnacle'), result.stdout);
  assert.doesNotMatch(result.stdout, /Write this plan/);
  assert.match(result.stdout, /stdin is not a terminal.* Nothing is written\./);
  assert.match(result.stdout, /declined\s+create \.binnacle\/project\.yaml/);
  assert.deepEqual(calls(), [['plugin', 'list', '--json']]);
  assert.equal(git(root, 'status', '--porcelain'), '?? docs/\n');
  assert.equal(read(root, 'docs/agents/issue-tracker.md'), '# Issue tracker\n');
});

test('registration with a running daemon', async (t) => {
  const home = makeHome(t);
  const binn = binnIn(home);
  const root = makeRepository(t, 'tracked');
  assert.equal(binn(root, '', 'daemon', 'start').status, 0);
  t.after(() => binn(root, '', 'daemon', 'stop'));

  // Registration is in the plan, outside the repository, and covered by its one confirmation.
  await t.test('declining the plan writes nothing and registers nothing', () => {
    const result = binn(root, '\n\nn\n', 'init');
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('Register the project with the running Binnacle daemon'), result.stdout);
    assert.match(result.stdout, /declined\s+project registration/);
    assert.equal(existsSync(join(root, '.binnacle')), false);
    assert.equal(git(root, 'status', '--porcelain'), '');
    assert.match(binn(root, '', 'project', 'list').stdout, /No projects/);
  });

  await t.test('confirming writes the manifest, then registers the project through project.register', () => {
    const before = commits(root);
    const result = binn(root, '\n\n\n', 'init');
    assert.equal(result.status, 0, result.stderr);
    assert.match(manifestOf(root), /id: tracked/);
    assert.match(result.stdout, /created\s+\.binnacle\/project\.yaml/);
    assert.match(result.stdout, /ran\s+project\.register/);
    const list = binn(root, '', 'project', 'list');
    assert.match(list.stdout, /tracked/);
    assert.ok(list.stdout.includes(root), list.stdout);
    assert.equal(commits(root), before);
  });
});

/** The skill plugins as Claude Code lists them, so that a binnacle plugin test sees only its own calls. */
const SKILL_PLUGINS = ['mattpocock-skills@claude-plugins-official', 'ponytail@ponytail'];

test('the plugin: Claude Code adds the package as a marketplace and installs binnacle from it, at user scope, in that order', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home, SKILL_PLUGINS);
  const root = makeRepository(t, 'plugged');

  // The window, then Enter for the plan, which holds the manifest, `.mcp.json` and the plugin.
  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const add = ['plugin', 'marketplace', 'add', PACKAGE, '--scope', 'user'];
  const install = ['plugin', 'install', 'binnacle@binnacle', '--scope', 'user'];
  assert.deepEqual(calls(), [['plugin', 'list', '--json'], add, install]);
  // Both commands are shown before the question, and summarised after.
  const question = result.stdout.indexOf(PLAN_QUESTION);
  for (const args of [add, install]) {
    const shown = result.stdout.indexOf(`claude ${args.join(' ')}`);
    assert.ok(shown >= 0 && shown < question, result.stdout);
  }
  assert.match(result.stdout, /ran\s+claude plugin marketplace add/);
  assert.match(result.stdout, /ran\s+claude plugin install binnacle@binnacle/);
  // Each wait on Claude Code is named before it starts.
  const asking = result.stdout.indexOf('Asking Claude Code for its plugins (claude plugin list --json)...');
  assert.ok(asking >= 0 && asking < question, result.stdout);
  for (const args of [add, install]) assert.ok(result.stdout.includes(`Running claude ${args.join(' ')}...`), result.stdout);
  // Claude Code's settings files are Claude Code's to write: binn init writes none.
  assert.equal(existsSync(join(home.home, '.claude')), false);
  assert.equal(git(root, 'status', '--porcelain'), '?? .binnacle/\n?? .mcp.json\n?? AGENTS.md\n?? docs/\n');
});

test('the plugin: a failed marketplace add is reported, and the install is not attempted', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home, SKILL_PLUGINS, 1);
  const root = makeRepository(t, 'unplugged');

  const result = binnIn(home)(root, '\n\n\n', 'init');

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
  const calls = fakeClaude(home, ['other@somewhere', 'binnacle@binnacle', ...SKILL_PLUGINS]);
  const root = makeRepository(t, 'listed');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls(), [['plugin', 'list', '--json']]);
  assert.match(result.stdout, /skipped\s+the binnacle plugin: Claude Code already lists binnacle@binnacle/);
});

test('the plugin: skipped and reported for a project that provides its own binnacle plugin', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home, SKILL_PLUGINS);
  const root = makeRepository(t, 'binnacle-itself', {
    '.claude/skills/binnacle/.claude-plugin/plugin.json': '{ "name": "binnacle" }\n',
  });

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  // Claude Code is still asked for its plugins, for the skill plugins; nothing is installed.
  assert.deepEqual(calls(), [['plugin', 'list', '--json']]);
  assert.match(result.stdout, /skipped\s+the binnacle plugin: the project provides its own, at \.claude\/skills\/binnacle/);
});

test('the plugin: a declined plan runs nothing but the listing', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home);
  const root = makeRepository(t, 'declined');

  const result = binnIn(home)(root, '\n\nn\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls(), [['plugin', 'list', '--json']]);
  assert.match(result.stdout, /declined\s+the binnacle plugin/);
});

test('the plugin: without Claude Code detected nothing is offered and nothing runs', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'no-claude');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Install the binnacle plugin/);
  assert.match(result.stdout, /skipped\s+the binnacle plugin: Claude Code is not detected/);
});

test('the plugin: Claude Code detected by ~/.claude alone, with no claude to run, is skipped and reported', (t) => {
  const home = makeHome(t);
  installUserDirectory(home, '.claude');
  const root = makeRepository(t, 'no-cli');

  // The plugin is never in the plan.
  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Install the binnacle plugin/);
  assert.match(result.stdout, /skipped\s+the binnacle plugin: `claude` is not on PATH/);
});

/** `binn init` as a subprocess that leaves this process free, so that a loopback stand-in here can answer it. */
async function binnInit(home: Home, cwd: string, input: string, env: Record<string, string> = {}) {
  const run = promisify(execFile)(process.execPath, ['--import', TERMINAL, BINN, 'init'], {
    cwd,
    encoding: 'utf8',
    env: { ...envFor(home), ...env },
  });
  run.child.stdin!.end(input);
  return await run;
}

/** A loopback stand-in for a tracker's API: every request is kept, and answered with `status` and `body`. */
async function trackerStandIn(t: TestContext, status: number, body: unknown): Promise<{ base: string; requests: string[] }> {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? '');
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, requests };
}

const remoteManifest = (provider: string, repository: string, host: string): string =>
  `version: 1\nproject:\n  id: remote\ntracker:\n  provider: ${provider}\n  repository: ${repository}\n  host: ${JSON.stringify(host)}\n`;

const TRACKER_FILE = 'docs/agents/issue-tracker.md';

test('the ticket-header section is appended to the issue tracker file once, and not a second time', (t) => {
  const home = makeHome(t);
  const conventions = '# Issue tracker: Local Markdown\n\nIssues live in docs/specs.';
  const root = makeRepository(t, 'layout', { [TRACKER_FILE]: conventions, 'docs/agents/triage-labels.md': '# Triage\n' });
  const before = commits(root);

  // The default window, then Enter for the plan: the manifest and the section.
  const first = binnIn(home)(root, '\n\n\n', 'init');
  assert.equal(first.status, 0, first.stderr);
  const extended = readFileSync(join(root, TRACKER_FILE), 'utf8');
  assert.ok(extended.startsWith(`${conventions}\n\n## Ticket header\n`), extended);
  const section = extended.slice(conventions.length);
  for (const line of ['Status:', 'Blocked by:', 'Spec:']) assert.ok(section.includes(`\`${line}\``), section);
  assert.match(section, /READY_FOR_REVIEW/);
  assert.match(section, /None/);
  assert.doesNotMatch(section, /issue number/);
  // A local ticket's branch comes from its file name, so the name must be unique across epics.
  assert.match(section, /A ticket's slug, its file name without the number, is unique across every spec's tickets/);
  assert.match(section, /`feat\/<slug>`/);
  // The roles a Task needs, and where a question and its answer go, as docs/agents/issue-tracker.md says them.
  assert.match(section, /`Roles:` — the roles the Task needs, comma-separated, from Developer, Reviewer, Architect, QA, Security, DevOps and Analyst/);
  assert.match(section, /without it a Task needs a Developer and a Reviewer/);
  assert.match(section, /^Roles: Developer, Reviewer, Security$/m);
  assert.match(section, /`### Question` heading inside `## Comments`, in a commit that changes only the ticket, on the branch where the work is/);
  assert.match(section, /under `### Answer`, written by the owner or `\/binnacle:answer`, never by an agent/);
  assert.match(section, /After its text, a question lists its options, each with its cost, the recommended one first and marked "\(recommended\)"/);
  assert.match(section, /the owner chooses one or writes their own answer/);
  // The exact addition is shown before the question.
  assert.ok(first.stdout.includes(section.trim()), first.stdout);
  assert.match(first.stdout, /extended\s+docs\/agents\/issue-tracker\.md/);

  // The manifest now declares its window, and the section is there: there is nothing to ask or write.
  const second = binnIn(home)(root, '', 'init');
  assert.equal(second.status, 0, second.stderr);
  assert.equal(readFileSync(join(root, TRACKER_FILE), 'utf8'), extended);
  assert.doesNotMatch(second.stdout, /Append to|Write this plan/);
  assert.match(second.stdout, /skipped\s+ticket-header section: docs\/agents\/issue-tracker\.md has it/);
  assert.equal(commits(root), before);
});

const CONVENTION_FILES = [TRACKER_FILE, 'docs/agents/triage-labels.md', 'docs/agents/domain.md'];

for (const { provider, remote, title, cli } of [
  { provider: 'local', remote: null, title: 'Local Markdown', cli: null },
  { provider: 'github', remote: 'git@github.com:Acme/Planned.git', title: 'GitHub', cli: 'gh issue' },
  { provider: 'gitlab', remote: 'https://gitlab.com/acme/planned.git', title: 'GitLab', cli: 'glab issue' },
]) {
  test(`on a bare repository with ${remote ? `a ${title}` : 'no forge'} remote, init plans the planning conventions for that tracker and the block in a new AGENTS.md, once`, (t) => {
    const home = makeHome(t);
    const root = makeRepository(t, `bare-${provider}`);
    if (remote) git(root, 'remote', 'add', 'origin', remote);

    const first = binnIn(home)(root, '\n\n\n', 'init');

    assert.equal(first.status, 0, first.stderr);
    const question = first.stdout.indexOf(PLAN_QUESTION);
    for (const heading of [...CONVENTION_FILES, 'AGENTS.md'].map((path) => `Create ${path}`)) {
      const shown = first.stdout.indexOf(heading);
      assert.ok(shown >= 0 && shown < question, `${heading}\n${first.stdout}`);
    }
    assert.doesNotMatch(first.stdout, /setup-matt-pocock-skills/);
    // The new manifest declares the workflow whose conventions the plan writes.
    assert.match(manifestOf(root), /\nworkflow:\n  provider: matt-pocock\n/);

    const tracker = read(root, TRACKER_FILE);
    assert.ok(tracker.startsWith(`# Issue tracker: ${title}\n`), tracker);
    if (cli) assert.match(tracker, new RegExp(`\`${cli} create`));
    assert.match(tracker, /## When a skill says "publish to the issue tracker"/);
    assert.match(tracker, /\n## Ticket header\n/);
    assert.match(tracker, provider === 'local' ? /such as `01, 03`/ : /such as `#12, #15`/);
    // The two planning conventions.
    assert.match(tracker, /Epic brief, `docs\/specs\/<epic>\/brief\.md`/);
    assert.match(tracker, /the problem, the outcome wanted, who it concerns, the systems it touches, constraints and open questions/);
    assert.match(tracker, /`## Contested points`/);
    assert.doesNotMatch(tracker, /\.scratch\//);

    const labels = read(root, 'docs/agents/triage-labels.md');
    for (const label of ['needs-triage', 'needs-info', 'ready-for-agent', 'ready-for-human', 'wontfix']) assert.match(labels, new RegExp(`\\| \`${label}\` +\\| \`${label}\` +\\|`));
    const domain = read(root, 'docs/agents/domain.md');
    assert.match(domain, /^# Domain Docs\n/);
    assert.match(domain, /single-context/);
    assert.doesNotMatch(domain, /CONTEXT-MAP\.md/);

    const agents = read(root, 'AGENTS.md');
    assert.match(agents, /\n## Agent skills\n\n### Issue tracker\n\n.+See `docs\/agents\/issue-tracker\.md`\.\n\n### Triage labels\n\n.+See `docs\/agents\/triage-labels\.md`\.\n\n### Domain docs\n\n.+See `docs\/agents\/domain\.md`\.\n$/);
    assert.match(agents, provider === 'local' ? /Markdown files in Git under `docs\/specs\/<slug>\/`/ : new RegExp(`${title} Issues`));

    const written = Object.fromEntries([...CONVENTION_FILES, 'AGENTS.md'].map((path) => [path, read(root, path)]));
    const second = binnIn(home)(root, '', 'init');
    assert.equal(second.status, 0, second.stderr);
    assert.doesNotMatch(second.stdout, /Create |Append to|Write this plan/);
    assert.match(second.stdout, /skipped\s+the Agent skills block: AGENTS\.md has it/);
    for (const [path, text] of Object.entries(written)) assert.equal(read(root, path), text, path);
  });
}

test('with only CLAUDE.md the block is appended there, and AGENTS.md is not created', (t) => {
  const home = makeHome(t);
  const claude = '# Claude Code Instructions\n\nKeep it short.';
  const root = makeRepository(t, 'claude-only', { 'CLAUDE.md': claude });

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('Append to the end of CLAUDE.md'), result.stdout);
  assert.equal(existsSync(join(root, 'AGENTS.md')), false);
  const extended = read(root, 'CLAUDE.md');
  assert.ok(extended.startsWith(`${claude}\n\n## Agent skills\n\n### Issue tracker\n`), extended);
  assert.match(result.stdout, /extended\s+CLAUDE\.md/);
});

test('with the convention files and the block present, only a missing ticket-header section is planned, and nothing else is touched', (t) => {
  const home = makeHome(t);
  const files = {
    [TRACKER_FILE]: '# Issue tracker: GitHub\n\nOur own words.\n',
    'docs/agents/triage-labels.md': '# Triage Labels\n\nOur own labels.\n',
    'docs/agents/domain.md': '# Domain Docs\n\nOur own layout.\n',
    'AGENTS.md': '# Agents\n\nKeep it simple.\n',
    // The block in either instruction file counts: this one is the set's entry, importing AGENTS.md.
    'CLAUDE.md': '@AGENTS.md\n\n## Agent skills\n\nOur own block.\n',
  };
  const root = makeRepository(t, 'own-conventions', files);

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const plan = result.stdout.slice(0, result.stdout.indexOf(PLAN_QUESTION));
  assert.ok(plan.includes(`Append to the end of ${TRACKER_FILE}`), result.stdout);
  assert.doesNotMatch(plan, /(Create|Append to the end of) (docs\/agents\/(triage-labels|domain)\.md|AGENTS\.md|CLAUDE\.md)/);
  assert.match(result.stdout, /skipped\s+the Agent skills block: CLAUDE\.md has it/);
  const tracker = read(root, TRACKER_FILE);
  assert.ok(tracker.startsWith(`${files[TRACKER_FILE]}\n## Ticket header\n`), tracker);
  // Only the ticket header is added to a file that exists: the planning conventions come with a new one.
  assert.doesNotMatch(tracker, /Contested points/);
  for (const path of ['docs/agents/triage-labels.md', 'docs/agents/domain.md', 'AGENTS.md', 'CLAUDE.md']) assert.equal(read(root, path), files[path as keyof typeof files], path);
});

test('a CLAUDE.md importing AGENTS.md is one instruction set; without the import there are two; a declined plan writes neither', (t) => {
  const home = makeHome(t);
  const agents = '# Agent Instructions\n\nKeep it simple.\n';
  const importing = '@AGENTS.md\n\n# Claude Code Instructions\n';
  const root = makeRepository(t, 'instructions', { 'AGENTS.md': agents, 'CLAUDE.md': importing });

  const one = binnIn(home)(root, '', 'init');
  assert.equal(one.status, 0, one.stderr);
  assert.match(one.stdout, /one instruction set: CLAUDE\.md, which imports AGENTS\.md/);

  // A mention in inline code is not an import.
  const mentioning = '# Claude Code Instructions\n\nWrite `@AGENTS.md` to import it.\n';
  writeFileSync(join(root, 'CLAUDE.md'), mentioning);
  const two = binnIn(home)(root, '', 'init');
  assert.equal(two.status, 0, two.stderr);
  assert.match(two.stdout, /two instruction sets: AGENTS\.md; CLAUDE\.md/);

  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), agents);
  assert.equal(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), mentioning);
});

test('a readable remote tracker is reported readable, and its section says issue numbers and that closing outranks Status:', async (t) => {
  const home = makeHome(t);
  const github = await trackerStandIn(t, 200, []);
  const root = makeRepository(t, 'remote', {
    '.binnacle/project.yaml': remoteManifest('github', 'octo-org/octo-repo', github.base),
    [TRACKER_FILE]: '# Issue tracker: GitHub\n',
  });

  const { stdout } = await binnInit(home, root, '\n\ny\n');

  assert.match(stdout, /Reading octo-org\/octo-repo\.\.\.\n.*octo-org\/octo-repo is readable/);
  assert.match(stdout, /checked\s+tracker: readable/);
  assert.deepEqual([...new Set(github.requests.map((url) => url.split('?')[0]))], ['/repos/octo-org/octo-repo/issues', '/repos/octo-org/octo-repo/issues/comments']);
  const section = readFileSync(join(root, TRACKER_FILE), 'utf8');
  assert.match(section, /issue numbers/);
  assert.match(section, /#12/);
  assert.match(section, /[Cc]losing an issue outranks its `Status:`/);
  assert.match(section, /closed as not planned or as a duplicate is cancelled/);
  assert.match(section, /`Roles:` — the roles the Task needs/);
  assert.match(section, /issue comments that start with `### Question` and `### Answer`/);
  assert.match(section, /After its text, a question lists its options, each with its cost, the recommended one first and marked "\(recommended\)"/);
  assert.doesNotMatch(section, /## Comments/);
  // A remote Task's branch carries its issue number, so its title need not be unique.
  assert.doesNotMatch(section, /slug, its file name/);
  assert.doesNotMatch(stdout, /from this shell/);
});

test('a remote tracker with no repository is reported as the manifest to fix, not a token to make', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'unnamed', { '.binnacle/project.yaml': 'version: 1\nproject:\n  id: unnamed\ntracker:\n  provider: github\n' });

  const result = binnIn(home)(root, '', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /tracker\.unavailable: .*no tracker\.repository/);
  assert.doesNotMatch(result.stdout, /fine-grained/);
  assert.match(result.stdout, /failed\s+tracker check: tracker\.unavailable/);
});

test('an unreadable remote tracker gives the failure code and how to make a read-only token, and never the token', async (t) => {
  const home = makeHome(t);
  const gitlab = await trackerStandIn(t, 401, { message: '401 Unauthorized' });
  const root = makeRepository(t, 'remote', {
    '.binnacle/project.yaml': remoteManifest('gitlab', 'group/project', gitlab.base),
    [TRACKER_FILE]: '# Issue tracker: GitLab\n',
  });
  const token = 'glpat-never-printed-anywhere';

  const { stdout, stderr } = await binnInit(home, root, '\n\ny\n', { BINNACLE_GITLAB_TOKEN: token });

  // GitLab reports no close reason, so its section says what closing means there.
  assert.match(readFileSync(join(root, TRACKER_FILE), 'utf8'), /GitLab reports no reason for closing: a closed issue is done, unless its `Status:` says `CANCELLED`/);
  assert.equal(gitlab.requests.length, 1);
  // The token came from this shell, which the daemon does not share.
  assert.match(stdout, /This check used BINNACLE_GITLAB_TOKEN from this shell/);
  assert.match(stdout, /tracker\.unauthorized/);
  assert.match(stdout, /a token was used/);
  assert.match(stdout, /read_api/);
  assert.match(stdout, /BINNACLE_GITLAB_TOKEN/);
  assert.ok(stdout.includes(join(home.binnacleHome, 'credentials.json')), stdout);
  assert.ok(stdout.includes(JSON.stringify(gitlab.base)), 'the key the token goes under');
  assert.match(stdout, /failed\s+tracker check: tracker\.unauthorized/);
  assert.ok(!stdout.includes(token) && !stderr.includes(token));
  assert.equal(existsSync(join(home.binnacleHome, 'credentials.json')), false);
});

test('the advice on a GitHub token names the access the snapshot’s CI needs beside the issues', async (t) => {
  const home = makeHome(t);
  const github = await trackerStandIn(t, 401, { message: 'Bad credentials' });
  const root = makeRepository(t, 'remote', {
    '.binnacle/project.yaml': remoteManifest('github', 'octo-org/octo-repo', github.base),
    [TRACKER_FILE]: '# Issue tracker: GitHub\n',
  });

  const { stdout } = await binnInit(home, root, '\n\ny\n', { BINNACLE_GITHUB_TOKEN: 'ghp_never-printed' });

  assert.match(stdout, /Issues: Read-only\), and Actions, Commit statuses and Pull requests: Read-only for the snapshot's CI\./);
  assert.doesNotMatch(stdout, /Checks/);
});

test('Claude Code on PATH gets a new .mcp.json, and only the detected harness is offered', (t) => {
  const home = makeHome(t);
  fakeClaude(home);
  const root = makeRepository(t, 'harnessed');
  const before = commits(root);

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(read(root, '.mcp.json')), {
    mcpServers: { binnacle: { type: 'stdio', command: 'binn', args: ['mcp'] } },
  });
  assert.match(result.stdout, /Claude Code/);
  assert.doesNotMatch(result.stdout, /Codex is installed|opencode|VS Code/);
  assert.equal(existsSync(join(root, '.codex')), false);
  assert.equal(existsSync(join(root, '.vscode')), false);
  assert.equal(existsSync(join(root, 'opencode.json')), false);
  assert.match(result.stdout, /created\s+\.mcp\.json/);
  // /binnacle:init passes this on, so that the skill names no harness's rule of its own (epic 14).
  assert.match(result.stdout, /Claude Code reads \.mcp\.json only when a session starts: once it is written, open a new session in the repository and approve the project's binnacle server when Claude Code offers it\./);
  assert.equal(commits(root), before);
});

test('an existing .mcp.json is left untouched and the entry is printed', (t) => {
  const home = makeHome(t);
  installUserDirectory(home, '.claude');
  const existing = '{\n  "mcpServers": {\n    "other": { "command": "other" }\n  }\n}\n';
  const root = makeRepository(t, 'configured', { '.mcp.json': existing });

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(root, '.mcp.json'), existing);
  assert.match(result.stdout, /"binnacle": \{/);
  assert.match(result.stdout, /"command": "binn",\s+"args": \[\s+"mcp"\s+\]/);
  assert.doesNotMatch(result.stdout, /Create \.mcp\.json|Append to the end of \.mcp\.json/, 'an existing JSON file is never in the plan');
  assert.match(result.stdout, /printed\s+the entry for \.mcp\.json/);
});

test('an existing Codex configuration gets the binnacle table appended, with the trust note', (t) => {
  const home = makeHome(t);
  installUserDirectory(home, '.codex');
  const root = makeRepository(t, 'codexed', { '.codex/config.toml': 'model = "o3"' });

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(root, '.codex/config.toml'), 'model = "o3"\n[mcp_servers.binnacle]\ncommand = "binn"\nargs = ["mcp"]\n');
  assert.match(result.stdout, /trusted project/);
  assert.match(result.stdout, /extended\s+\.codex\/config\.toml/);
});

test('a configuration that already names binnacle is skipped and reported', (t) => {
  const home = makeHome(t);
  fakeClaude(home);
  installExecutable(home, 'codex');
  const mcpJson = '{ "mcpServers": { "binnacle": { "command": "binn", "args": ["mcp"] } } }\n';
  const codexToml = '[mcp_servers.binnacle]\ncommand = "binn"\n';
  const root = makeRepository(t, 'twice', { '.mcp.json': mcpJson, '.codex/config.toml': codexToml });

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(root, '.mcp.json'), mcpJson);
  assert.equal(read(root, '.codex/config.toml'), codexToml);
  assert.match(result.stdout, /skipped\s+\.mcp\.json: it already names binnacle/);
  assert.match(result.stdout, /skipped\s+\.codex\/config\.toml: it already names binnacle/);
  assert.doesNotMatch(result.stdout, /Append to|Create \.mcp\.json/);
  assert.doesNotMatch(result.stdout.slice(0, result.stdout.indexOf('Summary:')), /trusted project|only when a session starts/, 'a harness note goes with an entry offered, not a skip');
});

test('a Codex configuration naming binnacle as a key under [mcp_servers] is skipped, not given a duplicate', (t) => {
  const home = makeHome(t);
  installUserDirectory(home, '.codex');
  const codexToml = '[mcp_servers]\nbinnacle = { command = "binn", args = ["mcp"] }\n';
  const root = makeRepository(t, 'inline', { '.codex/config.toml': codexToml });

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(root, '.codex/config.toml'), codexToml);
  assert.match(result.stdout, /skipped\s+\.codex\/config\.toml: it already names binnacle/);
});

test('every known harness gets its own template, and the generic snippet follows them', (t) => {
  const home = makeHome(t);
  fakeClaude(home);
  installExecutable(home, 'codex');
  installUserDirectory(home, '.config/opencode');
  installExecutable(home, 'code');
  const root = makeRepository(t, 'everywhere');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(root, '.mcp.json')));
  assert.equal(read(root, '.codex/config.toml'), '[mcp_servers.binnacle]\ncommand = "binn"\nargs = ["mcp"]\n');
  assert.deepEqual(JSON.parse(read(root, 'opencode.json')), {
    $schema: 'https://opencode.ai/config.json',
    mcp: { binnacle: { type: 'local', command: ['binn', 'mcp'] } },
  });
  assert.deepEqual(JSON.parse(read(root, '.vscode/mcp.json')), {
    servers: { binnacle: { type: 'stdio', command: 'binn', args: ['mcp'] } },
  });
  assert.ok(result.stdout.includes('Create .vscode/mcp.json'), result.stdout);
  const generic = result.stdout.indexOf('any other harness');
  assert.ok(generic >= 0 && generic < result.stdout.indexOf('Summary:'), result.stdout);
});

test('with no known harness, none is offered and the generic snippet is still printed', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'bare');

  const result = binnIn(home)(root, '\n\nn\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No known harness/);
  assert.match(result.stdout, /any other harness/);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

/**
 * Session artifacts in temporary roots, which `env` points `binn init` at. They are away from
 * `~/.claude` and `~/.codex`, so that no harness is detected because of them.
 */
function artifactRoots(home: Home) {
  const claude = join(home.home, 'claude-config');
  const codex = join(home.home, 'codex-home');
  return { env: { CLAUDE_CONFIG_DIR: claude, CODEX_HOME: codex }, claudeCode: join(claude, 'projects'), codex: join(codex, 'sessions') };
}

function writeRecords(path: string, records: unknown[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
}

/** Claude Code's directory for the sessions launched in `path`. */
const claudeCodeDirectory = (path: string): string => path.replace(/[^a-zA-Z0-9]/g, '-');

/**
 * A Claude Code session as it starts: a record with no `cwd`, then the first that has one.
 * A later record, older and elsewhere, shows that only that first one is read.
 */
const claudeCodeSession = (cwd: string, timestamp: string): unknown[] => [
  { type: 'queue-operation', timestamp: '2020-01-01T12:00:00.000Z' },
  { type: 'user', cwd, timestamp, sessionId: 's', message: { role: 'user', content: 'never read' } },
  { type: 'user', cwd: '/elsewhere', timestamp: '2020-01-01T12:00:00.000Z', sessionId: 's' },
];

const codexRollout = (cwd: string, timestamp: string): unknown[] => [
  { timestamp, type: 'session_meta', payload: { id: 'r', timestamp, cwd, model_provider: 'openai' } },
  { timestamp: '2020-01-01T12:00:00.000Z', type: 'turn_context', payload: { cwd: '/elsewhere' } },
];

test("the import window step shows each harness's sessions in this repository and the date of the oldest", async (t) => {
  const home = makeHome(t);
  const roots = artifactRoots(home);
  const root = makeRepository(t, 'counted');
  const worktree = join(root, '.claude', 'worktrees', 'w1');
  const own = join(roots.claudeCode, claudeCodeDirectory(root));

  writeRecords(join(own, 'one.jsonl'), claudeCodeSession(root, '2026-03-02T12:00:00.000Z'));
  writeRecords(join(own, 'two.jsonl'), claudeCodeSession(join(root, 'src'), '2026-04-10T12:00:00.000Z'));
  // A subagent's file is part of its session, not a session of its own.
  writeRecords(join(own, 'one', 'subagents', 'agent-a.jsonl'), claudeCodeSession(root, '2026-01-01T12:00:00.000Z'));
  writeRecords(join(roots.claudeCode, claudeCodeDirectory(worktree), 'three.jsonl'), claudeCodeSession(worktree, '2026-05-01T12:00:00.000Z'));
  // A directory whose name starts with the repository's, for a directory beside it.
  writeRecords(join(roots.claudeCode, claudeCodeDirectory(`${root}-later`), 'four.jsonl'), claudeCodeSession(`${root}-later`, '2026-01-01T12:00:00.000Z'));
  // A linked worktree beside the repository is the repository's too.
  const linked = join(dirname(root), 'linked-checkout');
  git(root, 'worktree', 'add', '--quiet', '-b', 'feature', linked);
  writeRecords(join(roots.claudeCode, claudeCodeDirectory(linked), 'five.jsonl'), claudeCodeSession(linked, '2026-06-01T12:00:00.000Z'));
  writeRecords(join(roots.codex, '2026', '02', '14', 'rollout-a.jsonl'), codexRollout(root, '2026-02-14T12:00:00.000Z'));
  writeRecords(join(roots.codex, '2026', '02', '01', 'rollout-c.jsonl'), codexRollout(linked, '2026-02-01T12:00:00.000Z'));
  writeRecords(join(roots.codex, '2025', '01', '01', 'rollout-b.jsonl'), codexRollout('/elsewhere', '2025-01-01T12:00:00.000Z'));

  const { stdout } = await binnInit(home, root, '', roots.env);

  assert.match(stdout, /Claude Code: 4 sessions, the oldest from 2026-03-02/);
  assert.match(stdout, /Codex: 2 sessions, the oldest from 2026-02-01/);
  // No answer at the end of input: the default applies, and the plan is not confirmed either.
  assert.match(stdout, /skipped\s+import window: no answer/);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('a new manifest is offered the window answered: 90 by default, all, or a number of days', async (t) => {
  for (const [input, window] of [
    ['\n\n\n', '90'],
    ['all\n\n\n', 'all'],
    ['soon\n30\n\n\n', '30'],
  ] as const) {
    const home = makeHome(t);
    const root = makeRepository(t, 'windowed');

    const { stdout } = await binnInit(home, root, input, artifactRoots(home).env);

    assert.match(stdout, /Claude Code: no sessions/);
    assert.match(stdout, /Codex: no sessions/);
    assert.ok(manifestOf(root).endsWith(`knowledge:\n  docs: docs\n  specs: docs/specs\n  language: en\n\nworkflow:\n  provider: matt-pocock\n${windowSection(window)}`), manifestOf(root));
    assert.equal(readManifest(root).manifest.telemetry.import.windowDays, window === 'all' ? 'all' : Number(window));
    // The window is in the manifest the plan shows, before the one question, and is not asked after it.
    const shown = stdout.indexOf(windowSection(window));
    assert.ok(shown >= 0 && shown < stdout.indexOf(PLAN_QUESTION), stdout);
    assert.ok(stdout.indexOf('Import window') < shown, stdout);
    assert.match(stdout, /created\s+\.binnacle\/project\.yaml/);
    if (input.includes('soon')) assert.match(stdout, /Answer 90, a number of days, or all/);
  }
});

test('with a new manifest, end of input at the window question writes no window, and a no to the plan writes no manifest', async (t) => {
  const home = makeHome(t);
  const unanswered = makeRepository(t, 'unanswered');

  const { stdout } = await binnInit(home, unanswered, '', artifactRoots(home).env);

  assert.equal(existsSync(join(unanswered, '.binnacle')), false);
  assert.match(stdout, /skipped\s+import window: no answer, so the default of 90 days applies/);

  const declining = makeRepository(t, 'declining');
  const declined = await binnInit(home, declining, 'all\n\nn\n', artifactRoots(home).env);

  assert.equal(existsSync(join(declining, '.binnacle')), false);
  assert.match(declined.stdout, /declined\s+create \.binnacle\/project\.yaml/);
});

test('with an existing manifest the window line is printed, not written, and a declared window is left alone', async (t) => {
  const home = makeHome(t);
  const existing = 'version: 1\nproject:\n  id: kept\n';
  const root = makeRepository(t, 'kept', { '.binnacle/project.yaml': existing });

  const { stdout } = await binnInit(home, root, '14\n', artifactRoots(home).env);

  assert.equal(manifestOf(root), existing);
  assert.ok(stdout.includes('telemetry:\n  import:\n    window_days: 14\n'), stdout);
  assert.match(stdout, /printed\s+the telemetry\.import\.window_days line for \.binnacle\/project\.yaml/);

  const declaring = `${existing}${windowSection('all')}`;
  writeFileSync(join(root, '.binnacle', 'project.yaml'), declaring);
  const again = await binnInit(home, root, '14\n', artifactRoots(home).env);

  assert.equal(manifestOf(root), declaring);
  assert.doesNotMatch(again.stdout, /Import window/);
  assert.match(again.stdout, /skipped\s+import window: \.binnacle\/project\.yaml declares all/);
});


/** The Product Snapshot's fields this ticket's checks read, as `/binnacle:product` gets them. */
type ProductSnapshot = { attention: { code: string }[]; next: { action: { description: string; command: string } | null } };

test("on an empty repository the confirmed plan leaves a layout the Product Snapshot reads, with the skeleton roadmap's Next action", async (t) => {
  const home = makeHome(t);
  const binn = binnIn(home);
  const root = makeRepository(t, 'empty');
  assert.equal(binn(root, '', 'daemon', 'start').status, 0);
  t.after(() => binn(root, '', 'daemon', 'stop'));

  const result = binn(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const question = result.stdout.indexOf(PLAN_QUESTION);
  for (const heading of ['Create docs/specs/.gitkeep', 'Create docs/roadmap.md']) {
    const shown = result.stdout.indexOf(heading);
    assert.ok(shown >= 0 && shown < question, `${heading}\n${result.stdout}`);
  }
  assert.match(manifestOf(root), /\nknowledge:\n  docs: docs\n  specs: docs\/specs\n  language: en\n/);
  assert.match(read(root, 'docs/roadmap.md'), /^\| # \| Epic \| Status \| Spec \|$/m);
  assert.match(result.stdout, /ran\s+project\.register/);

  const snapshot = await callOperation<ProductSnapshot>(readRuntime(home.binnacleHome)!, readToken(home.binnacleHome)!, 'project.snapshot', { path: root });
  const codes = snapshot.attention.map(({ code }) => code);
  assert.ok(!codes.includes('tracker.issues_missing'), codes.join(', '));
  assert.ok(!codes.includes('roadmap.missing'), codes.join(', '));
  assert.equal(snapshot.next.action?.command, '/binnacle:roadmap');
});

test('an existing roadmap is left byte for byte, and one not in the format is named in the Summary with binn audit', (t) => {
  const home = makeHome(t);
  const roadmap = '# Roadmap\n\n- ship the first version\n';
  const root = makeRepository(t, 'own-roadmap', { 'docs/roadmap.md': roadmap });

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /created\s+\.binnacle\/project\.yaml/);
  assert.equal(read(root, 'docs/roadmap.md'), roadmap);
  assert.ok(!result.stdout.includes('docs/roadmap.md:\n'), result.stdout);
  const summary = result.stdout.slice(result.stdout.indexOf('Summary:'));
  assert.match(summary, /skipped\s+docs\/roadmap\.md: it exists, and is not in Binnacle's format; binn audit names what is missing/);

  // One in the format is only reported as there.
  writeFileSync(join(root, 'docs/roadmap.md'), '| # | Epic | Status | Spec |\n| --- | --- | --- | --- |\n\n## Current focus\n\nNext action: plan. `/grill-with-docs`\n');
  rmSync(join(root, '.binnacle'), { recursive: true });
  assert.match(binnIn(home)(root, '\n\nn\n', 'init').stdout, /skipped\s+docs\/roadmap\.md: it exists\n/);
});

test('an existing manifest gets the issues directory it names and a roadmap under its knowledge.docs, and one without knowledge.docs gets no roadmap', (t) => {
  const home = makeHome(t);
  const manifest = 'version: 1\nproject:\n  id: kept\ntracker:\n  provider: local\n  local:\n    issues: work\nknowledge:\n  docs: handbook\n';
  const root = makeRepository(t, 'kept', { '.binnacle/project.yaml': manifest });

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(manifestOf(root), manifest);
  assert.ok(existsSync(join(root, 'work/.gitkeep')), result.stdout);
  assert.match(read(root, 'handbook/roadmap.md'), /## Current focus/);

  const bare = makeRepository(t, 'bare', { '.binnacle/project.yaml': 'version: 1\nproject:\n  id: bare\n' });
  const without = binnIn(home)(bare, '\n\n\n', 'init');
  assert.ok(!existsSync(join(bare, 'docs/roadmap.md')), without.stdout);
  assert.match(without.stdout, /skipped\s+the roadmap: \.binnacle\/project\.yaml declares no knowledge\.docs/);
});

test('the Summary suggests binn audit', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'audited');

  const result = binnIn(home)(root, '\n\nn\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout.slice(result.stdout.indexOf('Summary:')), /run `binn audit`/);
});

test('the Summary gives the next step for a detected harness other than Claude Code: run binnacle-product there', (t) => {
  const home = makeHome(t);
  fakeClaude(home);
  installUserDirectory(home, '.codex');
  installExecutable(home, 'opencode');
  const root = makeRepository(t, 'moving');

  const result = binnIn(home)(root, '\n\nn\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const summary = result.stdout.slice(result.stdout.indexOf('Summary:'));
  const codex = summary.slice(summary.indexOf('To work from Codex'), summary.indexOf('To work from opencode'));
  assert.match(codex, /trusted project/);
  assert.match(codex, /not on PATH.*\/usr\/lib\/chatgpt\/resources\/codex/);
  assert.match(codex, /Once binn init has installed Binnacle's skills, run `binnacle-product` in Codex/);
  const opencode = summary.slice(summary.indexOf('To work from opencode'));
  assert.match(opencode, /Run `opencode`/);
  assert.match(opencode, /run `binnacle-product` in opencode/);
  assert.doesNotMatch(opencode, /not on PATH/);
  assert.doesNotMatch(summary, /SKILL\.md/);
  assert.doesNotMatch(summary, /To work from Claude Code/);
});

test('with only Claude Code detected the Summary has no next step for another harness', (t) => {
  const home = makeHome(t);
  fakeClaude(home);
  const root = makeRepository(t, 'claude-only');

  const result = binnIn(home)(root, '\n\nn\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /To work from/);
});

/** A fake executable `name` on PATH, recording each call's arguments as fakeClaude does, and exiting with `exitCode`. */
function fakeTool(home: Home, name: string, exitCode = 0): () => string[][] {
  const calls = join(home.home, `${name}-calls`);
  writeFileSync(
    join(home.bin, name),
    `#!/bin/sh
for arg in "$@"; do printf '%s\\t' "$arg"; done >> '${calls}'
echo >> '${calls}'
exit ${exitCode}
`,
    { mode: 0o755 },
  );
  return () =>
    existsSync(calls)
      ? readFileSync(calls, 'utf8').trimEnd().split('\n').map((line) => line.replace(/\t$/, '').split('\t'))
      : [];
}

const SERENA = ['tool', 'install', '-p', '3.13', 'serena-agent'];
const GRAPHIFY = ['tool', 'install', 'graphifyy'];
const AST_GREP = ['i', '@ast-grep/cli', '-g', '--allow-scripts=@ast-grep/cli'];

test('the tools: each missing one is in the plan with its exact command, installed after a yes, and declared by the new manifest', (t) => {
  const home = makeHome(t);
  const uv = fakeTool(home, 'uv');
  const npm = fakeTool(home, 'npm');
  const root = makeRepository(t, 'tooled');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const question = result.stdout.indexOf(PLAN_QUESTION);
  for (const command of [`uv ${SERENA.join(' ')}`, `uv ${GRAPHIFY.join(' ')}`, `npm ${AST_GREP.join(' ')}`]) {
    const shown = result.stdout.indexOf(command);
    assert.ok(shown >= 0 && shown < question, `${command}\n${result.stdout}`);
    assert.match(result.stdout, new RegExp(`ran\\s+${command.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`));
  }
  assert.deepEqual(uv(), [SERENA, GRAPHIFY]);
  assert.deepEqual(npm(), [AST_GREP]);
  assert.deepEqual(readManifest(root).manifest.capabilities, { serena: true, graphify: true, ast_grep: true });
  // The installs write nothing into the repository; the .gitignore is the first graph's, docs/ and AGENTS.md the layout's and the conventions'.
  assert.equal(git(root, 'status', '--porcelain'), '?? .binnacle/\n?? .gitignore\n?? AGENTS.md\n?? docs/\n');
});

test('the tools: one already on PATH is reported as found, nothing is installed for it, and the new manifest declares it', (t) => {
  const home = makeHome(t);
  const uv = fakeTool(home, 'uv');
  const npm = fakeTool(home, 'npm');
  for (const name of ['serena', 'graphify', 'ast-grep']) installExecutable(home, name);
  const root = makeRepository(t, 'found');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  for (const title of ['Serena', 'Graphify', 'ast-grep']) assert.match(result.stdout, new RegExp(`found\\s+${title}: ${title === 'ast-grep' ? 'ast-grep' : title.toLowerCase()} is on PATH`));
  assert.deepEqual(uv(), []);
  assert.deepEqual(npm(), []);
  assert.doesNotMatch(result.stdout, /tool install|@ast-grep\/cli/);
  assert.deepEqual(readManifest(root).manifest.capabilities, { serena: true, graphify: true, ast_grep: true });
});

test('the tools: one the manifest declares false is not proposed', (t) => {
  const home = makeHome(t);
  const uv = fakeTool(home, 'uv');
  const npm = fakeTool(home, 'npm');
  const manifest = 'version: 1\nproject:\n  id: declared\ncapabilities:\n  serena: false\n  ast_grep: false\n';
  const root = makeRepository(t, 'declared', { '.binnacle/project.yaml': manifest });

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /serena-agent|@ast-grep\/cli/);
  assert.match(result.stdout, /skipped\s+Serena: .*declares it false/);
  assert.match(result.stdout, /skipped\s+ast-grep: .*declares it false/);
  assert.deepEqual(uv(), [GRAPHIFY]);
  assert.deepEqual(npm(), []);
  assert.equal(manifestOf(root), manifest);
});

test('the tools: without uv, Serena and Graphify are left out and uv is named with the command that installs it', (t) => {
  const home = makeHome(t);
  const npm = fakeTool(home, 'npm');
  const root = makeRepository(t, 'no-uv');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /serena-agent|graphifyy/);
  assert.match(result.stdout, /uv is not on PATH.*pipx install uv/);
  assert.match(result.stdout, /skipped\s+Serena: uv is not on PATH/);
  assert.match(result.stdout, /skipped\s+Graphify: uv is not on PATH/);
  assert.deepEqual(npm(), [AST_GREP]);
  assert.deepEqual(readManifest(root).manifest.capabilities, { ast_grep: true });
});

test('the tools: ast-grep is detected by ast-grep only, so an sg on PATH does not count', (t) => {
  const home = makeHome(t);
  const npm = fakeTool(home, 'npm');
  installExecutable(home, 'sg');
  const root = makeRepository(t, 'sg');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(npm(), [AST_GREP]);
  assert.doesNotMatch(result.stdout, /found\s+ast-grep/);
});

test('the tools: a failed install is reported in the Summary, and the rest of the plan still runs', (t) => {
  const home = makeHome(t);
  const uv = fakeTool(home, 'uv', 1);
  const npm = fakeTool(home, 'npm');
  const root = makeRepository(t, 'failing');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /failed\s+uv tool install -p 3\.13 serena-agent/);
  assert.match(result.stdout, /failed\s+uv tool install graphifyy/);
  assert.match(result.stdout, /ran\s+npm i @ast-grep\/cli -g/);
  assert.deepEqual(uv(), [SERENA, GRAPHIFY]);
  assert.deepEqual(npm(), [AST_GREP]);
});

test('the tools: a declined plan and a stdin that is not a terminal install nothing', (t) => {
  for (const [terminal, input] of [
    [true, '\n\nn\n'],
    [false, '\n\n'],
  ] as const) {
    const home = makeHome(t);
    const uv = fakeTool(home, 'uv');
    const npm = fakeTool(home, 'npm');
    const root = makeRepository(t, 'untouched');

    const result = binnIn(home, terminal)(root, input, 'init');

    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`uv ${SERENA.join(' ')}`), result.stdout);
    assert.match(result.stdout, /declined\s+install Serena/);
    assert.deepEqual(uv(), []);
    assert.deepEqual(npm(), []);
  }
});

const SERENA_SERVER = {
  claude: ['serena', 'start-mcp-server', '--context', 'claude-code', '--project-from-cwd'],
  codex: ['serena', 'start-mcp-server', '--context=codex', '--project-from-cwd'],
};
const CONTEXT7_SERVER = ['npx', '-y', '@upstash/context7-mcp'];
const graphifyServer = (root: string): string[] => ['uv', 'run', '--no-project', '--with', 'graphifyy[mcp]', 'python', '-m', 'graphify.serve', join(root, 'graphify-out', 'graph.json')];
/** The `mcp add` calls a fake harness CLI recorded, without the plugin step's calls. */
const mcpAdds = (calls: string[][]): string[][] => calls.filter((call) => call[0] === 'mcp' || call[0] === '--add-mcp');

test('the servers: each detected harness with an mcp add CLI registers every missing server at user scope, and Graphify at Claude Code local scope, after the installs', (t) => {
  const home = makeHome(t);
  fakeTool(home, 'uv');
  fakeTool(home, 'npm');
  const claude = fakeClaude(home);
  const codex = fakeTool(home, 'codex');
  const code = fakeTool(home, 'code');
  const root = makeRepository(t, 'served');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const question = result.stdout.indexOf(PLAN_QUESTION);
  const graph = join(root, 'graphify-out', 'graph.json');
  const commands = [
    `claude mcp add --scope user serena -- ${SERENA_SERVER.claude.join(' ')}`,
    `claude mcp add --scope user context7 -- ${CONTEXT7_SERVER.join(' ')}`,
    `claude mcp add --scope local graphify -- uv run --no-project --with 'graphifyy[mcp]' python -m graphify.serve ${graph}`,
    `codex mcp add serena -- ${SERENA_SERVER.codex.join(' ')}`,
    `codex mcp add context7 -- ${CONTEXT7_SERVER.join(' ')}`,
    `code --add-mcp '{"name":"context7","command":"npx","args":["-y","@upstash/context7-mcp"]}'`,
  ];
  for (const command of commands) {
    const shown = result.stdout.indexOf(command);
    assert.ok(shown >= 0 && shown < question, `${command}\n${result.stdout}`);
    // The registrations follow the installs in the plan.
    assert.ok(shown > result.stdout.indexOf('uv tool install graphifyy'), command);
    assert.ok(result.stdout.slice(question).includes(`ran${' '.repeat(7)}${command}`), `${command}\n${result.stdout}`);
  }

  assert.deepEqual(mcpAdds(claude()), [
    ['mcp', 'add', '--scope', 'user', 'serena', '--', ...SERENA_SERVER.claude],
    ['mcp', 'add', '--scope', 'local', 'graphify', '--', ...graphifyServer(root)],
    ['mcp', 'add', '--scope', 'user', 'context7', '--', ...CONTEXT7_SERVER],
  ]);
  assert.deepEqual(mcpAdds(codex()), [
    ['mcp', 'add', 'serena', '--', ...SERENA_SERVER.codex],
    ['mcp', 'add', 'context7', '--', ...CONTEXT7_SERVER],
  ]);
  assert.deepEqual(mcpAdds(code()), [
    ['--add-mcp', JSON.stringify({ name: 'serena', command: 'serena', args: ['start-mcp-server', '--context=vscode'] })],
    ['--add-mcp', JSON.stringify({ name: 'context7', command: 'npx', args: ['-y', '@upstash/context7-mcp'] })],
  ]);
  // Codex and VS Code have no per-project scope outside the repository: Graphify's entry is printed for them.
  assert.match(result.stdout, /printed\s+Graphify's MCP server for Codex/);
  assert.match(result.stdout, /printed\s+Graphify's MCP server for VS Code/);
  assert.ok(result.stdout.includes('[mcp_servers.graphify]\ncommand = "uv"'), result.stdout);
});

test('the servers: one already registered, in user or local scope, is reported and not registered again', (t) => {
  const home = makeHome(t);
  fakeTool(home, 'uv');
  fakeTool(home, 'npm');
  const claude = fakeClaude(home);
  const codex = fakeTool(home, 'codex');
  const root = makeRepository(t, 'registered');
  writeFileSync(join(home.home, '.claude.json'), JSON.stringify({ mcpServers: { serena: {} }, projects: { [root]: { mcpServers: { graphify: {} } } } }));
  mkdirSync(join(home.home, '.codex'));
  writeFileSync(join(home.home, '.codex', 'config.toml'), '[mcp_servers.context7]\ncommand = "npx"\n');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(mcpAdds(claude()), [['mcp', 'add', '--scope', 'user', 'context7', '--', ...CONTEXT7_SERVER]]);
  assert.deepEqual(mcpAdds(codex()), [['mcp', 'add', 'serena', '--', ...SERENA_SERVER.codex]]);
  assert.match(result.stdout, /found\s+Serena's MCP server: registered with Claude Code in .*\.claude\.json/);
  assert.match(result.stdout, /found\s+Graphify's MCP server: registered with Claude Code in .*\.claude\.json/);
  assert.match(result.stdout, /found\s+Context7's MCP server: registered with Codex in .*config\.toml/);
});

test("the servers: Serena registered with Codex in Codex's user file with Claude Code's context is registered again with Codex's, only after a yes", (t) => {
  for (const [args, input, corrected] of [
    ['"start-mcp-server", "--context=claude-code", "--project-from-cwd"', '\n\n\n', true],
    ['"start-mcp-server", "--context", "claude-code"', '\n\n\n', true],
    ['"start-mcp-server", "--context=claude-code", "--project-from-cwd"', '\n\nn\n', false],
  ] as const) {
    const home = makeHome(t);
    fakeTool(home, 'uv');
    fakeTool(home, 'npm');
    const codex = fakeTool(home, 'codex');
    const root = makeRepository(t, 'claude-context');
    mkdirSync(join(home.home, '.codex'));
    writeFileSync(join(home.home, '.codex', 'config.toml'), `[mcp_servers.serena]\ncommand = "serena"\nargs = [${args}]\n\n[mcp_servers.context7]\ncommand = "npx"\n`);

    const result = binnIn(home)(root, input, 'init');

    assert.equal(result.status, 0, result.stderr);
    const command = `codex mcp add serena -- ${SERENA_SERVER.codex.join(' ')}`;
    assert.ok(result.stdout.indexOf(command) >= 0 && result.stdout.indexOf(command) < result.stdout.indexOf(PLAN_QUESTION), result.stdout);
    assert.match(result.stdout, /Serena's MCP server is registered with Codex in .*config\.toml with Claude Code's context/);
    assert.deepEqual(mcpAdds(codex()), corrected ? [['mcp', 'add', 'serena', '--', ...SERENA_SERVER.codex]] : []);
    assert.match(result.stdout, corrected ? /ran\s+codex mcp add serena/ : /declined\s+register MCP servers with Codex/);
  }
});

test("the servers: Serena registered in the repository's Codex file with Claude Code's context is left alone and named in the Summary", (t) => {
  const home = makeHome(t);
  fakeTool(home, 'uv');
  fakeTool(home, 'npm');
  const codex = fakeTool(home, 'codex');
  const toml = '[mcp_servers.serena]\ncommand = "serena"\nargs = ["start-mcp-server", "--context=claude-code"]\n';
  const root = makeRepository(t, 'own-entry', { '.codex/config.toml': toml });

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(mcpAdds(codex()), [['mcp', 'add', 'context7', '--', ...CONTEXT7_SERVER]]);
  assert.equal(read(root, '.codex/config.toml').startsWith(toml), true);
  assert.match(result.stdout, /found\s+Serena's MCP server: registered with Codex in \.codex\/config\.toml, with Claude Code's context/);
});

test('the servers: a harness without an mcp add CLI gets each entry printed, and the Summary says so', (t) => {
  const home = makeHome(t);
  fakeTool(home, 'uv');
  fakeTool(home, 'npm');
  const opencode = fakeTool(home, 'opencode');
  const root = makeRepository(t, 'printed');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(opencode(), []);
  for (const title of ['Serena', 'Context7', 'Graphify']) assert.match(result.stdout, new RegExp(`printed\\s+${title}'s MCP server for opencode`));
  assert.ok(result.stdout.includes('"context7": {\n      "type": "local",\n      "command": [\n        "npx"'), result.stdout);
});

test('the servers: a tool declared false, or left out for a missing prerequisite, gets no registration', (t) => {
  const home = makeHome(t);
  fakeTool(home, 'uv');
  const claude = fakeClaude(home);
  const root = makeRepository(t, 'unregistered', { '.binnacle/project.yaml': 'version: 1\nproject:\n  id: unregistered\ncapabilities:\n  serena: false\n' });

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  // No npm, so Context7's server, which runs through npx, is left out; Serena is declared false.
  assert.deepEqual(mcpAdds(claude()), [['mcp', 'add', '--scope', 'local', 'graphify', '--', ...graphifyServer(root)]]);
  assert.match(result.stdout, /skipped\s+Context7: npm is not on PATH/);
  assert.doesNotMatch(result.stdout, /mcp add[^\n]*(serena|context7)/);
});

test('the servers: Graphify found on PATH but without uv, which its server runs through, gets no registration', (t) => {
  const home = makeHome(t);
  installExecutable(home, 'graphify');
  const claude = fakeClaude(home);
  const root = makeRepository(t, 'no-uv-server');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /found\s+Graphify: graphify is on PATH/);
  assert.match(result.stdout, /skipped\s+Graphify's MCP server: uv is not on PATH/);
  assert.deepEqual(mcpAdds(claude()), []);
});

test('the servers: registering them creates or changes no file in the repository, and a declined plan registers nothing', (t) => {
  const home = makeHome(t);
  fakeTool(home, 'uv');
  fakeTool(home, 'npm');
  for (const name of ['serena', 'graphify', 'ast-grep']) installExecutable(home, name);
  const claude = fakeClaude(home, ['binnacle@binnacle']);
  const root = makeRepository(t, 'untouched-servers', {
    '.binnacle/project.yaml': 'version: 1\nproject:\n  id: untouched\ntelemetry:\n  import:\n    window_days: 90\n',
    '.mcp.json': JSON.stringify({ mcpServers: { binnacle: {} } }),
    // Already ignored, so that the first graph's step writes nothing either.
    '.gitignore': 'graphify-out/\n',
    ...CONVENTIONS_IN_PLACE,
  });
  const before = git(root, 'status', '--porcelain', '--untracked-files=all');

  // The window is declared, so the language and the plan are the only questions.
  const declined = binnIn(home)(root, '\nn\n', 'init');
  assert.equal(declined.status, 0, declined.stderr);
  assert.deepEqual(mcpAdds(claude()), []);
  assert.match(declined.stdout, /declined\s+register MCP servers with Claude Code/);

  const result = binnIn(home)(root, '\n\n', 'init');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(mcpAdds(claude()).length, 3);
  assert.equal(git(root, 'status', '--porcelain', '--untracked-files=all'), before);
});

const PONYTAIL_MARKETPLACE = ['plugin', 'marketplace', 'add', 'DietrichGebert/ponytail', '--scope', 'user'];
const PONYTAIL_INSTALL = ['plugin', 'install', 'ponytail@ponytail', '--scope', 'user'];
const MATT_POCOCK_INSTALL = ['plugin', 'install', 'mattpocock-skills@claude-plugins-official', '--scope', 'user'];
/** The calls a fake `claude` recorded for the skill plugins, without the listing, the binnacle plugin's and the servers'. */
const skillPluginCalls = (calls: string[][]): string[][] =>
  calls.filter((call) => call[0] === 'plugin' && call[1] !== 'list' && !call.includes(PACKAGE) && !call.includes('binnacle@binnacle'));

test('the skill plugins: with Claude Code detected and neither listed, the plan shows their commands and installs them at user scope after a yes', (t) => {
  const home = makeHome(t);
  const claude = fakeClaude(home);
  const root = makeRepository(t, 'skilled');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const question = result.stdout.indexOf(PLAN_QUESTION);
  for (const args of [MATT_POCOCK_INSTALL, PONYTAIL_MARKETPLACE, PONYTAIL_INSTALL]) {
    const shown = result.stdout.indexOf(`claude ${args.join(' ')}`);
    assert.ok(shown >= 0 && shown < question, `${args.join(' ')}\n${result.stdout}`);
    assert.ok(result.stdout.slice(question).includes(`ran${' '.repeat(7)}claude ${args.join(' ')}`), `${args.join(' ')}\n${result.stdout}`);
  }
  assert.deepEqual(skillPluginCalls(claude()), [MATT_POCOCK_INSTALL, PONYTAIL_MARKETPLACE, PONYTAIL_INSTALL]);
  // Claude Code is asked for its plugins once, for the binnacle plugin and the skill plugins alike.
  assert.equal(claude().filter((call) => call[1] === 'list').length, 1);
  assert.deepEqual(readManifest(root).manifest.capabilities, { matt_pocock_skills: true, ponytail: true });
  assert.equal(git(root, 'status', '--porcelain'), '?? .binnacle/\n?? .mcp.json\n?? AGENTS.md\n?? docs/\n');
});

test('the skill plugins: one Claude Code already lists is reported, and nothing is installed for it', (t) => {
  const home = makeHome(t);
  const claude = fakeClaude(home, ['ponytail@ponytail', 'mattpocock-skills@somewhere-else']);
  const root = makeRepository(t, 'skills-listed');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(skillPluginCalls(claude()), []);
  assert.match(result.stdout, /found\s+Ponytail: Claude Code lists ponytail@ponytail/);
  assert.match(result.stdout, /found\s+Matt Pocock Skills: Claude Code lists mattpocock-skills@somewhere-else/);
  assert.deepEqual(readManifest(root).manifest.capabilities, { matt_pocock_skills: true, ponytail: true });
});

test('the skill plugins: one the manifest declares false is not proposed', (t) => {
  const home = makeHome(t);
  const claude = fakeClaude(home);
  const root = makeRepository(t, 'skills-false', { '.binnacle/project.yaml': 'version: 1\nproject:\n  id: skills-false\ncapabilities:\n  ponytail: false\n' });

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(skillPluginCalls(claude()), [MATT_POCOCK_INSTALL]);
  assert.doesNotMatch(result.stdout, /ponytail@ponytail/);
  assert.match(result.stdout, /skipped\s+Ponytail: \.binnacle\/project\.yaml declares it false/);
});

test('the skill plugins: for Codex, opencode or VS Code detected, no Summary line points them at where a skill set is had', (t) => {
  const home = makeHome(t);
  for (const name of ['codex', 'opencode', 'code']) installExecutable(home, name);
  const root = makeRepository(t, 'skills-elsewhere');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  // The skills step installs them there instead.
  assert.doesNotMatch(result.stdout, /(Matt Pocock Skills|Ponytail) for Codex|only into Claude Code|skills@latest|ponytail#install/);
});

test('the skill plugins: a failed plugin listing is reported once, and no plugin is installed', (t) => {
  const home = makeHome(t);
  const claude = fakeTool(home, 'claude', 1);
  const root = makeRepository(t, 'skills-unlisted');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(claude().filter((call) => call[0] === 'plugin'), [['plugin', 'list', '--json']]);
  const summary = result.stdout.slice(result.stdout.indexOf('Summary:'));
  assert.equal(summary.match(/failed\s+claude plugin list --json/g)?.length, 1, summary);
  assert.match(summary, /skipped\s+Ponytail: a Claude Code plugin, and `claude plugin list --json` failed/);
});

test('the skill plugins: without Claude Code detected nothing is installed, and the Summary says why', (t) => {
  const home = makeHome(t);
  installExecutable(home, 'codex');
  const root = makeRepository(t, 'skills-no-claude');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /plugin install/);
  const summary = result.stdout.slice(result.stdout.indexOf('Summary:'));
  assert.match(summary, /skipped\s+Matt Pocock Skills: a Claude Code plugin, and Claude Code is not detected/);
  assert.match(summary, /skipped\s+Ponytail: a Claude Code plugin, and Claude Code is not detected/);
  assert.doesNotMatch(summary, /Matt Pocock Skills for Codex/);
  assert.equal(readManifest(root).manifest.capabilities.ponytail, undefined);
});

/**
 * A fake `uv` and a fake `graphify` that log each call to one shared file, in order, as
 * `<name> <working directory> <arguments>`. `graphify` is on PATH from the start when
 * `installed`, and otherwise only once `uv tool install graphifyy` has run. It exits with
 * `exitCode`, saying `reason` on stderr; its report step, `cluster-only`, fails with
 * `reportReason` when one is given.
 */
function fakeGraphify(home: Home, { installed = false, exitCode = 0, reason = '', installFails = false, reportReason = '' } = {}): () => string[] {
  const log = join(home.home, 'graph-calls');
  const graphify = join(home.home, 'graphify');
  const logged = (name: string): string => `#!/bin/sh\necho "${name} $PWD $*" >> '${log}'\n`;
  const report = reportReason ? `if [ "$1" = cluster-only ]; then echo '${reportReason}' >&2; exit 4; fi\n` : '';
  writeFileSync(graphify, `${logged('graphify')}${report}${reason ? `echo '${reason}' >&2\n` : ''}exit ${exitCode}\n`, { mode: 0o755 });
  // An absolute cp: the PATH the fakes run with holds nothing but git and themselves.
  const install = installFails ? 'exit 1\n' : `if [ "$*" = "tool install graphifyy" ]; then /bin/cp '${graphify}' '${home.bin}/'; fi\n`;
  writeFileSync(join(home.bin, 'uv'), `${logged('uv')}${install}`, { mode: 0o755 });
  if (installed) writeFileSync(join(home.bin, 'graphify'), readFileSync(graphify), { mode: 0o755 });
  return () => (existsSync(log) ? readFileSync(log, 'utf8').trimEnd().split('\n') : []);
}

const EXTRACT = 'extract . --code-only --allow-dedup-shrink';
const CLUSTER = 'cluster-only . --no-label';
const graphCalls = (calls: string[]): string[] => calls.filter((call) => /graphif/.test(call));

test('the first graph: Graphify is built code-only in the repository root after its install, and its output directory is appended to .gitignore', (t) => {
  const home = makeHome(t);
  const calls = fakeGraphify(home);
  const root = makeRepository(t, 'graphed');
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  git(root, 'add', '.gitignore');
  git(root, 'commit', '--quiet', '-m', 'ignore');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const question = result.stdout.indexOf(PLAN_QUESTION);
  const append = result.stdout.indexOf('Append to the end of .gitignore');
  const build = result.stdout.indexOf(`graphify ${EXTRACT}`);
  assert.ok(append > result.stdout.indexOf('uv tool install graphifyy') && build > append && build < question, result.stdout);
  assert.equal(read(root, '.gitignore'), 'node_modules/\ngraphify-out/\n');
  assert.match(result.stdout, /extended\s+\.gitignore/);
  // Installed by the plan, then built, then its report, with no model; never called before the plan's yes.
  assert.deepEqual(graphCalls(calls()), [`uv ${root} tool install graphifyy`, `graphify ${root} ${EXTRACT}`, `graphify ${root} ${CLUSTER}`]);
  assert.ok(result.stdout.indexOf(`graphify ${CLUSTER}`) > build && result.stdout.indexOf(`graphify ${CLUSTER}`) < question, result.stdout);
  assert.match(result.stdout, new RegExp(`ran\\s+graphify ${EXTRACT}`));
  assert.match(result.stdout, new RegExp(`ran\\s+graphify ${CLUSTER}`));
});

test('the first graph: an output directory Git already ignores leaves .gitignore untouched, and a missing .gitignore is created', (t) => {
  const home = makeHome(t);
  const calls = fakeGraphify(home, { installed: true });
  const ignored = makeRepository(t, 'ignored', { '.gitignore': '/graphify-out\n' });

  const result = binnIn(home)(ignored, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(ignored, '.gitignore'), '/graphify-out\n');
  assert.doesNotMatch(result.stdout, /\s\.gitignore\n/);
  assert.match(result.stdout, /Git already ignores graphify-out\//);
  assert.deepEqual(graphCalls(calls()), [`graphify ${ignored} ${EXTRACT}`, `graphify ${ignored} ${CLUSTER}`]);

  const bare = makeRepository(t, 'unignored');
  assert.equal(binnIn(home)(bare, '\n\n\n', 'init').status, 0);
  assert.equal(read(bare, '.gitignore'), 'graphify-out/\n');
});

test('the first graph: a failing build is reported in the Summary with its reason, and the rest of the plan has run', (t) => {
  const home = makeHome(t);
  // graphify 0.9.76's refusal of a graph that shrinks, standing for any failed extract.
  const refusal =
    '[graphify extract] error: dedup merged 4 node(s); writing would shrink the graph from 12 nodes to 8 nodes. Refusing to overwrite graphify-out/graph.json. Pass --allow-dedup-shrink to write the smaller graph.';
  const calls = fakeGraphify(home, { installed: true, exitCode: 1, reason: refusal });
  const npm = fakeTool(home, 'npm');
  const root = makeRepository(t, 'graph-fails');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const summary = result.stdout.slice(result.stdout.indexOf('Summary:'));
  assert.match(summary, new RegExp(`failed\\s+graphify ${EXTRACT}: ${refusal.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`));
  assert.match(summary, /created\s+\.gitignore/);
  assert.match(summary, /ran\s+npm i @ast-grep\/cli -g/);
  assert.deepEqual(npm(), [AST_GREP]);
  // A failed build makes no report.
  assert.deepEqual(graphCalls(calls()), [`graphify ${root} ${EXTRACT}`]);
});

test('the first graph: a failing report is reported in the Summary with its reason, and the graph is kept', (t) => {
  const home = makeHome(t);
  const calls = fakeGraphify(home, { installed: true, reportReason: 'community detection failed' });
  const root = makeRepository(t, 'report-fails');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const summary = result.stdout.slice(result.stdout.indexOf('Summary:'));
  assert.match(summary, new RegExp(`ran\\s+graphify ${EXTRACT}`));
  assert.match(summary, new RegExp(`failed\\s+graphify ${CLUSTER}: community detection failed\\. The graph is kept`));
  assert.deepEqual(graphCalls(calls()), [`graphify ${root} ${EXTRACT}`, `graphify ${root} ${CLUSTER}`]);
});

test('the first graph: a failed install of Graphify skips the build, and says why', (t) => {
  const home = makeHome(t);
  const calls = fakeGraphify(home, { installFails: true });
  const root = makeRepository(t, 'graph-not-installed');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const summary = result.stdout.slice(result.stdout.indexOf('Summary:'));
  assert.match(summary, /failed\s+uv tool install graphifyy/);
  assert.match(summary, /skipped\s+the first graph: graphify is not on PATH/);
  assert.deepEqual(graphCalls(calls()), [`uv ${root} tool install graphifyy`]);
});

test('the first graph: Graphify declared false, or left out for a missing uv, means no .gitignore line and no build', (t) => {
  const home = makeHome(t);
  const calls = fakeGraphify(home, { installed: true });
  const declared = makeRepository(t, 'graph-false', { '.binnacle/project.yaml': 'version: 1\nproject:\n  id: graph-false\ncapabilities:\n  graphify: false\n' });

  assert.equal(binnIn(home)(declared, '\n\n\n', 'init').status, 0);
  assert.equal(existsSync(join(declared, '.gitignore')), false);
  assert.deepEqual(graphCalls(calls()), []);

  for (const name of ['uv', 'graphify']) rmSync(join(home.bin, name));
  const noUv = makeRepository(t, 'graph-no-uv');
  const result = binnIn(home)(noUv, '\n\n\n', 'init');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /skipped\s+Graphify: uv is not on PATH/);
  assert.equal(existsSync(join(noUv, '.gitignore')), false);
  assert.doesNotMatch(result.stdout, /extract \. --code-only/);
});

/**
 * Obsidian's own list of vaults, as Obsidian keeps it on Linux, holding a directory for each of
 * `names` under the temporary home. Returns the vaults' paths.
 */
function fakeObsidian(home: Home, ...names: string[]): string[] {
  const vaults = names.map((name) => join(home.home, 'vaults', name));
  for (const vault of vaults) mkdirSync(vault, { recursive: true });
  const config = join(home.home, '.config', 'obsidian');
  mkdirSync(config, { recursive: true });
  const listed = Object.fromEntries(vaults.map((path, index) => [`id${index}`, { path, ts: 1, open: index === 0 }]));
  writeFileSync(join(config, 'obsidian.json'), JSON.stringify({ vaults: listed }));
  return vaults;
}

const settingsOf = (home: Home): string => join(home.binnacleHome, 'settings.json');
const VAULT_HEADING = 'Set the Obsidian vault in';

test('the vault: the one vault Obsidian lists is proposed in the plan, and after a yes the settings file holds it, owner-only, with nothing written in the repository', (t) => {
  const home = makeHome(t);
  const [vault] = fakeObsidian(home, 'Notes');
  const root = makeRepository(t, 'vaulted', {
    '.binnacle/project.yaml': 'version: 1\nproject:\n  id: vaulted\ntelemetry:\n  import:\n    window_days: 90\n',
    ...CONVENTIONS_IN_PLACE,
  });
  const before = git(root, 'status', '--porcelain');

  const result = binnIn(home)(root, '\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const heading = result.stdout.indexOf(VAULT_HEADING);
  assert.ok(heading >= 0 && heading < result.stdout.indexOf(PLAN_QUESTION), result.stdout);
  assert.ok(result.stdout.slice(heading).includes(vault!), result.stdout);
  assert.deepEqual(JSON.parse(readFileSync(settingsOf(home), 'utf8')), { obsidian: { vaultPath: vault } });
  assert.equal(statSync(settingsOf(home)).mode & 0o777, 0o600);
  assert.match(result.stdout, new RegExp(`created\\s+${settingsOf(home)}`));
  assert.equal(git(root, 'status', '--porcelain'), before);
});

test('the vault: other settings in the file are kept beside the path', (t) => {
  const home = makeHome(t);
  const [vault] = fakeObsidian(home, 'Notes');
  mkdirSync(home.binnacleHome, { recursive: true });
  writeFileSync(settingsOf(home), JSON.stringify({ other: 1, obsidian: { theme: 'dark' } }), { mode: 0o644 });
  const root = makeRepository(t, 'vault-merged');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(settingsOf(home), 'utf8')), { other: 1, obsidian: { theme: 'dark', vaultPath: vault } });
  assert.equal(statSync(settingsOf(home)).mode & 0o777, 0o600);
  assert.match(result.stdout, new RegExp(`updated\\s+${settingsOf(home)}`));
});

test('the vault: it comes after the .gitignore append and before the first graph in the plan', (t) => {
  const home = makeHome(t);
  fakeGraphify(home, { installed: true });
  fakeObsidian(home, 'Notes');
  const root = makeRepository(t, 'vault-ordered');

  const result = binnIn(home)(root, '\n\nn\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const append = result.stdout.indexOf('Create .gitignore');
  const vault = result.stdout.indexOf(VAULT_HEADING);
  const build = result.stdout.indexOf(`graphify ${EXTRACT}`, vault);
  assert.ok(append >= 0 && vault > append && build > vault && build < result.stdout.indexOf(PLAN_QUESTION), result.stdout);
});

test('the vault: with no vault, or several, nothing is proposed, and init says how to set it and names those found', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'no-vault');

  const none = binnIn(home)(root, '\n\n\n', 'init');
  assert.equal(none.status, 0, none.stderr);
  assert.doesNotMatch(none.stdout, new RegExp(VAULT_HEADING));
  assert.match(none.stdout, /Obsidian lists no vault on this machine/);
  assert.ok(none.stdout.includes(settingsOf(home)) && none.stdout.includes('"vaultPath"'), none.stdout);
  assert.equal(existsSync(settingsOf(home)), false);

  const vaults = fakeObsidian(home, 'Work', 'Home');
  const several = binnIn(home)(makeRepository(t, 'two-vaults'), '\n\n\n', 'init');
  assert.equal(several.status, 0, several.stderr);
  assert.doesNotMatch(several.stdout, new RegExp(VAULT_HEADING));
  assert.ok(several.stdout.includes(`Obsidian lists 2 vaults on this machine: ${vaults[0]} and ${vaults[1]}`), several.stdout);
  assert.ok(several.stdout.includes('"vaultPath"'), several.stdout);
  assert.equal(existsSync(settingsOf(home)), false);
});

test('the vault: a path already set is reported and not changed', (t) => {
  const home = makeHome(t);
  fakeObsidian(home, 'Notes');
  mkdirSync(home.binnacleHome, { recursive: true });
  const set = `${JSON.stringify({ obsidian: { vaultPath: '/elsewhere/Vault' } })}\n`;
  writeFileSync(settingsOf(home), set);
  const root = makeRepository(t, 'vault-set');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, new RegExp(VAULT_HEADING));
  assert.match(result.stdout, /already names the Obsidian vault \/elsewhere\/Vault\. It is left as it is\./);
  assert.equal(readFileSync(settingsOf(home), 'utf8'), set);

  // One the daemon cannot use is left alone too, and said to be unusable.
  const relative = JSON.stringify({ obsidian: { vaultPath: 'Notes' } });
  writeFileSync(settingsOf(home), relative);
  const unusable = binnIn(home)(root, '\n\n\n', 'init');
  assert.match(unusable.stdout, /already names the Obsidian vault Notes\. It is left as it is, though it is not an absolute path/);
  assert.equal(readFileSync(settingsOf(home), 'utf8'), relative);
});

test('the vault: a declined plan, and a stdin that is not a terminal, write no settings file', (t) => {
  const home = makeHome(t);
  fakeObsidian(home, 'Notes');
  const root = makeRepository(t, 'vault-declined');

  const declined = binnIn(home)(root, '\n\nn\n', 'init');
  assert.equal(declined.status, 0, declined.stderr);
  assert.match(declined.stdout, /declined\s+set the Obsidian vault/);
  assert.equal(existsSync(settingsOf(home)), false);

  const piped = binnIn(home, false)(root, '\n\n\ny\n', 'init');
  assert.equal(piped.status, 0, piped.stderr);
  assert.ok(piped.stdout.includes(VAULT_HEADING), piped.stdout);
  assert.equal(existsSync(settingsOf(home)), false);
});

/** What `binn init --plan --json` prints. */
type PlanJson = {
  root: string;
  id: string;
  plan: { heading: string; body: string }[];
  notes: string[];
  history: { harness: string; sessions: number; oldest: string | null }[];
  window: { days: number | 'all'; declared: boolean; default: boolean };
  language: { value: 'en' | 'ru'; proposal: 'en' | 'ru'; source: 'readme' | 'locale'; declared: boolean };
  autostart: { ask: boolean };
};

/** `binn init --plan --json` with `args`, stdin a terminal that is never ended: a plan that read it, or held it open, would hang. */
async function planJson(t: TestContext, home: Home, cwd: string, ...args: string[]): Promise<PlanJson> {
  const child = spawn(process.execPath, ['--import', TERMINAL, BINN, 'init', '--plan', '--json', ...args], { cwd, env: envFor(home) });
  t.after(() => child.kill('SIGKILL'));
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  child.stdin.write('y\n');
  const code = await Promise.race([
    new Promise((resolve) => child.on('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 10_000, 'still running').unref()),
  ]);
  assert.equal(code, 0, `${stdout}\n${stderr}`);
  return JSON.parse(stdout) as PlanJson;
}

/** The numbered headings of the plan the interactive run shows. */
const shownHeadings = (stdout: string): string[] => {
  const plan = stdout.slice(stdout.indexOf('The plan. Nothing is written until you confirm it:'), stdout.indexOf(PLAN_QUESTION));
  return [...plan.matchAll(/^\d+\. [^\n]*:$/gm)].map((match) => match[0]);
};

test('--plan --json lists the interactive plan, item by item and in order, and writes, runs, reads and checks nothing', async (t) => {
  const home = makeHome(t);
  const claude = fakeClaude(home);
  const uv = fakeTool(home, 'uv');
  const npm = fakeTool(home, 'npm');
  installUserDirectory(home, '.codex');
  fakeObsidian(home, 'Work');
  const root = makeRepository(t, 'planned', { 'docs/agents/issue-tracker.md': '# Issue tracker\n', '.codex/config.toml': '[other]\nkey = 1\n' });
  git(root, 'remote', 'add', 'origin', 'git@github.com:Acme/Planned.git');

  const json = await planJson(t, home, root);

  assert.equal(json.root, root);
  assert.match(json.id, /^[0-9a-f]{64}$/);
  assert.equal(git(root, 'status', '--porcelain'), '?? .codex/\n?? docs/\n');
  assert.equal(existsSync(home.binnacleHome), false);
  // Claude Code is asked for its plugins, as the interactive plan does; nothing in the plan runs.
  assert.deepEqual(claude(), [['plugin', 'list', '--json']]);
  assert.deepEqual(uv(), []);
  assert.deepEqual(npm(), []);
  // The tracker check comes after the writes, so it is not run.
  assert.ok(!json.notes.some((note) => /Reading |tracker is checked|nothing to check/.test(note)), json.notes.join('\n'));

  const interactive = binnIn(home)(root, '\n\nn\n', 'init');
  assert.equal(interactive.status, 0, interactive.stderr);
  assert.ok(json.plan.length >= 8, JSON.stringify(json.plan, null, 2));
  assert.deepEqual(shownHeadings(interactive.stdout), json.plan.map(({ heading }, index) => `${index + 1}. ${heading}:`));
  let from = 0;
  json.plan.forEach(({ heading, body }, index) => {
    const at = interactive.stdout.indexOf(`${index + 1}. ${heading}:\n\n${body.trimEnd()}\n`, from);
    assert.ok(at >= from, `${heading}\n${interactive.stdout}`);
    from = at;
  });
});

test('--plan --json notes carry a printed JSON entry and a registration skipped because the daemon is not running', async (t) => {
  const home = makeHome(t);
  fakeClaude(home, ['binnacle@binnacle', ...SKILL_PLUGINS]);
  const root = makeRepository(t, 'noted', { '.mcp.json': '{\n  "mcpServers": {}\n}\n' });

  const { plan, notes } = await planJson(t, home, root);

  assert.ok(!plan.some(({ heading }) => heading.includes('.mcp.json')), JSON.stringify(plan));
  const entry = notes.find((note) => note.includes('.mcp.json exists, and binn init never rewrites a JSON file'));
  assert.ok(entry?.includes('"binnacle"') && entry.includes('"mcp"'), notes.join('\n---\n'));
  assert.ok(notes.some((note) => note.includes('The Binnacle daemon is not running') && note.includes('binn daemon start')), notes.join('\n---\n'));
});

test('--plan --json takes its window from --window, or else the default, and the window changes the id', async (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'windows');

  const byDefault = await planJson(t, home, root);
  const seven = await planJson(t, home, root, '--window', '7');
  const all = await planJson(t, home, root, '--window', 'all');

  const manifest = (json: PlanJson): string => json.plan.find(({ heading }) => heading === 'Create .binnacle/project.yaml')!.body;
  assert.ok(manifest(byDefault).endsWith(windowSection('90')), manifest(byDefault));
  assert.ok(manifest(seven).endsWith(windowSection('7')), manifest(seven));
  assert.ok(manifest(all).endsWith(windowSection('all')), manifest(all));
  assert.deepEqual(byDefault.window, { days: 90, declared: false, default: true });
  assert.deepEqual(seven.window, { days: 7, declared: false, default: false });
  assert.notEqual(seven.id, byDefault.id);
  assert.notEqual(all.id, seven.id);
  // The same plan, the same id.
  assert.equal((await planJson(t, home, root, '--window', '7')).id, seven.id);
  assert.deepEqual(byDefault.history, [
    { harness: 'Claude Code', sessions: 0, oldest: null },
    { harness: 'Codex', sessions: 0, oldest: null },
  ]);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('--plan --json with a manifest that declares a window says so, and an empty plan still has an id', async (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'settled', { '.binnacle/project.yaml': `version: 1\nproject:\n  id: settled\n${windowSection('30')}`, ...CONVENTIONS_IN_PLACE });

  const json = await planJson(t, home, root, '--window', '7');

  assert.deepEqual(json.plan, []);
  assert.match(json.id, /^[0-9a-f]{64}$/);
  assert.deepEqual(json.window, { days: 30, declared: true, default: false });
});

test('binn init --window skips the window question, and without a terminal still writes nothing', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'given-window');

  const result = binnIn(home)(root, '\n\n', 'init', '--window', '14');

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Import window/);
  assert.ok(manifestOf(root).endsWith(windowSection('14')), manifestOf(root));

  const other = makeRepository(t, 'no-terminal');
  const untouched = binnIn(home, false)(other, '\n', 'init', '--window', '14');
  assert.equal(untouched.status, 0, untouched.stderr);
  assert.equal(existsSync(join(other, '.binnacle')), false);
});

test('binn init refuses a bad --window, and --plan or --json alone, as usage errors', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'misused');
  for (const args of [['--window', 'soon'], ['--window', '0'], ['--window'], ['--plan'], ['--json']]) {
    const result = binnIn(home)(root, '', 'init', ...args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.stdout}`);
  }
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('binn --help names --plan, --json and --window for binn init', () => {
  const { stdout } = spawnSync(process.execPath, [BINN, '--help'], { encoding: 'utf8' });
  assert.match(stdout, /binn init \[--window <days\|all>\] \[--language <en\|ru>\] \[--autostart <yes\|no>\] \[--skip-harness <id>\]\.\.\. \[path\]/);
  assert.match(stdout, /binn init --plan --json \[--window <days\|all>\] \[--language <en\|ru>\] \[--autostart <yes\|no>\] \[--skip-harness <id>\]\.\.\. \[path\]/);
});

/** The new manifest's body in a plan. */
const manifestIn = (json: PlanJson): string => json.plan.find(({ heading }) => heading === 'Create .binnacle/project.yaml')!.body;

test('--plan --json proposes the language of the README, counting its prose and not its code, or the locale without one', async (t) => {
  const english = makeRepository(t, 'english');
  const russian = makeRepository(t, 'russian', { 'README.md': '# Магазин\n\nМагазин для своих, с корзиной и оплатой.\n' });
  const code = makeRepository(t, 'mostly-code', {
    'README.md': [
      '# Сборка',
      '',
      'Запустите `pnpm install --frozen-lockfile && pnpm run build:production`:',
      '',
      '```bash',
      'export NODE_OPTIONS="--max-old-space-size=4096"',
      'pnpm install --frozen-lockfile && pnpm run build:production && pnpm run deploy:staging',
      '```',
      '',
    ].join('\n'),
  });
  const none = makeRepository(t, 'no-readme');
  rmSync(join(none, 'README.md'));
  const locale = (env: NodeJS.ProcessEnv): Home => ({ ...makeHome(t), env });

  const cases: [string, Home, string, PlanJson['language']][] = [
    ['English README', locale({ LC_ALL: '', LANG: 'ru_RU.UTF-8' }), english, { value: 'en', proposal: 'en', source: 'readme', declared: false }],
    ['Russian README', locale({ LC_ALL: '', LANG: 'C' }), russian, { value: 'ru', proposal: 'ru', source: 'readme', declared: false }],
    ['README mostly code', locale({ LC_ALL: '', LANG: 'C' }), code, { value: 'ru', proposal: 'ru', source: 'readme', declared: false }],
    ['no README, Russian LANG', locale({ LC_ALL: '', LANG: 'ru_RU.UTF-8' }), none, { value: 'ru', proposal: 'ru', source: 'locale', declared: false }],
    ['no README, LC_ALL over LANG', locale({ LC_ALL: 'C', LANG: 'ru_RU.UTF-8' }), none, { value: 'en', proposal: 'en', source: 'locale', declared: false }],
    ['no README, unset', locale({ LC_ALL: '', LANG: '' }), none, { value: 'en', proposal: 'en', source: 'locale', declared: false }],
  ];
  for (const [name, home, root, language] of cases) {
    const json = await planJson(t, home, root);
    assert.deepEqual(json.language, language, name);
    assert.match(manifestIn(json), new RegExp(`\\nknowledge:\\n(  .*\\n)*  language: ${language.value}\\n`), `${name}\n${manifestIn(json)}`);
  }
});

test('--language answers the language in --plan, --apply and the interactive form, and changes the id', async (t) => {
  const home = makeHome(t);
  const planned = makeRepository(t, 'planned');

  const english = await planJson(t, home, planned);
  const russian = await planJson(t, home, planned, '--language', 'ru');
  assert.deepEqual(russian.language, { value: 'ru', proposal: 'en', source: 'readme', declared: false });
  assert.match(manifestIn(russian), /\n {2}language: ru\n/);
  assert.notEqual(russian.id, english.id);

  const applied = binnIn(home, false)(planned, '', 'init', '--apply', russian.id, '--language', 'ru');
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(manifestOf(planned), manifestIn(russian));

  const asked = makeRepository(t, 'asked');
  const result = binnIn(home)(asked, '\n\n', 'init', '--language', 'ru');
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Documentation language/);
  assert.match(manifestOf(asked), /\n {2}language: ru\n/);

  for (const args of [['--language', 'fr'], ['--language', ''], ['--language']]) {
    assert.equal(binnIn(home)(asked, '', 'init', ...args).status, 2, args.join(' '));
  }
});

test('binn init asks the language once, its proposal the default, and puts the answer in the new manifest', (t) => {
  const home = makeHome(t);
  const byDefault = makeRepository(t, 'by-default');
  const corrected = makeRepository(t, 'corrected');

  const taken = binnIn(home)(byDefault, '\n\n\n', 'init');
  assert.equal(taken.status, 0, taken.stderr);
  assert.match(taken.stdout, /Documentation language \[en\]: /);
  assert.match(manifestOf(byDefault), /\n {2}language: en\n/);

  const answered = binnIn(home)(corrected, '\nfr\nru\n\n', 'init');
  assert.equal(answered.status, 0, answered.stderr);
  assert.match(answered.stdout, /Answer en or ru\./);
  assert.match(manifestOf(corrected), /\n {2}language: ru\n/);
  // Asked after the window, and before the plan.
  const asked = answered.stdout.indexOf('Documentation language');
  assert.ok(answered.stdout.indexOf('Import window') < asked && asked < answered.stdout.indexOf('The plan. '), answered.stdout);
});

test('an existing manifest without a language gets the line printed and stays as it is, and an English answer prints nothing', async (t) => {
  const home = makeHome(t);
  const existing = 'version: 1\nproject:\n  id: kept\ntelemetry:\n  import:\n    window_days: 90\n';
  const russian = makeRepository(t, 'kept-ru', { 'README.md': 'Документация проекта.\n', '.binnacle/project.yaml': existing, ...CONVENTIONS_IN_PLACE });
  const english = makeRepository(t, 'kept-en', { '.binnacle/project.yaml': existing, ...CONVENTIONS_IN_PLACE });

  const printed = binnIn(home)(russian, '\n\n', 'init');
  assert.equal(printed.status, 0, printed.stderr);
  assert.ok(printed.stdout.includes('knowledge:\n  language: ru\n'), printed.stdout);
  assert.match(printed.stdout, /printed\s+the knowledge\.language line for \.binnacle\/project\.yaml/);
  assert.equal(manifestOf(russian), existing);

  const silent = binnIn(home)(english, '\n\n', 'init');
  assert.equal(silent.status, 0, silent.stderr);
  assert.doesNotMatch(silent.stdout, /language:|knowledge\.language/);
  assert.equal(manifestOf(english), existing);

  const json = await planJson(t, home, russian);
  assert.ok(!json.plan.some(({ heading }) => heading.includes('project.yaml')), JSON.stringify(json.plan));
  assert.ok(json.notes.some((note) => note.includes('knowledge:\n  language: ru')), json.notes.join('\n---\n'));
});

test('a manifest that declares a language is not asked, and --plan --json says it declares one', async (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'declared-language', {
    'README.md': 'Документация проекта.\n',
    '.binnacle/project.yaml': 'version: 1\nproject:\n  id: declared\nknowledge:\n  language: en\ntelemetry:\n  import:\n    window_days: 90\n',
    ...CONVENTIONS_IN_PLACE,
  });

  const result = binnIn(home)(root, '\n', 'init');
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Documentation language/);
  assert.deepEqual((await planJson(t, home, root, '--language', 'ru')).language, { value: 'en', proposal: 'ru', source: 'readme', declared: true });
});

test('--apply with the id from --plan --json writes that plan with stdin not a terminal, runs the tracker check and prints the Summary', async (t) => {
  const home = makeHome(t);
  const claude = fakeClaude(home);
  const root = makeRepository(t, 'applied', { 'docs/agents/issue-tracker.md': '# Issue tracker\n' });
  const before = commits(root);
  const { id, plan } = await planJson(t, home, root, '--window', '7');

  const result = binnIn(home, false)(root, '', 'init', '--apply', id, '--window', '7');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(manifestOf(root), plan.find(({ heading }) => heading === 'Create .binnacle/project.yaml')!.body);
  assert.ok(manifestOf(root).endsWith(windowSection('7')), manifestOf(root));
  assert.ok(existsSync(join(root, '.mcp.json')));
  assert.match(read(root, 'docs/agents/issue-tracker.md'), /## Ticket header/);
  assert.ok(claude().some((call) => call.join(' ') === 'plugin install binnacle@binnacle --scope user'), JSON.stringify(claude()));
  // Nothing is asked, neither the window nor the plan, and the plan is not shown again.
  assert.doesNotMatch(result.stdout, /Import window|Write this plan|stdin is not a terminal|The plan\. /);
  assert.match(result.stdout, /The tracker is not a remote one/);
  assert.match(result.stdout, /Summary:\n(.*\n)*\s+created\s+\.binnacle\/project\.yaml/);
  assert.match(result.stdout, /extended\s+docs\/agents\/issue-tracker\.md/);
  assert.match(result.stdout, /Nothing was committed/);
  assert.equal(commits(root), before);
});

test('--apply after a file in the plan was created or changed exits 3 with init.plan_changed and writes nothing', async (t) => {
  const changes = {
    // A file the plan would create appears.
    created: (root: string) => writeFileSync(join(root, '.mcp.json'), '{}\n'),
    // A file the plan would extend changes what the plan shows: here, it already has the section.
    changed: (root: string) => writeFileSync(join(root, 'docs/agents/issue-tracker.md'), '# Issue tracker\n\n## Ticket header\n\nBy hand.\n'),
  };
  for (const [name, change] of Object.entries(changes)) {
    const home = makeHome(t);
    const claude = fakeClaude(home);
    const root = makeRepository(t, name, { 'docs/agents/issue-tracker.md': '# Issue tracker\n' });
    const { id } = await planJson(t, home, root);
    change(root);
    const status = git(root, 'status', '--porcelain');
    const tracker = read(root, 'docs/agents/issue-tracker.md');

    const result = binnIn(home, false)(root, '', 'init', '--apply', id);

    assert.equal(result.status, 3, `${name}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /init\.plan_changed/);
    assert.doesNotMatch(result.stdout, /Summary:/);
    assert.equal(git(root, 'status', '--porcelain'), status);
    assert.equal(read(root, 'docs/agents/issue-tracker.md'), tracker);
    assert.equal(existsSync(join(root, '.binnacle')), false);
    assert.equal(existsSync(home.binnacleHome), false);
    assert.ok(claude().every((call) => call.join(' ') === 'plugin list --json'), JSON.stringify(claude()));
  }
});

test('--apply with a made-up id, or with another --window than the plan had, writes nothing', async (t) => {
  const home = makeHome(t);
  const claude = fakeClaude(home);
  const root = makeRepository(t, 'refused');
  const { id } = await planJson(t, home, root, '--window', '7');

  for (const args of [['--apply', '0'.repeat(64), '--window', '7'], ['--apply', id], ['--apply', id, '--window', 'all']]) {
    const result = binnIn(home, false)(root, '', 'init', ...args);
    assert.equal(result.status, 3, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stderr, /init\.plan_changed/);
  }
  assert.equal(git(root, 'status', '--porcelain'), '');
  assert.ok(claude().every((call) => call.join(' ') === 'plugin list --json'), JSON.stringify(claude()));
});

test('binn init refuses --apply with --plan, or without an id, as usage errors', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'misapplied');
  for (const args of [['--apply'], ['--apply', ' '], ['--apply', 'x', '--plan', '--json']]) {
    const result = binnIn(home)(root, '', 'init', ...args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.stdout}`);
  }
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('binn --help names --apply for binn init', () => {
  const { stdout } = spawnSync(process.execPath, [BINN, '--help'], { encoding: 'utf8' });
  assert.match(stdout, /binn init --apply <id> \[--window <days\|all>\] \[--language <en\|ru>\] \[--autostart <yes\|no>\] \[--skip-harness <id>\]\.\.\. \[path\]/);
});

/** The `binnacle-<action>` skills of the package's copy for the `skills` CLI, built by its prepare script. */
const COPY = join(PACKAGE, 'skills');
const BINNACLE_SKILLS = readdirSync(COPY).sort();
const SKILLS_ADD = ['skills', 'add', COPY, '-g', '-y', '--json'];
/** What the step asks once an add exits non-zero: the skills at user scope, and the harnesses each is in. */
const SKILLS_LIST = ['skills', 'list', '-g', '--json'];
const removal = (skills: string[], skipped: string[]): string[] => ['skills', 'remove', '-g', '-a', 'claude-code', ...skipped, '-s', ...skills, '-y'];
const skillsRemove = (...skipped: string[]): string[] => removal(BINNACLE_SKILLS, skipped);
/** Matt Pocock Skills and Ponytail, from their repositories: each removal names the skills the fake `npx`'s add reports as JSON. */
const MATT_POCOCK_ADD = ['skills', 'add', 'mattpocock/skills', '-g', '-y', '--json'];
const PONYTAIL_ADD = ['skills', 'add', 'DietrichGebert/ponytail', '-g', '-y', '--json'];
const mattPocockRemove = (...skipped: string[]): string[] => removal(['grill-with-docs', 'tdd'], skipped);
const ponytailRemove = (...skipped: string[]): string[] => removal(['ponytail', 'ponytail-audit'], skipped);
/** What the plan shows for a repository's removal: its skills are known once its add has run. */
const shownRemoval = (...skipped: string[]): string => `npx ${['skills', 'remove', '-g', '-a', 'claude-code', ...skipped].join(' ')} -s <each skill the add installed> -y`;
/** Every set's add and removal, in order: Binnacle's, Matt Pocock Skills, Ponytail. */
const allSkills = (...skipped: string[]): string[][] => [
  SKILLS_ADD,
  skillsRemove(...skipped),
  MATT_POCOCK_ADD,
  mattPocockRemove(...skipped),
  PONYTAIL_ADD,
  ponytailRemove(...skipped),
];

/**
 * A fake `npx` first on PATH, recording each call as fakeClaude does. `skills add` prints, as
 * the `skills` CLI does with `--json`, the line naming the harnesses it detected on stderr and
 * the skills it installed as JSON on stdout; `failing` names the subcommand that fails, with
 * output of its own. With `one-harness`, every add exits non-zero and reports each skill failed
 * for PromptScript, which its line names among the others, as `skills` 1.7.1 did on 2026-10-08,
 * while `skills list` shows each installed into Codex, Antigravity and Claude Code; with
 * `every-harness`, the same add installed nothing, and `skills list` shows none of them.
 */
function fakeNpx(home: Home, failing?: 'add' | 'remove' | 'one-harness' | 'every-harness'): () => string[][] {
  const calls = join(home.home, 'npx-calls');
  const sets = [['grill-with-docs', 'tdd'], ['ponytail', 'ponytail-audit'], BINNACLE_SKILLS];
  const partial = failing === 'one-harness' || failing === 'every-harness';
  // A skill it failed to install, such as one of the human's own by that name, is never removed.
  const reported = (names: string[]): string =>
    JSON.stringify(
      partial
        ? names.map((name) => ({ name, status: 'failed', error: 'PromptScript does not support global skill installation' }))
        : [...names.map((name) => ({ name, status: 'installed', agents: ['codex', 'claude-code'] })), { name: 'wizard', status: 'failed', error: 'exists' }],
    );
  // The human's own `wizard` is in Claude Code too: no add names it, so no removal does.
  const listed = JSON.stringify(
    failing === 'one-harness' ? [...sets.flat(), 'wizard'].map((name) => ({ name, scope: 'global', agents: ['Codex', 'Antigravity', 'Claude Code'] })) : [],
  );
  writeFileSync(
    join(home.bin, 'npx'),
    `#!/bin/sh
for arg in "$@"; do printf '%s\\t' "$arg"; done >> '${calls}'
echo >> '${calls}'
if [ "$2" = "${failing ?? ''}" ]; then echo "skills $2 broke: no network"; exit 1; fi
if [ "$2" = "list" ]; then printf '%s\\n' '${listed}'; exit 0; fi
if [ "$2" = "add" ]; then
  printf '\\033[2m│\\033[0m\\n●  Installing to: \\033[36mCodex\\033[0m, \\033[36mAntigravity\\033[0m, \\033[36mClaude Code\\033[0m${partial ? ', \\033[36mPromptScript\\033[0m' : ''}\\n' >&2
  case "$3" in
    mattpocock/skills) echo 'npm warn exec installing skills' >&2; printf '%s\\n' '${reported(sets[0]!)}' ;;
    DietrichGebert/ponytail) printf '%s\\n' '${reported(sets[1]!)}' ;;
    *) printf '%s\\n' '${reported(sets[2]!)}' ;;
  esac
  ${partial ? 'exit 1' : ''}
fi
exit 0
`,
    { mode: 0o755 },
  );
  return () =>
    existsSync(calls)
      ? readFileSync(calls, 'utf8').trimEnd().split('\n').map((line) => line.replace(/\t$/, '').split('\t'))
      : [];
}

test('the skills: with a harness detected, the plan adds each skill set to every harness and then removes it from Claude Code, after a yes', (t) => {
  const home = makeHome(t);
  fakeClaude(home, ['binnacle@binnacle', ...SKILL_PLUGINS]);
  installExecutable(home, 'codex');
  const npx = fakeNpx(home);
  const root = makeRepository(t, 'skills-everywhere');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.ok(BINNACLE_SKILLS.length > 0 && BINNACLE_SKILLS.every((name) => name.startsWith('binnacle-')), BINNACLE_SKILLS.join(' '));
  assert.deepEqual(npx(), allSkills());
  const plan = result.stdout.slice(0, result.stdout.indexOf(PLAN_QUESTION));
  for (const args of [SKILLS_ADD, skillsRemove(), MATT_POCOCK_ADD, PONYTAIL_ADD]) assert.ok(plan.includes(`npx ${args.join(' ')}`), `${args.join(' ')}\n${result.stdout}`);
  assert.match(plan, /Install Matt Pocock Skills from mattpocock\/skills into every harness the skills CLI detects/);
  assert.match(plan, /Install Ponytail from DietrichGebert\/ponytail into every harness the skills CLI detects/);
  assert.ok(plan.includes(shownRemoval()), result.stdout);
  const summary = result.stdout.slice(result.stdout.indexOf('Summary:'));
  for (const args of allSkills()) assert.ok(summary.includes(`ran       npx ${args.join(' ')}`), `${args.join(' ')}\n${summary}`);
  // The harnesses the skills CLI named, Claude Code apart: it keeps the plugin.
  assert.match(summary, /Binnacle's skills are installed into Codex and Antigravity: run `binnacle-product` there\./);
  assert.match(summary, /Run `binnacle-product` in Codex/);
});

test('the skills: every --skip-harness is added to each removal, in the plan and in the call', (t) => {
  const home = makeHome(t);
  installExecutable(home, 'codex');
  const npx = fakeNpx(home);
  const root = makeRepository(t, 'skills-skipped');

  const result = binnIn(home)(root, '\n\n\n', 'init', '--skip-harness', 'cursor', '--skip-harness', 'pi');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(npx(), allSkills('cursor', 'pi'));
  assert.ok(result.stdout.includes(`npx ${skillsRemove('cursor', 'pi').join(' ')}`), result.stdout);
  assert.ok(result.stdout.includes(shownRemoval('cursor', 'pi')), result.stdout);
  assert.match(result.stdout, /remove them from Claude Code, which has the binnacle plugin, and from cursor and pi, by running:/);
  assert.match(result.stdout, /remove them from Claude Code, which has its plugin, and from cursor and pi, by running:/);
  assert.match(result.stdout, /Binnacle's skills are installed into Codex and Antigravity, then removed from cursor and pi: run `binnacle-product` there\./);
});

test('the skills: a skill set the manifest declares false is not planned', (t) => {
  for (const [capability, left, kept] of [
    ['ponytail', PONYTAIL_ADD, MATT_POCOCK_ADD],
    ['matt_pocock_skills', MATT_POCOCK_ADD, PONYTAIL_ADD],
  ] as const) {
    const home = makeHome(t);
    installExecutable(home, 'codex');
    const npx = fakeNpx(home);
    const root = makeRepository(t, `skills-${capability}-false`, { '.binnacle/project.yaml': `version: 1\nproject:\n  id: x\ncapabilities:\n  ${capability}: false\n` });

    const result = binnIn(home)(root, '\n\n\n', 'init');

    assert.equal(result.status, 0, result.stderr);
    const calls = npx().map((call) => call.join(' '));
    assert.ok(!calls.includes(left.join(' ')) && calls.includes(kept.join(' ')), calls.join('\n'));
    assert.equal(calls.length, 4, calls.join('\n'));
    assert.ok(!result.stdout.includes(`skills add ${left[2]!}`), result.stdout);
  }
});

test('the skills: a declined plan, and a stdin that is not a terminal, run no npx', (t) => {
  for (const [input, terminal] of [['\n\nn\n', true], ['\n', false]] as const) {
    const home = makeHome(t);
    installExecutable(home, 'codex');
    const npx = fakeNpx(home);
    const root = makeRepository(t, `skills-declined-${terminal}`);

    const result = binnIn(home, terminal)(root, input, 'init');

    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`npx ${SKILLS_ADD.join(' ')}`), result.stdout);
    assert.deepEqual(npx(), []);
    assert.match(result.stdout, /declined\s+install Binnacle's skills/);
    assert.match(result.stdout, /declined\s+install Matt Pocock Skills into every harness/);
    assert.match(result.stdout, /declined\s+install Ponytail into every harness/);
  }
});

test('the skills: with no harness detected the step is skipped for every set, and says why', (t) => {
  const home = makeHome(t);
  const npx = fakeNpx(home);
  const root = makeRepository(t, 'skills-nowhere');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(npx(), []);
  assert.doesNotMatch(result.stdout, /npx skills (add|remove) /);
  for (const what of ["Binnacle's skills", 'Matt Pocock Skills', 'Ponytail']) assert.match(result.stdout, new RegExp(`skipped\\s+${what}: no harness is detected`));
  assert.match(result.stdout, /would install into every harness it knows/);
});

test('the skills: without npx on PATH the commands are printed for every set, and nothing runs', (t) => {
  const home = makeHome(t);
  installExecutable(home, 'codex');
  const root = makeRepository(t, 'skills-printed');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const question = result.stdout.indexOf(PLAN_QUESTION);
  for (const shown of [SKILLS_ADD, skillsRemove(), MATT_POCOCK_ADD, PONYTAIL_ADD].map((args) => `npx ${args.join(' ')}`).concat(shownRemoval())) {
    assert.ok(result.stdout.slice(0, question).includes(`  ${shown}`), `${shown}\n${result.stdout}`);
  }
  assert.doesNotMatch(result.stdout.slice(result.stdout.indexOf('The plan.'), question), /npx skills/);
  for (const what of ["Binnacle's skills", 'Matt Pocock Skills', 'Ponytail']) assert.match(result.stdout, new RegExp(`printed\\s+${what}: \`npx\` is not on PATH`));
});

test('the skills: a failed call is reported with its output, and the rest of the plan goes on', (t) => {
  for (const failing of ['add', 'remove'] as const) {
    const home = makeHome(t);
    installExecutable(home, 'codex');
    const npx = fakeNpx(home, failing);
    const root = makeRepository(t, `skills-${failing}-fails`);

    const result = binnIn(home)(root, '\n\n\n', 'init');

    assert.equal(result.status, 0, result.stderr);
    // A repository's failed add names no skills to remove; Binnacle's removal names the copy's own.
    assert.deepEqual(npx(), failing === 'add' ? [SKILLS_ADD, skillsRemove(), MATT_POCOCK_ADD, PONYTAIL_ADD] : allSkills());
    assert.ok(result.stdout.includes(`skills ${failing} broke: no network`), result.stdout);
    const summary = result.stdout.slice(result.stdout.indexOf('Summary:'));
    for (const args of failing === 'add' ? [SKILLS_ADD, MATT_POCOCK_ADD, PONYTAIL_ADD] : [skillsRemove(), mattPocockRemove(), ponytailRemove()]) {
      assert.ok(summary.includes(`failed    npx ${args.join(' ')}`), `${args.join(' ')}\n${summary}`);
    }
    if (failing === 'add') {
      assert.match(summary, /ran\s+npx skills remove /);
      for (const what of ['Matt Pocock Skills', 'Ponytail']) assert.match(summary, new RegExp(`skipped\\s+removing ${what} from Claude Code: its add failed`));
    } else assert.match(summary, /ran\s+npx skills add /);
    // The rest of the plan is written.
    assert.ok(existsSync(join(root, '.codex/config.toml')));
  }
});

test('the skills: an add that fails for one harness and installs elsewhere is read by what it installed: each set leaves Claude Code, and the Summary names the harness and why', (t) => {
  const home = makeHome(t);
  installExecutable(home, 'codex');
  const npx = fakeNpx(home, 'one-harness');
  const root = makeRepository(t, 'skills-one-harness-fails');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  // The removal names the skills the add reported that Claude Code now has, and not the human's own `wizard`.
  assert.deepEqual(npx(), [SKILLS_ADD, SKILLS_LIST, skillsRemove(), MATT_POCOCK_ADD, SKILLS_LIST, mattPocockRemove(), PONYTAIL_ADD, SKILLS_LIST, ponytailRemove()]);
  const summary = result.stdout.slice(result.stdout.indexOf('Summary:'));
  for (const args of allSkills()) assert.ok(summary.includes(`ran       npx ${args.join(' ')}`), `${args.join(' ')}\n${summary}`);
  for (const what of ["Binnacle's skills", 'Matt Pocock Skills', 'Ponytail']) {
    assert.ok(summary.includes(`failed    ${what} for a harness: PromptScript does not support global skill installation`), `${what}\n${summary}`);
  }
  assert.doesNotMatch(summary, /failed\s+npx skills add/);
  assert.match(summary, /Binnacle's skills are installed into Codex and Antigravity: run `binnacle-product` there\./);
});

test('the skills: an add that installed nothing is still recorded as failed, and no repository set is removed', (t) => {
  const home = makeHome(t);
  installExecutable(home, 'codex');
  const npx = fakeNpx(home, 'every-harness');
  const root = makeRepository(t, 'skills-every-harness-fails');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  // Binnacle's removal names the copy's own, and still runs, as after any failed add.
  assert.deepEqual(npx(), [SKILLS_ADD, SKILLS_LIST, skillsRemove(), MATT_POCOCK_ADD, SKILLS_LIST, PONYTAIL_ADD, SKILLS_LIST]);
  const summary = result.stdout.slice(result.stdout.indexOf('Summary:'));
  for (const args of [SKILLS_ADD, MATT_POCOCK_ADD, PONYTAIL_ADD]) assert.ok(summary.includes(`failed    npx ${args.join(' ')}`), `${args.join(' ')}\n${summary}`);
  for (const what of ['Matt Pocock Skills', 'Ponytail']) assert.match(summary, new RegExp(`skipped\\s+removing ${what} from Claude Code: its add failed`));
  assert.doesNotMatch(summary, /for a harness:/);
  assert.match(result.stdout, /PromptScript does not support global skill installation/);
  assert.doesNotMatch(summary, /Binnacle's skills are installed into/);
});

test('the skills: --plan --json shows the same commands, --skip-harness changes its id, and --apply runs them', async (t) => {
  const home = makeHome(t);
  installExecutable(home, 'codex');
  const npx = fakeNpx(home);
  const root = makeRepository(t, 'skills-applied');

  const json = await planJson(t, home, root, '--skip-harness', 'cursor');
  const body = (start: string): string | undefined => json.plan.find(({ heading }) => heading.startsWith(start))?.body;
  assert.equal(body("Install Binnacle's skills"), `  npx ${SKILLS_ADD.join(' ')}\n  npx ${skillsRemove('cursor').join(' ')}`);
  assert.equal(body('Install Matt Pocock Skills from'), `  npx ${MATT_POCOCK_ADD.join(' ')}\n  ${shownRemoval('cursor')}`);
  assert.equal(body('Install Ponytail from'), `  npx ${PONYTAIL_ADD.join(' ')}\n  ${shownRemoval('cursor')}`);
  assert.deepEqual(npx(), []);
  assert.notEqual((await planJson(t, home, root)).id, json.id);
  assert.notEqual((await planJson(t, home, root, '--skip-harness', 'pi')).id, json.id);

  const refused = binnIn(home, false)(root, '', 'init', '--apply', json.id);
  assert.equal(refused.status, 3, refused.stdout);
  assert.deepEqual(npx(), []);

  const result = binnIn(home, false)(root, '', 'init', '--apply', json.id, '--skip-harness', 'cursor');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(npx(), allSkills('cursor'));
});

/** The package's copy installed in `home`'s `~/.agents/skills`, as the `skills` CLI keeps it, with `binnacle-product` at `productVersion` when given. */
function installCopy(home: Home, productVersion?: string): void {
  const installed = join(home.home, '.agents', 'skills');
  cpSync(COPY, installed, { recursive: true });
  if (productVersion === undefined) return;
  const file = join(installed, 'binnacle-product', 'SKILL.md');
  writeFileSync(file, readFileSync(file, 'utf8').replace(/^(\s+version: )".*"$/m, `$1"${productVersion}"`));
}

test('the skills: a current set in ~/.agents/skills is installed again, as a stale one is, so that a harness installed since gets it, and the step says it was current', (t) => {
  const home = makeHome(t);
  installExecutable(home, 'codex');
  installCopy(home);
  const npx = fakeNpx(home);
  const root = makeRepository(t, 'skills-current');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(npx(), allSkills());
  const beforeQuestion = result.stdout.slice(0, result.stdout.indexOf(PLAN_QUESTION));
  assert.match(beforeQuestion, /Binnacle's skills in ~\/\.agents\/skills are current/);
  // The plan carries the add and removal, and its body is the only place the add is shown: no commands are printed in its place.
  const plan = beforeQuestion.slice(beforeQuestion.indexOf('The plan.'));
  assert.ok(plan.includes(`npx ${SKILLS_ADD.join(' ')}\n  npx ${skillsRemove().join(' ')}`), plan);
  assert.equal(beforeQuestion.indexOf(`npx ${SKILLS_ADD.join(' ')}\n`), beforeQuestion.lastIndexOf(`npx ${SKILLS_ADD.join(' ')}\n`), beforeQuestion);
  const summary = result.stdout.slice(result.stdout.indexOf('Summary:'));
  assert.match(summary, /found\s+Binnacle's skills: current/);
  assert.match(summary, /Binnacle's skills are installed into Codex/);
});

test('the skills: a stale set in ~/.agents/skills is reinstalled, and the plan says why', (t) => {
  const home = makeHome(t);
  installExecutable(home, 'codex');
  installCopy(home, 'old0000');
  const npx = fakeNpx(home);
  const root = makeRepository(t, 'skills-stale');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout.slice(0, result.stdout.indexOf(PLAN_QUESTION)), /Binnacle's skills in ~\/\.agents\/skills are stale: binnacle-product \(version old0000\)/);
  assert.deepEqual(npx(), allSkills());
});

test('binn init refuses an empty --skip-harness as a usage error, and --help names it', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'skip-misused');
  for (const args of [['--skip-harness'], ['--skip-harness', ' ']]) {
    const result = binnIn(home)(root, '', 'init', ...args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.stdout}`);
  }
  const { stdout } = spawnSync(process.execPath, [BINN, '--help'], { encoding: 'utf8' });
  assert.match(stdout, /--skip-harness <id>/);
});

/** The address the export points at in these tests: no daemon runs, so the one it would bind, at a fixed port. */
const OTEL = 'http://127.0.0.1:7717';
const CLAUDE_ENV = { CLAUDE_CODE_ENABLE_TELEMETRY: '1', OTEL_LOGS_EXPORTER: 'otlp', OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json', OTEL_EXPORTER_OTLP_ENDPOINT: OTEL };
const CODEX_OTEL = `[otel]\nexporter = { otlp-http = { endpoint = "${OTEL}/v1/logs", protocol = "json" } }\nlog_user_prompt = false\n`;
const GEMINI_TELEMETRY = { enabled: true, target: 'local', otlpEndpoint: OTEL, otlpProtocol: 'http', logPrompts: false };

/** A home where Claude Code, Codex and Gemini CLI are installed by their user directories, Claude Code's and Codex's settings already holding something of the owner's. */
function exportingHome(t: TestContext): Home {
  const home = makeHome(t);
  home.env = { BINNACLE_PORT: '7717' };
  installUserDirectory(home, '.gemini');
  installUserDirectory(home, '.codex');
  installUserDirectory(home, '.claude');
  writeFileSync(join(home.home, '.claude', 'settings.json'), JSON.stringify({ theme: 'dark', env: { FOO: 'bar' } }));
  writeFileSync(join(home.home, '.codex', 'config.toml'), 'model = "o3"');
  return home;
}

const userFile = (home: Home, relative: string): string | null => (existsSync(join(home.home, relative)) ? readFileSync(join(home.home, relative), 'utf8') : null);

test('the telemetry export: each supporting harness is pointed at the daemon after the one yes, keeping its settings, and is left alone at the next run', (t) => {
  const home = exportingHome(t);
  const root = makeRepository(t, 'export-written');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  // Each change is shown before the one question.
  const beforeQuestion = result.stdout.slice(0, result.stdout.indexOf(PLAN_QUESTION));
  for (const name of ['Claude Code', 'Codex', 'Gemini CLI']) assert.match(beforeQuestion, new RegExp(`Export ${name}'s OpenTelemetry to the Binnacle daemon at ${OTEL}, JSON over HTTP, prompts not logged`));
  assert.match(beforeQuestion, /OTEL_EXPORTER_OTLP_PROTOCOL/);
  assert.deepEqual(JSON.parse(userFile(home, '.claude/settings.json')!), { theme: 'dark', env: { FOO: 'bar', ...CLAUDE_ENV } });
  assert.equal(userFile(home, '.codex/config.toml'), `model = "o3"\n${CODEX_OTEL}`);
  assert.deepEqual(JSON.parse(userFile(home, '.gemini/settings.json')!), { telemetry: GEMINI_TELEMETRY });
  assert.match(result.stdout, /updated\s+~\/\.claude\/settings\.json/);
  assert.match(result.stdout, /updated\s+~\/\.codex\/config\.toml/);
  assert.match(result.stdout, /created\s+~\/\.gemini\/settings\.json/);

  const again = binnIn(home)(root, '\n', 'init');
  assert.equal(again.status, 0, again.stderr);
  for (const name of ['Claude Code', 'Codex', 'Gemini CLI']) assert.match(again.stdout, new RegExp(`skipped\\s+${name}'s OpenTelemetry export: it already exports to Binnacle`));
  assert.doesNotMatch(again.stdout, /Export .*'s OpenTelemetry/);
});

test('the telemetry export: a declined plan writes no harness settings', (t) => {
  const home = exportingHome(t);
  const root = makeRepository(t, 'export-declined');

  const result = binnIn(home)(root, '\n\nn\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(userFile(home, '.claude/settings.json'), JSON.stringify({ theme: 'dark', env: { FOO: 'bar' } }));
  assert.equal(userFile(home, '.codex/config.toml'), 'model = "o3"');
  assert.equal(userFile(home, '.gemini/settings.json'), null);
  assert.match(result.stdout, /declined\s+configure Gemini CLI's OpenTelemetry export/);
});

test('the telemetry export: --plan --json carries the same changes, and --apply writes them', async (t) => {
  const home = exportingHome(t);
  const root = makeRepository(t, 'export-applied');

  const json = await planJson(t, home, root);
  const item = (name: string) => json.plan.find(({ heading }) => heading.startsWith(`Export ${name}'s OpenTelemetry`));
  assert.equal(item('Claude Code')?.body, `${JSON.stringify({ env: CLAUDE_ENV }, null, 2)}\n`);
  assert.equal(item('Codex')?.body, CODEX_OTEL);
  assert.equal(item('Gemini CLI')?.body, `${JSON.stringify({ telemetry: GEMINI_TELEMETRY }, null, 2)}\n`);
  assert.equal(userFile(home, '.gemini/settings.json'), null);

  const result = binnIn(home, false)(root, '', 'init', '--apply', json.id);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(userFile(home, '.codex/config.toml'), `model = "o3"\n${CODEX_OTEL}`);
  assert.deepEqual(JSON.parse(userFile(home, '.gemini/settings.json')!), { telemetry: GEMINI_TELEMETRY });
});

test('the telemetry export: an export already configured elsewhere is left alone and named, an unreadable file gets the change printed, and a harness without export is named with its reason', (t) => {
  const home = makeHome(t);
  home.env = { BINNACLE_PORT: '7717' };
  installUserDirectory(home, '.claude');
  installUserDirectory(home, '.codex');
  installUserDirectory(home, '.gemini');
  installExecutable(home, 'opencode');
  installUserDirectory(home, '.zcode');
  installExecutable(home, 'antigravity');
  installUserDirectory(home, '.pi');
  const files = {
    '.claude/settings.json': JSON.stringify({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318' } }),
    '.codex/config.toml': '[otel]\nexporter = "none"\n',
    '.gemini/settings.json': '{ // mine\n  "telemetry": { "enabled": true }\n}\n',
  };
  for (const [relative, text] of Object.entries(files)) writeFileSync(join(home.home, relative), text);
  const root = makeRepository(t, 'export-elsewhere');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  for (const [relative, text] of Object.entries(files)) assert.equal(userFile(home, relative), text);
  assert.match(result.stdout, /skipped\s+Claude Code's OpenTelemetry export: ~\/\.claude\/settings\.json already has settings of its own \(its env sets OTEL_EXPORTER_OTLP_ENDPOINT\)/);
  assert.match(result.stdout, /skipped\s+Codex's OpenTelemetry export: ~\/\.codex\/config\.toml already has settings of its own \(it has an \[otel\] table\)/);
  assert.match(result.stdout, /printed\s+Gemini CLI's OpenTelemetry export for ~\/\.gemini\/settings\.json/);
  assert.match(result.stdout, /"otlpEndpoint": "http:\/\/127\.0\.0\.1:7717"/);
  assert.match(result.stdout, /skipped\s+opencode's OpenTelemetry export: opencode documents no OpenTelemetry export/);
  assert.match(result.stdout, /skipped\s+ZCode's OpenTelemetry export: ZCode documents no OpenTelemetry export/);
  assert.match(result.stdout, /skipped\s+Antigravity's OpenTelemetry export: Antigravity has no OpenTelemetry export/);
  assert.match(result.stdout, /skipped\s+pi's OpenTelemetry export: pi has no built-in OpenTelemetry export/);
});

test('the telemetry export: with no daemon running and BINNACLE_PORT 0, there is no address, and nothing is planned for it', (t) => {
  const home = makeHome(t);
  installUserDirectory(home, '.gemini');
  const root = makeRepository(t, 'export-no-address');

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(userFile(home, '.gemini/settings.json'), null);
  assert.match(result.stdout, /skipped\s+Gemini CLI's OpenTelemetry export: the daemon's address is not known/);
});

/** The autostart question, asked after the window and before the plan (ADR-0043). */
const AUTOSTART_QUESTION = 'Start the daemon at login? [Y/n]';
const summaryOf = (stdout: string): string => stdout.slice(stdout.indexOf('Summary:'));

/** A fake `systemctl` on PATH and Linux as the platform, so that init can offer autostart: its calls, and where the unit goes. */
function fakeSystemd(home: Home): { unit: string; calls(): string[] } {
  const log = join(home.home, 'systemctl.log');
  const state = join(home.home, 'systemctl-state');
  const unit = join(home.home, '.config', 'systemd', 'user', 'binnacle.service');
  mkdirSync(state);
  writeFileSync(join(home.bin, 'systemctl'), fakeSystemctl(log, state, unit), { mode: 0o755 });
  home.env = { ...home.env, BINNACLE_SERVICE_PLATFORM: 'linux' };
  return {
    unit,
    calls: () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []),
  };
}

test('autostart: asked after the window and before the plan, Enter means yes, and its plan item, last, turns it on', (t) => {
  const home = makeHome(t);
  const systemd = fakeSystemd(home);
  const root = makeRepository(t, 'autostarted');

  const result = binnIn(home)(root, '\n\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const asked = result.stdout.indexOf(AUTOSTART_QUESTION);
  assert.ok(result.stdout.indexOf('Import window') < asked && asked < result.stdout.indexOf('The plan. '), result.stdout);
  assert.match(shownHeadings(result.stdout).at(-1)!, /Start the Binnacle daemon at login/);
  assert.match(readFileSync(systemd.unit, 'utf8'), new RegExp(`BINNACLE_HOME=${home.binnacleHome}`));
  assert.deepEqual(systemd.calls().slice(-3), ['--user daemon-reload', '--user enable binnacle', '--user restart binnacle']);
  assert.match(summaryOf(result.stdout), /ran\s+binn daemon autostart on/);
});

test('autostart: turned on with a tracker token only in this shell, the Summary warns the service will not see it, and the token is never shown or copied', (t) => {
  const home = makeHome(t);
  fakeSystemd(home);
  const token = 'github_pat_only-in-this-shell';
  home.env = { ...home.env, BINNACLE_GITHUB_TOKEN: token };
  const root = makeRepository(t, 'autostarted-with-token');

  const result = binnIn(home)(root, '\n\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const summary = summaryOf(result.stdout);
  assert.match(summary, /ran\s+binn daemon autostart on\n\s+warned\s+BINNACLE_GITHUB_TOKEN is set in this shell, but the daemon the service manager starts does not see it/);
  assert.ok(summary.includes(`${join(home.binnacleHome, 'credentials.json')} has no token for "github.com"`), summary);
  assert.doesNotMatch(result.stderr, /BINNACLE_GITHUB_TOKEN/);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(token));
  for (const dir of [home.home, root]) {
    const holding = readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name))
      .filter((path) => readFileSync(path, 'latin1').includes(token));
    assert.deepEqual(holding, []);
  }
});

test('autostart: no installs nothing and the Summary names the command; a later run offers it again', (t) => {
  const home = makeHome(t);
  const systemd = fakeSystemd(home);
  const root = makeRepository(t, 'declined-autostart');

  const result = binnIn(home)(root, '\n\nn\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(AUTOSTART_QUESTION), result.stdout);
  assert.ok(!shownHeadings(result.stdout).some((heading) => /daemon at login/.test(heading)), result.stdout);
  assert.equal(existsSync(systemd.unit), false);
  assert.deepEqual(systemd.calls(), ['--user show-environment']);
  assert.match(summaryOf(result.stdout), /skipped\s+autostart: .*`binn daemon autostart on`/);

  const again = binnIn(home)(root, '\n\nn\n', 'init');
  assert.equal(again.status, 0, again.stderr);
  assert.ok(again.stdout.includes(AUTOSTART_QUESTION), again.stdout);
});

test('autostart: without a terminal, and in the forms that ask nothing, nothing is installed and the command is named', async (t) => {
  const home = makeHome(t);
  const systemd = fakeSystemd(home);
  const root = makeRepository(t, 'unattended-autostart');

  const piped = binnIn(home, false)(root, '\n\n\n\n', 'init');
  assert.equal(piped.status, 0, piped.stderr);
  assert.doesNotMatch(piped.stdout, /Start the daemon at login/);
  assert.match(summaryOf(piped.stdout), /skipped\s+autostart: .*`binn daemon autostart on`/);

  const { id, plan, notes } = await planJson(t, home, root);
  assert.ok(!plan.some(({ heading }) => /daemon at login/.test(heading)), JSON.stringify(plan, null, 2));
  assert.ok(notes.some((note) => note.includes('binn daemon autostart on')), notes.join('\n---\n'));
  const applied = binnIn(home, false)(root, '', 'init', '--apply', id);
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(summaryOf(applied.stdout), /skipped\s+autostart: .*`binn daemon autostart on`/);

  assert.equal(existsSync(systemd.unit), false);
  assert.ok(systemd.calls().every((call) => call === '--user show-environment'), systemd.calls().join('\n'));
});

test('autostart: already on, nothing is asked', (t) => {
  const home = makeHome(t);
  const systemd = fakeSystemd(home);
  const root = makeRepository(t, 'already-autostarted');
  const on = spawnSync(process.execPath, [BINN, 'daemon', 'autostart', 'on'], { encoding: 'utf8', env: envFor(home) });
  assert.equal(on.status, 0, on.stderr);
  const before = systemd.calls().length;

  const result = binnIn(home)(root, '\n\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Start the daemon at login/);
  assert.match(summaryOf(result.stdout), /skipped\s+autostart: it is on/);
  assert.equal(systemd.calls().length, before);
});

test('autostart: broken, or not available here, nothing is asked and the Summary says why', async (t) => {
  await t.test('a broken service names its repair', (t) => {
    const home = makeHome(t);
    const systemd = fakeSystemd(home);
    const root = makeRepository(t, 'broken-autostart');
    assert.equal(spawnSync(process.execPath, [BINN, 'daemon', 'autostart', 'on'], { encoding: 'utf8', env: envFor(home) }).status, 0);
    writeFileSync(systemd.unit, readFileSync(systemd.unit, 'utf8').replace(`"${process.execPath}"`, '"/nowhere/node"'));

    const result = binnIn(home)(root, '\n\n\n', 'init');
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /Start the daemon at login/);
    assert.match(summaryOf(result.stdout), /skipped\s+autostart: broken, `binn daemon autostart on` repairs it/);
  });

  await t.test('no systemd user manager', (t) => {
    const home = makeHome(t);
    const root = makeRepository(t, 'no-systemd');
    home.env = { BINNACLE_SERVICE_PLATFORM: 'linux' };

    const result = binnIn(home)(root, '\n\n\n', 'init');
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /Start the daemon at login/);
    assert.match(summaryOf(result.stdout), /skipped\s+autostart: not available here, no systemd user manager answers \(systemctl was not found on PATH\)/);
  });

  await t.test('no Task Scheduler on Windows', (t) => {
    const home = makeHome(t);
    const root = makeRepository(t, 'no-schtasks');
    home.env = { BINNACLE_SERVICE_PLATFORM: 'win32' };

    const result = binnIn(home)(root, '\n\n\n', 'init');
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /Start the daemon at login/);
    assert.match(summaryOf(result.stdout), /skipped\s+autostart: not available here, Task Scheduler does not answer \(schtasks was not found on PATH\)/);
  });
});

test('autostart: once init turned it on, a tracker token from this shell is pointed at the credentials file', async (t) => {
  const home = makeHome(t);
  fakeSystemd(home);
  const gitlab = await trackerStandIn(t, 200, []);
  const root = makeRepository(t, 'remote', {
    '.binnacle/project.yaml': remoteManifest('gitlab', 'group/project', gitlab.base),
    [TRACKER_FILE]: '# Issue tracker: GitLab\n',
  });

  const { stdout } = await binnInit(home, root, '\n\n\ny\n', { BINNACLE_GITLAB_TOKEN: 'glpat-from-the-shell' });

  assert.match(stdout, /ran\s+binn daemon autostart on/);
  assert.match(stdout, /This check used BINNACLE_GITLAB_TOKEN from this shell\. The daemon starts through the service manager, which does not carry it, so use the credentials file/);
});

test("autostart: the Summary's token warning looks for the project's own tracker host in the credentials file, registered or not", async (t) => {
  for (const [entry, warned] of [['gitlab.com', true], ['own', false]] as const) {
    const home = makeHome(t);
    fakeSystemd(home);
    const gitlab = await trackerStandIn(t, 200, []);
    const root = makeRepository(t, `own-host-${entry}`, {
      '.binnacle/project.yaml': remoteManifest('gitlab', 'group/project', gitlab.base),
      [TRACKER_FILE]: '# Issue tracker: GitLab\n',
    });
    mkdirSync(home.binnacleHome, { recursive: true });
    writeFileSync(join(home.binnacleHome, 'credentials.json'), JSON.stringify({ [entry === 'own' ? gitlab.base : entry]: 'glpat-in-the-file' }), { mode: 0o600 });

    const { stdout } = await binnInit(home, root, '\n\n\ny\n', { BINNACLE_GITLAB_TOKEN: 'glpat-from-the-shell' });

    const summary = summaryOf(stdout);
    assert.match(summary, /ran\s+binn daemon autostart on/);
    if (warned) assert.ok(summary.includes(`has no token for ${JSON.stringify(gitlab.base)}`), summary);
    else assert.doesNotMatch(summary, /warned/);
  }
});

test('autostart from the chat: --plan --json says it could be asked only while it is off and available', async (t) => {
  const home = makeHome(t);
  fakeSystemd(home);
  const root = makeRepository(t, 'askable');
  assert.deepEqual((await planJson(t, home, root)).autostart, { ask: true });
  // An answer given does not change whether it could be asked.
  assert.deepEqual((await planJson(t, home, root, '--autostart', 'no')).autostart, { ask: true });

  assert.equal(spawnSync(process.execPath, [BINN, 'daemon', 'autostart', 'on'], { encoding: 'utf8', env: envFor(home) }).status, 0);
  assert.deepEqual((await planJson(t, home, root, '--autostart', 'yes')).autostart, { ask: false });

  const elsewhere = makeHome(t);
  elsewhere.env = { BINNACLE_SERVICE_PLATFORM: 'linux' };
  const unavailable = await planJson(t, elsewhere, root, '--autostart', 'yes');
  assert.deepEqual(unavailable.autostart, { ask: false });
  assert.ok(!unavailable.plan.some(({ heading }) => /daemon at login/.test(heading)), JSON.stringify(unavailable.plan, null, 2));
});

test('autostart from the chat: --autostart yes makes it the last item of --plan, and --apply with it turns it on', async (t) => {
  const home = makeHome(t);
  const systemd = fakeSystemd(home);
  const root = makeRepository(t, 'chat-yes');

  const yes = await planJson(t, home, root, '--autostart', 'yes');
  const none = await planJson(t, home, root);
  assert.match(yes.plan.at(-1)!.heading, /Start the Binnacle daemon at login/);
  assert.equal(yes.plan.at(-1)!.body, '  binn daemon autostart on');
  assert.notEqual(yes.id, none.id);
  assert.equal(existsSync(systemd.unit), false);

  // Without the same answer, the plan is not the one confirmed.
  const other = binnIn(home, false)(root, '', 'init', '--apply', yes.id);
  assert.equal(other.status, 3, other.stdout);
  assert.equal(existsSync(systemd.unit), false);

  const applied = binnIn(home, false)(root, '', 'init', '--apply', yes.id, '--autostart', 'yes');
  assert.equal(applied.status, 0, applied.stderr);
  assert.doesNotMatch(applied.stdout, /Start the daemon at login\?/);
  assert.match(readFileSync(systemd.unit, 'utf8'), new RegExp(`BINNACLE_HOME=${home.binnacleHome}`));
  assert.deepEqual(systemd.calls().slice(-3), ['--user daemon-reload', '--user enable binnacle', '--user restart binnacle']);
  assert.match(summaryOf(applied.stdout), /ran\s+binn daemon autostart on/);
});

test('autostart from the chat: --autostart no installs nothing and the Summary names the command', async (t) => {
  const home = makeHome(t);
  const systemd = fakeSystemd(home);
  const root = makeRepository(t, 'chat-no');

  const { id, plan, notes } = await planJson(t, home, root, '--autostart', 'no');
  assert.ok(!plan.some(({ heading }) => /daemon at login/.test(heading)), JSON.stringify(plan, null, 2));
  assert.ok(notes.some((note) => note.includes('binn daemon autostart on')), notes.join('\n---\n'));
  const applied = binnIn(home, false)(root, '', 'init', '--apply', id, '--autostart', 'no');
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(summaryOf(applied.stdout), /skipped\s+autostart: declined, `binn daemon autostart on` turns it on later/);

  // At a terminal, the flag answers the question unasked.
  const asked = binnIn(home)(makeRepository(t, 'terminal-no'), '\n', 'init', '--window', '7', '--autostart', 'no');
  assert.equal(asked.status, 0, asked.stderr);
  assert.doesNotMatch(asked.stdout, /Start the daemon at login\?/);
  assert.match(summaryOf(asked.stdout), /skipped\s+autostart: declined/);

  assert.equal(existsSync(systemd.unit), false);
  assert.ok(systemd.calls().every((call) => call === '--user show-environment'), systemd.calls().join('\n'));
});

test('binn init refuses an --autostart other than yes or no as a usage error', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'misused-autostart');
  for (const args of [['--autostart', 'maybe'], ['--autostart', ''], ['--autostart']]) {
    const result = binnIn(home)(root, '', 'init', ...args);
    assert.equal(result.status, 2, `${args.join(' ')}\n${result.stdout}`);
  }
  assert.equal(git(root, 'status', '--porcelain'), '');
});
