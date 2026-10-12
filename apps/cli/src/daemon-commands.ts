import { spawn, type ChildProcess } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  daemonEntry,
  ensureHome,
  isAlive,
  logPath,
  OWNER_ONLY_FILE,
  readAutostart,
  readInstalled,
  readRuntime,
  removeRuntime,
  renderUnit,
  runManager,
  serviceInputs,
  servicePlatform,
  SERVICE_NAME,
  type Autostart,
  type Runtime,
} from '@binnacle/daemon';
import { callOperation, isListening } from './client.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { reportFailure, requireToken } from './report.ts';

const START_TIMEOUT_MS = 10_000;
const STOP_TIMEOUT_MS = 10_000;

/**
 * Starts the daemon: through the service manager when autostart is on for this home, first
 * rewriting the definition with the current paths, so that the daemon is the one the service
 * supervises (ADR-0043); otherwise as a detached user process.
 */
export async function start(home: string): Promise<ExitCode> {
  ensureHome(home);
  const service = serviceFor(home);
  if (service && rewriteUnit(home, service) && !systemctlAll(['daemon-reload'])) return EXIT.failed;

  // A live pid is a running daemon, exactly as `binn daemon status` reads it. A slow
  // daemon must never look stale here: replacing its runtime file would orphan it and
  // start a competitor against the same home.
  const running = readRuntime(home);
  if (running && isAlive(running.pid)) {
    report('Binnacle daemon is already running.', running);
    return EXIT.ok;
  }
  // Under the service it is left to the daemon, which replaces a stale file itself: a daemon the
  // manager restarted meanwhile may already have written its own, which removing would orphan.
  if (service) return await startService(home);
  // Absent, or a runtime file whose pid is gone: stale, not a blocker.
  if (running) removeRuntime(home);

  const log = openSync(logPath(home), 'a', OWNER_ONLY_FILE);
  let child;
  try {
    child = spawn(process.execPath, [daemonEntry()], {
      detached: true,
      stdio: ['ignore', log, log],
      env: { ...process.env, BINNACLE_HOME: home },
    });
  } finally {
    closeSync(log);
  }

  try {
    const runtime = await waitForStart(home, child);
    child.unref();
    report('Binnacle daemon started.', runtime);
    return EXIT.ok;
  } catch (error) {
    child.unref();
    console.error(`binn: ${(error as Error).message}`);
    const tail = logTail(home);
    if (tail) console.error(tail);
    return EXIT.failed;
  }
}

export async function status(home: string): Promise<ExitCode> {
  const code = await daemonStatus(home);
  try {
    console.log(describeAutostart(readAutostart(home)));
  } catch (error) {
    console.log(`Autostart is unknown: ${(error as Error).message}.`);
  }
  return code;
}

async function daemonStatus(home: string): Promise<ExitCode> {
  const runtime = readRuntime(home);
  if (!runtime) {
    console.log('Binnacle daemon is not running.');
    return EXIT.unreachable;
  }
  if (!isAlive(runtime.pid)) {
    console.log(`Binnacle daemon is not running (stale runtime file for pid ${runtime.pid}).`);
    return EXIT.unreachable;
  }

  try {
    const status = await callOperation<Runtime>(runtime, requireToken(home), 'daemon.status');
    report('Binnacle daemon is running.', status);
    return EXIT.ok;
  } catch (error) {
    return reportFailure(error);
  }
}

/** Stops the daemon: through the service manager when autostart is on for this home, so that it is not started again; then any process of the home left is signalled. */
export async function stop(home: string): Promise<ExitCode> {
  const runtime = readRuntime(home);
  // Read before the manager stops it: a pid gone afterwards was the service's daemon, not a stale file.
  const alive = runtime !== null && isAlive(runtime.pid);
  const supervised = serviceFor(home) !== null;
  if (supervised && !systemctlAll(['stop', SERVICE_NAME])) return EXIT.failed;
  if (!runtime) {
    console.log('Binnacle daemon is not running.');
    return EXIT.ok;
  }
  if (!alive) {
    removeRuntime(home);
    console.log(`Removed a stale runtime file for pid ${runtime.pid}.`);
    return EXIT.ok;
  }

  try {
    process.kill(runtime.pid, 'SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      console.error(`binn: could not signal pid ${runtime.pid}: ${(error as Error).message}`);
      return EXIT.failed;
    }
  }

  if (!(await waitFor(() => !isAlive(runtime.pid), STOP_TIMEOUT_MS))) {
    console.error(`binn: pid ${runtime.pid} did not stop within ${STOP_TIMEOUT_MS / 1000}s.`);
    return EXIT.failed;
  }

  // The daemon removes its own runtime file on a clean stop. Windows has no graceful
  // SIGTERM, so the file is removed here too rather than left for the next start.
  removeRuntime(home);
  console.log(`Binnacle daemon stopped${supervised ? ' through the service manager' : ''} (pid ${runtime.pid}).`);
  return EXIT.ok;
}

