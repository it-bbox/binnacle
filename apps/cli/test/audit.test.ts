import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';

const BINN = fileURLToPath(new URL('../src/bin.ts', import.meta.url));

/** The environment minus anything that points git at another repository or holds a tracker token. */
const baseEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_') && !/^BINNACLE_(GITHUB|GITLAB)_TOKEN$/.test(key)),
);

function git(cwd: string, ...args: string[]): void {
  const result = spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, encoding: 'utf8', env: baseEnv });
  assert.equal(result.status, 0, result.stderr);
}

/** A temporary directory, removed after the test. */
function scratch(t: TestContext): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-audit-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** A Git repository with one commit, and `remote` as its origin when given. */
function fixture(t: TestContext, remote?: string): string {
  const root = join(scratch(t), 'repo');
  mkdirSync(root);
  git(root, 'init', '--quiet', '--initial-branch=trunk');
  writeFileSync(join(root, 'README.md'), '# fixture\n');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'fixture');
  if (remote) git(root, 'remote', 'add', 'origin', remote);
  return root;
}

type Finding = { code: string; area: string; status: string; reason: string; recommendation?: string };

/** `binn audit` as a process, with `~` and the daemon's home in one empty directory and the network unreachable. */
function audit(t: TestContext, args: string[], env: Record<string, string> = {}, cwd?: string) {
  const home = scratch(t);
  return spawnSync(process.execPath, [BINN, 'audit', ...args], {
    cwd: cwd ?? home,
    encoding: 'utf8',
    env: {
      ...baseEnv,
      HOME: home,
      BINNACLE_HOME: join(home, '.binnacle'),
      // Away from this machine's own harness files, so that its sessions and tool settings are never shown.
      CLAUDE_CONFIG_DIR: join(home, 'claude-config'),
      CODEX_HOME: join(home, 'codex-home'),
      NODE_USE_ENV_PROXY: '1',
      HTTPS_PROXY: 'http://127.0.0.1:9',
      HTTP_PROXY: 'http://127.0.0.1:9',
      ...env,
    },
  });
}

const findings = (stdout: string): Finding[] => JSON.parse(stdout).findings;
const byCode = (all: Finding[], code: string): Finding => all.find((finding) => finding.code === code)!;

/** Every path under `dir` with its size, `.git` included. */
function listing(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? [`${prefix}${entry.name}/`, ...listing(join(dir, entry.name), `${prefix}${entry.name}/`)]
      : [`${prefix}${entry.name} ${statSync(join(dir, entry.name)).size}`],
  );
}

test('binn audit on a bare repository, with no daemon, registration or manifest, lists its findings in a stable order', (t) => {
  const root = fixture(t);
  const first = audit(t, ['--json'], {}, root);
  assert.equal(first.status, 0, first.stderr);
  const all = findings(first.stdout);
  assert.ok(all.length > 0);
  for (const finding of findings(first.stdout)) {
    assert.match(finding.code, /^[a-z]+\.[a-z0-9_]+$/);
    assert.ok(['git-and-tracker', 'docs', 'matt-pocock-layout', 'scratch', 'capabilities', 'instructions', 'structure', 'telemetry', 'docker'].includes(finding.area), finding.area);
    assert.ok(['ok', 'gap', 'unknown'].includes(finding.status));
    assert.ok(finding.reason);
    assert.equal(finding.recommendation !== undefined, finding.status !== 'ok', `${finding.code}: a recommendation for a gap or an unknown only`);
  }
  assert.equal(byCode(all, 'git.repository').status, 'ok');
  assert.match(byCode(all, 'git.repository').reason, /trunk/);
  assert.deepEqual(findings(audit(t, ['--json'], {}, root).stdout), all);
});

test('binn audit prints each finding with its code, area, status, reason and recommendation, and takes a path', (t) => {
  const root = fixture(t, 'git@github.com:owner/name.git');
  const result = audit(t, [root]);
  assert.equal(result.status, 0, result.stderr);
  for (const finding of findings(audit(t, [root, '--json']).stdout)) {
    assert.ok(result.stdout.includes(finding.code), finding.code);
    assert.ok(result.stdout.includes(finding.area));
    assert.ok(result.stdout.includes(finding.status));
    assert.ok(result.stdout.includes(finding.reason));
    if (finding.recommendation) assert.ok(result.stdout.includes(finding.recommendation));
  }
});

test('a repository with no remote is told that local tickets under docs/specs are a tracker Binnacle reads', (t) => {
  const provider = byCode(findings(audit(t, ['--json'], {}, fixture(t)).stdout), 'tracker.provider');
  assert.equal(provider.status, 'ok');
  assert.match(provider.reason, /docs\/specs\//);
});

test('the tracker provider is read from the remote, and the token is reported without its value, in either output', (t) => {
  const root = fixture(t, 'https://gitlab.example.com/group/project.git');
  const none = findings(audit(t, ['--json'], {}, root).stdout);
  assert.equal(byCode(none, 'tracker.provider').status, 'ok');
  assert.match(byCode(none, 'tracker.provider').reason, /gitlab/);
  assert.equal(byCode(none, 'tracker.token').status, 'gap');

  const SECRET = 'glpat-SECRETVALUE123';
  for (const args of [[], ['--json']]) {
    const result = audit(t, args, { BINNACLE_GITLAB_TOKEN: SECRET }, root);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!result.stdout.includes(SECRET) && !result.stderr.includes(SECRET));
  }
  const present = findings(audit(t, ['--json'], { BINNACLE_GITLAB_TOKEN: SECRET }, root).stdout);
  assert.equal(byCode(present, 'tracker.token').status, 'ok');
  assert.equal(byCode(present, 'tracker.token_works').status, 'unknown');
});

