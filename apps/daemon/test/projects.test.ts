import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { registryPath, storePath, type ErrorEnvelope } from '../src/index.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

const POSIX = process.platform !== 'win32';

type Envelope = ErrorEnvelope;

type Event = {
  type: string;
  projectPath: string | null;
  occurredAt: string;
  payload: Record<string, string>;
  provenance: string;
};

/** Read straight off disk: the registry file is the record, so a test asserts against the file. */
function readRegistryFile(home: string): { projects: { path: string }[] } {
  try {
    return JSON.parse(readFileSync(registryPath(home), 'utf8'));
  } catch (error) {
    // No file is how "nothing is registered" looks, and a failed registration must leave it that way.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { projects: [] };
    throw error;
  }
}

type Project = {
  id: string;
  name: string | null;
  path: string;
  registeredAt: string;
  unavailable?: string;
};

const MINIMAL_MANIFEST = `version: 1

project:
  id: example-project
  name: Example Project
`;

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A directory carrying a committed project manifest, which is all registration needs. */
function makeProject(manifest: string = MINIMAL_MANIFEST): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-project-')));
  roots.push(root);
  mkdirSync(join(root, '.binnacle'));
  writeFileSync(join(root, '.binnacle', 'project.yaml'), manifest);
  return root;
}

async function withDaemon(body: (daemon: TestDaemon) => Promise<void>): Promise<void> {
  const daemon = await startTestDaemon();
  try {
    await body(daemon);
  } finally {
    await daemon.stop();
  }
}

describe('registering a project', () => {
  it('records the repository and reports the project it registered', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();

      const registered = await daemon.call<{ project: Project }>('project.register', { path: root });
      assert.equal(registered.status, 200);
      assert.equal(registered.body.project.id, 'example-project');
      assert.equal(registered.body.project.name, 'Example Project');
      assert.equal(registered.body.project.path, root);

      const listed = await daemon.call<{ projects: Project[] }>('project.list');
      assert.equal(listed.status, 200);
      assert.deepEqual(
        listed.body.projects.map((project) => project.path),
        [root],
      );
    });
  });
});

describe('registering the same project twice', () => {
  it('succeeds and changes nothing', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();

      const first = await daemon.call<{ project: Project }>('project.register', { path: root });
      const second = await daemon.call<{ project: Project }>('project.register', { path: root });
      assert.equal(second.status, 200);
      assert.equal(second.body.project.registeredAt, first.body.project.registeredAt);

      const listed = await daemon.call<{ projects: Project[] }>('project.list');
      assert.equal(listed.body.projects.length, 1);
      assert.equal(readRegistryFile(daemon.home).projects.length, 1);
    });
  });

  it('is the same project whether reached by a path or through a symlink to it', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      const link = join(realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-link-'))), 'repo');
      roots.push(link);
      symlinkSync(root, link);

      await daemon.call('project.register', { path: root });
      await daemon.call('project.register', { path: link });

      const listed = await daemon.call<{ projects: Project[] }>('project.list');
      assert.equal(listed.body.projects.length, 1);
    });
  });
});

describe('registering what cannot be registered', () => {
  it('names the template when there is no manifest', async () => {
    await withDaemon(async (daemon) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-bare-')));
      roots.push(root);

      const { status, body } = await daemon.call<Envelope>('project.register', { path: root });
      assert.equal(status, 400);
      assert.equal(body.error.code, 'manifest.missing');
      assert.match(body.error.message, /templates\/project\/project\.yaml\.example/);
      assert.deepEqual(readRegistryFile(daemon.home).projects, []);
    });
  });

  it('names the supported version when the manifest declares another', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject('version: 2\n\nproject:\n  id: from-the-future\n');

      const { status, body } = await daemon.call<Envelope>('project.register', { path: root });
      assert.equal(status, 400);
      assert.equal(body.error.code, 'manifest.unsupported_version');
      assert.match(body.error.message, /version 1/);
    });
  });

  it('rejects a path that is not there', async () => {
    await withDaemon(async (daemon) => {
      const { status, body } = await daemon.call<Envelope>('project.register', { path: '/no/such/place' });
      assert.equal(status, 400);
      assert.equal(body.error.code, 'project.path_not_found');
    });
  });
});

describe('unregistering a project', () => {
  it('removes the registration and leaves the repository alone', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      await daemon.call('project.register', { path: root });

      const { status } = await daemon.call('project.unregister', { path: root });
      assert.equal(status, 200);

      const listed = await daemon.call<{ projects: Project[] }>('project.list');
      assert.deepEqual(listed.body.projects, []);
      assert.deepEqual(readRegistryFile(daemon.home).projects, []);
      assert.ok(readFileSync(join(root, '.binnacle', 'project.yaml'), 'utf8').includes('example-project'));
    });
  });

  it('says so when the path was never registered', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      const { status, body } = await daemon.call<Envelope>('project.unregister', { path: root });
      assert.equal(status, 404);
      assert.equal(body.error.code, 'project.not_registered');
    });
  });
});

