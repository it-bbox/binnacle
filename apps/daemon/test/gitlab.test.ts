import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { gitlabApiRoot, readGitLabTasks } from '@binnacle/adapters';
import { sum } from '@binnacle/telemetry';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/** A Task's usage by role with no runs, as the brief gives it. */
const NO_ROLES = { implementation: sum([]), review: sum([]), rework: sum([]) };

type SnapshotTask = { id: string; title: string | null; state: string | null; unmetDependencies: string[]; ticket: string; start: string | null };
type Section = { items: SnapshotTask[]; remainder: number };
type Snapshot = {
  tasks: { inFlight: Section; readyToStart: Section; counts: Record<string, number> } | null;
  roadmap: { epics: unknown[] } | null;
  attention: { code: string; message: string }[];
};

/** A full project path with a subgroup, which GitLab's API takes URL-encoded as one segment. */
const REPOSITORY = 'gitlab-org/sub-group/project';
const ISSUES_PATH = `/projects/${encodeURIComponent(REPOSITORY)}/issues`;

// The daemon runs in this process and reads its environment: a token the developer has set
// would otherwise reach the loopback server, and every test below that expects none.
delete process.env.BINNACLE_GITLAB_TOKEN;

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** An issue in the shape GitLab's REST API returns it, with only the fields the adapter reads and one it must not. */
function issue(
  iid: number,
  title: string,
  fields: { state?: 'opened' | 'closed'; description?: string | null; labels?: string[] } = {},
): Record<string, unknown> {
  return {
    id: 1000 + iid,
    iid,
    title,
    state: 'opened',
    description: null,
    labels: [],
    web_url: `https://gitlab.com/${REPOSITORY}/-/issues/${iid}`,
    ...fields,
  };
}

const header = (lines: Record<string, string>): string =>
  [...Object.entries(lines).map(([name, value]) => `${name}: ${value}`), '', '**What to build:** something.', '', 'Status: DONE'].join('\n');

type Reply = { status: number; headers?: Record<string, string>; body: unknown };

/**
 * A loopback stand-in for GitLab at the network boundary: it serves `pages` of issues for
 * `REPOSITORY`, and `notes`, pages of each issue's notes by iid, none when it has no entry,
 * with GitLab's `Link` pagination header, or whatever `reply` says instead; a reply with status
 * 0 drops the connection. Every request path it receives is kept as sent, still encoded, with the
 * `private-token` header it carried.
 */
type FakeGitLab = {
  base: string;
  pages: unknown[][];
  notes: Record<number, unknown[][]>;
  reply: ((request: URL) => Reply | null) | null;
  requests: string[];
  tokens: (string | undefined)[];
  close(): Promise<void>;
};

