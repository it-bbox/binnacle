import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { githubApiRoot, readGitHubTasks } from '@binnacle/adapters';
import { BRANCH_SLUG_LIMIT } from '@binnacle/core';
import { storePath } from '../src/index.ts';
import { BODY_LIMIT } from '../src/task.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

type SnapshotTask = { id: string; title: string | null; state: string | null; unmetDependencies: string[]; ticket: string };
type Section = { items: SnapshotTask[]; remainder: number };
type Snapshot = {
  roadmap: { epics: unknown[] } | null;
  tasks: { inFlight: Section; readyToStart: Section; counts: Record<string, number> } | null;
  attention: { code: string; message: string }[];
};

const REPOSITORY = 'octo-org/octo-repo';
const PERMALINK = `https://github.com/${REPOSITORY}/blob/0123abc/docs/specs/first/spec.md#L3`;

// The daemon runs in this process and reads its environment: a token the developer has set
// would otherwise reach the loopback server, and every test below that expects none.
delete process.env.BINNACLE_GITHUB_TOKEN;

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
 * Every request it receives is kept, with the `authorization` header it carried, so a test
 * can see what Binnacle asked for and with which token.
 */
type FakeGitHub = {
  base: string;
  pages: unknown[][];
  reply: ((request: URL) => Reply | null) | null;
  requests: URL[];
  authorizations: (string | undefined)[];
  close(): Promise<void>;
};

