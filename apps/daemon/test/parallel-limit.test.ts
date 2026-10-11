import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * The Parallel limit on the machine (ADR-0041): read from the Binnacle home's `settings.json`
 * with its source, given by the snapshot's `tasks.parallel` with its mode, and set through the
 * daemon's authenticated API, which keeps every other key of the file.
 */
type Limit = { limit: number; mode: 'number' | 'auto'; source: 'manifest' | 'machine' | 'default' };
type Snapshot = { tasks: { parallel: Limit & { inProgress: number; free: number } }; attention: { code: string; message: string }[] };
type Failure = { error: { code: string; message: string } };

const MANIFEST = `version: 1

project:
  id: parallel-limit

tracker:
  provider: local
  local:
    issues: docs/specs
`;

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function makeProject(manifest = MANIFEST): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-parallel-')));
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

const settingsFile = (daemon: TestDaemon): string => join(daemon.home, 'settings.json');
const writeSettings = (daemon: TestDaemon, settings: unknown): void => writeFileSync(settingsFile(daemon), JSON.stringify(settings), { mode: 0o600 });

async function get(daemon: TestDaemon): Promise<Limit> {
  const result = await daemon.call<Limit>('parallel.get');
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

async function parallel(daemon: TestDaemon, root: string): Promise<Snapshot['tasks']['parallel'] & { attention: string[] }> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
  const result = await daemon.call<Snapshot>('project.snapshot', { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  const { limit, mode, source, inProgress, free } = result.body.tasks.parallel;
  return { limit, mode, source, inProgress, free, attention: result.body.attention.map((item) => item.code).filter((code) => code.startsWith('parallel_limit')) };
}

describe('the Parallel limit read from the machine', () => {
  it('is 2 by default, when the settings file is missing or does not set it', async () => {
    await withDaemon(async (daemon) => {
      assert.deepEqual(await get(daemon), { limit: 2, mode: 'number', source: 'default' });
      writeSettings(daemon, { obsidian: { vaultPath: '/nowhere' } });
      assert.deepEqual(await get(daemon), { limit: 2, mode: 'number', source: 'default' });
      assert.deepEqual(await parallel(daemon, makeProject()), { limit: 2, mode: 'number', source: 'default', inProgress: 0, free: 2, attention: [] });
    });
  });

  it("is the settings file's number, read on every call, and the snapshot gives it with its source", async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      writeSettings(daemon, { parallelLimit: 3 });
      assert.deepEqual(await get(daemon), { limit: 3, mode: 'number', source: 'machine' });
      assert.deepEqual(await parallel(daemon, root), { limit: 3, mode: 'number', source: 'machine', inProgress: 0, free: 3, attention: [] });
      writeSettings(daemon, { parallelLimit: 5 });
      assert.equal((await parallel(daemon, root)).limit, 5);
    });
  });

  it('is auto with its ceiling, 4', async () => {
    await withDaemon(async (daemon) => {
      writeSettings(daemon, { parallelLimit: 'auto' });
      assert.deepEqual(await get(daemon), { limit: 4, mode: 'auto', source: 'machine' });
      assert.deepEqual(await parallel(daemon, makeProject()), { limit: 4, mode: 'auto', source: 'machine', inProgress: 0, free: 4, attention: [] });
    });
  });

  it("gives way to a project manifest's own limit, for that project only", async () => {
    await withDaemon(async (daemon) => {
      writeSettings(daemon, { parallelLimit: 'auto' });
      const own = makeProject(`${MANIFEST}\nautomation:\n  max_parallel_development_tasks: 5\n`);
      assert.deepEqual(await parallel(daemon, own), { limit: 5, mode: 'number', source: 'manifest', inProgress: 0, free: 5, attention: [] });
      assert.deepEqual(await parallel(daemon, makeProject()), { limit: 4, mode: 'auto', source: 'machine', inProgress: 0, free: 4, attention: [] });
      assert.deepEqual(await get(daemon), { limit: 4, mode: 'auto', source: 'machine' });
    });
  });

  it('falls back to the default with an attention item when the file holds a value Binnacle cannot use', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      for (const bad of [0, 'many', 2.5, 17]) {
        writeSettings(daemon, { parallelLimit: bad });
        assert.deepEqual(await get(daemon), { limit: 2, mode: 'number', source: 'default' });
        assert.deepEqual((await parallel(daemon, root)).attention, ['parallel_limit.invalid'], JSON.stringify(bad));
      }
    });
  });
});

