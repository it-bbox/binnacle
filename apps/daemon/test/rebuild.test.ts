import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { registryPath, storePath, type ErrorEnvelope } from '../src/index.ts';
import { startTestDaemon } from '../src/testing.ts';

type Event = {
  type: string;
  projectPath: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
};

type Project = {
  id: string | null;
  name: string | null;
  path: string;
  unavailable: string | null;
};

/** The version the release bumps (ADR-0044), which the daemon run from source reports as its own. */
const CLI_VERSION = (JSON.parse(readFileSync(new URL('../../cli/package.json', import.meta.url), 'utf8')) as { version: string }).version;

const manifest = (name: string): string => `version: 1\n\nproject:\n  id: example-project\n  name: ${name}\n`;

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function temporary(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  roots.push(root);
  return root;
}

function makeProject(name = 'Example Project'): string {
  const root = temporary('binnacle-rebuild-');
  mkdirSync(join(root, '.binnacle'));
  writeFileSync(join(root, '.binnacle', 'project.yaml'), manifest(name));
  return root;
}

/**
 * Turns the store into one an earlier Binnacle wrote: another schema version, and a
 * `project` table of a shape this one cannot write to. This is a fixture, like a
 * manifest file — there is no API for "be an older release".
 */
function ageStore(home: string): void {
  const db = new DatabaseSync(storePath(home));
  db.exec(`
    update meta set value = '0' where key = 'schema_version';
    drop table project;
    create table project (path text primary key, name text);
  `);
  db.close();
}

describe('a store written under another schema version', () => {
  it('drops and re-derives the projections, keeping the registry and the history', async () => {
    const home = temporary('binnacle-home-');
    const root = makeProject('Before');

    const first = await startTestDaemon({ home });
    await first.call('project.register', { path: root });
    const history = (await first.call<{ events: Event[] }>('event.list')).body.events;
    await first.stop();

    ageStore(home);
    writeFileSync(join(root, '.binnacle', 'project.yaml'), manifest('After'));
    const registry = readFileSync(registryPath(home), 'utf8');

    // No command, no migration step: starting the daemon is the whole upgrade.
    const second = await startTestDaemon({ home });
    try {
      const listed = await second.call<{ projects: Project[] }>('project.list');
      assert.equal(listed.status, 200);
      assert.deepEqual(
        listed.body.projects.map(({ path, id, name }) => ({ path, id, name })),
        [{ path: root, id: 'example-project', name: 'After' }],
      );

      assert.equal(readFileSync(registryPath(home), 'utf8'), registry);

      const { body } = await second.call<{ events: Event[] }>('event.list');
      for (const event of history) assert.ok(body.events.some((kept) => JSON.stringify(kept) === JSON.stringify(event)));
      const rebuilt = body.events.find((event) => event.type === 'store.rebuilt');
      assert.ok(rebuilt, `no store.rebuilt among ${body.events.map((e) => e.type).join(', ')}`);
      assert.equal(rebuilt.payload.from, 0);
      assert.equal(typeof rebuilt.payload.to, 'number');
    } finally {
      await second.stop();
    }
  });

  for (const [event, operation, body] of [
    ['daily', 'daily.get', {}],
    ['checkpoint', 'checkpoint.record', { promoted: [] }],
  ] as const) {
    it(`keeps the ${event} baseline, which is history rather than projection`, async () => {
      const home = temporary('binnacle-home-');
      const root = makeProject();
      const git = (...args: string[]): string =>
        execFileSync('git', ['-c', 'user.name=Binnacle Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
          cwd: root,
          encoding: 'utf8',
        });
      git('init', '--quiet');
      git('add', '.');
      git('commit', '--quiet', '-m', 'Start');

      const first = await startTestDaemon({ home });
      await first.call('project.register', { path: root });
      const recorded = await first.call<{ head: string }>(operation, { path: root, ...body });
      assert.equal(recorded.status, 200, JSON.stringify(recorded.body));
      await first.stop();

      ageStore(home);
      const second = await startTestDaemon({ home });
      try {
        const next = await second.call<{ from: { commit: string | null; source: string }; commits: { count: number } }>('daily.get', { path: root });
        assert.deepEqual(next.body.from, { commit: recorded.body.head, source: event });
        assert.equal(next.body.commits.count, 0);
      } finally {
        await second.stop();
      }
    });
  }

  it('is not rebuilt when the version has not changed', async () => {
    const home = temporary('binnacle-home-');
    const first = await startTestDaemon({ home });
    await first.stop();

    const second = await startTestDaemon({ home });
    try {
      const { body } = await second.call<{ events: Event[] }>('event.list');
      assert.ok(!body.events.some((event) => event.type === 'store.rebuilt'));
    } finally {
      await second.stop();
    }
  });
});