async function fakeGitHub(pages: unknown[][]): Promise<FakeGitHub> {
  const fake: FakeGitHub = { base: '', pages, reply: null, requests: [], authorizations: [], close: async () => {} };
  const server: Server = createServer((request: IncomingMessage, response) => {
    const url = new URL(request.url ?? '/', fake.base);
    fake.requests.push(url);
    fake.authorizations.push(request.headers.authorization);
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
const codes = (body: Pick<Snapshot, 'attention'>): string[] => body.attention.map((item) => item.code).filter((code) => /^(tracker|task)\./.test(code));

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

describe('the credentials a GitHub tracker is read with', () => {
  const ENV_TOKEN = 'ghp_fromTheEnvironment0001';
  const FILE_TOKEN = 'ghp_fromTheCredentialsFile2';

  /** Sets the daemon's environment for one test: it runs in this process. `undefined` unsets. */
  async function withEnv(vars: Record<string, string | undefined>, body: () => Promise<void>): Promise<void> {
    const saved = Object.fromEntries(Object.keys(vars).map((name) => [name, process.env[name]]));
    const apply = (values: Record<string, string | undefined>): void => {
      for (const [name, value] of Object.entries(values)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    };
    apply(vars);
    try {
      await body();
    } finally {
      apply(saved);
    }
  }

  function credentials(daemon: TestDaemon, contents: unknown, mode = 0o600): void {
    const path = join(daemon.home, 'credentials.json');
    writeFileSync(path, typeof contents === 'string' ? contents : JSON.stringify(contents));
    chmodSync(path, mode);
  }

  const noToken = { BINNACLE_GITHUB_TOKEN: undefined, BINNACLE_GITLAB_TOKEN: undefined, GITHUB_TOKEN: undefined, GH_TOKEN: undefined };

  it('sends BINNACLE_GITHUB_TOKEN from the daemon’s environment first, before the credentials file', async () => {
    await withEnv({ ...noToken, BINNACLE_GITHUB_TOKEN: ENV_TOKEN }, () =>
      withGitHub([[issue(1, 'One', { body: header({ Status: 'ACTIVE' }) })]], async (daemon, fake) => {
        credentials(daemon, { [fake.base]: FILE_TOKEN });
        const body = await snapshot(daemon, makeProject(manifest(fake.base)));
        assert.deepEqual(ids(body.tasks!.inFlight), ['#1']);
        assert.deepEqual(fake.authorizations, [`Bearer ${ENV_TOKEN}`]);
      }),
    );
  });

  it('sends the declared host’s entry in the credentials file when the environment has none, on every page', async () => {
    await withEnv(noToken, () =>
      withGitHub([[issue(1, 'One')], [issue(2, 'Two')]], async (daemon, fake) => {
        credentials(daemon, { 'github.com': 'ghp_anotherHost', [fake.base]: FILE_TOKEN });
        const body = await snapshot(daemon, makeProject(manifest(fake.base)));
        assert.equal(body.tasks!.counts.unknown, 2);
        assert.deepEqual(fake.authorizations, [`Bearer ${FILE_TOKEN}`, `Bearer ${FILE_TOKEN}`]);
      }),
    );
  });

  it('reads anonymously when neither holds a token for the declared host, and never reads GITHUB_TOKEN or the other provider’s variable', async () => {
    await withEnv({ ...noToken, GITHUB_TOKEN: 'ghp_generic', GH_TOKEN: 'ghp_ghCli', BINNACLE_GITLAB_TOKEN: 'glpat_other' }, () =>
      withGitHub([[issue(1, 'One', { body: header({ Status: 'ACTIVE' }) })]], async (daemon, fake) => {
        const root = makeProject(manifest(fake.base));
        assert.deepEqual(ids((await snapshot(daemon, root)).tasks!.inFlight), ['#1']);

        credentials(daemon, { 'github.com': 'ghp_anotherHost' });
        const body = await snapshot(daemon, root);
        assert.deepEqual(ids(body.tasks!.inFlight), ['#1']);
        assert.deepEqual(codes(body), []);
        assert.deepEqual(fake.authorizations, [undefined, undefined]);
      }),
    );
  });

  it('looks the token up on every call, so a token added to the file is used by the next snapshot', async () => {
    await withEnv(noToken, () =>
      withGitHub([[issue(1, 'One')]], async (daemon, fake) => {
        const root = makeProject(manifest(fake.base));
        await snapshot(daemon, root);
        credentials(daemon, { [fake.base]: FILE_TOKEN });
        await snapshot(daemon, root);
        assert.deepEqual(fake.authorizations, [undefined, `Bearer ${FILE_TOKEN}`]);
      }),
    );
  });

  it('refuses a credentials file others can read, and reads nothing from the tracker', { skip: process.platform === 'win32' && 'no POSIX modes' }, async () => {
    await withEnv(noToken, () =>
      withGitHub([[issue(1, 'One', { body: header({ Status: 'ACTIVE' }) })]], async (daemon, fake) => {
        const root = makeProject(manifest(fake.base, '\nknowledge:\n  docs: docs\n'));
        mkdirSync(join(root, 'docs'));
        writeFileSync(join(root, 'docs', 'roadmap.md'), '# Roadmap\n\n| # | Epic | Status | Spec |\n| --- | --- | --- | --- |\n| 1 | First | tickets | — |\n');
        for (const mode of [0o644, 0o640, 0o602]) {
          credentials(daemon, { [fake.base]: FILE_TOKEN }, mode);
          const body = await snapshot(daemon, root);
          assert.equal(body.tasks, null);
          assert.equal(body.roadmap?.epics.length, 1);
          assert.deepEqual(codes(body), ['tracker.credentials_insecure']);
          assert.equal(JSON.stringify(body).includes(FILE_TOKEN), false);
        }
        assert.equal(fake.requests.length, 0);

        // The environment comes first, so a token there is used without the file being read.
        await withEnv({ BINNACLE_GITHUB_TOKEN: ENV_TOKEN }, async () => {
          assert.deepEqual(codes(await snapshot(daemon, root)), []);
        });
        assert.deepEqual(fake.authorizations, [`Bearer ${ENV_TOKEN}`]);
      }),
    );
  });

  it('refuses a credentials file that is not an object of host to token, without quoting it', async () => {
    await withEnv(noToken, () =>
      withGitHub([[issue(1, 'One')]], async (daemon, fake) => {
        const root = makeProject(manifest(fake.base));
        const broken = [`{"${fake.base}": "${FILE_TOKEN}"`, `["${FILE_TOKEN}"]`, { [fake.base]: 42 }, { [fake.base]: `${FILE_TOKEN}\n${FILE_TOKEN}` }];
        for (const contents of broken) {
          credentials(daemon, contents);
          const body = await snapshot(daemon, root);
          assert.equal(body.tasks, null);
          assert.deepEqual(codes(body), ['tracker.unavailable']);
          assert.match(body.attention.find((item) => item.code === 'tracker.unavailable')!.message, /credentials\.json/);
          assert.equal(JSON.stringify(body).includes(FILE_TOKEN), false);
        }
        assert.equal(fake.requests.length, 0);
      }),
    );
  });

  it('says a token was used when it is rejected, and lets the token reach no response, diagnostic, event or log line', async () => {
    // Characters a header cannot carry would otherwise come back quoted in fetch's own error.
    const unusable = 'ghp_notAHeader\rvalue';
    const written: string[] = [];
    const capture = (stream: NodeJS.WriteStream): (() => void) => {
      const write = stream.write;
      stream.write = function (this: NodeJS.WriteStream, chunk: unknown, ...rest: unknown[]) {
        written.push(String(chunk));
        return (write as (...args: unknown[]) => boolean).call(this, chunk, ...rest);
      } as typeof stream.write;
      return () => {
        stream.write = write;
      };
    };
    const restore = [capture(process.stdout), capture(process.stderr)];
    const bodies: unknown[] = [];
    try {
      await withEnv({ ...noToken, BINNACLE_GITHUB_TOKEN: ENV_TOKEN }, () =>
        withGitHub([[]], async (daemon, fake) => {
          fake.reply = () => ({ status: 401, body: { message: 'Bad credentials' } });
          const root = makeProject(manifest(fake.base));
          execFileSync('git', ['init', '--quiet'], { cwd: root });
          execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--allow-empty', '-m', 'x'], {
            cwd: root,
          });

          const body = await snapshot(daemon, root);
          assert.equal(body.tasks, null);
          assert.deepEqual(codes(body), ['tracker.unauthorized']);
          assert.match(body.attention.find((item) => item.code === 'tracker.unauthorized')!.message, /a token was used/);
          bodies.push(body);
          for (const operation of ['project.status', 'daily.get', 'checkpoint.prepare', 'checkpoint.record', 'project.list', 'event.list']) {
            bodies.push((await daemon.call(operation, { path: root, promoted: [] })).body);
          }

          await withEnv({ BINNACLE_GITHUB_TOKEN: unusable }, async () => {
            const refused = await snapshot(daemon, root);
            assert.equal(refused.tasks, null);
            assert.deepEqual(codes(refused), ['tracker.unavailable']);
            assert.match(refused.attention.find((item) => item.code === 'tracker.unavailable')!.message, /BINNACLE_GITHUB_TOKEN/);
            bodies.push(refused);
          });
          assert.equal(fake.requests.length, 4);
        }),
      );
    } finally {
      for (const undo of restore) undo();
    }
    const everything = JSON.stringify(bodies) + written.join('');
    for (const token of [ENV_TOKEN, unusable, 'notAHeader']) assert.equal(everything.includes(token), false, `${token} leaked`);
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

  // Below the seam on purpose: through the daemon, a hostname's API root is only reachable
  // over the real network, and `pnpm test` stays offline. The base-URL form is what every
  // test above reads through.
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
      assert.deepEqual(await mismatches(daemon, 'code.example.com:8443', [`git@code.example.com:${REPOSITORY}.git`]), []);
      // One matching remote is enough.
      assert.deepEqual(await mismatches(daemon, null, ['https://example.com/fork.git', `https://github.com/${REPOSITORY}`]), []);
    } finally {
      await daemon.stop();
    }
  });
});

describe('Task transitions on a GitHub tracker', () => {
  type Unavailable = { available: false; reason: string };
  type Transition = { id: string; title: string | null; from: string | null; to: string | null; ticket: string };
  type Delta = {
    head: string;
    fallback: { reason: string } | null;
    commits: { count: number };
    transitions: { items: Transition[]; remainder: number } | Unavailable | null;
    newTickets: Section | Unavailable | null;
    readyToStart: Section | null;
    attention: { code: string; message: string }[];
  };
  type Event = { type: string; payload: Record<string, unknown> };

  function commit(root: string, message: string): void {
    execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--allow-empty', '-m', message], {
      cwd: root,
    });
  }

  /** A committed repository whose manifest points at the loopback stand-in, registered with `daemon`. */
  async function gitProject(daemon: TestDaemon, fake: FakeGitHub): Promise<string> {
    const root = makeProject(manifest(fake.base));
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    commit(root, 'Start');
    assert.equal((await daemon.call('project.register', { path: root })).status, 200);
    return root;
  }

  async function call(daemon: TestDaemon, operation: string, body: Record<string, unknown>): Promise<Delta> {
    const result = await daemon.call<Delta>(operation, body);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  }

  async function recorded(daemon: TestDaemon, type: string): Promise<Event[]> {
    return (await daemon.call<{ events: Event[] }>('event.list')).body.events.filter((event) => event.type === type);
  }

  const before = (): unknown[] => [
    issue(1, 'Close me', { body: header({ Status: 'ACTIVE' }) }),
    issue(2, 'Start me', { body: header({ Status: 'READY' }) }),
    issue(3, 'Leave me', { body: header({ Status: 'READY' }) }),
  ];
  const changed = (): unknown[] => [
    issue(1, 'Close me', { state: 'closed', state_reason: 'completed', body: header({ Status: 'ACTIVE' }) }),
    issue(2, 'Start me', { body: header({ Status: 'ACTIVE' }) }),
    issue(3, 'Leave me', { body: header({ Status: 'READY' }) }),
    issue(4, 'Filed since', { body: header({ Status: 'BACKLOG' }) }),
  ];
  const STATES_BEFORE = { '#1': 'ACTIVE', '#2': 'READY', '#3': 'READY' };
  const MOVES = [
    { id: '#1', from: 'ACTIVE', to: 'DONE' },
    { id: '#2', from: 'READY', to: 'ACTIVE' },
  ];
  const moves = (body: Delta): unknown[] => (body.transitions as { items: Transition[] }).items.map(({ id, from, to }) => ({ id, from, to }));

  function assertUnavailable(body: Delta, reason: RegExp): void {
    for (const list of [body.transitions, body.newTickets]) {
      assert.equal((list as Unavailable | null)?.available, false, JSON.stringify(list));
      assert.match((list as Unavailable).reason, reason);
    }
  }

  it('says transitions and new tickets are unavailable on the first daily, and records every Task’s state', async () => {
    await withGitHub([before()], async (daemon, fake) => {
      const root = await gitProject(daemon, fake);

      const body = await call(daemon, 'daily.get', { path: root });
      assert.equal(body.fallback?.reason, 'no_baseline');
      assertUnavailable(body, /no daily or checkpoint/i);
      assert.deepEqual(ids(body.readyToStart!), ['#2', '#3']);
      assert.deepEqual((await recorded(daemon, 'daily'))[0]?.payload, { head: body.head, states: STATES_BEFORE });
    });
  });

  it('lists what closed, what started and what was filed between two dailies, and nothing after a third', async () => {
    await withGitHub([before()], async (daemon, fake) => {
      const root = await gitProject(daemon, fake);
      await call(daemon, 'daily.get', { path: root });

      fake.pages[0] = changed();
      const body = await call(daemon, 'daily.get', { path: root });
      assert.equal(body.fallback, null);
      assert.deepEqual(body.transitions, {
        items: [
          { id: '#1', title: 'Close me', from: 'ACTIVE', to: 'DONE', ticket: `https://github.com/${REPOSITORY}/issues/1` },
          { id: '#2', title: 'Start me', from: 'READY', to: 'ACTIVE', ticket: `https://github.com/${REPOSITORY}/issues/2` },
        ],
        remainder: 0,
      });
      assert.deepEqual(body.newTickets, {
        items: [{ id: '#4', title: 'Filed since', state: 'BACKLOG', unmetDependencies: [], ticket: `https://github.com/${REPOSITORY}/issues/4` }],
        remainder: 0,
      });

      const again = await call(daemon, 'daily.get', { path: root });
      assert.deepEqual(again.transitions, { items: [], remainder: 0 });
      assert.deepEqual(again.newTickets, { items: [], remainder: 0 });
    });
  });

  it('says they are unavailable with an explicit since, which records nothing', async () => {
    await withGitHub([before()], async (daemon, fake) => {
      const root = await gitProject(daemon, fake);
      const first = await call(daemon, 'daily.get', { path: root });

      fake.pages[0] = changed();
      const since = await call(daemon, 'daily.get', { path: root, since: first.head });
      assert.equal(since.fallback, null);
      assertUnavailable(since, /since/);
      assert.equal((await recorded(daemon, 'daily')).length, 1);

      // The recorded baseline is untouched by `since`.
      assert.deepEqual(moves(await call(daemon, 'daily.get', { path: root })), MOVES);
    });
  });

  it('says they are unavailable when the recorded baseline was rewritten away and the delta fell back', async () => {
    await withGitHub([before()], async (daemon, fake) => {
      const root = await gitProject(daemon, fake);
      commit(root, 'To be rewritten');
      await call(daemon, 'daily.get', { path: root });
      execFileSync('git', ['reset', '--quiet', '--hard', 'HEAD~1'], { cwd: root });
      commit(root, 'Rewritten');

      fake.pages[0] = changed();
      const body = await call(daemon, 'daily.get', { path: root });
      assert.equal(body.fallback?.reason, 'baseline_diverged');
      assertUnavailable(body, /fell back to a window of commits/);
    });
  });

  it('answers the rest of a daily while the tracker is unreadable, records no states then, and says so the next time', async () => {
    await withGitHub([before()], async (daemon, fake) => {
      const root = await gitProject(daemon, fake);
      await call(daemon, 'daily.get', { path: root });

      commit(root, 'While the tracker is down');
      fake.reply = () => ({ status: 404, body: { message: 'Not Found' } });
      const down = await call(daemon, 'daily.get', { path: root });
      assert.equal(down.commits.count, 1);
      assert.equal(down.transitions, null);
      assert.equal(down.newTickets, null);
      assert.equal(down.readyToStart, null);
      assert.deepEqual(codes(down), ['tracker.not_found']);
      assert.deepEqual((await recorded(daemon, 'daily'))[0]?.payload, { head: down.head });

      fake.reply = null;
      const back = await call(daemon, 'daily.get', { path: root });
      assert.equal(back.fallback, null);
      assertUnavailable(back, /last daily recorded no Task states/);
    });
  });

  it('gives the checkpoint’s delta the transitions since the last checkpoint, not since the last daily', async () => {
    await withGitHub([before()], async (daemon, fake) => {
      const root = await gitProject(daemon, fake);

      assertUnavailable(await call(daemon, 'checkpoint.prepare', { path: root }), /no checkpoint/i);
      assert.equal((await daemon.call('checkpoint.record', { path: root, promoted: [] })).status, 200);
      assert.deepEqual((await recorded(daemon, 'checkpoint'))[0]?.payload.states, STATES_BEFORE);

      fake.pages[0] = changed();
      await call(daemon, 'daily.get', { path: root });
      const prepared = await call(daemon, 'checkpoint.prepare', { path: root });
      assert.deepEqual(moves(prepared), MOVES);
      assert.deepEqual(ids(prepared.newTickets as Section), ['#4']);
    });
  });

  it('keeps the recorded states through a projection rebuild', async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-home-')));
    roots.push(home);
    const fake = await fakeGitHub([before()]);
    try {
      const first = await startTestDaemon({ home });
      let root: string;
      try {
        root = await gitProject(first, fake);
        await call(first, 'daily.get', { path: root });
      } finally {
        await first.stop();
      }

      // A store another Binnacle wrote: its projections are dropped and re-derived on the next start.
      const db = new DatabaseSync(storePath(home));
      db.exec("update meta set value = '0' where key = 'schema_version'");
      db.close();

      fake.pages[0] = changed();
      const second = await startTestDaemon({ home });
      try {
        assert.equal((await recorded(second, 'store.rebuilt')).length, 1);
        assert.deepEqual(moves(await call(second, 'daily.get', { path: root })), MOVES);
      } finally {
        await second.stop();
      }
    } finally {
      await fake.close();
    }
  });
});

