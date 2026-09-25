import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { githubApiRoot, readGitHubTasks } from '@binnacle/adapters';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

type SnapshotTask = { id: string; title: string | null; state: string | null; unmetDependencies: string[]; ticket: string };
type Section = { items: SnapshotTask[]; remainder: number };
type Snapshot = {
  roadmap: { epics: unknown[] } | null;
  tasks: { inFlight: Section; readyToStart: Section; counts: Record<string, number> } | null;
  attention: { code: string; message: string }[];
};

const REPOSITORY = 'octo-org/octo-repo';

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** An issue in the shape GitHub's REST API returns it, with only the fields the adapter reads. */
function issue(
  number: number,
  title: string,
  fields: { state?: 'open' | 'closed'; state_reason?: string | null; body?: string | null; labels?: unknown[]; pull_request?: unknown } = {},
): Record<string, unknown> {
  return {
    number,
    title,
    state: 'open',
    state_reason: null,
    body: null,
    labels: [],
    html_url: `https://github.com/${REPOSITORY}/issues/${number}`,
    ...fields,
  };
}

const header = (lines: Record<string, string>): string =>
  [...Object.entries(lines).map(([name, value]) => `${name}: ${value}`), '', '**What to build:** something.', '', 'Status: DONE'].join('\n');

type Reply = { status: number; headers?: Record<string, string>; body: unknown };

/**
 * A loopback stand-in for GitHub at the network boundary: it serves `pages` of issues for
 * `REPOSITORY` with GitHub's `Link` pagination header, or whatever `reply` says instead.
 * Every request it receives is kept, so a test can see what Binnacle asked for.
 */
type FakeGitHub = { base: string; pages: unknown[][]; reply: ((request: URL) => Reply | null) | null; requests: URL[]; close(): Promise<void> };

