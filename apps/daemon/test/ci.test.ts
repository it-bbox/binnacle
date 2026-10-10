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
delete process.env.BINNACLE_GITLAB_TOKEN;

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
 * over HTTPS, to GitHub's public API or a GitHub Enterprise host's `/api/v3`, is sent to the
 * loopback forge instead, so that a forge read from a remote can be served here.
 */
const outbound: URL[] = [];
let redirect: string | null = null;
const realFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.hostname === '127.0.0.1' && url.pathname.startsWith('/ops/')) return realFetch(input, init);
    outbound.push(url);
    if (url.protocol === 'https:' && redirect !== null) return realFetch(`${redirect}${url.pathname.replace(/^\/api\/v3/, '')}${url.search}`, init);
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
    delete process.env.BINNACLE_GITLAB_TOKEN;
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

  it('makes the section unavailable, never "undefined", when GitHub gives no default branch, commit or link', async () => {
    await withForge(async (daemon, fake) => {
      const root = githubProject(fake);
      for (const [path, body, missing] of [
        [`/repos/${REPOSITORY}`, { full_name: REPOSITORY }, /default branch/],
        [`/repos/${REPOSITORY}/commits/main`, { html_url: 'https://github.com/x' }, /commit/],
        [`/repos/${REPOSITORY}/commits/main`, { sha: MAIN_SHA }, /link/],
        // A link the dashboard would bind to href is a web link, or none.
        [`/repos/${REPOSITORY}/commits/main`, { sha: MAIN_SHA, html_url: 'javascript:alert(1)' }, /link/],
        [`/repos/${REPOSITORY}/pulls`, [{ number: 7, title: 'T', html_url: 'javascript:alert(1)', head: { ref: 'b', sha: MAIN_SHA } }], /link to pull request #7/],
      ] as const) {
        fake.reply = (url) => (url.pathname === path ? { status: 200, body } : null);
        const ci = (await snapshotOf(daemon, root)).ci;
        assert.equal('available' in ci && ci.available, false, JSON.stringify(ci));
        assert.match((ci as { reason: string }).reason, missing);
        assert.doesNotMatch(JSON.stringify(ci), /undefined/);
      }
    });
  });

  it('gives no time, rather than one GitHub did not give, when the commit’s date is not a string', async () => {
    await withForge(async (daemon, fake) => {
      fake.reply = (url) =>
        url.pathname === `/repos/${REPOSITORY}/commits/main`
          ? { status: 200, body: { sha: MAIN_SHA, html_url: `https://github.com/${REPOSITORY}/commit/${MAIN_SHA}`, commit: { committer: { date: 42 } } } }
          : null;
      assert.equal(available((await snapshotOf(daemon, githubProject(fake))).ci).defaultBranch.at, null);
    });
  });

  it('says a refusal of the repository is of the repository', async () => {
    await withForge(async (daemon, fake) => {
      fake.reply = (url) => (url.pathname === `/repos/${REPOSITORY}` ? { status: 403, body: { message: 'No' } } : null);
      const ci = (await snapshotOf(daemon, githubProject(fake))).ci;
      assert.match((ci as { reason: string }).reason, /no read access to the repository of /);
    });
  });

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

  it('on a host of its own is read with that host’s entry in the credentials file only, never the environment’s token', async () => {
    await withForge(async (daemon, fake) => {
      redirect = fake.base;
      process.env.BINNACLE_GITHUB_TOKEN = TOKEN;
      const root = localProject(`git@github.example.org:${REPOSITORY}.git`);
      const ci = available((await snapshotOf(daemon, root)).ci);
      assert.deepEqual(ci.forge, { provider: 'github', host: 'github.example.org', repository: REPOSITORY, from: 'remote' });
      assert.ok(fake.authorizations.every((value) => value === undefined), JSON.stringify(fake.authorizations));
      assert.deepEqual([...new Set(outbound.map((url) => url.origin))], ['https://github.example.org']);

      writeFileSync(join(daemon.home, 'credentials.json'), JSON.stringify({ 'github.example.org': 'ghp_enterprise-token' }), { mode: 0o600 });
      fake.authorizations.length = 0;
      available((await snapshotOf(daemon, root)).ci);
      assert.ok(fake.authorizations.every((value) => value === 'Bearer ghp_enterprise-token'), JSON.stringify(fake.authorizations));
    });
  });

  it('says that nothing was read, and not that the tracker was not, when its token cannot be used', async () => {
    await withForge(async (daemon) => {
      writeFileSync(join(daemon.home, 'credentials.json'), '[]', { mode: 0o600 });
      const ci = (await snapshotOf(daemon, localProject(`https://github.com/${REPOSITORY}.git`))).ci;
      assert.match((ci as { reason: string }).reason, /nothing was read/);
      assert.doesNotMatch((ci as { reason: string }).reason, /tracker/);
      assert.deepEqual(outbound, []);
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

type TaskRequest = { forge: Exclude<Ci, { available: false }>['forge']; number: number; title: string; branch: string; draft: boolean; state: State; url: string };
type Unread = { available: false; reason: string };

async function requestOf(daemon: TestDaemon, root: string, id: string): Promise<TaskRequest | Unread | null> {
  await daemon.call('project.register', { path: root });
  const { status, body } = await daemon.call<{ request: TaskRequest | Unread | null }>('task.get', { path: root, id });
  assert.equal(status, 200, JSON.stringify(body));
  return body.request;
}

/** Issues #2 and #3, open, which pull requests' branches map to by number. */
const issues = (url: URL): Reply | null =>
  url.pathname === `/repos/${REPOSITORY}/issues`
    ? {
        status: 200,
        body: [2, 3].map((number) => ({ number, title: `Step ${number}`, state: 'open', body: 'Status: ACTIVE', labels: [], html_url: `https://github.com/${REPOSITORY}/issues/${number}` })),
      }
    : null;

describe('the Task’s request on task_get', () => {
  it('is the open pull request its branch maps to, with its CI state, found past the snapshot’s limit, no other request’s state read', async () => {
    await withForge(async (daemon, fake) => {
      fake.reply = issues;
      fake.pulls = [
        ...Array.from({ length: 11 }, (_, index) => ({ number: 20 + index, title: `More ${index}`, branch: `more-${index}`, sha: String(index).repeat(40) })),
        { number: 7, title: 'Second step', branch: 'feat/2-second', sha: 'b'.repeat(40), draft: true },
      ];
      fake.checks['b'.repeat(40)] = [run('completed', 'failure')];
      const request = await requestOf(daemon, githubProject(fake), '#2');
      assert.deepEqual(request, {
        forge: { provider: 'github', host: fake.base, repository: REPOSITORY, from: 'tracker' },
        number: 7,
        title: 'Second step',
        branch: 'feat/2-second',
        draft: true,
        state: reported('failing'),
        url: `https://github.com/${REPOSITORY}/pull/7`,
      });
      assert.ok(!fake.requests.some((url) => /\/commits\/[0-9]{40}\//.test(url.pathname)));
    });
  });

  it('is null for a Task with no open pull request', async () => {
    await withForge(async (daemon, fake) => {
      fake.reply = issues;
      fake.pulls = [{ number: 7, title: 'Second step', branch: 'feat/2-second', sha: 'b'.repeat(40) }];
      assert.equal(await requestOf(daemon, githubProject(fake), '#3'), null);
    });
  });

  it('maps a pull request to a local ticket by the branch its Task names, the forge read from the Git remote', async () => {
    await withForge(async (daemon, fake) => {
      redirect = fake.base;
      fake.pulls = [{ number: 3, title: 'First step', branch: 'feat/first-step', sha: 'b'.repeat(40) }];
      fake.statuses['b'.repeat(40)] = ['success'];
      const request = (await requestOf(daemon, localProject(`https://github.com/${REPOSITORY}.git`), 'alpha/01')) as TaskRequest;
      assert.equal(request.number, 3);
      assert.deepEqual(request.state, reported('passing'));
      assert.equal(request.forge.from, 'remote');
    });
  });

  for (const status of [401, 403, 429]) {
    it(`is unavailable with the forge’s reason on a ${status}, the brief still served`, async () => {
      await withForge(async (daemon, fake) => {
        fake.reply = (url) => issues(url) ?? (url.pathname.includes('/issues') ? null : { status, body: { message: 'No' } });
        const request = (await requestOf(daemon, githubProject(fake), '#2')) as Unread;
        assert.equal(request.available, false);
        assert.match(request.reason, new RegExp(`\\(${status}\\)`));
      });
    });
  }

  it('is unavailable, saying so, without a forge', async () => {
    await withForge(async (daemon) => {
      const request = (await requestOf(daemon, localProject(null), 'alpha/01')) as Unread;
      assert.match(request.reason, /no Git remote on GitHub or GitLab/);
      assert.deepEqual(outbound, []);
    });
  });
});

describe('the daily’s ci section', () => {
  it('is CI as of now, its requests mapped to the Tasks at HEAD, a failing default branch ci.failing, and the vault’s daily note carries it', async () => {
    await withForge(async (daemon, fake) => {
      redirect = fake.base;
      const vault = temporary('binnacle-ci-daily-vault-');
      writeFileSync(join(daemon.home, 'settings.json'), JSON.stringify({ obsidian: { vaultPath: vault } }), { mode: 0o600 });
      fake.checks[MAIN_SHA] = [run('completed', 'failure')];
      fake.pulls = [{ number: 3, title: 'First step', branch: 'feat/first-step', sha: 'b'.repeat(40) }];
      const root = localProject(`https://github.com/${REPOSITORY}.git`);
      await daemon.call('project.register', { path: root });
      const { status, body } = await daemon.call<Snapshot>('daily.get', { path: root });
      assert.equal(status, 200, JSON.stringify(body));
      const ci = available(body.ci);
      assert.deepEqual(ci.defaultBranch.state, reported('failing'));
      assert.equal(ci.requests.items[0]!.taskId, 'alpha/01');
      assert.equal(body.attention.filter((item) => item.code === 'ci.failing').length, 1);

      const note = readFileSync(join(vault, 'Projects/CI Local/Product/daily.md'), 'utf8');
      assert.ok(note.includes(`## CI\n\n\`main\` on GitHub (${REPOSITORY}): failing at \`${MAIN_SHA.slice(0, 7)}\``), note);
      assert.ok(note.includes('- #3 First step, `feat/first-step`, alpha/01: none (provider reported).'), note);
    });
  });
});

/** A full project path with a subgroup, which GitLab's API takes URL-encoded as one segment. */
const PROJECT = 'gitlab-org/sub-group/project';
const PROJECT_PATH = `/api/v4/projects/${encodeURIComponent(PROJECT)}`;
const GITLAB_TOKEN = 'glpat-ci-secret-token';

/**
 * GitLab's API for `PROJECT`, served under `/api/v4`: the project, its default branch's latest
 * commit, its open merge requests, and `issues`. `pipelines` holds statuses newest first: by SHA
 * for the default branch's commit, served only with `ref` set to the default branch, and by
 * `!iid` for a merge request's own pipelines, whatever commit they ran on. A pipeline list
 * follows `per_page` with GitLab's `Link` header, so that reading more than the latest would show.
 */
type FakeGitLab = {
  origin: string;
  base: string;
  defaultBranch: string;
  head: string;
  pipelines: Record<string, string[]>;
  merges: { iid: number; title: string; branch: string; sha: string; draft?: boolean }[];
  issues: unknown[];
  reply: ((url: URL) => Reply | null) | null;
  requests: URL[];
  tokens: (string | undefined)[];
  close(): Promise<void>;
};

async function fakeGitLab(): Promise<FakeGitLab> {
  const fake: FakeGitLab = {
    origin: '',
    base: '',
    defaultBranch: 'main',
    head: MAIN_SHA,
    pipelines: {},
    merges: [],
    issues: [],
    reply: null,
    requests: [],
    tokens: [],
    close: async () => {},
  };
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', fake.origin);
    fake.requests.push(url);
    fake.tokens.push(request.headers['private-token'] as string | undefined);
    const reply = fake.reply?.(url) ?? gitlabRoute(fake, url);
    response.writeHead(reply.status, { 'content-type': 'application/json', ...reply.headers });
    response.end(JSON.stringify(reply.body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  fake.origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  fake.base = `${fake.origin}/api/v4`;
  fake.close = () => new Promise((resolve) => server.close(() => resolve()));
  return fake;
}

function gitlabRoute(fake: FakeGitLab, url: URL): Reply {
  const path = url.pathname;
  if (path === PROJECT_PATH) return { status: 200, body: { path_with_namespace: PROJECT, default_branch: fake.defaultBranch } };
  if (path === `${PROJECT_PATH}/issues`) return { status: 200, body: fake.issues };
  if (/\/issues\/\d+\/notes$/.test(path)) return { status: 200, body: [] };
  if (path === `${PROJECT_PATH}/merge_requests` && url.searchParams.get('state') === 'opened') {
    return {
      status: 200,
      body: fake.merges.map((merge) => ({
        iid: merge.iid,
        title: merge.title,
        draft: merge.draft ?? false,
        source_branch: merge.branch,
        sha: merge.sha,
        web_url: `https://gitlab.com/${PROJECT}/-/merge_requests/${merge.iid}`,
      })),
    };
  }
  if (path === `${PROJECT_PATH}/repository/commits/${encodeURIComponent(fake.defaultBranch)}`) {
    return { status: 200, body: { id: fake.head, web_url: `https://gitlab.com/${PROJECT}/-/commit/${fake.head}`, committed_date: '2026-10-11T07:00:00.000Z' } };
  }
  const merge = new RegExp(`^${PROJECT_PATH}/merge_requests/(\\d+)/pipelines$`).exec(path)?.[1];
  if (path === `${PROJECT_PATH}/pipelines` || merge !== undefined) {
    const key = merge !== undefined ? `!${merge}` : url.searchParams.get('ref') === fake.defaultBranch ? (url.searchParams.get('sha') ?? '') : '';
    const statuses = fake.pipelines[key] ?? [];
    const perPage = Number(url.searchParams.get('per_page') ?? '20');
    const page = Number(url.searchParams.get('page') ?? '1');
    const next = new URL(url);
    next.searchParams.set('page', String(page + 1));
    return {
      status: 200,
      headers: page * perPage < statuses.length ? { link: `<${next}>; rel="next"` } : {},
      body: statuses
        .slice((page - 1) * perPage, page * perPage)
        .map((status, index) => ({ id: 100 - index, status, web_url: `https://gitlab.com/${PROJECT}/-/pipelines/${100 - index}` })),
    };
  }
  return { status: 404, body: { message: '404 Not Found' } };
}

async function withGitLab(body: (daemon: TestDaemon, fake: FakeGitLab) => Promise<void>): Promise<void> {
  const [daemon, fake] = await Promise.all([startTestDaemon(), fakeGitLab()]);
  outbound.length = 0;
  try {
    await body(daemon, fake);
  } finally {
    redirect = null;
    delete process.env.BINNACLE_GITLAB_TOKEN;
    await Promise.all([daemon.stop(), fake.close()]);
  }
}

/** A project whose tracker is GitLab, at the loopback forge. */
function gitlabProject(fake: FakeGitLab): string {
  const root = temporary('binnacle-ci-gitlab-');
  write(root, '.binnacle/project.yaml', `version: 1\n\nproject:\n  id: ci-gitlab\n\ntracker:\n  provider: gitlab\n  repository: ${PROJECT}\n  host: ${fake.base}\n`);
  return root;
}

/** Issues 2 and 3, open, which merge requests' branches map to by number. */
const gitlabIssues = [2, 3].map((iid) => ({ iid, title: `Step ${iid}`, state: 'opened', description: 'Status: ACTIVE', labels: [], web_url: `https://gitlab.com/${PROJECT}/-/issues/${iid}` }));

describe('the ci section on GitLab', () => {
  it('gives the default branch’s latest commit with its latest pipeline’s status, its link and when, every state provider_reported', async () => {
    await withGitLab(async (daemon, fake) => {
      // Newest first: only the latest pipeline counts.
      fake.pipelines[MAIN_SHA] = ['success', 'failed'];
      const ci = available((await snapshotOf(daemon, gitlabProject(fake))).ci);
      assert.deepEqual(ci.forge, { provider: 'gitlab', host: fake.base, repository: PROJECT, from: 'tracker' });
      assert.deepEqual(ci.defaultBranch, {
        branch: 'main',
        commit: MAIN_SHA,
        state: reported('passing'),
        url: `https://gitlab.com/${PROJECT}/-/commit/${MAIN_SHA}`,
        at: '2026-10-11T07:00:00.000Z',
      });
      assert.deepEqual(ci.requests, { items: [], remainder: 0 });
      const pipelines = fake.requests.filter((url) => url.pathname.endsWith('/pipelines'));
      assert.ok(pipelines.length > 0 && pipelines.every((url) => (url.searchParams.get('page') ?? '1') === '1'), 'only the latest pipeline is read');
    });
  });

  it('maps each pipeline status: success and skipped pass; failed and canceled fail; anything still to finish runs; no pipeline is none; anything else fails', async () => {
    const cases: [string[], string][] = [
      [['success'], 'passing'],
      [['skipped'], 'passing'],
      [['failed'], 'failing'],
      [['canceled'], 'failing'],
      [['canceling'], 'failing'],
      ...['created', 'waiting_for_resource', 'preparing', 'pending', 'running', 'scheduled', 'manual'].map((status): [string[], string] => [[status], 'running']),
      [[], 'none'],
      [['something-new'], 'failing'],
    ];
    await withGitLab(async (daemon, fake) => {
      const root = gitlabProject(fake);
      for (const [pipelines, expected] of cases) {
        fake.pipelines[MAIN_SHA] = pipelines;
        const ci = available((await snapshotOf(daemon, root)).ci);
        assert.deepEqual(ci.defaultBranch.state, reported(expected), JSON.stringify(pipelines));
      }
    });
  });

  it('makes a failing default branch ci.failing, and only a failing one', async () => {
    await withGitLab(async (daemon, fake) => {
      const root = gitlabProject(fake);
      fake.pipelines[MAIN_SHA] = ['failed'];
      const items = (await snapshotOf(daemon, root)).attention.filter((item) => item.code === 'ci.failing');
      assert.equal(items.length, 1);
      assert.match(items[0]!.message, /as GitLab reports it/);
      assert.ok(items[0]!.message.includes(`https://gitlab.com/${PROJECT}/-/commit/${MAIN_SHA}`));

      fake.pipelines[MAIN_SHA] = ['running'];
      assert.equal((await snapshotOf(daemon, root)).attention.filter((item) => item.code === 'ci.failing').length, 0);
    });
  });

  it('lists the open merge requests with their head pipelines’ statuses and the Tasks their branches map to, cut at the limit', async () => {
    await withGitLab(async (daemon, fake) => {
      fake.issues = gitlabIssues;
      fake.merges = [
        { iid: 7, title: 'Second step', branch: 'feat/2-second', sha: 'b'.repeat(40) },
        { iid: 8, title: 'Draft', branch: 'spike', sha: 'c'.repeat(40), draft: true },
        ...Array.from({ length: 10 }, (_, index) => ({ iid: 20 + index, title: `More ${index}`, branch: `more-${index}`, sha: String(index).repeat(40) })),
      ];
      fake.pipelines['!7'] = ['failed'];
      fake.pipelines['!8'] = ['pending'];
      const ci = available((await snapshotOf(daemon, gitlabProject(fake))).ci);
      assert.equal(ci.requests.items.length, 10);
      assert.equal(ci.requests.remainder, 2);
      assert.deepEqual(ci.requests.items[0], {
        number: 7,
        title: 'Second step',
        branch: 'feat/2-second',
        taskId: '#2',
        draft: false,
        state: reported('failing'),
        url: `https://gitlab.com/${PROJECT}/-/merge_requests/7`,
      });
      assert.deepEqual(ci.requests.items[1], {
        number: 8,
        title: 'Draft',
        branch: 'spike',
        taskId: null,
        draft: true,
        state: reported('running'),
        url: `https://gitlab.com/${PROJECT}/-/merge_requests/8`,
      });
      assert.deepEqual(ci.requests.items[2]!.state, reported('none'));
      // A failing merge request is no attention item: only the default branch's is.
      assert.equal(ci.defaultBranch.state.value, 'none');
      // A merge request's state is its own pipelines', whatever commit they ran on; those of the requests left out are not read.
      assert.ok(!fake.requests.some((url) => url.searchParams.has('sha') && url.searchParams.get('sha') !== MAIN_SHA));
      assert.ok(!fake.requests.some((url) => /\/merge_requests\/(28|29)\/pipelines$/.test(url.pathname)));
    });
  });

  it('reads with the token Binnacle holds for the host, which appears in nothing returned, and sends nothing to any other host', async () => {
    await withGitLab(async (daemon, fake) => {
      process.env.BINNACLE_GITLAB_TOKEN = GITLAB_TOKEN;
      fake.pipelines[MAIN_SHA] = ['failed'];
      fake.merges = [{ iid: 7, title: 'Second step', branch: 'feat/2-second', sha: 'b'.repeat(40) }];
      const snapshot = await snapshotOf(daemon, gitlabProject(fake));
      available(snapshot.ci);
      assert.ok(!JSON.stringify(snapshot).includes(GITLAB_TOKEN));
      assert.ok(fake.requests.filter((url) => !url.pathname.includes('/issues')).length >= 5);
      assert.ok(fake.tokens.every((value) => value === GITLAB_TOKEN), JSON.stringify(fake.tokens));
      assert.deepEqual([...new Set(outbound.map((url) => url.origin))], [fake.origin]);
    });
  });

  for (const [status, pattern] of [
    [401, /GitLab refused the request .*\(401\); a token was used/],
    [403, /GitLab gave no read access .*\(403\); a token was used/],
    [429, /GitLab rate-limited .*\(429\)/],
  ] as const) {
    it(`makes the section unavailable with the forge’s reason on a ${status}, never empty`, async () => {
      await withGitLab(async (daemon, fake) => {
        process.env.BINNACLE_GITLAB_TOKEN = GITLAB_TOKEN;
        fake.reply = (url) => (url.pathname.includes('/issues') ? null : { status, body: { message: 'No' } });
        const ci = (await snapshotOf(daemon, gitlabProject(fake))).ci;
        assert.equal('available' in ci && ci.available, false);
        assert.match((ci as { reason: string }).reason, pattern);
        assert.ok(!(ci as { reason: string }).reason.includes(GITLAB_TOKEN));
      });
    });
  }

  it('makes the section unavailable when a pipeline cannot be read, or GitLab gives no default branch or no web link', async () => {
    await withGitLab(async (daemon, fake) => {
      const root = gitlabProject(fake);
      fake.merges = [{ iid: 7, title: 'Second step', branch: 'feat/2-second', sha: 'b'.repeat(40) }];
      const cases: [(url: URL) => Reply | null, RegExp][] = [
        [(url) => (url.pathname.endsWith('/merge_requests/7/pipelines') ? { status: 403, body: { message: 'No' } } : null), /no read access to the pipelines .*\(403\); no token was used/],
        [(url) => (url.pathname === PROJECT_PATH ? { status: 200, body: { default_branch: null } } : null), /GitLab gave no default branch/],
        [(url) => (url.pathname.includes('/repository/commits/') ? { status: 200, body: { id: MAIN_SHA, web_url: 'javascript:alert(1)' } } : null), /GitLab gave no link to the commit of main/],
        [
          (url) =>
            url.pathname.endsWith('/merge_requests')
              ? { status: 200, body: [{ iid: 7, title: 'T', source_branch: 'b', sha: MAIN_SHA, web_url: 'javascript:alert(1)' }] }
              : null,
          /link to merge request !7/,
        ],
      ];
      for (const [reply, reason] of cases) {
        fake.reply = reply;
        const ci = (await snapshotOf(daemon, root)).ci;
        assert.equal('available' in ci && ci.available, false, JSON.stringify(ci));
        assert.match((ci as { reason: string }).reason, reason);
        assert.doesNotMatch(JSON.stringify(ci), /undefined/);
      }
    });
  });
});

describe('the GitLab forge of a project whose tracker is local', () => {
  it('is its GitLab remote, read anonymously from gitlab.com only, with each merge request mapped to the ticket its branch names', async () => {
    await withGitLab(async (daemon, fake) => {
      redirect = fake.origin;
      fake.pipelines[MAIN_SHA] = ['success'];
      fake.merges = [{ iid: 3, title: 'First step', branch: 'feat/first-step', sha: 'b'.repeat(40) }];
      fake.pipelines['!3'] = ['running'];
      const ci = available((await snapshotOf(daemon, localProject(`https://gitlab.com/${PROJECT}.git`))).ci);
      assert.deepEqual(ci.forge, { provider: 'gitlab', host: 'gitlab.com', repository: PROJECT, from: 'remote' });
      assert.deepEqual(ci.defaultBranch.state, reported('passing'));
      assert.deepEqual(ci.requests.items[0], {
        number: 3,
        title: 'First step',
        branch: 'feat/first-step',
        taskId: 'alpha/01',
        draft: false,
        state: reported('running'),
        url: `https://gitlab.com/${PROJECT}/-/merge_requests/3`,
      });
      assert.ok(fake.tokens.every((value) => value === undefined));
      assert.deepEqual([...new Set(outbound.map((url) => url.origin))], ['https://gitlab.com']);
    });
  });
});

describe('the Task’s request on task_get on GitLab', () => {
  it('is the open merge request its branch maps to, with its head pipeline’s status, found past the snapshot’s limit, and null for a Task with none', async () => {
    await withGitLab(async (daemon, fake) => {
      fake.issues = gitlabIssues;
      fake.merges = [
        ...Array.from({ length: 11 }, (_, index) => ({ iid: 20 + index, title: `More ${index}`, branch: `more-${index}`, sha: String(index).repeat(40) })),
        { iid: 7, title: 'Second step', branch: 'feat/2-second', sha: 'b'.repeat(40), draft: true },
      ];
      fake.pipelines['!7'] = ['failed'];
      const root = gitlabProject(fake);
      assert.deepEqual(await requestOf(daemon, root, '#2'), {
        forge: { provider: 'gitlab', host: fake.base, repository: PROJECT, from: 'tracker' },
        number: 7,
        title: 'Second step',
        branch: 'feat/2-second',
        draft: true,
        state: reported('failing'),
        url: `https://gitlab.com/${PROJECT}/-/merge_requests/7`,
      });
      assert.ok(!fake.requests.some((url) => /\/merge_requests\/(2\d|30)\/pipelines$/.test(url.pathname)));
      assert.equal(await requestOf(daemon, root, '#3'), null);
    });
  });

  it('is unavailable with the forge’s reason when GitLab refuses, the brief still served', async () => {
    await withGitLab(async (daemon, fake) => {
      fake.issues = gitlabIssues;
      fake.reply = (url) => (url.pathname.includes('/issues') ? null : { status: 403, body: { message: 'No' } });
      const request = (await requestOf(daemon, gitlabProject(fake), '#2')) as Unread;
      assert.equal(request.available, false);
      assert.match(request.reason, /GitLab gave no read access .*\(403\)/);
    });
  });
});