const AUTOSTART_ON = 'binn daemon autostart on';

/** `binn daemon autostart [on|off]`: turns autostart on or off for this home, or, with no action, says which it is (ADR-0043). */
export async function autostart(home: string, action: 'on' | 'off' | undefined): Promise<ExitCode> {
  let current: Autostart;
  try {
    servicePlatform();
  } catch (error) {
    console.error(`binn: ${(error as Error).message}`);
    return EXIT.usage;
  }
  try {
    current = readAutostart(home);
  } catch (error) {
    console.error(`binn: ${(error as Error).message}`);
    return EXIT.failed;
  }
  if (action === undefined) {
    console.log(describeAutostart(current));
    return EXIT.ok;
  }
  if (current.path === null) {
    console.error(`binn: autostart is not available on ${current.platform} yet.`);
    return EXIT.failed;
  }
  return action === 'on' ? await autostartOn(current, current.path) : await autostartOff(current);
}

const systemctl = (...args: string[]) => runManager('systemctl', ['--user', ...args]);

/** Runs each manager call in turn, stopping at the first refusal, which it reports as the manager printed it. */
function systemctlAll(...calls: string[][]): boolean {
  for (const args of calls) {
    const result = systemctl(...args);
    if (!result.ok) {
      console.error(`binn: systemctl --user ${args.join(' ')} failed: ${result.message}`);
      return false;
    }
  }
  return true;
}

/** Why autostart cannot be turned on here, or null when it can: a platform not supported yet, or no systemd user manager. */
export function autostartUnavailable({ platform, path }: Autostart): string | null {
  if (path === null) return `${platform} is not supported yet`;
  const manager = systemctl('show-environment');
  return manager.ok ? null : `no systemd user manager answers (${manager.message})`;
}

async function autostartOn(current: Autostart, path: string): Promise<ExitCode> {
  const { home } = current;
  const unavailable = autostartUnavailable(current);
  if (unavailable) {
    console.error(`binn: autostart is not available here: ${unavailable}. Nothing was changed.`);
    return EXIT.failed;
  }

  const unit = renderUnit(serviceInputs(home));
  const installed = readInstalled(path);
  if (installed?.text === unit && systemctl('is-enabled', SERVICE_NAME).ok && systemctl('is-active', SERVICE_NAME).ok) {
    console.log(`Autostart is already on for ${home}; nothing changed.`);
    return EXIT.ok;
  }

  // A daemon of this home started by hand holds the home: the service's could not claim it.
  const running = readRuntime(home);
  if (running && isAlive(running.pid)) {
    const stopped = await stop(home);
    if (stopped !== EXIT.ok) return stopped;
  }

  rewriteUnit(home, path, installed);

  // `restart`, not `enable --now`: a service already running under the old definition must pick up the new one.
  if (!systemctlAll(['daemon-reload'], ['enable', SERVICE_NAME], ['restart', SERVICE_NAME])) {
    console.error(`binn: ${path} is written but autostart may not be on; \`binn daemon autostart off\` removes it.`);
    return EXIT.failed;
  }
  console.log(`Autostart is on for ${home}: ${path} starts the daemon at login, and again when it fails.`);
  return EXIT.ok;
}