test('a token in the credentials file counts, and is not printed', (t) => {
  const root = fixture(t, 'https://github.com/owner/name.git');
  const home = scratch(t);
  mkdirSync(join(home, '.binnacle'));
  writeFileSync(join(home, '.binnacle', 'credentials.json'), JSON.stringify({ 'github.com': 'ghp_FILESECRET' }), { mode: 0o600 });
  const result = spawnSync(process.execPath, [BINN, 'audit', '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...baseEnv, HOME: home, BINNACLE_HOME: join(home, '.binnacle') },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.stdout.includes('ghp_FILESECRET'));
  assert.equal(byCode(findings(result.stdout), 'tracker.token').status, 'ok');
});

test('the exit code is 0 with gaps, and non-zero with a reason for a missing path and for a directory outside Git', (t) => {
  const gaps = audit(t, ['--json'], {}, fixture(t, 'https://github.com/owner/name.git'));
  assert.ok(findings(gaps.stdout).some((finding) => finding.status === 'gap'));
  assert.equal(gaps.status, 0);

  const missing = audit(t, [join(scratch(t), 'nowhere')]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /nowhere/);

  const outside = audit(t, [scratch(t)]);
  assert.notEqual(outside.status, 0);
  assert.match(outside.stderr, /Git repository/);
});

test('binn audit writes nothing, in the repository or in the home it is pointed at', (t) => {
  const root = fixture(t, 'https://github.com/owner/name.git');
  const home = scratch(t);
  const before = [listing(root), listing(home)];
  const result = spawnSync(process.execPath, [BINN, 'audit'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...baseEnv, HOME: home, BINNACLE_HOME: join(home, '.binnacle') },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual([listing(root), listing(home)], before);
  assert.equal(readFileSync(join(root, 'README.md'), 'utf8'), '# fixture\n');
});

test('binn audit names a detached HEAD, and audits the repository containing a subdirectory path, with --json before the path', (t) => {
  const root = fixture(t);
  git(root, 'checkout', '--quiet', '--detach');
  mkdirSync(join(root, 'sub'));
  const result = audit(t, ['--json', join(root, 'sub')]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).root, root);
  assert.match(byCode(findings(result.stdout), 'git.repository').reason, /detached HEAD/);
});

test('binn audit gives the same output with the network unreachable as with a proxy-free environment', (t) => {
  const root = fixture(t, 'https://github.com/owner/name.git');
  const home = scratch(t);
  const plain = spawnSync(process.execPath, [BINN, 'audit', '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...baseEnv, HOME: home, BINNACLE_HOME: join(home, '.binnacle'), CLAUDE_CONFIG_DIR: join(home, 'claude-config'), CODEX_HOME: join(home, 'codex-home') },
  });
  assert.equal(plain.stdout, audit(t, ['--json'], {}, root).stdout);
});

/** Writes `files` (path to text) into the fixture, creating directories. */
function write(root: string, files: Record<string, string>): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

const finding = (root: string, t: TestContext, code: string): Finding => byCode(findings(audit(t, ['--json'], {}, root).stdout), code);

test('binn audit: a repository with a context file and ADRs but no ticket-header convention gets a gap that names binn init', (t) => {
  const root = fixture(t);
  write(root, { 'CONTEXT.md': '# c\n', 'docs/adr/ADR-0001-x.md': '# x\n' });
  assert.equal(finding(root, t, 'docs.context').status, 'ok');
  assert.equal(finding(root, t, 'docs.adr').status, 'ok');
  const gap = finding(root, t, 'layout.ticket_header');
  assert.equal(gap.status, 'gap');
  assert.match(gap.recommendation!, /binn init/);
  assert.equal(finding(fixture(t), t, 'docs.context').status, 'gap');
});

test('binn audit: a partial Matt Pocock layout names what is missing, and a complete one is ok', (t) => {
  const root = fixture(t);
  const none = finding(root, t, 'layout.files');
  assert.match(none.reason, /No Matt Pocock layout/);
  // binn init writes the convention files itself, so the setup is never a step.
  for (const { recommendation } of [none, finding(root, t, 'layout.ticket_header')]) {
    assert.match(recommendation!, /binn init/);
    assert.doesNotMatch(recommendation!, /setup-matt-pocock-skills/);
  }
  write(root, { 'docs/agents/issue-tracker.md': '# t\n\n## Ticket header\n\nx\n', 'docs/agents/domain.md': '# d\n' });
  const partial = finding(root, t, 'layout.files');
  assert.equal(partial.status, 'gap');
  assert.match(partial.recommendation!, /binn init/);
  assert.doesNotMatch(partial.recommendation!, /setup-matt-pocock-skills/);
  assert.match(partial.reason, /Missing: docs\/agents\/triage-labels\.md, docs\/specs\/<slug>\//);
  assert.doesNotMatch(partial.reason, /Missing:.*issue-tracker/);
  assert.equal(finding(root, t, 'layout.ticket_header').status, 'ok');
  write(root, { 'docs/agents/triage-labels.md': '# l\n', 'docs/specs/one/spec.md': '# s\n' });
  assert.equal(finding(root, t, 'layout.files').status, 'ok');
});

test('binn audit: a CLAUDE.md holding @AGENTS.md is one instruction set; two files that do not import each other get a recommendation', (t) => {
  const root = fixture(t);
  assert.equal(finding(root, t, 'instructions.sets').status, 'gap');
  assert.match(finding(root, t, 'instructions.sets').reason, /No AGENTS\.md or CLAUDE\.md/);
  write(root, { 'AGENTS.md': '# a\n', 'CLAUDE.md': '@AGENTS.md\n' });
  const one = finding(root, t, 'instructions.sets');
  assert.equal(one.status, 'ok');
  assert.equal(one.recommendation, undefined);
  write(root, { 'CLAUDE.md': '# own rules\n' });
  const two = finding(root, t, 'instructions.sets');
  assert.equal(two.status, 'gap');
  assert.match(two.recommendation!, /canonical/);
});

test('a repository without .binnacle/project.yaml gets a gap that recommends binn init, and one with it an ok', (t) => {
  const root = fixture(t);
  const without = byCode(findings(audit(t, ['--json'], {}, root).stdout), 'binnacle.manifest');
  assert.equal(without.status, 'gap');
  assert.match(without.recommendation!, /binn init/);

  mkdirSync(join(root, '.binnacle'));
  writeFileSync(join(root, '.binnacle', 'project.yaml'), 'name: fixture\n');
  assert.equal(byCode(findings(audit(t, ['--json'], {}, root).stdout), 'binnacle.manifest').status, 'ok');
});

test('binn audit: a repository with no .scratch gets an ok and nothing more', (t) => {
  const scratchFindings = findings(audit(t, ['--json'], {}, fixture(t)).stdout).filter((f) => f.area === 'scratch');
  assert.deepEqual(scratchFindings.map((f) => [f.code, f.status]), [['scratch.exists', 'ok']]);
});

test('binn audit: a .scratch that Git does not ignore is a gap, and an ignored one is not', (t) => {
  const root = fixture(t);
  write(root, { '.scratch/notes.txt': 'x\n' });
  const open = finding(root, t, 'scratch.ignored');
  assert.equal(open.status, 'gap');
  assert.match(open.recommendation!, /\.gitignore/);
  write(root, { '.gitignore': '.scratch/\n' });
  assert.equal(finding(root, t, 'scratch.ignored').status, 'ok');
  assert.equal(finding(root, t, 'scratch.durable').status, 'ok');
});

test('binn audit: a .scratch holding the only copy of a spec or a ticket is a gap that says what to move into Git', (t) => {
  const root = fixture(t);
  write(root, { '.gitignore': '.scratch/\n', '.scratch/audit/spec.md': '# s\n', '.scratch/audit/issues/01-first.md': '# t\n', '.scratch/audit/run.log': 'x\n' });
  write(root, { 'docs/specs/audit/issues/01-first.md': '# t\n' });
  const gap = finding(root, t, 'scratch.durable');
  assert.equal(gap.status, 'gap');
  assert.match(gap.reason, /\.scratch\/audit\/spec\.md/);
  assert.doesNotMatch(gap.reason, /01-first|run\.log/);
  assert.match(gap.recommendation!, /docs\/specs\/<slug>\//);
  const words = fixture(t);
  write(words, { '.gitignore': '.scratch/\n', '.scratch/inspect-notes.md': 'x\n', '.scratch/respect.md': 'x\n' });
  assert.equal(finding(words, t, 'scratch.durable').status, 'ok');
});

test('binn audit: tests, CI and the shape of the project are read from files, and a bare repository has gaps', (t) => {
  const bare = fixture(t);
  assert.equal(finding(bare, t, 'structure.tests').status, 'gap');
  assert.equal(finding(bare, t, 'structure.ci').status, 'gap');
  assert.equal(finding(bare, t, 'structure.shape').status, 'unknown');

  const root = fixture(t);
  write(root, {
    'package.json': JSON.stringify({ scripts: { test: 'node --test' } }),
    'pnpm-workspace.yaml': 'packages:\n  - apps/*\n',
    '.github/workflows/ci.yml': 'name: ci\n',
  });
  assert.equal(finding(root, t, 'structure.tests').status, 'ok');
  assert.match(finding(root, t, 'structure.tests').reason, /package\.json/);
  assert.equal(finding(root, t, 'structure.ci').status, 'ok');
  assert.match(finding(root, t, 'structure.ci').reason, /\.github\/workflows\/ci\.yml/);
  assert.match(finding(root, t, 'structure.shape').reason, /workspace/);

  const single = fixture(t);
  write(single, { 'package.json': JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }), '.gitlab-ci.yml': 'x: 1\n', 'tests/a.test.ts': '' });
  assert.match(finding(single, t, 'structure.tests').reason, /tests\//);
  assert.match(finding(single, t, 'structure.ci').reason, /\.gitlab-ci\.yml/);
  assert.match(finding(single, t, 'structure.shape').reason, /single package/);
});

test('binn audit does not run what it finds: a test script and a CI file leave nothing behind', (t) => {
  const root = fixture(t);
  write(root, { 'package.json': JSON.stringify({ scripts: { test: 'touch RAN' } }), '.github/workflows/ci.yml': 'x\n' });
  assert.equal(audit(t, [], {}, root).status, 0);
  assert.ok(!listing(root).some((entry) => entry.startsWith('RAN')));
});

const TOOLS = ['serena', 'graphify', 'context7'];

/** `binn audit --json` in `root` with `home` as `~`, and the harnesses' roots in `home` too, where a test may have put files. */
function auditIn(root: string, home: string): Finding[] {
  const result = spawnSync(process.execPath, [BINN, 'audit', '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...baseEnv, HOME: home, BINNACLE_HOME: join(home, '.binnacle'), CLAUDE_CONFIG_DIR: join(home, 'claude-config'), CODEX_HOME: join(home, 'codex-home') },
  });
  assert.equal(result.status, 0, result.stderr);
  return findings(result.stdout);
}

test('a tool with no configuration anywhere is unknown, not a gap, and the finding names the files looked in', (t) => {
  const all = findings(audit(t, ['--json'], {}, fixture(t)).stdout);
  for (const tool of TOOLS) {
    const found = byCode(all, `capabilities.${tool}`);
    assert.equal(found.area, 'capabilities');
    assert.equal(found.status, 'unknown');
    for (const file of ['.binnacle/project.yaml', '.mcp.json', '.codex/config.toml', '.claude.json']) assert.ok(found.reason.includes(file), `${tool}: ${file}`);
    assert.ok(found.recommendation);
  }
});

test('a tool configured in the repository is ok, from .mcp.json, .codex/config.toml or .serena', (t) => {
  const root = fixture(t);
  write(root, {
    '.mcp.json': JSON.stringify({ mcpServers: { context7: { command: 'npx' } } }),
    '.codex/config.toml': '[mcp_servers.graphify]\ncommand = "graphify"\n',
    '.serena/project.yml': 'project_name: x\n',
    // Names that only look like a tool's are not that tool.
    'opencode.jsonc': '{ "theme": "context7-dark", "mcp": { "my-context7-fork": {} } }',
  });
  const all = auditIn(root, scratch(t));
  for (const tool of TOOLS) assert.equal(byCode(all, `capabilities.${tool}`).status, 'ok', tool);
  assert.doesNotMatch(byCode(all, 'capabilities.context7').reason, /opencode/);
  assert.match(byCode(all, 'capabilities.context7').reason, /\.mcp\.json/);
  assert.match(byCode(all, 'capabilities.graphify').reason, /\.codex\/config\.toml/);
});

test("a tool registered in VS Code's .vscode/mcp.json is ok", (t) => {
  const root = fixture(t);
  write(root, { '.vscode/mcp.json': JSON.stringify({ servers: { serena: { command: 'serena' } } }) });
  assert.match(byCode(auditIn(root, scratch(t)), 'capabilities.serena').reason, /found in \.vscode\/mcp\.json/);
});

test('a tool configured in the user-scope files of Claude Code or Codex is ok', (t) => {
  const root = fixture(t);
  const home = scratch(t);
  write(home, {
    'claude-config/.claude.json': JSON.stringify({ mcpServers: { serena: {} } }),
    'codex-home/config.toml': '[mcp_servers.context7]\ncommand = "x"\n',
  });
  const all = auditIn(root, home);
  assert.equal(byCode(all, 'capabilities.serena').status, 'ok');
  assert.equal(byCode(all, 'capabilities.context7').status, 'ok');
  assert.equal(byCode(all, 'capabilities.graphify').status, 'unknown');
});

test('a capability declared in .binnacle/project.yaml is the declaration, whatever the other files say', (t) => {
  const root = fixture(t);
  write(root, {
    '.binnacle/project.yaml': 'version: 1\nproject:\n  id: fixture\ntracker:\n  provider: local\ncapabilities:\n  serena: true\n  graphify: false\n  context7: optional\n',
    '.mcp.json': JSON.stringify({ mcpServers: { graphify: {} } }),
  });
  const all = auditIn(root, scratch(t));
  assert.equal(byCode(all, 'capabilities.serena').status, 'ok');
  assert.match(byCode(all, 'capabilities.serena').reason, /declares/);
  assert.equal(byCode(all, 'capabilities.graphify').status, 'ok');
  assert.match(byCode(all, 'capabilities.graphify').reason, /not use/);
  assert.equal(byCode(all, 'capabilities.context7').status, 'ok');
  assert.match(byCode(all, 'capabilities.context7').reason, /optional/);
});

test('an unreadable configuration file does not fail the audit', (t) => {
  const root = fixture(t);
  write(root, { '.mcp.json': '{not json', '.codex/config.toml': '\u0000' });
  assert.equal(byCode(auditIn(root, scratch(t)), 'capabilities.serena').status, 'unknown');
});

/** The package's `binnacle-<action>` copy for the `skills` CLI, built by its prepare script, and the version each skill carries. */
const COPY = fileURLToPath(new URL('../skills', import.meta.url));
const COPY_SKILLS = readdirSync(COPY).sort();
const COPY_VERSION = /^metadata:\n\s+version: "([^"]+)"/m.exec(readFileSync(join(COPY, COPY_SKILLS[0]!, 'SKILL.md'), 'utf8'))![1]!;

/** `skills` installed as the `skills` CLI keeps its canonical copies, under `~/.agents/skills`, each with `version` in its metadata. */
function installSkills(home: string, skills: string[], version: (skill: string) => string): void {
  write(home, Object.fromEntries(skills.map((skill) => [`.agents/skills/${skill}/SKILL.md`, `---\nname: ${skill}\ndescription: x\nmetadata:\n  version: "${version(skill)}"\n---\n\nText.\n`])));
}

test("Binnacle's skills installed at another version than the package's copy are one stale finding", (t) => {
  const home = scratch(t);
  installSkills(home, COPY_SKILLS, (skill) => (skill === 'binnacle-product' ? 'old0000' : COPY_VERSION));
  const stale = auditIn(fixture(t), home).filter(({ code }) => code === 'capabilities.binnacle_skills');
  assert.equal(stale.length, 1);
  assert.equal(stale[0]!.area, 'capabilities');
  assert.equal(stale[0]!.status, 'gap');
  assert.match(stale[0]!.reason, /binnacle-product/);
  assert.match(stale[0]!.reason, /~\/\.agents\/skills/);
  assert.match(stale[0]!.recommendation ?? '', /binn init/);
});

test("Binnacle's skills partly missing beside others are one stale finding naming the missing", (t) => {
  const home = scratch(t);
  installSkills(home, COPY_SKILLS.filter((skill) => skill !== 'binnacle-daily'), () => COPY_VERSION);
  const stale = auditIn(fixture(t), home).filter(({ code }) => code === 'capabilities.binnacle_skills');
  assert.equal(stale.length, 1);
  assert.equal(stale[0]!.status, 'gap');
  assert.match(stale[0]!.reason, /binnacle-daily/);
});

test("Binnacle's skills current, or not installed at all, are not reported", (t) => {
  const current = scratch(t);
  installSkills(current, COPY_SKILLS, () => COPY_VERSION);
  // A skill the package no longer has is not the package's to judge.
  installSkills(current, ['binnacle-retired'], () => 'old0000');
  for (const home of [current, scratch(t)]) assert.equal(auditIn(fixture(t), home).filter(({ code }) => code === 'capabilities.binnacle_skills').length, 0);
});

test('telemetry readiness on a machine with no session artifacts is unknown, never a gap, and names where it looked', (t) => {
  const all = findings(audit(t, ['--json'], {}, fixture(t)).stdout);
  for (const code of ['telemetry.claude_code', 'telemetry.codex']) {
    const found = byCode(all, code);
    assert.equal(found.area, 'telemetry');
    assert.equal(found.status, 'unknown');
    assert.match(found.reason, /No sessions/);
    assert.match(found.reason, /claude-config|codex-home/);
  }
});

test('telemetry readiness counts the sessions of this repository only, and shows no content', (t) => {
  const root = fixture(t);
  const home = scratch(t);
  const line = (cwd: string) => JSON.stringify({ type: 'user', cwd, timestamp: '2026-09-01T10:00:00.000Z', message: { content: 'SECRET PROMPT' } });
  const meta = (id: string, cwd: string) => JSON.stringify({ type: 'session_meta', timestamp: '2026-09-01T10:00:00.000Z', payload: { id, cwd } });
  const encode = (path: string) => path.replace(/[^a-zA-Z0-9]/g, '-');
  write(home, {
    [`claude-config/projects/${encode(root)}/a.jsonl`]: `${line(root)}\n`,
    [`claude-config/projects/${encode(root)}/b.jsonl`]: `${line(root)}\n`,
    [`claude-config/projects/${encode('/elsewhere')}/c.jsonl`]: `${line('/elsewhere')}\n`,
    'codex-home/sessions/2026/09/01/rollout-x.jsonl': `${meta('x', root)}\n`,
    'codex-home/sessions/2026/09/01/rollout-y.jsonl': `${meta('y', '/elsewhere')}\n`,
  });
  const all = auditIn(root, home);
  assert.equal(byCode(all, 'telemetry.claude_code').status, 'ok');
  assert.match(byCode(all, 'telemetry.claude_code').reason, /2 Claude Code sessions/);
  assert.equal(byCode(all, 'telemetry.codex').status, 'ok');
  assert.match(byCode(all, 'telemetry.codex').reason, /1 Codex session\b/);
  assert.ok(!JSON.stringify(all).includes('SECRET PROMPT'));
});

test('telemetry readiness says, per detected harness, whether it exports OpenTelemetry to Binnacle', (t) => {
  const root = fixture(t);
  const home = scratch(t);
  const address = 'http://127.0.0.1:7717';
  write(home, {
    // Installed by their user directories; settings where CLAUDE_CONFIG_DIR and CODEX_HOME point.
    '.claude/.keep': '',
    '.codex/.keep': '',
    '.gemini/settings.json': JSON.stringify({ telemetry: { enabled: true, target: 'local', otlpEndpoint: address, otlpProtocol: 'http', logPrompts: false } }),
    'claude-config/settings.json': JSON.stringify({ env: { OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318' } }),
    'xdg/opencode/.keep': '',
    '.zcode/.keep': '',
    '.pi/.keep': '',
  });
  // PATH holds git and no harness, so that each is detected by its user directory alone.
  const bin = join(home, 'bin');
  mkdirSync(bin);
  const git = (process.env.PATH ?? '').split(delimiter).map((dir) => join(dir, 'git')).find(existsSync)!;
  symlinkSync(git, join(bin, 'git'));
  const run = (env: Record<string, string>) => {
    const result = spawnSync(process.execPath, [BINN, 'audit', '--json'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...baseEnv, PATH: bin, HOME: home, BINNACLE_HOME: join(home, '.binnacle'), CLAUDE_CONFIG_DIR: join(home, 'claude-config'), CODEX_HOME: join(home, 'codex-home'), XDG_CONFIG_HOME: join(home, 'xdg'), ...env },
    });
    assert.equal(result.status, 0, result.stderr);
    return findings(result.stdout);
  };
  const all = run({ BINNACLE_PORT: '7717' });
  assert.equal(byCode(all, 'telemetry.export_gemini_cli').status, 'ok');
  assert.match(byCode(all, 'telemetry.export_gemini_cli').reason, /exports OpenTelemetry to Binnacle at http:\/\/127\.0\.0\.1:7717/);
  assert.equal(byCode(all, 'telemetry.export_claude_code').status, 'gap');
  assert.match(byCode(all, 'telemetry.export_claude_code').reason, /settings of its own/);
  assert.match(byCode(all, 'telemetry.export_claude_code').recommendation!, /leaves OpenTelemetry settings of a harness's own alone/);
  assert.equal(byCode(all, 'telemetry.export_codex').status, 'gap');
  assert.match(byCode(all, 'telemetry.export_codex').recommendation!, /Run binn init/);
  assert.equal(byCode(all, 'telemetry.export_opencode').status, 'ok');
  assert.match(byCode(all, 'telemetry.export_opencode').reason, /documents no OpenTelemetry export/);
  assert.equal(byCode(all, 'telemetry.export_zcode').status, 'ok');
  assert.match(byCode(all, 'telemetry.export_zcode').reason, /ZCode documents no OpenTelemetry export/);
  assert.equal(byCode(all, 'telemetry.export_pi').status, 'ok');
  assert.match(byCode(all, 'telemetry.export_pi').reason, /pi has no built-in OpenTelemetry export/);
  assert.ok(all.filter(({ code }) => code.startsWith('telemetry.export_')).every(({ area }) => area === 'telemetry'));

  // Port 0 and no daemon: there is no address to compare with.
  assert.equal(byCode(run({ BINNACLE_PORT: '0' }), 'telemetry.export_gemini_cli').status, 'unknown');
});

/** The roadmap's format, as Binnacle reads it: the epic table and a current focus ending with a Next action. */
const ROADMAP = '# Roadmap\n\n| # | Epic | Status | Spec |\n| --- | --- | --- | --- |\n\n## Current focus\n\nNext action: plan. `/grill-with-docs`\n';

test('binn audit: a missing roadmap is a gap that names binn init, and one in the format is ok', (t) => {
  const root = fixture(t);
  const missing = finding(root, t, 'docs.roadmap');
  assert.equal(missing.status, 'gap');
  assert.equal(missing.area, 'docs');
  assert.match(missing.reason, /docs\/roadmap\.md/);
  assert.match(missing.recommendation!, /binn init/);
  write(root, { 'docs/roadmap.md': ROADMAP });
  assert.equal(finding(root, t, 'docs.roadmap').status, 'ok');
});

test('binn audit: a roadmap not in the format is a gap naming what is missing, and the roadmap the manifest names is the one read', (t) => {
  const root = fixture(t);
  write(root, { 'docs/roadmap.md': '# Roadmap\n\n- ship it\n' });
  const bare = finding(root, t, 'docs.roadmap');
  assert.equal(bare.status, 'gap');
  assert.match(bare.reason, /not in Binnacle's format/);
  assert.match(bare.reason, /\| # \| Epic \| Status \| Spec \|/);
  assert.match(bare.reason, /## Current focus/);
  assert.match(bare.recommendation!, /never rewrites/);

  write(root, { 'docs/roadmap.md': '# Roadmap\n\n| # | Epic | Status | Spec |\n| --- | --- | --- | --- |\n\n## Current focus\n\nShip it.\n' });
  const noNext = finding(root, t, 'docs.roadmap');
  assert.equal(noNext.status, 'gap');
  assert.match(noNext.reason, /Next action:/);
  assert.doesNotMatch(noNext.reason, /Epic \| Status/);

  write(root, { '.binnacle/project.yaml': 'version: 1\nproject:\n  id: repo\nknowledge:\n  docs: handbook\n', 'handbook/roadmap.md': ROADMAP });
  const declared = finding(root, t, 'docs.roadmap');
  assert.equal(declared.status, 'ok');
  assert.match(declared.reason, /handbook\/roadmap\.md/);
});

test('binn audit: a manifest that declares no knowledge.docs is a roadmap gap, since Binnacle reads no roadmap', (t) => {
  const root = fixture(t);
  write(root, { '.binnacle/project.yaml': 'version: 1\nproject:\n  id: repo\n', 'docs/roadmap.md': ROADMAP });
  const gap = finding(root, t, 'docs.roadmap');
  assert.equal(gap.status, 'gap');
  assert.match(gap.reason, /knowledge\.docs/);

  // A manifest with problems declares nothing to trust: where the roadmap is is not known, even with docs/roadmap.md in the format.
  write(root, { '.binnacle/project.yaml': 'version: 1\nproject:\n  id: repo\ntracker:\n  provider: jira\n' });
  assert.equal(finding(root, t, 'docs.roadmap').status, 'unknown');
});

/** Writes `files` into the fixture and commits them, so that `git ls-files` lists them. */
function commit(root: string, files: Record<string, string>): void {
  write(root, files);
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'files');
}

/** Binnacle's places, none of which is a stranded document. */
const PLACES = {
  'CONTEXT.md': '# c\n',
  'AGENTS.md': '# a\n',
  'CHANGELOG.md': '# c\n',
  'LICENSE.txt': 'x\n',
  'docs/roadmap.md': ROADMAP,
  'docs/vision.md': '# v\n',
  'docs/product-inbox.md': '# i\n',
  'docs/specs/one/spec.md': '# s\n',
  'docs/specs/one/issues/01-plan.md': '# t\n',
  'docs/adr/ADR-0001-x.md': '# x\n',
  'docs/agents/issue-tracker.md': '# t\n',
  '.claude/skills/binnacle-roadmap/SKILL.md': '# s\n',
  'src/plan.ts': 'export {};\n',
};

test("binn audit: stranded documents outside Binnacle's places are listed, unknown, with /binnacle:roadmap, the same twice and nothing written", (t) => {
  const root = fixture(t);
  commit(root, { ...PLACES, 'TODO.md': '- x\n', 'plans/q3.md': '# q3\n', 'plans/q4.md': '# q4\n', 'auth/login-spec.md': '# s\n', 'doc/adr/0001-use-x.md': '# x\n', 'notes.txt': 'x\n', 'README-roadmap.md': '# r\n', 'src/.notes.md': '# n\n' });
  const before = listing(root);
  const first = audit(t, ['--json'], {}, root).stdout;
  assert.equal(audit(t, ['--json'], {}, root).stdout, first);
  assert.deepEqual(listing(root), before);

  const stranded = byCode(findings(first), 'docs.stranded');
  assert.equal(stranded.area, 'docs');
  assert.equal(stranded.status, 'unknown');
  for (const path of ['TODO.md', 'plans/', 'auth/login-spec.md', 'doc/adr/', 'notes.txt', 'README-roadmap.md', 'src/.notes.md']) assert.ok(stranded.reason.includes(path), path);
  for (const path of ['plans/q3.md', 'CONTEXT.md', 'CHANGELOG', 'LICENSE', 'docs/', 'SKILL.md', 'src/plan.ts']) assert.ok(!stranded.reason.includes(path), path);
  assert.match(stranded.recommendation!, /\/binnacle:roadmap/);

  // The places under knowledge.docs move with the manifest's declaration.
  commit(root, { '.binnacle/project.yaml': 'version: 1\nproject:\n  id: repo\nknowledge:\n  docs: handbook\n', 'handbook/roadmap.md': ROADMAP, 'handbook/specs/two/spec.md': '# s\n' });
  const moved = finding(root, t, 'docs.stranded').reason;
  assert.ok(moved.includes('docs/roadmap.md') && moved.includes('docs/specs/'), moved);
  assert.ok(!moved.includes('handbook'), moved);
});

test("binn audit: a repository with only Binnacle's places has no stranded document, and untracked or ignored files are never listed", (t) => {
  const root = fixture(t);
  commit(root, { ...PLACES, '.gitignore': 'notes/\n' });
  write(root, { 'TODO.md': '- x\n', 'notes/today.md': '# n\n' });
  const ok = finding(root, t, 'docs.stranded');
  assert.equal(ok.status, 'ok');
  assert.equal(ok.recommendation, undefined);
});

/** The docker findings, in order. */
const docker = (root: string, t: TestContext): Finding[] => findings(audit(t, ['--json'], {}, root).stdout).filter((finding) => finding.area === 'docker');

test('binn audit: no tracked container file is one ok, in the last area of the report', (t) => {
  const root = fixture(t);
  write(root, { Dockerfile: 'FROM scratch\n' });
  const all = findings(audit(t, ['--json'], {}, root).stdout);
  const found = all.filter((finding) => finding.area === 'docker');
  assert.equal(found.length, 1);
  assert.equal(found[0]!.code, 'docker.setup');
  assert.equal(found[0]!.status, 'ok');
  assert.match(found[0]!.reason, /no container setup/);
  assert.equal(all.at(-1)!.area, 'docker');
});

test('binn audit: a Dockerfile with no .dockerignore is a gap; one leaving .env in names .env; one excluding both is ok', (t) => {
  const root = fixture(t);
  commit(root, { Dockerfile: 'FROM scratch\n' });
  const [missing] = docker(root, t);
  assert.equal(missing!.code, 'docker.ignore');
  assert.equal(missing!.status, 'gap');
  assert.match(missing!.reason, /Dockerfile/);
  assert.match(missing!.reason, /no tracked \.dockerignore/);
  assert.match(missing!.recommendation!, /\.dockerignore/);

  commit(root, { '.dockerignore': '# build\nnode_modules\n.git\n' });
  const [env] = docker(root, t);
  assert.equal(env!.status, 'gap');
  assert.match(env!.reason, /does not exclude \.env\b/);
  assert.doesNotMatch(env!.reason, /\.git\b/);

  commit(root, { '.dockerignore': '.env\n' });
  const [git] = docker(root, t);
  assert.equal(git!.status, 'gap');
  assert.match(git!.reason, /does not exclude \.git\b/);

  for (const ignore of ['.env*\n**/.git\n', '/.env\n.git/\n', '*\n!src\n', '  .env  \n.git/**\n']) {
    commit(root, { '.dockerignore': ignore });
    const [ok] = docker(root, t);
    assert.equal(ok!.status, 'ok', ignore);
    assert.ok(ok!.reason.includes('Dockerfile') && ok!.reason.includes('.dockerignore'), ok!.reason);
    assert.equal(ok!.recommendation, undefined);
  }
  // A later exception lets .env back in.
  commit(root, { '.dockerignore': '.env*\n.git\n!.env\n' });
  assert.equal(docker(root, t)[0]!.status, 'gap');

  // A character class Docker would reject reads as literal text: the audit still runs.
  commit(root, { '.dockerignore': '[z-a]\n.env\n.git\n' });
  assert.equal(docker(root, t)[0]!.status, 'ok');
});

test("binn audit: a Dockerfile's own <Dockerfile>.dockerignore is read for it instead of the directory's, and is no container file itself", (t) => {
  const root = fixture(t);
  commit(root, { Dockerfile: 'FROM scratch\n', '.dockerignore': '.env\n.git\n', 'Dockerfile.dockerignore': '.git\n', 'Dockerfile.dev.dockerignore': '.env\n.git\n' });
  const found = docker(root, t);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.status, 'gap');
  assert.match(found[0]!.reason, /^Dockerfile: Dockerfile\.dockerignore does not exclude \.env\b/);
  commit(root, { 'Dockerfile.dockerignore': '.env\n.git\n' });
  assert.equal(docker(root, t)[0]!.status, 'ok');
});

test('binn audit: each build context is one finding, read against the .dockerignore beside it, and untracked container files are never read', (t) => {
  const root = fixture(t);
  commit(root, {
    '.dockerignore': '.env\n.git\n',
    'services/api/Dockerfile.dev': 'FROM scratch\n',
    'services/api/compose.yaml': 'services: {}\n',
    'services/web/web.Dockerfile': 'FROM scratch\n',
    'services/web/.dockerignore': '.env\n',
    'tools/Containerfile': 'FROM scratch\n',
    'tools/.dockerignore': '.env*\n.git\n',
    '.gitignore': 'ignored/\n',
  });
  write(root, { 'loose/Dockerfile': 'FROM scratch\n', 'ignored/docker-compose.yml': 'services: {}\n' });
  const found = docker(root, t);
  assert.equal(found.length, 3, JSON.stringify(found));
  const api = found.find((finding) => finding.reason.includes('services/api/'))!;
  assert.equal(api.status, 'gap');
  assert.ok(api.reason.includes('services/api/Dockerfile.dev') && api.reason.includes('services/api/compose.yaml'), api.reason);
  const web = found.find((finding) => finding.reason.includes('services/web/'))!;
  assert.equal(web.status, 'gap');
  assert.match(web.reason, /services\/web\/\.dockerignore does not exclude \.git\b/);
  assert.equal(found.find((finding) => finding.reason.includes('tools/'))!.status, 'ok');
  for (const finding of found) assert.ok(!finding.reason.includes('loose/') && !finding.reason.includes('ignored/'), finding.reason);
});

test("binn audit on this repository's own tree gives no gap in the docker, secrets and security areas", (t) => {
  const result = audit(t, ['--json', fileURLToPath(new URL('../../..', import.meta.url))]);
  assert.equal(result.status, 0, result.stderr);
  const all = findings(result.stdout);
  assert.ok(all.some((finding) => finding.area === 'docker'));
  assert.deepEqual(all.filter((finding) => ['docker', 'secrets', 'security'].includes(finding.area) && finding.status === 'gap'), []);
});