async function fakeGitLab(pages: unknown[][]): Promise<FakeGitLab> {
  const fake: FakeGitLab = { base: '', pages, notes: {}, reply: null, requests: [], tokens: [], close: async () => {} };
  const server: Server = createServer((request, response) => {
    fake.requests.push(request.url ?? '/');
    fake.tokens.push(request.headers['private-token'] as string | undefined);
    const url = new URL(request.url ?? '/', fake.base);
    const reply = fake.reply?.(url) ?? pageReply(fake, url);
    if (reply.status === 0) return void request.socket.destroy();
    response.writeHead(reply.status, { 'content-type': 'application/json', ...reply.headers });
    response.end(JSON.stringify(reply.body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  fake.base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v4`;
  fake.close = () => new Promise((resolve) => server.close(() => resolve()));
  return fake;
}

function pageReply(fake: FakeGitLab, url: URL): Reply {
  const notes = new RegExp(`^/api/v4${ISSUES_PATH}/(\\d+)/notes$`).exec(url.pathname)?.[1];
  const pages = url.pathname === `/api/v4${ISSUES_PATH}` ? fake.pages : notes !== undefined ? (fake.notes[Number(notes)] ?? [[]]) : undefined;
  if (pages === undefined) return { status: 404, body: { message: '404 Project Not Found' } };
  const page = Number(url.searchParams.get('page') ?? '1');
  const link = (n: number): string => {
    const next = new URL(url);
    next.searchParams.set('page', String(n));
    return next.toString();
  };
  const headers: Record<string, string> =
    page < pages.length ? { link: `<${link(page + 1)}>; rel="next", <${link(1)}>; rel="first", <${link(pages.length)}>; rel="last"` } : {};
  return { status: 200, headers, body: pages[page - 1] ?? [] };
}

/** A note in the shape GitLab's REST API lists an issue's, with only the fields the adapter reads. */
const note = (body: string, system = false): Record<string, unknown> => ({ body, system, created_at: '2026-10-11T08:00:00.000Z' });

function manifest(host: string, extra = ''): string {
  return `version: 1\n\nproject:\n  id: gitlab-project\n\ntracker:\n  provider: gitlab\n  repository: ${REPOSITORY}\n  host: ${host}\n${extra}`;
}

function makeProject(text: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-gitlab-')));
  roots.push(root);
  mkdirSync(join(root, '.binnacle'));
  writeFileSync(join(root, '.binnacle', 'project.yaml'), text);
  return root;
}

async function withGitLab(pages: unknown[][], body: (daemon: TestDaemon, fake: FakeGitLab) => Promise<void>): Promise<void> {
  const [daemon, fake] = await Promise.all([startTestDaemon(), fakeGitLab(pages)]);
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
/** Tracker, Task and Review attention only: these projects declare no roadmap, which is not what is tested here. A closed issue is DONE without a Review read, and is no review.missing item. */
const codes = (body: Snapshot): string[] => body.attention.map((item) => item.code).filter((code) => /^(tracker|task|review)\./.test(code));

describe('GitLab issues as Tasks in the Product Snapshot', () => {
  it('reads every issue, open and closed, through every page of the full project path, by iid, web URL and description', async () => {
    const pages = [
      [issue(3, 'Third', { description: header({ Status: 'ACTIVE' }) })],
      [issue(1, 'First', { state: 'closed' })],
      [issue(2, 'Second', { description: header({ Status: 'READY', 'Blocked by': 'None (can start immediately)' }) })],
    ];
    await withGitLab(pages, async (daemon, fake) => {
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));

      assert.deepEqual(body.tasks, {
        inFlight: {
          items: [{ id: '#3', title: 'Third', state: 'ACTIVE', unmetDependencies: [], ticket: `https://gitlab.com/${REPOSITORY}/-/issues/3`, questions: { asked: 0, unanswered: 0 }, start: null, roles: { required: ['Developer', 'Reviewer'], source: 'default', suggested: [] } }],
          remainder: 0,
        },
        readyToStart: {
          items: [{ id: '#2', title: 'Second', state: 'READY', unmetDependencies: [], ticket: `https://gitlab.com/${REPOSITORY}/-/issues/2`, questions: { asked: 0, unanswered: 0 }, start: null, roles: { required: ['Developer', 'Reviewer'], source: 'default', suggested: [] } }],
          remainder: 0,
        },
        counts: { BACKLOG: 0, READY: 0, MERGED: 0, DONE: 1, CANCELLED: 0, unknown: 0 },
        parallel: { limit: 2, inProgress: 1, free: 1, provenance: 'calculated', impact: { available: false, reason: "graphify is not on the daemon's PATH, so no graph is built or read." } },
      });
      assert.deepEqual(codes(body), []);
      const requested = fake.requests.map((path) => [path.split('?')[0], new URL(path, fake.base).searchParams.get('page') ?? '1']);
      assert.deepEqual(requested.slice(0, 3), [
        [`/api/v4${ISSUES_PATH}`, '1'],
        [`/api/v4${ISSUES_PATH}`, '2'],
        [`/api/v4${ISSUES_PATH}`, '3'],
      ]);
      // Then, at once, the notes of each open issue.
      assert.deepEqual(requested.slice(3).sort(), [
        [`/api/v4${ISSUES_PATH}/2/notes`, '1'],
        [`/api/v4${ISSUES_PATH}/3/notes`, '1'],
      ]);
    });
  });

  it('takes an open issue’s state from its Status: line, and gives none with a diagnostic when it has no usable one', async () => {
    const pages = [
      [
        issue(1, 'Backlog', { description: header({ Status: 'BACKLOG' }) }),
        issue(2, 'Filed by hand', { description: 'Something is broken.' }),
        issue(3, 'Not a state', { description: header({ Status: 'WIP' }) }),
      ],
    ];
    await withGitLab(pages, async (daemon, fake) => {
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      assert.deepEqual(body.tasks!.counts, { BACKLOG: 1, READY: 0, MERGED: 0, DONE: 0, CANCELLED: 0, unknown: 2 });
      assert.deepEqual(codes(body), ['task.unknown_state', 'task.unknown_state']);
    });
  });

  it('has no close reason, so a closed issue is CANCELLED when its Status: says so and DONE otherwise, with GitHub’s mismatch rule', async () => {
    const closed = (iid: number, status?: string): Record<string, unknown> =>
      issue(iid, `Closed ${iid}`, { state: 'closed', description: status === undefined ? null : header({ Status: status }) });
    const pages = [
      [
        closed(1, 'CANCELLED'),
        closed(2, 'DONE'),
        closed(3),
        closed(4, 'ACTIVE'),
        issue(5, 'Forgot to close', { description: header({ Status: 'DONE' }) }),
        issue(6, 'Abandoned', { description: header({ Status: 'CANCELLED' }) }),
      ],
    ];
    await withGitLab(pages, async (daemon, fake) => {
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      // DONE: 2, 3, 4 and, by its Status:, the open 5. CANCELLED: 1 and, by its Status:, the open 6.
      assert.deepEqual(body.tasks!.counts, { BACKLOG: 0, READY: 0, MERGED: 0, DONE: 4, CANCELLED: 2, unknown: 0 });
      // A closed issue with no header is not a mismatch.
      const mismatches = body.attention.filter((item) => item.code === 'tracker.state_mismatch').map((item) => item.message);
      assert.deepEqual(codes(body), ['tracker.state_mismatch', 'tracker.state_mismatch', 'tracker.state_mismatch']);
      assert.match(mismatches[0]!, /^#4 .*closed as DONE/);
      assert.match(mismatches[1]!, /^#5 .*open/);
      assert.match(mismatches[2]!, /^#6 .*open/);
    });
  });

  it('meets a dependency on a closed issue, waits on an open one, and reports one on no known issue as dangling', async () => {
    const pages = [
      [
        issue(1, 'Done', { state: 'closed' }),
        issue(2, 'In flight', { description: header({ Status: 'ACTIVE' }) }),
        issue(3, 'Unblocked', { description: header({ Status: 'READY', 'Blocked by': '#1' }) }),
        issue(4, 'Waiting', { description: header({ Status: 'READY', 'Blocked by': '1, 2 (the API first)' }) }),
        issue(5, 'Typo', { description: header({ Status: 'READY', 'Blocked by': '#99' }) }),
      ],
    ];
    await withGitLab(pages, async (daemon, fake) => {
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      assert.deepEqual(ids(body.tasks!.readyToStart), ['#3', '#5']);
      assert.deepEqual(codes(body), ['task.dangling_dependency']);
    });
  });

  it('links a roadmap epic to its issues through the spec slug in their Spec: line, a path or a permalink', async () => {
    const pages = [
      [
        issue(1, 'By path', { description: header({ Status: 'ACTIVE', Spec: '`docs/specs/first/spec.md`' }) }),
        issue(2, 'By permalink', {
          description: header({ Status: 'READY', Spec: `https://gitlab.com/${REPOSITORY}/-/blob/0123abc/docs/specs/first/spec.md` }),
        }),
        issue(3, 'Another epic', { description: header({ Status: 'ACTIVE', Spec: 'docs/specs/second/spec.md' }) }),
      ],
    ];
    await withGitLab(pages, async (daemon, fake) => {
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

describe('a GitLab tracker that cannot be read', () => {
  const failures: [string, Reply, string][] = [
    ['an anonymous request refused', { status: 401, body: { message: '401 Unauthorized' } }, 'tracker.unauthorized'],
    ['no read access', { status: 403, body: { message: '403 Forbidden' } }, 'tracker.forbidden'],
    ['no such project', { status: 404, body: { message: '404 Project Not Found' } }, 'tracker.not_found'],
    ['the rate limit', { status: 429, headers: { 'retry-after': '60', 'ratelimit-remaining': '0' }, body: 'Retry later' }, 'tracker.rate_limited'],
  ];

  for (const [name, reply, code] of failures) {
    it(`answers everything else, with Tasks null and one ${code} item, on ${name}`, async () => {
      await withGitLab([[]], async (daemon, fake) => {
        fake.reply = () => reply;
        const root = makeProject(manifest(fake.base, '\nknowledge:\n  docs: docs\n'));
        mkdirSync(join(root, 'docs'));
        writeFileSync(join(root, 'docs', 'roadmap.md'), '# Roadmap\n\n| # | Epic | Status | Spec |\n| --- | --- | --- | --- |\n| 1 | First | tickets | — |\n');

        const body = await snapshot(daemon, root);
        assert.equal(body.tasks, null);
        assert.equal(body.roadmap?.epics.length, 1);
        assert.deepEqual(codes(body), [code]);
        assert.match(body.attention.find((item) => item.code === code)!.message, /GitLab/);
      });
    });
  }

  it('says whether a token was used when the request is refused', async () => {
    await withGitLab([[]], async (daemon, fake) => {
      fake.reply = () => ({ status: 401, body: {} });
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      assert.match(body.attention.find((item) => item.code === 'tracker.unauthorized')!.message, /no token/i);
    });
  });

  it('gives up the whole reading when a later page fails, rather than answer with part of the tracker', async () => {
    await withGitLab([[issue(1, 'One', { description: header({ Status: 'ACTIVE' }) })], [issue(2, 'Two')]], async (daemon, fake) => {
      fake.reply = (url) => (url.searchParams.get('page') === '2' ? { status: 404, body: {} } : null);
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      assert.equal(body.tasks, null);
      assert.deepEqual(codes(body), ['tracker.not_found']);
    });
  });

  it('is unreachable when nothing listens on the declared host', async () => {
    const fake = await fakeGitLab([[]]);
    await fake.close();
    const daemon = await startTestDaemon();
    try {
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      assert.equal(body.tasks, null);
      assert.deepEqual(codes(body), ['tracker.unreachable']);
    } finally {
      await daemon.stop();
    }
  });

  it('never follows a next page to another host', async () => {
    await withGitLab([[issue(1, 'One')]], async (daemon, fake) => {
      fake.reply = (url) =>
        url.searchParams.get('page') === null ? { status: 200, headers: { link: '<http://elsewhere.invalid/issues?page=2>; rel="next"' }, body: [] } : null;
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      assert.equal(body.tasks, null);
      assert.deepEqual(codes(body), ['tracker.unreachable']);
      assert.equal(fake.requests.length, 1);
    });
  });
});

describe('the credentials a GitLab tracker is read with', () => {
  // The lookup itself, its order, the insecure file and every leak are tested on GitHub
  // (`github.test.ts`); here, that GitLab gets its own variable, its own header and the same file.
  const credentials = (daemon: TestDaemon, entries: Record<string, string>): void => {
    const path = join(daemon.home, 'credentials.json');
    writeFileSync(path, JSON.stringify(entries));
    chmodSync(path, 0o600);
  };

  it('sends BINNACLE_GITLAB_TOKEN as private-token, then the declared host’s entry, and never the GitHub variable', async () => {
    await withGitLab([[issue(1, 'One', { description: header({ Status: 'ACTIVE' }) })]], async (daemon, fake) => {
      const root = makeProject(manifest(fake.base));
      credentials(daemon, { [fake.base]: 'glpat-fromTheFile' });
      process.env.BINNACLE_GITHUB_TOKEN = 'ghp_notForGitLab';
      try {
        process.env.BINNACLE_GITLAB_TOKEN = 'glpat-fromTheEnvironment';
        assert.deepEqual(ids((await snapshot(daemon, root)).tasks!.inFlight), ['#1']);
        delete process.env.BINNACLE_GITLAB_TOKEN;
        await snapshot(daemon, root);
      } finally {
        delete process.env.BINNACLE_GITLAB_TOKEN;
        delete process.env.BINNACLE_GITHUB_TOKEN;
      }
      assert.deepEqual(fake.tokens, ['glpat-fromTheEnvironment', 'glpat-fromTheEnvironment', 'glpat-fromTheFile', 'glpat-fromTheFile']);
    });
  });

  it('says a token was used when GitLab rejects it, without quoting it', async () => {
    await withGitLab([[]], async (daemon, fake) => {
      fake.reply = () => ({ status: 401, body: { message: '401 Unauthorized' } });
      credentials(daemon, { [fake.base]: 'glpat-rejected' });
      const body = await snapshot(daemon, makeProject(manifest(fake.base)));
      assert.deepEqual(codes(body), ['tracker.unauthorized']);
      assert.match(body.attention.find((item) => item.code === 'tracker.unauthorized')!.message, /a token was used/);
      assert.equal(JSON.stringify(body).includes('glpat-rejected'), false);
    });
  });
});

describe('the GitLab tracker in the manifest', () => {
  it('makes Tasks unavailable, naming the field, when no repository is declared', async () => {
    const daemon = await startTestDaemon();
    try {
      const body = await snapshot(daemon, makeProject('version: 1\n\nproject:\n  id: bare\n\ntracker:\n  provider: gitlab\n'));
      assert.equal(body.tasks, null);
      assert.deepEqual(codes(body), ['tracker.unavailable']);
      assert.match(body.attention.find((item) => item.code === 'tracker.unavailable')!.message, /tracker\.repository/);
    } finally {
      await daemon.stop();
    }
  });

  it('agrees with a remote at the declared host and full project path, subgroups included', async () => {
    const daemon = await startTestDaemon();
    try {
      const mismatches = async (host: string | null, remote: string): Promise<string[]> => {
        const root = makeProject(`version: 1\n\nproject:\n  id: remote-check\n\ntracker:\n  provider: gitlab\n  repository: ${REPOSITORY}\n${host ? `  host: ${host}\n` : ''}`);
        execFileSync('git', ['init', '--quiet'], { cwd: root });
        execFileSync('git', ['remote', 'add', 'origin', remote], { cwd: root });
        assert.equal((await daemon.call('project.register', { path: root })).status, 200);
        return (await daemon.call<{ diagnostics: { code: string }[] }>('project.status', { path: root })).body.diagnostics.map((item) => item.code);
      };
      assert.deepEqual(await mismatches(null, `git@gitlab.com:${REPOSITORY}.git`), []);
      assert.deepEqual(await mismatches(null, 'git@gitlab.com:gitlab-org/project.git'), ['tracker.remote_mismatch']);
      assert.deepEqual(await mismatches('gitlab.example.com', `https://gitlab.example.com/${REPOSITORY}.git`), []);
    } finally {
      await daemon.stop();
    }
  });

  // Below the seam on purpose, as for GitHub: through the daemon, a hostname's API root is
  // only reachable over the real network, and `pnpm test` stays offline.
  it('maps a host to its API root: gitlab.com by default, any other hostname, or a base URL as given', () => {
    assert.equal(gitlabApiRoot(null), 'https://gitlab.com/api/v4');
    assert.equal(gitlabApiRoot('gitlab.com'), 'https://gitlab.com/api/v4');
    assert.equal(gitlabApiRoot('gitlab.example.com'), 'https://gitlab.example.com/api/v4');
    assert.equal(gitlabApiRoot('http://127.0.0.1:8080/api/v4/'), 'http://127.0.0.1:8080/api/v4');
  });
});

// The delta's code is the same for every remote tracker (see github.test.ts for every case);
// this shows GitLab's states are recorded and compared like GitHub's.
describe('Task transitions on a GitLab tracker', () => {
  it('records Task states with a daily and a checkpoint, and lists what closed, started and was filed since', async () => {
    type Transition = { id: string; from: string | null; to: string | null };
    type Delta = { transitions: { items: Transition[] } | { available: false; reason: string } | null; newTickets: Section | null };
    type Event = { type: string; payload: Record<string, unknown> };
    const before = [
      issue(1, 'Close me', { description: header({ Status: 'ACTIVE' }) }),
      issue(2, 'Start me', { description: header({ Status: 'READY' }) }),
    ];
    await withGitLab([before], async (daemon, fake) => {
      const root = makeProject(manifest(fake.base));
      execFileSync('git', ['init', '--quiet'], { cwd: root });
      execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--allow-empty', '-m', 'Start'], {
        cwd: root,
      });
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);
      const first = await daemon.call<Delta>('daily.get', { path: root });
      assert.equal((first.body.transitions as { available: boolean }).available, false);
      assert.equal((await daemon.call('checkpoint.record', { path: root, promoted: [] })).status, 200);
      const events = (await daemon.call<{ events: Event[] }>('event.list')).body.events;
      for (const type of ['daily', 'checkpoint']) {
        assert.deepEqual(events.find((event) => event.type === type)?.payload.states, { '#1': 'ACTIVE', '#2': 'READY' });
      }

      fake.pages[0] = [
        issue(1, 'Close me', { state: 'closed', description: header({ Status: 'ACTIVE' }) }),
        issue(2, 'Start me', { description: header({ Status: 'ACTIVE' }) }),
        issue(3, 'Filed since', { description: header({ Status: 'BACKLOG' }) }),
      ];
      for (const operation of ['daily.get', 'checkpoint.prepare']) {
        const { status, body } = await daemon.call<Delta>(operation, { path: root });
        assert.equal(status, 200, JSON.stringify(body));
        assert.deepEqual(
          (body.transitions as { items: Transition[] }).items.map(({ id, from, to }) => ({ id, from, to })),
          [
            { id: '#1', from: 'ACTIVE', to: 'DONE' },
            { id: '#2', from: 'READY', to: 'ACTIVE' },
          ],
          operation,
        );
        assert.deepEqual(ids(body.newTickets!), ['#3'], operation);
      }
    });
  });
});

describe('the task brief on a GitLab tracker', () => {
  type Brief = {
    id: string;
    title: string | null;
    state: string | null;
    triage: string | null;
    ticket: string;
    spec: string | null;
    dependencies: { id: string; title: string | null; state: string | null; met: boolean | null; dangling: boolean }[];
    body: { text: string; truncated: boolean };
    branch: string;
    start: string | null;
    review: { text: string; truncated: boolean } | { available: false; reason: string } | null;
    diagnostics: { code: string; message: string }[];
  };

  async function taskGet(daemon: TestDaemon, root: string, id: string): Promise<{ status: number; body: Brief & { error: { code: string } } }> {
    assert.equal((await daemon.call('project.register', { path: root })).status, 200);
    return daemon.call<Brief & { error: { code: string } }>('task.get', { path: root, id });
  }

  it('gives the issue’s fields, its dependencies, its description after the header, and the branch; an unknown number is task.not_found', async () => {
    const pages = [
      [
        issue(1, 'Done', { state: 'closed' }),
        issue(3, 'Read GitLab issues (by iid)', {
          description: ['Status: READY', 'Blocked by: #1, #7', 'Spec: `docs/specs/first/spec.md`', '', '**What to build:** GitLab.', '', 'Status: DONE'].join('\n'),
          labels: ['ready-for-agent'],
        }),
      ],
    ];
    await withGitLab(pages, async (daemon, fake) => {
      const root = makeProject(manifest(fake.base));
      const result = await taskGet(daemon, root, '#3');
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.deepEqual(result.body, {
        id: '#3',
        title: 'Read GitLab issues (by iid)',
        state: 'READY',
        triage: 'ready-for-agent',
        ticket: `https://gitlab.com/${REPOSITORY}/-/issues/3`,
        spec: 'docs/specs/first/spec.md',
        dependencies: [
          { id: '#1', title: 'Done', state: 'DONE', met: true, dangling: false },
          { id: '#7', title: null, state: null, met: null, dangling: true },
        ],
        body: { text: '**What to build:** GitLab.\n\nStatus: DONE', truncated: false },
        branch: 'feat/3-read-gitlab-issues-by-iid',
        start: null,
        review: { available: false, reason: 'Binnacle reads only questions and answers from an issue’s comments, so no Review is read on GitHub or GitLab.' },
        questions: { branch: null, items: [] },
        roles: { required: ['Developer', 'Reviewer'], source: 'default', suggested: [] },
        diagnostics: [],
        byRole: NO_ROLES,
        reworkUnread: null,
      });
      assert.equal((await taskGet(daemon, root, '3')).body.id, '#3');
      assert.equal((await taskGet(daemon, root, '#9')).body.error.code, 'task.not_found');
      // Besides the issues, only the open issue's notes are read.
      assert.ok(fake.requests.every((path) => path.startsWith(`/api/v4${ISSUES_PATH}?`) || path.startsWith(`/api/v4${ISSUES_PATH}/3/notes?`)));
    });
  });
});

describe('questions and answers from GitLab issue notes', () => {
  type Questions = { branch: string | null; items: { text: string; answer: string | null }[] } | { available: false; reason: string };

  async function questions(daemon: TestDaemon, root: string, id: string): Promise<Questions> {
    assert.equal((await daemon.call('project.register', { path: root })).status, 200);
    const result = await daemon.call<{ questions: Questions }>('task.get', { path: root, id });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.questions;
  }

  it('reads each open issue’s notes through every page, oldest first, system notes left out, and a closed issue’s not at all', async () => {
    const pages = [[issue(1, 'Asked', { description: header({ Status: 'READY' }) }), issue(2, 'Never asked'), issue(3, 'Closed', { state: 'closed' })]];
    await withGitLab(pages, async (daemon, fake) => {
      fake.notes = {
        1: [
          [note('### Question\nWhich database?'), note('### Answer\nchanged the description', true)],
          [note('Just a note.'), note('### Answer\n\nSQLite.\n'), note('### Question\nAnd the port?')],
        ],
        3: [[note('### Question\nNever read.')]],
      };
      const root = makeProject(manifest(fake.base));
      assert.deepEqual(await questions(daemon, root, '#1'), {
        branch: null,
        items: [
          { text: 'Which database?', answer: 'SQLite.' },
          { text: 'And the port?', answer: null },
        ],
      });
      assert.deepEqual(await questions(daemon, root, '#2'), { branch: null, items: [] });
      assert.deepEqual(await questions(daemon, root, '#3'), {
        available: false,
        reason: 'Binnacle reads the comments of open issues only on GitLab, and #3 is closed.',
      });
      const listed = fake.requests.filter((path) => path.includes('/notes'));
      assert.ok(listed.every((path) => /\/issues\/[12]\/notes\?/.test(path)), listed.join(' '));
      for (const path of listed) {
        const query = new URL(path, fake.base).searchParams;
        assert.deepEqual([query.get('sort'), query.get('order_by')], ['asc', 'created_at']);
      }
      // Three reads, each of #1's two pages and #2's one.
      assert.equal(listed.length, 9);
    });
  });

  it('lists an open issue’s unanswered questions waiting for the owner, counts them, and counts none for a closed issue, whose notes are not read', async () => {
    const pages = [[issue(1, 'Asked', { description: header({ Status: 'ACTIVE' }) }), issue(2, 'Closed', { state: 'closed' })]];
    await withGitLab(pages, async (daemon, fake) => {
      fake.notes = { 1: [[note('### Question\nWhich database?'), note('### Answer\nSQLite.'), note('### Question\nAnd the port?')]] };
      const root = makeProject(manifest(fake.base));
      const body = (await snapshot(daemon, root)) as Snapshot & { pendingDecisions: { questions: unknown } };
      assert.deepEqual(body.pendingDecisions.questions, {
        items: [{ id: '#1', title: 'Asked', ticket: `https://gitlab.com/${REPOSITORY}/-/issues/1`, question: 'And the port?', branch: null }],
        remainder: 0,
      });
      assert.deepEqual((body.tasks!.inFlight.items[0] as SnapshotTask & { questions: unknown }).questions, { asked: 2, unanswered: 1 });
      const board = await daemon.call<{ columns: Record<string, { items: { id: string; questions: unknown }[] }> }>('task.list', { path: root, spec: null });
      assert.deepEqual(
        Object.values(board.body.columns).flatMap((column) => column.items.map((card) => [card.id, card.questions])),
        [
          ['#1', { asked: 2, unanswered: 1 }],
          ['#2', null],
        ],
      );
    });
  });

  const failures: [string, Reply, RegExp][] = [
    ['a token refused', { status: 401, body: { message: '401 Unauthorized' } }, /^GitLab refused the request for .*\(401\); a token was used\.$/],
    ['no read access', { status: 403, body: { message: '403 Forbidden' } }, /^GitLab gave no read access to the comments of .*\(403\); a token was used\.$/],
    ['the rate limit', { status: 429, headers: { 'retry-after': '60' }, body: 'Retry later' }, /^GitLab rate-limited the reading of .*\(429\)/],
    ['a dropped connection', { status: 0, body: null }, /^GitLab could not be read for /],
  ];

  for (const [name, reply, reason] of failures) {
    it(`leaves the Tasks readable and their questions unavailable with the reason, never the token, when one issue's notes fail on ${name}`, async () => {
      const token = 'glpat-readingTheNotes';
      process.env.BINNACLE_GITLAB_TOKEN = token;
      try {
        await withGitLab([[issue(1, 'One', { description: header({ Status: 'ACTIVE' }) }), issue(2, 'Two', { description: header({ Status: 'READY' }) })]], async (daemon, fake) => {
          fake.notes = { 1: [[note('### Question\nAsked.')]] };
          fake.reply = (url) => (url.pathname.endsWith('/2/notes') ? reply : null);
          const root = makeProject(manifest(fake.base));
          const body = await snapshot(daemon, root);
          assert.deepEqual(ids(body.tasks!.inFlight), ['#1']);
          assert.deepEqual(codes(body), []);
          const unavailable = await questions(daemon, root, '#1');
          assert.ok('available' in unavailable && !unavailable.available, JSON.stringify(unavailable));
          assert.match(unavailable.reason, reason);
          assert.deepEqual((body as Snapshot & { pendingDecisions: { questions: unknown } }).pendingDecisions.questions, unavailable);
          assert.equal(JSON.stringify([body, unavailable]).includes(token), false);
          assert.ok(fake.tokens.every((sent) => sent === token));
        });
      } finally {
        delete process.env.BINNACLE_GITLAB_TOKEN;
      }
    });
  }

  it('never follows a next page of notes to another host', async () => {
    await withGitLab([[issue(1, 'One')]], async (daemon, fake) => {
      fake.reply = (url) =>
        url.pathname.endsWith('/1/notes') ? { status: 200, headers: { link: '<http://elsewhere.invalid/notes?page=2>; rel="next"' }, body: [] } : null;
      const unavailable = await questions(daemon, makeProject(manifest(fake.base)), '#1');
      assert.deepEqual(unavailable, {
        available: false,
        reason: `GitLab pointed the next page of ${REPOSITORY} at ${fake.base} at another host, http://elsewhere.invalid, which is not read.`,
      });
      assert.deepEqual(
        fake.requests.map((path) => path.split('?')[0]),
        [`/api/v4${ISSUES_PATH}`, `/api/v4${ISSUES_PATH}/1/notes`],
      );
    });
  });
});

describe('the GitLab adapter', () => {
  // The spec slug is in no daemon response, only behind the roadmap checks, and triage's
  // case-sensitivity is not in the brief test, so both are read here, from the adapter.
  it('takes triage from the label naming a canonical role, and keeps the Spec: value and its slug', async () => {
    const fake = await fakeGitLab([
      [
        issue(1, 'Labelled', {
          description: header({ Status: 'READY', Spec: `https://gitlab.com/${REPOSITORY}/-/blob/0123abc/docs/specs/first/spec.md#L3` }),
          labels: ['bug', 'ready-for-agent'],
        }),
        issue(2, 'Unlabelled', { description: header({ Status: 'READY', Spec: '`docs/specs/second/spec.md`' }), labels: ['Ready-For-Agent'] }),
      ],
    ]);
    try {
      const reading = await readGitLabTasks(REPOSITORY, fake.base, null);
      assert.deepEqual(
        reading.tasks?.map(({ id, triage, spec, specSlug }) => ({ id, triage, spec, specSlug })),
        [
          { id: '#1', triage: 'ready-for-agent', spec: `https://gitlab.com/${REPOSITORY}/-/blob/0123abc/docs/specs/first/spec.md#L3`, specSlug: 'first' },
          { id: '#2', triage: null, spec: 'docs/specs/second/spec.md', specSlug: 'second' },
        ],
      );
    } finally {
      await fake.close();
    }
  });
});