/** Off for this home only: a service that starts another home's daemon, such as the owner's seen from an agent's temporary home, is left alone. */
async function autostartOff({ home, path, serves }: Autostart): Promise<ExitCode> {
  if (serves !== home || path === null) {
    const other = serves ? ` The service starts the daemon for ${serves}, and stays.` : '';
    console.log(`Autostart is already off for ${home}; nothing changed.${other}`);
    return EXIT.ok;
  }
  if (!systemctlAll(['disable', '--now', SERVICE_NAME])) return EXIT.failed;
  rmSync(path, { force: true });
  if (!systemctlAll(['daemon-reload'])) return EXIT.failed;

  // A daemon of this home started by hand while the service was on: off leaves none running.
  const running = readRuntime(home);
  if (running && isAlive(running.pid)) {
    const stopped = await stop(home);
    if (stopped !== EXIT.ok) return stopped;
  }
  console.log(`Autostart is off for ${home}: the service's daemon is stopped and ${path} is removed.`);
  return EXIT.ok;
}

function describeAutostart({ state, platform, home, path, serves, missing }: Autostart): string {
  const where = path ? `${platform}, ${path}` : platform;
  if (state === 'on') return `Autostart is on for ${home} (${where}).`;
  if (state === 'broken') return `Autostart is broken for ${home} (${where}): ${missing.join(' and ')} no longer exists. Repair it with \`${AUTOSTART_ON}\`.`;
  const other = serves && serves !== home ? ` The service starts the daemon for ${serves} instead.` : '';
  return `Autostart is off for ${home} (${platform}).${other} Turn it on with \`${AUTOSTART_ON}\`.`;
}

/** The definition's path when autostart is on, or broken, for this home: then start and stop go through the manager. Anything unreadable leaves them as they were. */
function serviceFor(home: string): string | null {
  try {
    const current = readAutostart(home);
    return current.state === 'off' ? null : current.path;
  } catch {
    return null;
  }
}

/** Writes the definition with the current paths when the installed one differs, saying what it replaced; true when it wrote. */
function rewriteUnit(home: string, path: string, installed = readInstalled(path)): boolean {
  const unit = renderUnit(serviceInputs(home));
  if (installed?.text === unit) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, unit);
  if (installed && !installed.ours) console.error(`binn: warning: replaced ${path}, which Binnacle did not write.`);
  else if (installed && installed.home !== home) console.log(`Autostart moves from ${installed.home} to ${home}.`);
  else if (installed) console.log(`Rewrote ${path} with the current paths to Node, the daemon and PATH.`);
  return true;
}

async function startService(home: string): Promise<ExitCode> {
  if (!systemctlAll(['start', SERVICE_NAME])) return EXIT.failed;
  try {
    report('Binnacle daemon started through the service manager.', await waitForStart(home));
    return EXIT.ok;
  } catch (error) {
    console.error(`binn: ${(error as Error).message} \`journalctl --user -u ${SERVICE_NAME}\` shows its output.`);
    return EXIT.failed;
  }
}

function report(headline: string, runtime: Runtime): void {
  console.log(headline);
  console.log(`  address  http://${runtime.host}:${runtime.port}`);
  console.log(`  pid      ${runtime.pid}`);
  console.log(`  since    ${runtime.startedAt}`);
  console.log(`  version  ${runtime.version}`);
}

/** Waits for the daemon to answer: the child spawned, or, under the service manager, whichever process holds the home. */
async function waitForStart(home: string, child?: ChildProcess): Promise<Runtime> {
  let exitCode: number | null = null;
  const exited = (): number | null => exitCode;
  child?.once('exit', (code) => {
    exitCode = code ?? -1;
  });

  const deadline = Date.now() + START_TIMEOUT_MS;
  for (;;) {
    const runtime = readRuntime(home);
    if (runtime && (child ? runtime.pid === child.pid : isAlive(runtime.pid)) && (await isListening(runtime))) return runtime;

    const code = exited();
    if (code !== null) throw new Error(`the daemon exited with code ${code} before it started listening.`);
    if (Date.now() >= deadline) throw new Error(`the daemon did not start within ${START_TIMEOUT_MS / 1000}s.`);
    await delay(25);
  }
}

async function waitFor(done: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (done()) return true;
    if (Date.now() >= deadline) return false;
    await delay(25);
  }
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function logTail(home: string, lines = 20): string {
  try {
    return readFileSync(logPath(home), 'utf8').trimEnd().split('\n').slice(-lines).join('\n');
  } catch {
    return '';
  }
}
