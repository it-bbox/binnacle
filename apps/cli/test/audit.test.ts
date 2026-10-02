import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    assert.match(finding.code, /^[a-z]+\.[a-z_]+$/);
    assert.equal(finding.area, 'git-and-tracker');
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

test('binn audit gives the same output with the network unreachable as with a proxy-free environment', (t) => {
  const root = fixture(t, 'https://github.com/owner/name.git');
  const home = scratch(t);
  const plain = spawnSync(process.execPath, [BINN, 'audit', '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...baseEnv, HOME: home, BINNACLE_HOME: join(home, '.binnacle') },
  });
  assert.equal(plain.stdout, audit(t, ['--json'], {}, root).stdout);
});
