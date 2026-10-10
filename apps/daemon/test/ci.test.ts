import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * The snapshot's `ci` section, read from a loopback stand-in for GitHub: the default branch's
 * latest commit with its CI state from its check runs and combined status, and the open pull
 * requests with their heads' states and the Tasks their branches map to.
 */
type State = { value: string; provenance: string };
type Ci =
  | { available: false; reason: string }
  | {
      forge: { provider: string; host: string; repository: string; from: string };
      defaultBranch: { branch: string; commit: string; state: State; url: string; at: string };
      requests: { items: { number: number; title: string; branch: string; taskId: string | null; draft: boolean; state: State; url: string }[]; remainder: number };
    };
type Snapshot = { ci: Ci; attention: { code: string; message: string }[] };

const REPOSITORY = 'octo-org/octo-repo';
const TOKEN = 'ghp_ci-secret-token';
delete process.env.BINNACLE_GITHUB_TOKEN;

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

type Check = { status: string; conclusion: string | null };
type Reply = { status: number; headers?: Record<string, string>; body: unknown };

/** GitHub's API for `REPOSITORY`: the repository, its commits' check runs and statuses, its open pull requests, and no issues. */
type FakeGitHub = {
  base: string;
  defaultBranch: string;
  head: string;
  checks: Record<string, Check[]>;
  statuses: Record<string, string[]>;
  pulls: { number: number; title: string; branch: string; sha: string; draft?: boolean }[];
  reply: ((url: URL) => Reply | null) | null;
  requests: URL[];
  authorizations: (string | undefined)[];
  close(): Promise<void>;
};

const MAIN_SHA = 'a'.repeat(40);

async function fakeGitHub(): Promise<FakeGitHub> {
  const fake: FakeGitHub = {
    base: '',
    defaultBranch: 'main',
    head: MAIN_SHA,
    checks: {},
    statuses: {},
    pulls: [],
    reply: null,
    requests: [],
    authorizations: [],
    close: async () => {},
  };
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', fake.base);
    fake.requests.push(url);
    fake.authorizations.push(request.headers.authorization);
    const reply = fake.reply?.(url) ?? route(fake, url);
    response.writeHead(reply.status, { 'content-type': 'application/json', ...reply.headers });
    response.end(JSON.stringify(reply.body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  fake.base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  fake.close = () => new Promise((resolve) => server.close(() => resolve()));
  return fake;
}

function route(fake: FakeGitHub, url: URL): Reply {
  const repo = `/repos/${REPOSITORY}`;
  const path = url.pathname;
  if (path === repo) return { status: 200, body: { full_name: REPOSITORY, default_branch: fake.defaultBranch } };
  if (path === `${repo}/issues` || path === `${repo}/issues/comments`) return { status: 200, body: [] };
  if (path === `${repo}/pulls`) {
    return {
      status: 200,
      body: fake.pulls.map((pull) => ({
        number: pull.number,
        title: pull.title,
        draft: pull.draft ?? false,
        html_url: `https://github.com/${REPOSITORY}/pull/${pull.number}`,
        head: { ref: pull.branch, sha: pull.sha },
      })),
    };
  }
  if (path === `${repo}/commits/${fake.defaultBranch}`) {
    return {
      status: 200,
      body: { sha: fake.head, html_url: `https://github.com/${REPOSITORY}/commit/${fake.head}`, commit: { committer: { date: '2026-10-11T07:00:00Z' } } },
    };
  }
  const checks = new RegExp(`^${repo}/commits/([0-9a-f]+)/check-runs$`).exec(path);
  if (checks) {
    const runs = fake.checks[checks[1]!] ?? [];
    return { status: 200, body: { total_count: runs.length, check_runs: runs } };
  }
  const status = new RegExp(`^${repo}/commits/([0-9a-f]+)/status$`).exec(path);
  if (status) {
    const states = fake.statuses[status[1]!] ?? [];
    return { status: 200, body: { state: states.length === 0 ? 'pending' : states[0], total_count: states.length, statuses: states.map((state) => ({ state })) } };
  }
  return { status: 404, body: { message: 'Not Found' } };
}

/**
 * Every request the daemon sends outside itself goes through `fetch`; each is recorded, and one
 * for GitHub's public API is sent to the loopback forge instead, so that a forge read from a
 * `github.com` remote can be served here.
 */
const outbound: URL[] = [];
let redirect: string | null = null;
const realFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.hostname === '127.0.0.1' && url.pathname.startsWith('/ops/')) return realFetch(input, init);
    outbound.push(url);
    if (url.origin === 'https://api.github.com' && redirect !== null) return realFetch(`${redirect}${url.pathname}${url.search}`, init);
    return realFetch(input, init);
  };
});
after(() => {
  globalThis.fetch = realFetch;
});

