import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { isAlive, readRuntime } from '@binnacle/daemon';
import { fakeSystemctl } from './fake-systemctl.ts';

const BINN = fileURLToPath(new URL('../src/bin.ts', import.meta.url));
const DAEMON_ENTRY = fileURLToPath(import.meta.resolve('@binnacle/daemon/bin'));

function setup(t: TestContext, platform = 'linux') {
  const root = mkdtempSync(join(tmpdir(), 'binnacle-autostart-'));
  const home = join(root, 'binnacle');
  const user = join(root, 'user');
  const bin = join(root, 'bin');
  const state = join(root, 'state');
  const log = join(root, 'systemctl.log');
  for (const dir of [user, bin, state]) mkdirSync(dir);
  writeFileSync(join(bin, 'systemctl'), fakeSystemctl(log, state), { mode: 0o755 });

  const env: NodeJS.ProcessEnv = { ...process.env, HOME: user, BINNACLE_HOME: home, BINNACLE_PORT: '0', BINNACLE_SERVICE_PLATFORM: platform, PATH: bin };
  // Nothing here may reach this machine's own user manager or its configuration.
  delete env.XDG_CONFIG_HOME;
  delete env.XDG_RUNTIME_DIR;
  delete env.DBUS_SESSION_BUS_ADDRESS;

  t.after(() => {
    const leftover = readRuntime(home);
    if (leftover && isAlive(leftover.pid)) process.kill(leftover.pid, 'SIGKILL');
    rmSync(root, { recursive: true, force: true });
  });

  return {
    home,
    bin,
    unit: join(user, '.config', 'systemd', 'user', 'binnacle.service'),
    binn: (...args: string[]) => spawnSync(process.execPath, [BINN, ...args], { encoding: 'utf8', env }),
    calls: (): string[] => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []),
    set: (flag: string) => writeFileSync(join(state, flag), 'yes\n'),
    env,
  };
}

test('autostart on writes the unit with absolute paths, BINNACLE_HOME and PATH, then enables and starts it', (t) => {
  const { binn, unit, calls, home, bin } = setup(t);

  const on = binn('daemon', 'autostart', 'on');
  assert.equal(on.status, 0, on.stderr);
  assert.match(on.stdout, /Autostart is on/);

  const text = readFileSync(unit, 'utf8');
  assert.match(text, /^# Written by binn daemon autostart/);
  assert.ok(text.includes(`ExecStart="${process.execPath}" "${DAEMON_ENTRY}"`), text);
  assert.ok(text.includes(`Environment="BINNACLE_HOME=${home}"`), text);
  assert.ok(text.includes(`Environment="PATH=${bin}"`), text);
  assert.match(text, /^Restart=on-failure$/m);
  assert.match(text, /^WantedBy=default\.target$/m);
  assert.deepEqual(calls().slice(-3), ['--user daemon-reload', '--user enable binnacle', '--user restart binnacle']);

  const state = binn('daemon', 'autostart');
  assert.equal(state.status, 0, state.stderr);
  assert.match(state.stdout, new RegExp(`Autostart is on for ${home} \\(linux`));
});

test('autostart on again says nothing changed and calls nothing that changes', (t) => {
  const { binn, calls } = setup(t);
  assert.equal(binn('daemon', 'autostart', 'on').status, 0);
  const before = calls().length;

  const again = binn('daemon', 'autostart', 'on');
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /already on.*nothing changed/);
  assert.deepEqual(calls().slice(before), ['--user show-environment', '--user is-enabled binnacle', '--user is-active binnacle']);
});

test('autostart off stops, disables and removes the unit, and again says nothing changed', (t) => {
  const { binn, unit, calls } = setup(t);
  assert.equal(binn('daemon', 'autostart', 'on').status, 0);

  const off = binn('daemon', 'autostart', 'off');
  assert.equal(off.status, 0, off.stderr);
  assert.match(off.stdout, /Autostart is off/);
  assert.equal(existsSync(unit), false);
  assert.deepEqual(calls().slice(-2), ['--user disable --now binnacle', '--user daemon-reload']);

  const before = calls().length;
  const again = binn('daemon', 'autostart', 'off');
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /already off.*nothing changed/);
  assert.equal(calls().length, before);

  assert.match(binn('daemon', 'autostart').stdout, /Autostart is off for .*binn daemon autostart on/);
});

test('a unit whose Node path no longer exists reads broken, naming the path and the repair', (t) => {
  const { binn, unit } = setup(t);
  assert.equal(binn('daemon', 'autostart', 'on').status, 0);
  writeFileSync(unit, readFileSync(unit, 'utf8').replace(`"${process.execPath}"`, '"/nowhere/node"'));

  const state = binn('daemon', 'autostart');
  assert.equal(state.status, 0, state.stderr);
  assert.match(state.stdout, /Autostart is broken for .*\/nowhere\/node no longer exists.*binn daemon autostart on/s);
});