async function fakeGitHub(pages: unknown[][]): Promise<FakeGitHub> {
  const fake: FakeGitHub = { base: '', pages, reply: null, requests: [], close: async () => {} };
  const server: Server = createServer((request: IncomingMessage, response) => {
    const url = new URL(request.url ?? '/', fake.base);
    fake.requests.push(url);
    const reply = fake.reply?.(url) ?? pageReply(fake, url);
    response.writeHead(reply.status, { 'content-type': 'application/json', ...reply.headers });
    response.end(JSON.stringify(reply.body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  fake.base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  fake.close = () => new Promise((resolve) => server.close(() => resolve()));
  return fake;
}

function pageReply(fake: FakeGitHub, url: URL): Reply {
  if (url.pathname !== `/repos/${REPOSITORY}/issues`) return { status: 404, body: { message: 'Not Found' } };
  const page = Number(url.searchParams.get('page') ?? '1');
  const link = (n: number): string => {
    const next = new URL(url);
    next.searchParams.set('page', String(n));
    return next.toString();
  };
  const headers: Record<string, string> =
    page < fake.pages.length ? { link: `<${link(page + 1)}>; rel="next", <${link(fake.pages.length)}>; rel="last"` } : {};
  return { status: 200, headers, body: fake.pages[page - 1] ?? [] };
}

function manifest(host: string, extra = ''): string {
  return `version: 1\n\nproject:\n  id: github-project\n\ntracker:\n  provider: github\n  repository: ${REPOSITORY}\n  host: ${host}\n${extra}`;
}

function makeProject(text: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-github-')));
  roots.push(root);
  mkdirSync(join(root, '.binnacle'));
  writeFileSync(join(root, '.binnacle', 'project.yaml'), text);
  return root;
}

async function withGitHub(pages: unknown[][], body: (daemon: TestDaemon, fake: FakeGitHub) => Promise<void>): Promise<void> {
  const [daemon, fake] = await Promise.all([startTestDaemon(), fakeGitHub(pages)]);
  try {
    await body(daemon, fake);
  } finally {
    await Promise.all([daemon.stop(), fake.close()]);
  }
}

async function snapshot(daemon: TestDaemon, root: string): Promise<Snapshot> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
  const result = await daemon.call<Snapshot>('project.snapshot', { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

const ids = (section: Section): string[] => section.items.map((task) => task.id);
/** Tracker and Task attention only: these projects declare no roadmap, which is not what is tested here. */
const codes = (body: Snapshot): string[] => body.attention.map((item) => item.code).filter((code) => /^(tracker|task)\./.test(code));

describe('GitHub issues as Tasks in the Product Snapshot', () => {
  it('reads every issue, open and closed, through every page, and skips pull requests', async () => {
    const pages = [
      [
        issue(3, 'Third', { body: header({ Status: 'ACTIVE' }) }),
        issue(4, 'A pull request', { body: header({ Status: 'ACTIVE' }), pull_request: { url: 'x' } }),
      ],
      [issue(1, 'First', { state: 'closed', state_reason: 'completed' })],
      [issue(2, 'Second', { body: header({ Status: 'READY', 'Blocked by': 'None (can start immediately)' }) })],
    ];
    await withGitHub(pages, async (daemon, fake) => {
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));

      assert.deepEqual(body.tasks, {
        inFlight: {
          items: [{ id: '#3', title: 'Third', state: 'ACTIVE', unmetDependencies: [], ticket: `https://github.com/${REPOSITORY}/issues/3` }],
          remainder: 0,
        },
        readyToStart: {
          items: [{ id: '#2', title: 'Second', state: 'READY', unmetDependencies: [], ticket: `https://github.com/${REPOSITORY}/issues/2` }],
          remainder: 0,
        },
        counts: { BACKLOG: 0, READY: 0, MERGED: 0, DONE: 1, CANCELLED: 0, unknown: 0 },
      });
      assert.deepEqual(codes(body), []);
      assert.deepEqual(
        fake.requests.map((url) => [url.pathname, url.searchParams.get('state'), url.searchParams.get('page') ?? '1']),
        [
          [`/repos/${REPOSITORY}/issues`, 'all', '1'],
          [`/repos/${REPOSITORY}/issues`, 'all', '2'],
          [`/repos/${REPOSITORY}/issues`, 'all', '3'],
        ],
      );
    });
  });

  it('reads the tracker on every call, so a closed issue shows in the next snapshot', async () => {
    await withGitHub([[issue(1, 'Only', { body: header({ Status: 'ACTIVE' }) })]], async (daemon, fake) => {
      const root = makeProject(manifest(fake.base));
      assert.deepEqual(ids((await snapshot(daemon, root)).tasks!.inFlight), ['#1']);

      fake.pages[0] = [issue(1, 'Only', { state: 'closed', state_reason: 'completed', body: header({ Status: 'DONE' }) })];
      const body = await snapshot(daemon, root);
      assert.deepEqual(ids(body.tasks!.inFlight), []);
      assert.equal(body.tasks!.counts.DONE, 1);
    });
  });

  it('takes an open issue’s state from its Status: line, and gives none with a diagnostic when it has no usable one', async () => {
    const pages = [
      [
        issue(1, 'Backlog', { body: header({ Status: 'BACKLOG' }) }),
        issue(2, 'Filed by hand', { body: 'Something is broken.' }),
        issue(3, 'Empty body', { body: null }),
        issue(4, 'Not a state', { body: header({ Status: 'WIP' }) }),
      ],
    ];
    await withGitHub(pages, async (daemon, fake) => {
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      assert.deepEqual(body.tasks!.counts, { BACKLOG: 1, READY: 0, MERGED: 0, DONE: 0, CANCELLED: 0, unknown: 3 });
      assert.deepEqual(codes(body), ['task.unknown_state', 'task.unknown_state', 'task.unknown_state']);
      assert.match(body.attention.find((item) => item.code === 'task.unknown_state')!.message, /#2 .*no Status: line/);
    });
  });

  it('lets closing outrank Status:, by close reason, and keeps CANCELLED when no reason is reported', async () => {
    const closed = (number: number, state_reason: string | null, status?: string): Record<string, unknown> =>
      issue(number, `Closed ${number}`, { state: 'closed', state_reason, body: status === undefined ? null : header({ Status: status }) });
    const pages = [
      [
        closed(1, 'completed', 'ACTIVE'),
        closed(2, 'not_planned'),
        closed(3, 'duplicate'),
        closed(4, null, 'CANCELLED'),
        closed(5, null, 'ACTIVE'),
        closed(6, null),
        closed(7, 'not_planned', 'CANCELLED'),
        closed(8, 'completed', 'DONE'),
      ],
    ];
    await withGitHub(pages, async (daemon, fake) => {
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      // DONE: 1, 5, 6, 8. CANCELLED: 2, 3, 4, 7.
      assert.deepEqual(body.tasks!.counts, { BACKLOG: 0, READY: 0, MERGED: 0, DONE: 4, CANCELLED: 4, unknown: 0 });
      // Only a closed issue whose Status: names another state than closing gave it; one with no header is not a mismatch.
      const mismatches = body.attention.filter((item) => item.code === 'tracker.state_mismatch');
      assert.deepEqual(codes(body), ['tracker.state_mismatch', 'tracker.state_mismatch']);
      assert.match(mismatches[0]!.message, /^#1 /);
      assert.match(mismatches[1]!.message, /^#5 /);
    });
  });

  it('reports an open issue whose Status: says DONE or CANCELLED as a state mismatch', async () => {
    const pages = [[issue(1, 'Forgot to close', { body: header({ Status: 'DONE' }) }), issue(2, 'Abandoned', { body: header({ Status: 'CANCELLED' }) })]];
    await withGitHub(pages, async (daemon, fake) => {
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      assert.deepEqual(codes(body), ['tracker.state_mismatch', 'tracker.state_mismatch']);
      assert.match(body.attention.find((item) => item.code === 'tracker.state_mismatch')!.message, /^#1 .*open/);
    });
  });

  it('meets a dependency on a closed issue, waits on an open one, and reports one on no known issue as dangling', async () => {
    const pages = [
      [
        issue(1, 'Done', { state: 'closed', state_reason: 'completed' }),
        issue(2, 'In flight', { body: header({ Status: 'ACTIVE' }) }),
        issue(3, 'Unblocked', { body: header({ Status: 'READY', 'Blocked by': '#1' }) }),
        issue(4, 'Waiting', { body: header({ Status: 'READY', 'Blocked by': '1, 2 (the API first)' }) }),
        issue(5, 'Typo', { body: header({ Status: 'READY', 'Blocked by': '#99' }) }),
      ],
    ];
    await withGitHub(pages, async (daemon, fake) => {
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      assert.deepEqual(ids(body.tasks!.readyToStart), ['#3', '#5']);
      assert.equal(body.tasks!.counts.READY, 1);
      assert.deepEqual(codes(body), ['task.dangling_dependency']);
      assert.match(body.attention.find((item) => item.code === 'task.dangling_dependency')!.message, /#5 .*#99/);
    });
  });

  it('links a roadmap epic to its issues through the spec slug in their Spec: line, a path or a permalink', async () => {
    const pages = [
      [
        issue(1, 'By path', { body: header({ Status: 'ACTIVE', Spec: '`docs/specs/first/spec.md`' }) }),
        issue(2, 'By permalink', {
          body: header({ Status: 'READY', Spec: `https://github.com/${REPOSITORY}/blob/0123abc/docs/specs/first/spec.md` }),
        }),
        issue(3, 'Another epic', { body: header({ Status: 'ACTIVE', Spec: 'docs/specs/second/spec.md' }) }),
      ],
    ];
    await withGitHub(pages, async (daemon, fake) => {
      const root = makeProject(manifest(fake.base, '\nknowledge:\n  docs: docs\n'));
      mkdirSync(join(root, 'docs'));
      writeFileSync(
        join(root, 'docs', 'roadmap.md'),
        ['# Roadmap', '', '| # | Epic | Status | Spec |', '| --- | --- | --- | --- |', '| 1 | First | done | [`first`](specs/first/spec.md) |', ''].join('\n'),
      );

      const body = await snapshot(daemon, root);
      const mismatch = body.attention.filter((item) => item.code === 'roadmap.status_mismatch');
      assert.equal(mismatch.length, 1);
      assert.match(mismatch[0]!.message, /not DONE or CANCELLED: #1, #2\.$/);
    });
  });
});

describe('a GitHub tracker that cannot be read', () => {
  const failures: [string, Reply, string][] = [
    ['an anonymous request refused', { status: 401, body: { message: 'Requires authentication' } }, 'tracker.unauthorized'],
    ['no read access', { status: 403, body: { message: 'Resource not accessible' } }, 'tracker.forbidden'],
    ['no such repository', { status: 404, body: { message: 'Not Found' } }, 'tracker.not_found'],
    [
      'the primary rate limit',
      { status: 403, headers: { 'x-ratelimit-remaining': '0' }, body: { message: 'API rate limit exceeded' } },
      'tracker.rate_limited',
    ],
    ['a secondary rate limit', { status: 429, headers: { 'retry-after': '60' }, body: { message: 'slow down' } }, 'tracker.rate_limited'],
  ];

  for (const [name, reply, code] of failures) {
    it(`answers everything else, with Tasks null and one ${code} item, on ${name}`, async () => {
      await withGitHub([[]], async (daemon, fake) => {
        fake.reply = () => reply;
        const root = makeProject(manifest(fake.base, '\nknowledge:\n  docs: docs\n'));
        mkdirSync(join(root, 'docs'));
        writeFileSync(join(root, 'docs', 'roadmap.md'), '# Roadmap\n\n| # | Epic | Status | Spec |\n| --- | --- | --- | --- |\n| 1 | First | tickets | — |\n');

        const body = await snapshot(daemon, root);
        assert.equal(body.tasks, null);
        assert.equal(body.roadmap?.epics.length, 1);
        assert.deepEqual(codes(body), [code]);
      });
    });
  }

  it('says whether a token was used when the request is refused', async () => {
    await withGitHub([[]], async (daemon, fake) => {
      fake.reply = () => ({ status: 401, body: {} });
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      assert.match(body.attention.find((item) => item.code === 'tracker.unauthorized')!.message, /no token/i);
    });
  });

  it('gives up the whole reading when a later page fails, rather than answer with part of the tracker', async () => {
    await withGitHub([[issue(1, 'One', { body: header({ Status: 'ACTIVE' }) })], [issue(2, 'Two')]], async (daemon, fake) => {
      fake.reply = (url) => (url.searchParams.get('page') === '2' ? { status: 404, body: {} } : null);
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      assert.equal(body.tasks, null);
      assert.deepEqual(codes(body), ['tracker.not_found']);
    });
  });

  it('is unreachable when nothing listens on the declared host', async () => {
    const fake = await fakeGitHub([[]]);
    const base = fake.base;
    await fake.close();
    const daemon = await startTestDaemon();
    try {
      const body = await snapshot(daemon, makeProject(manifest(base)));
      assert.equal(body.tasks, null);
      assert.deepEqual(codes(body), ['tracker.unreachable']);
    } finally {
      await daemon.stop();
    }
  });

  it('never follows a next page to another host', async () => {
    await withGitHub([[issue(1, 'One')]], async (daemon, fake) => {
      fake.reply = (url) =>
        url.searchParams.get('page') === null ? { status: 200, headers: { link: '<http://elsewhere.invalid/issues?page=2>; rel="next"' }, body: [] } : null;
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      assert.equal(body.tasks, null);
      assert.deepEqual(codes(body), ['tracker.unreachable']);
      assert.equal(fake.requests.length, 1);
    });
  });
});

describe('the GitHub tracker in the manifest', () => {
  it('reads repository and host, both null when unwritten', async () => {
    const daemon = await startTestDaemon();
    try {
      type Status = { manifest: { tracker: { repository: string | null; host: string | null } } | null };
      const declared = makeProject(manifest('ghe.example.com'));
      const unwritten = makeProject('version: 1\n\nproject:\n  id: bare\n\ntracker:\n  provider: github\n');
      for (const root of [declared, unwritten]) assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      const tracker = async (root: string) => (await daemon.call<Status>('project.status', { path: root })).body.manifest?.tracker;
      assert.deepEqual(await tracker(declared), { provider: 'github', repository: REPOSITORY, host: 'ghe.example.com', local: { issues: null } });
      assert.deepEqual(await tracker(unwritten), { provider: 'github', repository: null, host: null, local: { issues: null } });
    } finally {
      await daemon.stop();
    }
  });

  it('makes Tasks unavailable, naming the field, when no repository is declared', async () => {
    const daemon = await startTestDaemon();
    try {
      const body = await snapshot(daemon, makeProject('version: 1\n\nproject:\n  id: bare\n\ntracker:\n  provider: github\n'));
      assert.equal(body.tasks, null);
      assert.deepEqual(codes(body), ['tracker.unavailable']);
      assert.match(body.attention.find((item) => item.code === 'tracker.unavailable')!.message, /tracker\.repository/);
    } finally {
      await daemon.stop();
    }
  });

  it('maps a host to its API root: github.com, any other hostname, or a base URL as given', () => {
    assert.equal(githubApiRoot(null), 'https://api.github.com');
    assert.equal(githubApiRoot('github.com'), 'https://api.github.com');
    assert.equal(githubApiRoot('ghe.example.com'), 'https://ghe.example.com/api/v3');
    assert.equal(githubApiRoot('http://127.0.0.1:8080/custom'), 'http://127.0.0.1:8080/custom');
  });
});

describe('the GitHub remote against the declared tracker', () => {
  function git(root: string, ...args: string[]): void {
    execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  }

  async function mismatches(daemon: TestDaemon, host: string | null, remotes: string[]): Promise<string[]> {
    const root = makeProject(
      `version: 1\n\nproject:\n  id: remote-check\n\ntracker:\n  provider: github\n  repository: ${REPOSITORY}\n${host ? `  host: ${host}\n` : ''}`,
    );
    git(root, 'init', '--quiet');
    remotes.forEach((url, index) => git(root, 'remote', 'add', `r${index}`, url));
    assert.equal((await daemon.call('project.register', { path: root })).status, 200);
    const status = await daemon.call<{ diagnostics: { code: string }[] }>('project.status', { path: root });
    return status.body.diagnostics.map((item) => item.code);
  }

  it('compares each remote’s host and path with the declared host and repository', async () => {
    const daemon = await startTestDaemon();
    try {
      assert.deepEqual(await mismatches(daemon, null, [`https://github.com/${REPOSITORY}.git`]), []);
      assert.deepEqual(await mismatches(daemon, null, [`git@github.com:${REPOSITORY.toUpperCase()}.git`]), []);
      assert.deepEqual(await mismatches(daemon, null, ['https://github.com/someone/else.git']), ['tracker.remote_mismatch']);
      assert.deepEqual(await mismatches(daemon, null, [`https://gitlab.com/${REPOSITORY}.git`]), ['tracker.remote_mismatch']);
      // A neutral hostname is not a mismatch once it is declared.
      assert.deepEqual(await mismatches(daemon, 'code.example.com', [`ssh://git@code.example.com:2222/${REPOSITORY}`]), []);
      assert.deepEqual(await mismatches(daemon, 'https://code.example.com/api/v3', [`git@code.example.com:${REPOSITORY}.git`]), []);
      // One matching remote is enough.
      assert.deepEqual(await mismatches(daemon, null, ['https://example.com/fork.git', `https://github.com/${REPOSITORY}`]), []);
    } finally {
      await daemon.stop();
    }
  });
});

describe('the daily on a GitHub tracker', () => {
  it('lists what can start, and leaves transitions and new tickets unavailable until states are recorded', async () => {
    await withGitHub([[issue(1, 'Start', { body: header({ Status: 'READY' }) })]], async (daemon, fake) => {
      const root = makeProject(manifest(fake.base));
      execFileSync('git', ['init', '--quiet'], { cwd: root });
      execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--allow-empty', '-m', 'x'], {
        cwd: root,
      });
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);

      type Daily = { transitions: unknown; newTickets: unknown; readyToStart: Section | null };
      const result = await daemon.call<Daily>('daily.get', { path: root });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.transitions, null);
      assert.equal(result.body.newTickets, null);
      assert.deepEqual(ids(result.body.readyToStart!), ['#1']);
    });
  });
});

describe('the GitHub adapter', () => {
  // Triage and the Spec: value are in no daemon response until the task brief (ticket 06),
  // so they are read here, from the adapter, against the same loopback server.
  it('takes triage from the label naming a canonical role, and keeps the Spec: value and its slug', async () => {
    const fake = await fakeGitHub([
      [
        issue(1, 'Labelled', {
          body: header({ Status: 'READY', Spec: `https://github.com/${REPOSITORY}/blob/0123abc/docs/specs/first/spec.md#L3` }),
          labels: [{ name: 'bug' }, { name: 'ready-for-agent' }],
        }),
        issue(2, 'Unlabelled', { body: header({ Status: 'READY', Spec: '`docs/specs/second/spec.md`' }), labels: [{ name: 'Ready-For-Agent' }] }),
        issue(3, 'No spec', { body: header({ Status: 'READY', Spec: 'see the wiki' }) }),
      ],
    ]);
    try {
      const reading = await readGitHubTasks(REPOSITORY, fake.base);
      assert.deepEqual(
        reading.tasks?.map(({ id, triage, spec, specSlug }) => ({ id, triage, spec, specSlug })),
        [
          { id: '#1', triage: 'ready-for-agent', spec: `https://github.com/${REPOSITORY}/blob/0123abc/docs/specs/first/spec.md#L3`, specSlug: 'first' },
          { id: '#2', triage: null, spec: 'docs/specs/second/spec.md', specSlug: 'second' },
          { id: '#3', triage: null, spec: 'see the wiki', specSlug: null },
        ],
      );
    } finally {
      await fake.close();
    }
  });
});