function git(root: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=Binnacle Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: root });
}

function write(root: string, path: string, text: string): void {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}

function temporary(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  roots.push(root);
  return root;
}

/** A project whose tracker is GitHub, at the loopback forge. */
function githubProject(fake: FakeGitHub): string {
  const root = temporary('binnacle-ci-');
  write(root, '.binnacle/project.yaml', `version: 1\n\nproject:\n  id: ci\n\ntracker:\n  provider: github\n  repository: ${REPOSITORY}\n  host: ${fake.base}\n`);
  return root;
}

/** A repository whose tracker is local, with one ticket, and whatever remote `remote` names. */
function localProject(remote: string | null): string {
  const root = temporary('binnacle-ci-local-');
  write(root, '.binnacle/project.yaml', 'version: 1\n\nproject:\n  id: ci-local\n  name: CI Local\n\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n\nknowledge:\n  docs: docs\n  specs: docs/specs\n');
  write(root, 'docs/roadmap.md', '# Roadmap\n\n## Current focus\n\nAlpha.\n');
  write(root, 'docs/specs/alpha/issues/01-first-step.md', '# 01: First step\n\nStatus: ACTIVE\n');
  git(root, 'init', '--quiet', '--initial-branch=main');
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '-m', 'Start');
  if (remote !== null) git(root, 'remote', 'add', 'origin', remote);
  return root;
}

async function withForge(body: (daemon: TestDaemon, fake: FakeGitHub) => Promise<void>): Promise<void> {
  const [daemon, fake] = await Promise.all([startTestDaemon(), fakeGitHub()]);
  outbound.length = 0;
  try {
    await body(daemon, fake);
  } finally {
    redirect = null;
    delete process.env.BINNACLE_GITHUB_TOKEN;
    await Promise.all([daemon.stop(), fake.close()]);
  }
}

async function snapshotOf(daemon: TestDaemon, root: string): Promise<Snapshot> {
  await daemon.call('project.register', { path: root });
  const { status, body } = await daemon.call<Snapshot>('project.snapshot', { path: root });
  assert.equal(status, 200);
  return body;
}

function available(ci: Ci): Exclude<Ci, { available: false }> {
  assert.ok(!('available' in ci), JSON.stringify(ci));
  return ci as Exclude<Ci, { available: false }>;
}

const reported = (value: string): State => ({ value, provenance: 'provider_reported' });
const run = (status: string, conclusion: string | null = null): Check => ({ status, conclusion });

