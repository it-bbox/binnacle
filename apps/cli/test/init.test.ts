import assert from 'node:assert/strict';
import { execFile, spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test, type TestContext } from 'node:test';
import { isAlive, readManifest, readRuntime } from '@binnacle/daemon';

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

type Home = { home: string; binnacleHome: string; bin: string };

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

  const result = binnIn(home)(join(root, 'src'), '\n\n', 'init');

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

  const result = binnIn(home)(root, '\n\n', 'init', root);

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

  const result = binnIn(home)(root, '\nyes\n', 'init');

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
  // The default window, then a no to the plan; stdin is never ended.
  child.stdin.write('\nn\n');

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
  const result = binnIn(home)(root, '\n\n', 'init');

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
  assert.equal(git(root, 'status', '--porcelain'), '?? .binnacle/\n?? .codex/\n?? .mcp.json\n?? docs/\n');
  assert.equal(commits(root), before);
});

test('n declines the whole plan: nothing is written and nothing runs', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home);
  const root = makeRepository(t, 'declined-plan', { 'docs/agents/issue-tracker.md': '# Issue tracker\n' });

  const result = binnIn(home)(root, '\nn\n', 'init');

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
  const result = binnIn(home, false)(root, '\n\ny\ny\n', 'init');

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
    const result = binn(root, '\nn\n', 'init');
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('Register the project with the running Binnacle daemon'), result.stdout);
    assert.match(result.stdout, /declined\s+project registration/);
    assert.equal(existsSync(join(root, '.binnacle')), false);
    assert.equal(git(root, 'status', '--porcelain'), '');
    assert.match(binn(root, '', 'project', 'list').stdout, /No projects/);
  });

  await t.test('confirming writes the manifest, then registers the project through project.register', () => {
    const before = commits(root);
    const result = binn(root, '\n\n', 'init');
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

test('the plugin: Claude Code adds the package as a marketplace and installs binnacle from it, at user scope, in that order', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home);
  const root = makeRepository(t, 'plugged');

  // The window, then Enter for the plan, which holds the manifest, `.mcp.json` and the plugin.
  const result = binnIn(home)(root, '\n\n', 'init');

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
  assert.equal(git(root, 'status', '--porcelain'), '?? .binnacle/\n?? .mcp.json\n');
});

test('the plugin: a failed marketplace add is reported, and the install is not attempted', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home, [], 1);
  const root = makeRepository(t, 'unplugged');

  const result = binnIn(home)(root, '\n\n', 'init');

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

  const result = binnIn(home)(root, '\n\n', 'init');

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

  const result = binnIn(home)(root, '\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls(), []);
  assert.match(result.stdout, /skipped\s+the binnacle plugin: the project provides its own, at \.claude\/skills\/binnacle/);
});

test('the plugin: a declined plan runs nothing but the listing', (t) => {
  const home = makeHome(t);
  const calls = fakeClaude(home);
  const root = makeRepository(t, 'declined');

  const result = binnIn(home)(root, '\nn\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls(), [['plugin', 'list', '--json']]);
  assert.match(result.stdout, /declined\s+the binnacle plugin/);
});

test('the plugin: without Claude Code detected nothing is offered and nothing runs', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'no-claude');

  const result = binnIn(home)(root, '\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Install the binnacle plugin/);
  assert.match(result.stdout, /skipped\s+the binnacle plugin: Claude Code is not detected/);
});