describe('the task brief on a GitHub tracker', () => {
  type Brief = {
    id: string;
    title: string | null;
    state: string | null;
    triage: string | null;
    ticket: string;
    spec: string | null;
    dependencies: { id: string; title: string | null; state: string | null; met: boolean; dangling: boolean }[];
    body: { text: string; truncated: boolean };
    branch: string;
  };
  type Envelope = { error: { code: string; message: string } };

  async function taskGet(daemon: TestDaemon, root: string, id: string): Promise<{ status: number; body: Brief & Envelope }> {
    assert.equal((await daemon.call('project.register', { path: root })).status, 200);
    return daemon.call<Brief & Envelope>('task.get', { path: root, id });
  }

  it('gives the issue’s fields, triage from its label, its dependencies, its body after the header, and the branch', async () => {
    const pages = [
      [
        issue(1, 'Done', { state: 'closed', state_reason: 'completed' }),
        issue(2, 'In flight', { body: header({ Status: 'ACTIVE' }) }),
        issue(4, 'A pull request', { body: header({ Status: 'READY' }), pull_request: { url: 'x' } }),
        issue(5, 'Add a task brief: `task.get` & friends!', {
          body: ['Status: READY', 'Blocked by: #1, 2, #99', `Spec: ${PERMALINK}`, '', '**What to build:** a brief.', '', 'Status: DONE'].join('\r\n'),
          labels: [{ name: 'bug' }, { name: 'ready-for-agent' }],
        }),
        issue(6, 'Mislabelled', { body: header({ Status: 'READY', Spec: '`docs/specs/second/spec.md`' }), labels: [{ name: 'Ready-For-Agent' }] }),
      ],
    ];
    await withGitHub(pages, async (daemon, fake) => {
      const root = makeProject(manifest(fake.base));
      const result = await taskGet(daemon, root, '#5');
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.deepEqual(result.body, {
        id: '#5',
        title: 'Add a task brief: `task.get` & friends!',
        state: 'READY',
        triage: 'ready-for-agent',
        ticket: `https://github.com/${REPOSITORY}/issues/5`,
        spec: PERMALINK,
        dependencies: [
          { id: '#1', title: 'Done', state: 'DONE', met: true, dangling: false },
          { id: '#2', title: 'In flight', state: 'ACTIVE', met: false, dangling: false },
          { id: '#99', title: null, state: null, met: false, dangling: true },
        ],
        body: { text: '**What to build:** a brief.\n\nStatus: DONE', truncated: false },
        branch: 'feat/5-add-a-task-brief-task-get-friends',
      });
      assert.equal((await taskGet(daemon, root, '5')).body.id, '#5');
      const other = (await taskGet(daemon, root, '#6')).body;
      assert.equal(other.triage, null, 'a label is a triage role only verbatim');
      assert.equal(other.spec, 'docs/specs/second/spec.md');
      // Issue comments are never read: every request is for the issue list.
      assert.ok(fake.requests.every((url) => url.pathname === `/repos/${REPOSITORY}/issues`));
    });
  });

  it('cuts a long body and a long title’s branch at fixed limits, and gives a title with no ASCII a number-only branch', async () => {
    const pages = [
      [
        issue(1, `${'word '.repeat(40)}end`, { body: header({ Status: 'READY' }).replace('something.', 'x'.repeat(BODY_LIMIT)) }),
        issue(2, 'Исправить всё', { body: header({ Status: 'READY' }) }),
      ],
    ];
    await withGitHub(pages, async (daemon, fake) => {
      const root = makeProject(manifest(fake.base));
      const long = (await taskGet(daemon, root, '#1')).body;
      assert.equal(long.body.truncated, true);
      assert.equal(Array.from(long.body.text).length, BODY_LIMIT);
      const slug = long.branch.replace(/^feat\/1-/, '');
      assert.ok(slug.length <= BRANCH_SLUG_LIMIT, slug);
      assert.match(slug, /^word(-word)*$/);
      assert.equal((await taskGet(daemon, root, '#2')).body.branch, 'feat/2');
    });
  });

  it('answers an unknown number, a pull request and a local id with task.not_found', async () => {
    await withGitHub([[issue(1, 'One'), issue(4, 'A pull request', { pull_request: { url: 'x' } })]], async (daemon, fake) => {
      const root = makeProject(manifest(fake.base));
      for (const id of ['#2', '4', 'epic/01']) {
        const result = await taskGet(daemon, root, id);
        assert.equal(result.status, 404, id);
        assert.equal(result.body.error.code, 'task.not_found', id);
      }
    });
  });

  it('answers with the tracker’s failure code when the issues cannot be read', async () => {
    await withGitHub([[]], async (daemon, fake) => {
      fake.reply = () => ({ status: 404, body: { message: 'Not Found' } });
      const result = await taskGet(daemon, makeProject(manifest(fake.base)), '#1');
      assert.equal(result.body.error.code, 'tracker.not_found');
    });
  });
});

describe('the GitHub adapter', () => {
  // The spec slug is in no daemon response, only behind the roadmap checks, so it is read
  // here, from the adapter, against the same loopback server.
  it('takes the spec slug from a Spec: path or permalink, and none from anything else', async () => {
    const fake = await fakeGitHub([
      [
        issue(1, 'Permalink', { body: header({ Status: 'READY', Spec: PERMALINK }) }),
        issue(2, 'Path', { body: header({ Status: 'READY', Spec: '`docs/specs/second/spec.md`' }) }),
        issue(3, 'No spec', { body: header({ Status: 'READY', Spec: 'see the wiki' }) }),
      ],
    ]);
    try {
      const reading = await readGitHubTasks(REPOSITORY, fake.base, null);
      assert.deepEqual(
        reading.tasks?.map(({ id, specSlug }) => ({ id, specSlug })),
        [
          { id: '#1', specSlug: 'first' },
          { id: '#2', specSlug: 'second' },
          { id: '#3', specSlug: null },
        ],
      );
    } finally {
      await fake.close();
    }
  });
});