describe('the ci section on GitHub', () => {
  it('gives the default branch passing, with its commit, its link and when, every state provider_reported', async () => {
    await withForge(async (daemon, fake) => {
      fake.checks[MAIN_SHA] = [run('completed', 'success'), run('completed', 'skipped')];
      fake.statuses[MAIN_SHA] = ['success'];
      const ci = available((await snapshotOf(daemon, githubProject(fake))).ci);
      assert.deepEqual(ci.forge, { provider: 'github', host: fake.base, repository: REPOSITORY, from: 'tracker' });
      assert.deepEqual(ci.defaultBranch, {
        branch: 'main',
        commit: MAIN_SHA,
        state: reported('passing'),
        url: `https://github.com/${REPOSITORY}/commit/${MAIN_SHA}`,
        at: '2026-10-11T07:00:00Z',
      });
      assert.deepEqual(ci.requests, { items: [], remainder: 0 });
    });
  });

  it('combines check runs and statuses: any failure, cancellation or timeout fails; anything queued or in progress runs; neither is none', async () => {
    const cases: [Check[], string[], string][] = [
      [[run('completed', 'success')], ['failure'], 'failing'],
      [[run('completed', 'success')], ['error'], 'failing'],
      [[run('completed', 'cancelled')], ['success'], 'failing'],
      [[run('completed', 'timed_out')], [], 'failing'],
      [[run('in_progress'), run('completed', 'failure')], [], 'failing'],
      [[run('queued')], ['success'], 'running'],
      [[run('completed', 'success')], ['pending'], 'running'],
      [[run('in_progress')], [], 'running'],
      [[], ['success'], 'passing'],
      [[run('completed', 'skipped')], [], 'passing'],
      [[], [], 'none'],
    ];
    await withForge(async (daemon, fake) => {
      const root = githubProject(fake);
      for (const [checks, statuses, expected] of cases) {
        fake.checks[MAIN_SHA] = checks;
        fake.statuses[MAIN_SHA] = statuses;
        const ci = available((await snapshotOf(daemon, root)).ci);
        assert.deepEqual(ci.defaultBranch.state, reported(expected), JSON.stringify({ checks, statuses }));
      }
    });
  });

  it('makes a failing default branch ci.failing, and only a failing one', async () => {
    await withForge(async (daemon, fake) => {
      const root = githubProject(fake);
      fake.checks[MAIN_SHA] = [run('completed', 'failure')];
      const failing = await snapshotOf(daemon, root);
      const items = failing.attention.filter((item) => item.code === 'ci.failing');
      assert.equal(items.length, 1);
      assert.match(items[0]!.message, /main/);
      assert.ok(items[0]!.message.includes(`https://github.com/${REPOSITORY}/commit/${MAIN_SHA}`));

      fake.checks[MAIN_SHA] = [run('in_progress')];
      assert.equal((await snapshotOf(daemon, root)).attention.filter((item) => item.code === 'ci.failing').length, 0);
    });
  });

  it('lists the open pull requests with their heads’ states and the Tasks their branches map to, cut at the limit', async () => {
    await withForge(async (daemon, fake) => {
      fake.reply = (url) =>
        url.pathname === `/repos/${REPOSITORY}/issues`
          ? { status: 200, body: [{ number: 2, title: 'Second', state: 'open', body: 'Status: ACTIVE', labels: [], html_url: `https://github.com/${REPOSITORY}/issues/2` }] }
          : null;
      fake.pulls = [
        { number: 7, title: 'Second step', branch: 'feat/2-second', sha: 'b'.repeat(40) },
        { number: 8, title: 'Draft', branch: 'spike', sha: 'c'.repeat(40), draft: true },
        ...Array.from({ length: 10 }, (_, index) => ({ number: 20 + index, title: `More ${index}`, branch: `more-${index}`, sha: String(index).repeat(40) })),
      ];
      fake.checks['b'.repeat(40)] = [run('completed', 'failure')];
      fake.statuses['c'.repeat(40)] = ['pending'];
      const ci = available((await snapshotOf(daemon, githubProject(fake))).ci);
      assert.equal(ci.requests.items.length, 10);
      assert.equal(ci.requests.remainder, 2);
      assert.deepEqual(ci.requests.items[0], {
        number: 7,
        title: 'Second step',
        branch: 'feat/2-second',
        taskId: '#2',
        draft: false,
        state: reported('failing'),
        url: `https://github.com/${REPOSITORY}/pull/7`,
      });
      assert.deepEqual(ci.requests.items[1], {
        number: 8,
        title: 'Draft',
        branch: 'spike',
        taskId: null,
        draft: true,
        state: reported('running'),
        url: `https://github.com/${REPOSITORY}/pull/8`,
      });
      assert.deepEqual(ci.requests.items[2]!.state, reported('none'));
      // A failing pull request is no attention item: only the default branch's is.
      assert.equal(ci.defaultBranch.state.value, 'none');
      // The states of the requests left out are not read.
      assert.ok(!fake.requests.some((url) => url.pathname.includes('8'.repeat(40)) || url.pathname.includes('9'.repeat(40))));
    });
  });

  it('reads with the token Binnacle holds for the host, which appears in nothing returned, and sends nothing to any other host', async () => {
    await withForge(async (daemon, fake) => {
      process.env.BINNACLE_GITHUB_TOKEN = TOKEN;
      fake.checks[MAIN_SHA] = [run('completed', 'failure')];
      fake.pulls = [{ number: 7, title: 'Second step', branch: 'feat/2-second', sha: 'b'.repeat(40) }];
      const snapshot = await snapshotOf(daemon, githubProject(fake));
      available(snapshot.ci);
      assert.ok(!JSON.stringify(snapshot).includes(TOKEN));
      const ciRequests = fake.requests.filter((url) => !url.pathname.includes('/issues'));
      assert.ok(ciRequests.length >= 5);
      assert.ok(fake.authorizations.every((value) => value === `Bearer ${TOKEN}`));
      assert.deepEqual([...new Set(outbound.map((url) => url.origin))], [fake.base]);
    });
  });

  for (const [status, headers, pattern] of [
    [401, {}, /refused the request .*\(401\); a token was used/],
    [403, {}, /no read access .*\(403\); a token was used/],
    [429, {}, /rate-limited .*\(429\)/],
  ] as const) {
    it(`makes the section unavailable with the forge’s reason on a ${status}, never empty`, async () => {
      await withForge(async (daemon, fake) => {
        process.env.BINNACLE_GITHUB_TOKEN = TOKEN;
        fake.reply = (url) => (url.pathname.includes('/issues') ? null : { status, headers, body: { message: 'No' } });
        const ci = (await snapshotOf(daemon, githubProject(fake))).ci;
        assert.equal('available' in ci && ci.available, false);
        assert.match((ci as { reason: string }).reason, pattern);
        assert.ok(!(ci as { reason: string }).reason.includes(TOKEN));
      });
    });
  }

  it('makes the section unavailable when one pull request’s state cannot be read', async () => {
    await withForge(async (daemon, fake) => {
      fake.pulls = [{ number: 7, title: 'Second step', branch: 'feat/2-second', sha: 'b'.repeat(40) }];
      fake.reply = (url) => (url.pathname.endsWith(`${'b'.repeat(40)}/status`) ? { status: 403, body: { message: 'No' } } : null);
      const ci = (await snapshotOf(daemon, githubProject(fake))).ci;
      assert.match((ci as { reason: string }).reason, /no read access .*\(403\); no token was used/);
    });
  });
});

