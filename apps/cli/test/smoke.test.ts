import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { isAlive, readRuntime, tokenPath } from '@binnacle/daemon';

const BINN = fileURLToPath(new URL('../src/bin.ts', import.meta.url));
/** The version the release bumps, which the daemon run from source reports as its own. */
const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

/**
 * The one test that drives the real CLI as a subprocess. It covers what the in-process
 * seam cannot: the spawned daemon process, the runtime file, the token file and exit
 * codes. Everything else is tested through `@binnacle/daemon/testing`.
 */
test('binn daemon start, an operation, and stop', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'binnacle-smoke-'));
  const binn = (...args: string[]) =>
    spawnSync(process.execPath, [BINN, ...args], {
      encoding: 'utf8',
      // English, the language this test reads.
      env: { ...process.env, LC_ALL: 'C', BINNACLE_HOME: home, BINNACLE_PORT: '0' },
    });

  t.after(() => {
    const leftover = readRuntime(home);
    if (leftover && isAlive(leftover.pid)) process.kill(leftover.pid, 'SIGKILL');
    rmSync(home, { recursive: true, force: true });
  });

  await t.test('status before anything is started is unreachable', () => {
    const result = binn('daemon', 'status');
    assert.equal(result.status, 4, result.stderr);
    assert.match(result.stdout, /not running/);
  });

  await t.test('start reports the port it took and leaves a live daemon behind', () => {
    const result = binn('daemon', 'start');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Binnacle daemon started/);

    const runtime = readRuntime(home);
    assert.ok(runtime, 'a runtime file was written');
    assert.ok(runtime.port > 0);
    assert.equal(runtime.host, '127.0.0.1');
    assert.ok(isAlive(runtime.pid));
    assert.match(result.stdout, new RegExp(`http://127\\.0\\.0\\.1:${runtime.port}`));
  });

  await t.test('status runs the daemon.status operation over the API', () => {
    const runtime = readRuntime(home);
    assert.ok(runtime);
    const result = binn('daemon', 'status');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Binnacle daemon is running/);
    assert.match(result.stdout, new RegExp(`pid\\s+${runtime.pid}`));
    assert.match(result.stdout, new RegExp(`http://127\\.0\\.0\\.1:${runtime.port}`));
    assert.equal(/^\s*version\s+(\S+)$/m.exec(result.stdout)?.[1], VERSION, result.stdout);
  });

  await t.test('a second start reports the running instance instead of competing', () => {
    const before = readRuntime(home);
    const result = binn('daemon', 'start');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /already running/);
    assert.deepEqual(readRuntime(home), before);
  });

  await t.test('a rejected operation exits with the operation-failure code', () => {
    const token = tokenPath(home);
    const original = binn('daemon', 'status');
    assert.equal(original.status, 0, original.stderr);

    writeFileSync(token, 'a'.repeat(64));
    try {
      const result = binn('daemon', 'status');
      assert.equal(result.status, 3, result.stdout);
      assert.match(result.stderr, /The presented Binnacle API token is not valid\./);
      assert.doesNotMatch(result.stderr, /auth\.invalid/);
    } finally {
      rmSync(token, { force: true });
    }
  });

  await t.test('an unknown command is a usage error', () => {
    const result = binn('nonsense');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /unknown command/);
  });

  await t.test('stop stops the daemon cleanly and removes its runtime file', () => {
    const runtime = readRuntime(home);
    assert.ok(runtime);

    const result = binn('daemon', 'stop');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /stopped/);
    assert.equal(readRuntime(home), null);
    assert.equal(isAlive(runtime.pid), false);

    assert.equal(binn('daemon', 'status').status, 4);
  });
});
