import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { runtimePath } from '@binnacle/daemon';
import { startTestDaemon } from '@binnacle/daemon/testing';

const BINN = fileURLToPath(new URL('../src/bin.ts', import.meta.url));

/** Asynchronous, so that the test daemon in this process can answer while `binn` runs. */
function binn(home: string, ...args: string[]): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BINN, ...args], { env: { ...process.env, HOME: home, BINNACLE_HOME: join(home, '.binnacle') } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

function temporaryHome(t: TestContext): string {
  const home = mkdtempSync(join(tmpdir(), 'binnacle-cli-dashboard-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  return home;
}

test('binn dashboard --print prints the running daemon\'s address with its token in the fragment, and opens nothing', async (t) => {
  const home = temporaryHome(t);
  const daemon = await startTestDaemon({ home: join(home, '.binnacle') });
  t.after(() => daemon.stop());

  const result = await binn(home, 'dashboard', '--print');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `http://127.0.0.1:${daemon.runtime.port}/#token=${daemon.token}\n`);
  assert.equal(result.stderr, '');
});

test('binn dashboard with no daemon gives daemon.unreachable and the command that starts one', async (t) => {
  const home = temporaryHome(t);
  for (const args of [['dashboard'], ['dashboard', '--print']]) {
    const result = await binn(home, ...args);
    assert.equal(result.status, 4, args.join(' '));
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /daemon\.unreachable/);
    assert.match(result.stderr, /binn daemon start/);
  }
});

test('binn dashboard gives daemon.unreachable when the runtime file names a live process that does not answer', async (t) => {
  const home = temporaryHome(t);
  const daemon = await startTestDaemon({ home: join(home, '.binnacle') });
  const { port } = daemon.runtime;
  await daemon.stop();
  // This test's own pid is alive, and nothing listens on the port the stopped daemon had.
  writeFileSync(runtimePath(join(home, '.binnacle')), JSON.stringify({ ...daemon.runtime, pid: process.pid, port }));

  const result = await binn(home, 'dashboard', '--print');
  assert.equal(result.status, 4);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /daemon\.unreachable/);
  assert.match(result.stderr, /binn daemon start/);
});

test('binn dashboard refuses an unknown option', async (t) => {
  const result = await binn(temporaryHome(t), 'dashboard', '--open');
  assert.equal(result.status, 2);
});
