import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { isAlive, readAutostart, readRuntime, runManager, servicePlatform, SERVICE_NAME } from '@binnacle/daemon';

/**
 * The live autostart test (ticket 07 of daemon-autostart): `binn daemon autostart` with this
 * machine's real service manager, systemd, launchd or Task Scheduler. It installs a service named
 * `binnacle` for the user, which would replace a developer's own, so it runs only where `CI` is
 * set: the workflow's `autostart-live` job, on a runner thrown away afterwards. `pnpm test` does
 * not run it.
 */

const BINN = fileURLToPath(new URL('../src/bin.ts', import.meta.url));
const skip = !process.env.CI && 'CI is not set: this test installs a real `binnacle` service for this user, so it runs on a CI runner only.';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test(`autostart on ${process.platform} with the real service manager`, { skip, timeout: 10 * 60_000 }, async (t: TestContext) => {
  const platform = servicePlatform();
  const home = mkdtempSync(join(tmpdir(), 'binnacle-live-'));
  const env: NodeJS.ProcessEnv = { ...process.env, BINNACLE_HOME: home };
  const binn = (...args: string[]) => spawnSync(process.execPath, [BINN, ...args], { encoding: 'utf8', env });

  /** The pid of the daemon answering for the home, or null. */
  function answering(): number | null {
    const status = binn('daemon', 'status');
    return status.status === 0 ? Number(status.stdout.match(/pid\s+(\d+)/)?.[1]) : null;
  }

  /** Polls until a daemon other than `not` answers, or null after `seconds`. */
  async function waitForDaemon(seconds: number, not?: number): Promise<number | null> {
    const deadline = Date.now() + seconds * 1000;
    for (;;) {
      const pid = answering();
      if (pid !== null && pid !== not) return pid;
      if (Date.now() >= deadline) return null;
      await sleep(500);
    }
  }

  /** Whether the manager still knows a service named `binnacle`. */
  const registered = (): boolean =>
    platform === 'win32'
      ? runManager('schtasks', ['/Query', '/TN', SERVICE_NAME]).ok
      : platform === 'darwin'
        ? runManager('launchctl', ['print', `gui/${process.getuid?.()}/${SERVICE_NAME}`]).ok
        : runManager('systemctl', ['--user', 'cat', SERVICE_NAME]).ok;

  t.after(() => {
    binn('daemon', 'autostart', 'off');
    const left = readRuntime(home);
    if (left && isAlive(left.pid)) process.kill(left.pid, 'SIGKILL');
    // A Windows daemon killed a moment ago may still hold its log.
    rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  });

  const on = binn('daemon', 'autostart', 'on');
  // Only Linux may lack the manager: a hosted runner's user may have no systemd user manager.
  if (platform === 'linux' && /autostart is not available here/.test(on.stderr)) {
    t.skip(`this runner has no systemd user manager: ${on.stderr.trim()}`);
    return;
  }
  assert.equal(on.status, 0, on.stderr);
  assert.match(binn('daemon', 'autostart').stdout, /Autostart is on for /);
  const first = await waitForDaemon(30);
  // Task Scheduler's own view, for a task that never answers on this runner.
  if (!first && platform === 'win32') {
    const query = runManager('schtasks', ['/Query', '/TN', SERVICE_NAME, '/V', '/FO', 'LIST']);
    t.diagnostic(query.ok ? query.output : query.message);
  }
  assert.ok(first, 'the service starts a daemon that answers');

  // A daemon that dies with a failure is started again by the manager.
  process.kill(first, 'SIGKILL');
  // Task Scheduler restarts a failed task after its one-minute interval, if at all.
  const restarted = await waitForDaemon(platform === 'win32' ? 90 : 30, first);
  if (platform === 'win32') {
    // Ticket 04 left it open: Task Scheduler may restart a task that fails to start, not one whose program fails.
    t.diagnostic(`Task Scheduler ${restarted ? 'restarted' : 'did not restart'} a daemon killed with a failure.`);
    if (!restarted) assert.equal(binn('daemon', 'start').status, 0);
  } else {
    assert.ok(restarted, 'the service manager restarts a daemon that died with a failure');
  }

  const stop = binn('daemon', 'stop');
  assert.equal(stop.status, 0, stop.stderr);
  assert.match(stop.stdout, /stopped through the service manager/);
  // Stopped through the manager, it is not started again.
  await sleep(3000);
  assert.equal(answering(), null, 'no daemon answers after stop');

  const start = binn('daemon', 'start');
  assert.equal(start.status, 0, start.stderr);
  assert.match(start.stdout, /started through the service manager/);
  const pid = answering();
  assert.ok(pid, 'the daemon answers after start');

  if (platform === 'win32') {
    // Ticket 04 left it open: whether ending the task ends Node, cmd's child; `binn daemon stop` signals it after.
    assert.ok(runManager('schtasks', ['/End', '/TN', SERVICE_NAME]).ok);
    const deadline = Date.now() + 10_000;
    while (isAlive(pid) && Date.now() < deadline) await sleep(250);
    t.diagnostic(`schtasks /End ${isAlive(pid) ? 'left' : 'ended'} the daemon, cmd's child.`);
    // Left running, it is ended here, so that `off` meets a task already ended, as after a `binn daemon stop`.
    if (isAlive(pid)) process.kill(pid, 'SIGKILL');
  }

  const off = binn('daemon', 'autostart', 'off');
  assert.equal(off.status, 0, off.stderr);
  assert.match(binn('daemon', 'autostart').stdout, /Autostart is off for /);
  assert.equal(answering(), null, 'no daemon answers after off');
  assert.equal(existsSync(readAutostart(home, env).path), false, 'the definition is removed');
  assert.equal(registered(), false, 'the service manager has no binnacle service left');
});