describe('the forge of a project whose tracker is local', () => {
  it('is its GitHub remote, read anonymously, with each pull request mapped to the ticket its branch names', async () => {
    await withForge(async (daemon, fake) => {
      redirect = fake.base;
      fake.checks[MAIN_SHA] = [run('completed', 'success')];
      fake.pulls = [{ number: 3, title: 'First step', branch: 'feat/first-step', sha: 'b'.repeat(40) }];
      const ci = available((await snapshotOf(daemon, localProject(`https://github.com/${REPOSITORY}.git`))).ci);
      assert.deepEqual(ci.forge, { provider: 'github', host: 'github.com', repository: REPOSITORY, from: 'remote' });
      assert.deepEqual(ci.defaultBranch.state, reported('passing'));
      assert.equal(ci.requests.items[0]!.taskId, 'alpha/01');
      assert.ok(fake.authorizations.every((value) => value === undefined));
      assert.deepEqual([...new Set(outbound.map((url) => url.origin))], ['https://api.github.com']);
    });
  });

  it('is none without a GitHub or GitLab remote, and the section says so', async () => {
    await withForge(async (daemon) => {
      for (const remote of [null, 'https://git.example.com/team/project.git']) {
        const ci = (await snapshotOf(daemon, localProject(remote))).ci;
        assert.equal('available' in ci && ci.available, false);
        assert.match((ci as { reason: string }).reason, /no Git remote on GitHub or GitLab/);
      }
      assert.deepEqual(outbound, []);
    });
  });

  it('is GitLab, which this version does not read CI from yet, and says so', async () => {
    await withForge(async (daemon) => {
      const ci = (await snapshotOf(daemon, localProject('git@gitlab.com:team/project.git'))).ci;
      assert.match((ci as { reason: string }).reason, /GitLab/);
      assert.deepEqual(outbound, []);
    });
  });
});

describe('the vault’s snapshot note', () => {
  it('carries CI: the default branch’s state and the open pull requests with their Tasks', async () => {
    await withForge(async (daemon, fake) => {
      redirect = fake.base;
      const vault = temporary('binnacle-ci-vault-');
      writeFileSync(join(daemon.home, 'settings.json'), JSON.stringify({ obsidian: { vaultPath: vault } }), { mode: 0o600 });
      fake.checks[MAIN_SHA] = [run('completed', 'failure')];
      fake.pulls = [{ number: 3, title: 'First step', branch: 'feat/first-step', sha: 'b'.repeat(40) }];
      await snapshotOf(daemon, localProject(`https://github.com/${REPOSITORY}.git`));
      const note = readFileSync(join(vault, 'Projects/CI Local/Product/snapshot.md'), 'utf8');
      const expected = [
        '## CI',
        `\`main\` on GitHub (${REPOSITORY}): failing at \`${MAIN_SHA.slice(0, 7)}\`, 2026-10-11T07:00:00Z (provider reported). https://github.com/${REPOSITORY}/commit/${MAIN_SHA}`,
        '### Open pull requests',
        `- #3 First step, \`feat/first-step\`, alpha/01: none (provider reported). https://github.com/${REPOSITORY}/pull/3`,
      ].join('\n\n');
      assert.ok(note.includes(expected), note);
    });
  });
});
