import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { runtimePath } from '@binnacle/daemon';
import { startTestDaemon } from '@binnacle/daemon/testing';
import { daemonAddress } from '../src/export.ts';

const BINN = fileURLToPath(new URL('../src/bin.ts', import.meta.url));

/** Asynchronous, so that the test daemon in this process can answer while `binn` runs. */
function binn(home: string, ...args: string[]): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return binnWith(home, {}, ...args);
}

function binnWith(home: string, env: NodeJS.ProcessEnv, ...args: string[]): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // English, the language these tests read, unless a test sets another.
    const child = spawn(process.execPath, [BINN, ...args], { env: { ...process.env, LC_ALL: 'C', HOME: home, BINNACLE_HOME: join(home, '.binnacle'), ...env } });
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

/** A PATH holding only a fake opener, under the platform's name, which writes the address it was given. */
function fakeOpener(home: string): { path: string; opened: string } {
  const bin = join(home, 'bin');
  const opened = join(home, 'opened');
  mkdirSync(bin);
  for (const name of ['xdg-open', 'open']) {
    writeFileSync(join(bin, name), `#!/bin/sh\nprintf '%s' "$1" > '${opened}'\n`);
    chmodSync(join(bin, name), 0o755);
  }
  return { path: bin, opened };
}

async function waitForFile(path: string): Promise<string> {
  for (let i = 0; i < 100 && !existsSync(path); i++) await new Promise((resolve) => setTimeout(resolve, 50));
  return readFileSync(path, 'utf8');
}

/** A skill's shell output reaches the model's provider, and the token authorises the daemon's local API (ADR-0031). */
test('binn dashboard passes the opener the address with its token, and prints it without the token', { skip: process.platform === 'win32' }, async (t) => {
  const home = temporaryHome(t);
  const daemon = await startTestDaemon({ home: join(home, '.binnacle') });
  t.after(() => daemon.stop());
  const opener = fakeOpener(home);

  const result = await binnWith(home, { PATH: opener.path }, 'dashboard');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `http://127.0.0.1:${daemon.runtime.port}/\n`);
  assert.ok(!(result.stdout + result.stderr).includes(daemon.token));
  assert.equal(await waitForFile(opener.opened), `http://127.0.0.1:${daemon.runtime.port}/#token=${daemon.token}`);
});

test('binn dashboard with no browser to open says to run binn dashboard --print at a terminal, and shows no token', { skip: process.platform === 'win32' }, async (t) => {
  const home = temporaryHome(t);
  const daemon = await startTestDaemon({ home: join(home, '.binnacle') });
  t.after(() => daemon.stop());
  mkdirSync(join(home, 'empty'));

  const result = await binnWith(home, { PATH: join(home, 'empty') }, 'dashboard');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `http://127.0.0.1:${daemon.runtime.port}/\n`);
  assert.match(result.stderr, /could not open a browser/);
  assert.match(result.stderr, /`binn dashboard --print` at a terminal/);
  assert.ok(!(result.stdout + result.stderr).includes(daemon.token));
});

/** A daemon in a container, bound to every interface and reached from the host at a published port (ADR-0048). */
const ALLOWED = ['127.0.0.1:7718', 'localhost:7718'];

test('binn dashboard --print gives the first allowed Host value with the token, when the daemon allows one', async (t) => {
  const home = temporaryHome(t);
  const daemon = await startTestDaemon({ home: join(home, '.binnacle'), bind: '0.0.0.0', allowedHosts: ALLOWED });
  t.after(() => daemon.stop());

  const result = await binn(home, 'dashboard', '--print');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `http://127.0.0.1:7718/#token=${daemon.token}\n`);
});

test('binn dashboard in a container with no browser prints the allowed address, which stands, and says the opener failed', { skip: process.platform === 'win32' }, async (t) => {
  const home = temporaryHome(t);
  const daemon = await startTestDaemon({ home: join(home, '.binnacle'), bind: '0.0.0.0', allowedHosts: ALLOWED });
  t.after(() => daemon.stop());
  mkdirSync(join(home, 'empty'));

  const result = await binnWith(home, { PATH: join(home, 'empty') }, 'dashboard');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'http://127.0.0.1:7718/\n');
  assert.match(result.stderr, /could not open a browser/);
  assert.ok(!(result.stdout + result.stderr).includes(daemon.token));
});

test('binn daemon status shows the bound address and every address the daemon accepts', async (t) => {
  const home = temporaryHome(t);
  const daemon = await startTestDaemon({ home: join(home, '.binnacle'), bind: '0.0.0.0', allowedHosts: ALLOWED });
  t.after(() => daemon.stop());

  const result = await binn(home, 'daemon', 'status');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`^ {2}address {2}http://127\\.0\\.0\\.1:${daemon.runtime.port}$`, 'm'));
  assert.match(result.stdout, /^ {2}bound {4}0\.0\.0\.0$/m);
  assert.match(result.stdout, new RegExp(`^ {2}accepts {2}127\\.0\\.0\\.1:${daemon.runtime.port}, 127\\.0\\.0\\.1:7718, localhost:7718$`, 'm'));
});

test('binn daemon status names an accepted address once, as when a container\'s host port is the daemon\'s own', async (t) => {
  const home = temporaryHome(t);
  const daemon = await startTestDaemon({ home: join(home, '.binnacle'), bind: '0.0.0.0', allowedHosts: ['127.0.0.1:7718', '127.0.0.1:7718'] });
  t.after(() => daemon.stop());

  const result = await binn(home, 'daemon', 'status');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`^ {2}accepts {2}127\\.0\\.0\\.1:${daemon.runtime.port}, 127\\.0\\.0\\.1:7718$`, 'm'));
});

test('the telemetry export points at the runtime file\'s host, loopback, never 0.0.0.0', async (t) => {
  const home = temporaryHome(t);
  const daemon = await startTestDaemon({ home: join(home, '.binnacle'), bind: '0.0.0.0', allowedHosts: ALLOWED });
  t.after(() => daemon.stop());

  assert.equal(daemonAddress(join(home, '.binnacle')), `http://127.0.0.1:${daemon.runtime.port}`);
});

test('binn dashboard with no daemon says no daemon answers, with the command that starts one, and exits 4', async (t) => {
  const home = temporaryHome(t);
  for (const args of [['dashboard'], ['dashboard', '--print']]) {
    const result = await binn(home, ...args);
    assert.equal(result.status, 4, args.join(' '));
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /no Binnacle daemon is answering/);
    assert.doesNotMatch(result.stderr, /daemon\.unreachable/);
    assert.match(result.stderr, /binn daemon start/);
  }
});

test('binn dashboard says no daemon answers when the runtime file names a live process that does not answer', async (t) => {
  const home = temporaryHome(t);
  const daemon = await startTestDaemon({ home: join(home, '.binnacle') });
  const { port } = daemon.runtime;
  await daemon.stop();
  // This test's own pid is alive, and nothing listens on the port the stopped daemon had.
  writeFileSync(runtimePath(join(home, '.binnacle')), JSON.stringify({ ...daemon.runtime, pid: process.pid, port }));

  const result = await binn(home, 'dashboard', '--print');
  assert.equal(result.status, 4);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /no Binnacle daemon is answering/);
  assert.match(result.stderr, /binn daemon start/);
});

test('binn dashboard refuses an unknown option', async (t) => {
  const result = await binn(temporaryHome(t), 'dashboard', '--open');
  assert.equal(result.status, 2);
});