describe('the Parallel limit set through the daemon', () => {
  it('writes the limit, a number or auto, keeping every other key of the file, owner-only', async () => {
    await withDaemon(async (daemon) => {
      writeSettings(daemon, { obsidian: { vaultPath: '/vault', theme: 'dark' }, other: 1 });
      const set = await daemon.call<Limit>('parallel.set', { limit: 3 });
      assert.equal(set.status, 200, JSON.stringify(set.body));
      assert.deepEqual(set.body, { limit: 3, mode: 'number', source: 'machine' });
      assert.deepEqual(JSON.parse(readFileSync(settingsFile(daemon), 'utf8')), { obsidian: { vaultPath: '/vault', theme: 'dark' }, other: 1, parallelLimit: 3 });
      assert.equal(statSync(settingsFile(daemon)).mode & 0o777, 0o600);

      assert.deepEqual((await daemon.call<Limit>('parallel.set', { limit: 'auto' })).body, { limit: 4, mode: 'auto', source: 'machine' });
      assert.deepEqual(await get(daemon), { limit: 4, mode: 'auto', source: 'machine' });
      assert.equal(JSON.parse(readFileSync(settingsFile(daemon), 'utf8')).obsidian.vaultPath, '/vault');
    });
  });

  it('creates the settings file when there is none', async () => {
    await withDaemon(async (daemon) => {
      assert.equal((await daemon.call('parallel.set', { limit: 16 })).status, 200);
      assert.deepEqual(JSON.parse(readFileSync(settingsFile(daemon), 'utf8')), { parallelLimit: 16 });
    });
  });

  it('refuses zero, a negative, a fraction, a value over the bound and any other string, with a reason, writing nothing', async () => {
    await withDaemon(async (daemon) => {
      writeSettings(daemon, { obsidian: { vaultPath: '/vault' }, parallelLimit: 3 });
      const before = readFileSync(settingsFile(daemon), 'utf8');
      for (const limit of [0, -1, 1.5, 17, 'many', '3', 'AUTO', null, true, [2], undefined]) {
        const result = await daemon.call<Failure>('parallel.set', limit === undefined ? {} : { limit });
        assert.equal(result.status, 400, JSON.stringify(limit));
        assert.equal(result.body.error.code, 'parallel_limit.invalid');
        assert.match(result.body.error.message, /a whole number from 1 to 16, or "auto"/);
      }
      assert.equal(readFileSync(settingsFile(daemon), 'utf8'), before);
    });
  });

  it('refuses to rewrite a settings file it cannot read as a JSON object, leaving it as it is', async () => {
    await withDaemon(async (daemon) => {
      for (const text of ['{ "obsidian": ', '[1, 2]']) {
        writeFileSync(settingsFile(daemon), text);
        const result = await daemon.call<Failure>('parallel.set', { limit: 3 });
        assert.equal(result.status, 409);
        assert.equal(result.body.error.code, 'settings.unreadable');
        assert.equal(readFileSync(settingsFile(daemon), 'utf8'), text);
      }
    });
  });

  it("needs the daemon's token, as every operation does", async () => {
    await withDaemon(async (daemon) => {
      for (const token of [null, 'not-the-token']) {
        const result = await daemon.call<Failure>('parallel.set', { limit: 3 }, { token });
        assert.equal(result.status, 401);
      }
      assert.equal((await daemon.call<Failure>('parallel.get', {}, { token: null })).status, 401);
      assert.throws(() => statSync(settingsFile(daemon)), { code: 'ENOENT' });
    });
  });
});