describe('the registry is the record, the table is a projection', () => {
  it('keeps the registry in a file under the Binnacle home, owner-only where enforced', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      await daemon.call('project.register', { path: root });

      const path = registryPath(daemon.home);
      assert.deepEqual(
        readRegistryFile(daemon.home).projects.map((entry) => entry.path),
        [root],
      );
      if (POSIX) assert.equal(statSync(path).mode & 0o777, 0o600);
    });
  });

  it('loses no registration when the database is deleted', async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-home-')));
    roots.push(home);
    const root = makeProject();

    const first = await startTestDaemon({ home });
    await first.call('project.register', { path: root });
    await first.stop();

    rmSync(storePath(home), { force: true });

    const second = await startTestDaemon({ home });
    try {
      const listed = await second.call<{ projects: Project[] }>('project.list');
      assert.deepEqual(
        listed.body.projects.map((p) => p.path),
        [root],
      );
      assert.equal(listed.body.projects[0]?.id, 'example-project');
    } finally {
      await second.stop();
    }
  });
});

describe('events', () => {
  it('appends an event for a registration and for an unregistration', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      await daemon.call('project.register', { path: root });
      await daemon.call('project.unregister', { path: root });

      const { status, body } = await daemon.call<{ events: Event[] }>('event.list');
      assert.equal(status, 200);
      assert.deepEqual(
        body.events.map((event) => event.type),
        ['project.unregistered', 'project.registered'],
      );
      for (const event of body.events) assert.equal(event.provenance, 'measured');
      assert.equal(body.events[1]?.payload.id, 'example-project');
    });
  });

  it('appends nothing for a registration that changes nothing', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      await daemon.call('project.register', { path: root });
      await daemon.call('project.register', { path: root });

      const { body } = await daemon.call<{ events: Event[] }>('event.list');
      assert.equal(body.events.length, 1);
    });
  });

  it('filters by project and limits, newest first', async () => {
    await withDaemon(async (daemon) => {
      const mine = makeProject();
      const other = makeProject('version: 1\n\nproject:\n  id: other-project\n  name: Other\n');
      await daemon.call('project.register', { path: mine });
      await daemon.call('project.register', { path: other });

      const filtered = await daemon.call<{ events: Event[] }>('event.list', { path: mine });
      assert.deepEqual(
        filtered.body.events.map((event) => event.projectPath),
        [mine],
      );

      const limited = await daemon.call<{ events: Event[] }>('event.list', { limit: 1 });
      assert.equal(limited.body.events.length, 1);
      assert.equal(limited.body.events[0]?.payload.id, 'other-project');
    });
  });

  it('survives the projection being re-derived on the next start', async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-home-')));
    roots.push(home);
    const root = makeProject();

    const first = await startTestDaemon({ home });
    await first.call('project.register', { path: root });
    await first.stop();

    // Change the manifest between runs: the projection must pick the new name up, which
    // is what proves it was re-derived rather than read back, and the history must not
    // move, which is what proves the append-only tier is untouched by that.
    writeFileSync(
      join(root, '.binnacle', 'project.yaml'),
      'version: 1\n\nproject:\n  id: example-project\n  name: Renamed Between Runs\n',
    );

    const second = await startTestDaemon({ home });
    try {
      const listed = await second.call<{ projects: Project[] }>('project.list');
      assert.equal(listed.body.projects[0]?.name, 'Renamed Between Runs');

      const { body } = await second.call<{ events: Event[] }>('event.list');
      assert.deepEqual(
        body.events.map((event) => event.type),
        ['project.registered'],
      );
    } finally {
      await second.stop();
    }
  });
});

describe('what the daemon refuses to guess or swallow', () => {
  it('refuses a relative path rather than resolving it against its own directory', async () => {
    await withDaemon(async (daemon) => {
      for (const path of ['.', 'some/repo', '../up']) {
        const { status, body } = await daemon.call<Envelope>('project.register', { path });
        assert.equal(status, 400, `${path} was not refused`);
        assert.equal(body.error.code, 'request.invalid');
        assert.match(body.error.message, /absolute/);
      }
    });
  });

  it('is still a hard error when an already-registered manifest turns unsupported', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      assert.equal((await daemon.call('project.register', { path: root })).status, 200);

      writeFileSync(join(root, '.binnacle', 'project.yaml'), 'version: 99\n\nproject:\n  id: example-project\n');

      const { status, body } = await daemon.call<Envelope>('project.register', { path: root });
      assert.equal(status, 400);
      assert.equal(body.error.code, 'manifest.unsupported_version');
    });
  });

  it('refuses a limit beyond the bound its own message names', async () => {
    await withDaemon(async (daemon) => {
      for (const limit of [0, -1, 1.5, 501]) {
        const { status, body } = await daemon.call<Envelope>('event.list', { limit });
        assert.equal(status, 400, `limit ${limit} was accepted`);
        assert.equal(body.error.code, 'request.invalid');
      }
    });
  });

  it('says how to repair an unreadable registry instead of answering a bare 500', async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-home-')));
    roots.push(home);
    const root = makeProject();

    const daemon = await startTestDaemon({ home });
    try {
      await daemon.call('project.register', { path: root });
      writeFileSync(registryPath(home), 'this is not json');

      const { status, body } = await daemon.call<Envelope>('project.register', { path: root });
      assert.equal(status, 500);
      assert.equal(body.error.code, 'registry.unreadable');
      assert.match(body.error.message, /Repair or remove/);
    } finally {
      await daemon.stop();
    }
  });
});