test('the plugin: Claude Code detected by ~/.claude alone, with no claude to run, is skipped and reported', (t) => {
  const home = makeHome(t);
  installUserDirectory(home, '.claude');
  const root = makeRepository(t, 'no-cli');

  // The plugin is never in the plan.
  const result = binnIn(home)(root, '\n\n', 'init');

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
  const first = binnIn(home)(root, '\n\n', 'init');
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

test('without the Matt Pocock layout, init points at /setup-matt-pocock-skills and runs nothing', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'plain');

  const result = binnIn(home)(root, '\nn\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\/setup-matt-pocock-skills/);
  assert.match(result.stdout, /skipped\s+ticket-header section: no Matt Pocock layout/);
  assert.equal(existsSync(join(root, 'docs')), false);
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('a CLAUDE.md importing AGENTS.md is one instruction set; without the import there are two; neither is written', (t) => {
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

  const { stdout } = await binnInit(home, root, '\ny\n');

  assert.match(stdout, /Reading octo-org\/octo-repo\.\.\.\n.*octo-org\/octo-repo is readable/);
  assert.match(stdout, /checked\s+tracker: readable/);
  assert.deepEqual([...new Set(github.requests.map((url) => url.split('?')[0]))], ['/repos/octo-org/octo-repo/issues']);
  const section = readFileSync(join(root, TRACKER_FILE), 'utf8');
  assert.match(section, /issue numbers/);
  assert.match(section, /#12/);
  assert.match(section, /[Cc]losing an issue outranks its `Status:`/);
  assert.match(section, /closed as not planned or as a duplicate is cancelled/);
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

  const { stdout, stderr } = await binnInit(home, root, '\ny\n', { BINNACLE_GITLAB_TOKEN: token });

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

test('Claude Code on PATH gets a new .mcp.json, and only the detected harness is offered', (t) => {
  const home = makeHome(t);
  fakeClaude(home);
  const root = makeRepository(t, 'harnessed');
  const before = commits(root);

  const result = binnIn(home)(root, '\n\n', 'init');

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
  assert.equal(commits(root), before);
});

test('an existing .mcp.json is left untouched and the entry is printed', (t) => {
  const home = makeHome(t);
  installUserDirectory(home, '.claude');
  const existing = '{\n  "mcpServers": {\n    "other": { "command": "other" }\n  }\n}\n';
  const root = makeRepository(t, 'configured', { '.mcp.json': existing });

  const result = binnIn(home)(root, '\n\n', 'init');

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

  const result = binnIn(home)(root, '\n\n', 'init');

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

  const result = binnIn(home)(root, '\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(root, '.mcp.json'), mcpJson);
  assert.equal(read(root, '.codex/config.toml'), codexToml);
  assert.match(result.stdout, /skipped\s+\.mcp\.json: it already names binnacle/);
  assert.match(result.stdout, /skipped\s+\.codex\/config\.toml: it already names binnacle/);
  assert.doesNotMatch(result.stdout, /Append to|Create \.mcp\.json/);
  assert.doesNotMatch(result.stdout.slice(0, result.stdout.indexOf('Summary:')), /trusted project/, 'the trust note goes with an entry offered, not a skip');
});

test('a Codex configuration naming binnacle as a key under [mcp_servers] is skipped, not given a duplicate', (t) => {
  const home = makeHome(t);
  installUserDirectory(home, '.codex');
  const codexToml = '[mcp_servers]\nbinnacle = { command = "binn", args = ["mcp"] }\n';
  const root = makeRepository(t, 'inline', { '.codex/config.toml': codexToml });

  const result = binnIn(home)(root, '\n\n', 'init');

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

  const result = binnIn(home)(root, '\n\n', 'init');

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

  const result = binnIn(home)(root, '\nn\n', 'init');

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
    ['\n\n', '90'],
    ['all\n\n', 'all'],
    ['soon\n30\n\n', '30'],
  ] as const) {
    const home = makeHome(t);
    const root = makeRepository(t, 'windowed');

    const { stdout } = await binnInit(home, root, input, artifactRoots(home).env);

    assert.match(stdout, /Claude Code: no sessions/);
    assert.match(stdout, /Codex: no sessions/);
    assert.ok(manifestOf(root).endsWith(`issues: docs/specs\n${windowSection(window)}`), manifestOf(root));
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
  const declined = await binnInit(home, declining, 'all\nn\n', artifactRoots(home).env);

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


test('the Summary suggests binn audit', (t) => {
  const home = makeHome(t);
  const root = makeRepository(t, 'audited');

  const result = binnIn(home)(root, '\nn\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout.slice(result.stdout.indexOf('Summary:')), /run `binn audit`/);
});

test('the Summary gives the next step for a detected harness other than Claude Code, with the prompt that follows the skill', (t) => {
  const home = makeHome(t);
  fakeClaude(home);
  installUserDirectory(home, '.codex');
  installExecutable(home, 'opencode');
  const root = makeRepository(t, 'moving');

  const result = binnIn(home)(root, '\nn\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  const summary = result.stdout.slice(result.stdout.indexOf('Summary:'));
  const skill = join(PACKAGE, 'plugin', 'skills', 'product', 'SKILL.md');
  assert.ok(existsSync(skill), 'the plugin is built into the package');
  const codex = summary.slice(summary.indexOf('To work from Codex'), summary.indexOf('To work from opencode'));
  assert.match(codex, /trusted project/);
  assert.match(codex, /not on PATH.*\/usr\/lib\/chatgpt\/resources\/codex/);
  assert.ok(codex.includes(`read the Binnacle product skill file at ${skill} and follow it`), summary);
  const opencode = summary.slice(summary.indexOf('To work from opencode'));
  assert.match(opencode, /Run `opencode`/);
  assert.ok(opencode.includes(`read the Binnacle product skill file at ${skill} and follow it`), summary);
  assert.doesNotMatch(opencode, /not on PATH/);
  assert.doesNotMatch(summary, /To work from Claude Code/);
});

test('a project that carries its own binnacle plugin has the agent read that skill file', (t) => {
  const home = makeHome(t);
  installExecutable(home, 'codex');
  const own = '.claude/skills/binnacle/skills/product/SKILL.md';
  const root = makeRepository(t, 'carrier', { [own]: '# product\n' });

  const result = binnIn(home)(root, '\nn\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(`product skill file at ${join(root, own)} and follow it`), result.stdout);
  assert.doesNotMatch(result.stdout, /`codex` is not on PATH/);
});

test('with only Claude Code detected the Summary has no next step for another harness', (t) => {
  const home = makeHome(t);
  fakeClaude(home);
  const root = makeRepository(t, 'claude-only');

  const result = binnIn(home)(root, '\nn\n', 'init');

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
const AST_GREP = ['i', '@ast-grep/cli', '-g'];

test('the tools: each missing one is in the plan with its exact command, installed after a yes, and declared by the new manifest', (t) => {
  const home = makeHome(t);
  const uv = fakeTool(home, 'uv');
  const npm = fakeTool(home, 'npm');
  const root = makeRepository(t, 'tooled');

  const result = binnIn(home)(root, '\n\n', 'init');

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
  // The installs write nothing into the repository.
  assert.equal(git(root, 'status', '--porcelain'), '?? .binnacle/\n');
});

test('the tools: one already on PATH is reported as found, nothing is installed for it, and the new manifest declares it', (t) => {
  const home = makeHome(t);
  const uv = fakeTool(home, 'uv');
  const npm = fakeTool(home, 'npm');
  for (const name of ['serena', 'graphify', 'ast-grep']) installExecutable(home, name);
  const root = makeRepository(t, 'found');

  const result = binnIn(home)(root, '\n\n', 'init');

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

  const result = binnIn(home)(root, '\n\n', 'init');

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

  const result = binnIn(home)(root, '\n\n', 'init');

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

  const result = binnIn(home)(root, '\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(npm(), [AST_GREP]);
  assert.doesNotMatch(result.stdout, /found\s+ast-grep/);
});

test('the tools: a failed install is reported in the Summary, and the rest of the plan still runs', (t) => {
  const home = makeHome(t);
  const uv = fakeTool(home, 'uv', 1);
  const npm = fakeTool(home, 'npm');
  const root = makeRepository(t, 'failing');

  const result = binnIn(home)(root, '\n\n', 'init');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /failed\s+uv tool install -p 3\.13 serena-agent/);
  assert.match(result.stdout, /failed\s+uv tool install graphifyy/);
  assert.match(result.stdout, /ran\s+npm i @ast-grep\/cli -g/);
  assert.deepEqual(uv(), [SERENA, GRAPHIFY]);
  assert.deepEqual(npm(), [AST_GREP]);
});

test('the tools: a declined plan and a stdin that is not a terminal install nothing', (t) => {
  for (const [terminal, input] of [
    [true, '\nn\n'],
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