describe('the daemon lifecycle in the history', () => {
  it('records every start and every clean stop', async () => {
    const home = temporary('binnacle-home-');
    const first = await startTestDaemon({ home });
    await first.stop();

    const second = await startTestDaemon({ home });
    try {
      const { body } = await second.call<{ events: Event[] }>('event.list');
      assert.deepEqual(
        body.events.map((event) => event.type),
        ['daemon.started', 'daemon.stopped', 'daemon.started'],
      );
      for (const event of body.events) {
        assert.equal(event.projectPath, null);
        assert.equal(typeof event.payload.pid, 'number');
        assert.equal(event.payload.version, CLI_VERSION);
      }
      assert.equal(body.events[0]?.payload.port, second.runtime.port);
    } finally {
      await second.stop();
    }
  });
});

describe('a registered repository that has disappeared from disk', () => {
  it('stays registered and is answered with a reason by list, status and detect', async () => {
    const home = temporary('binnacle-home-');
    const root = makeProject();

    const first = await startTestDaemon({ home });
    await first.call('project.register', { path: root });
    rmSync(root, { recursive: true, force: true });

    const check = async (daemon: typeof first): Promise<void> => {
      const listed = await daemon.call<{ projects: Project[] }>('project.list');
      assert.deepEqual(
        listed.body.projects.map((project) => project.path),
        [root],
      );
      assert.match(listed.body.projects[0]?.unavailable ?? '', /No directory at/);

      for (const path of [root, join(root, 'nested')]) {
        const detected = await daemon.call<{ project: Project }>('project.detect', { path });
        assert.equal(detected.status, 200);
        assert.equal(detected.body.project.path, root);
        assert.match(detected.body.project.unavailable ?? '', /No directory at/);

        const status = await daemon.call<{ project: Project; git: { available: boolean } }>('project.status', { path });
        assert.equal(status.status, 200);
        assert.equal(status.body.project.path, root);
        assert.match(status.body.project.unavailable ?? '', /No directory at/);
        assert.equal(status.body.git.available, false);
      }
      assert.deepEqual(
        JSON.parse(readFileSync(registryPath(home), 'utf8')).projects.map((entry: { path: string }) => entry.path),
        [root],
      );
    };

    try {
      await check(first);
    } finally {
      await first.stop();
    }

    // And the same after the projection is re-derived from the registry on a start.
    const second = await startTestDaemon({ home });
    try {
      await check(second);
    } finally {
      await second.stop();
    }
  });

  it('is found through a symlinked prefix of the path it disappeared from', async () => {
    const home = temporary('binnacle-home-');
    const root = makeProject();
    const link = join(temporary('binnacle-link-'), 'via');
    symlinkSync(join(root, '..'), link, 'dir');

    const daemon = await startTestDaemon({ home });
    try {
      await daemon.call('project.register', { path: root });
      rmSync(root, { recursive: true, force: true });

      const detected = await daemon.call<{ project: Project }>('project.detect', {
        path: join(link, basename(root), 'nested'),
      });
      assert.equal(detected.status, 200);
      assert.equal(detected.body.project.path, root);
    } finally {
      await daemon.stop();
    }
  });

  it('is still project.path_not_found for a missing path no registration contains', async () => {
    const home = temporary('binnacle-home-');
    const daemon = await startTestDaemon({ home });
    try {
      await daemon.call('project.register', { path: makeProject() });
      const missing = join(temporary('binnacle-gone-'), 'never-existed');
      for (const operation of ['project.detect', 'project.status']) {
        const { status, body } = await daemon.call<ErrorEnvelope>(operation, { path: missing });
        assert.equal(status, 400);
        assert.equal(body.error.code, 'project.path_not_found');
      }
    } finally {
      await daemon.stop();
    }
  });
});