test('autostart on replaces a unit Binnacle did not write, with a warning', (t) => {
  const { binn, unit } = setup(t);
  mkdirSync(join(unit, '..'), { recursive: true });
  writeFileSync(unit, '[Service]\nExecStart=/opt/node /opt/binnacle/apps/daemon/src/bin.ts\n');

  const on = binn('daemon', 'autostart', 'on');
  assert.equal(on.status, 0, on.stderr);
  assert.match(on.stderr, /warning: replaced .*binnacle\.service, which Binnacle did not write/);
  assert.match(readFileSync(unit, 'utf8'), /^# Written by binn daemon autostart/);
});

test('a refusal of systemctl is reported with its message', (t) => {
  const { binn, set } = setup(t);
  set('refuse');

  const on = binn('daemon', 'autostart', 'on');
  assert.equal(on.status, 3);
  assert.match(on.stderr, /systemctl --user enable binnacle.*Failed to enable unit: Access denied/s);
});

test('without a systemd user manager, autostart on refuses and writes nothing', async (t) => {
  await t.test('systemctl is there but no user manager answers', (t) => {
    const { binn, unit, set, calls } = setup(t);
    set('no-manager');
    const on = binn('daemon', 'autostart', 'on');
    assert.equal(on.status, 3);
    assert.match(on.stderr, /not available.*No medium found/s);
    assert.equal(existsSync(unit), false);
    assert.deepEqual(calls(), ['--user show-environment']);
  });

  await t.test('no systemctl at all', (t) => {
    const { binn, unit, bin } = setup(t);
    rmSync(join(bin, 'systemctl'));
    const on = binn('daemon', 'autostart', 'on');
    assert.equal(on.status, 3);
    assert.match(on.stderr, /not available/);
    assert.equal(existsSync(unit), false);
  });
});

test('autostart on replaces a running user-process daemon of the same home', (t) => {
  const { binn, home } = setup(t);
  const start = binn('daemon', 'start');
  assert.equal(start.status, 0, start.stderr);
  const runtime = readRuntime(home);
  assert.ok(runtime && isAlive(runtime.pid));

  const on = binn('daemon', 'autostart', 'on');
  assert.equal(on.status, 0, on.stderr);
  assert.equal(isAlive(runtime.pid), false);
  assert.equal(readRuntime(home), null);
});

test('autostart off from another home leaves the service alone, and off leaves no daemon of its own home', (t) => {
  const { binn, unit, calls, env, home } = setup(t);
  assert.equal(binn('daemon', 'autostart', 'on').status, 0);
  const before = calls().length;

  const other = spawnSync(process.execPath, [BINN, 'daemon', 'autostart', 'off'], { encoding: 'utf8', env: { ...env, BINNACLE_HOME: `${home}-agent` } });
  assert.equal(other.status, 0, other.stderr);
  assert.match(other.stdout, new RegExp(`already off for ${home}-agent; nothing changed\\. The service starts the daemon for ${home}, and stays`));
  assert.ok(existsSync(unit));
  assert.equal(calls().length, before);

  // The fake manager starts nothing, so this daemon is a user process of the service's home.
  assert.equal(binn('daemon', 'start').status, 0);
  const runtime = readRuntime(home);
  assert.ok(runtime && isAlive(runtime.pid));
  const off = binn('daemon', 'autostart', 'off');
  assert.equal(off.status, 0, off.stderr);
  assert.equal(isAlive(runtime.pid), false);
  assert.equal(existsSync(unit), false);
});

test('autostart on rewrites a unit whose paths changed, and says so', (t) => {
  const { binn, unit } = setup(t);
  assert.equal(binn('daemon', 'autostart', 'on').status, 0);
  writeFileSync(unit, readFileSync(unit, 'utf8').replace(`"${process.execPath}"`, '"/nowhere/node"'));

  const on = binn('daemon', 'autostart', 'on');
  assert.equal(on.status, 0, on.stderr);
  assert.match(on.stdout, /Rewrote .*binnacle\.service with the current paths/);
  assert.ok(readFileSync(unit, 'utf8').includes(`"${process.execPath}"`));
  assert.match(binn('daemon', 'autostart').stdout, /Autostart is on/);
});

test('the platform variable selects the platform', (t) => {
  const { binn, calls } = setup(t, 'darwin');
  const on = binn('daemon', 'autostart', 'on');
  assert.equal(on.status, 3);
  assert.match(on.stderr, /not available on darwin yet/);
  assert.deepEqual(calls(), []);

  const bad = setup(t, 'plan9').binn('daemon', 'autostart');
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /BINNACLE_SERVICE_PLATFORM/);
});
