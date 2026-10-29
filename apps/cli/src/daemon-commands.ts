import { terminalText } from '@binnacle/core';
import { spawn, type ChildProcess } from 'node:child_process';
import { closeSync, openSync, readFileSync, rmSync } from 'node:fs';
import {
  credentialsKey,
  credentialsPath,
  daemonEntry,
  ensureHome,
  isAlive,
  logPath,
  OWNER_ONLY_FILE,
  readAutostart,
  readInstalled,
  readManifest,
  readRegistry,
  readRuntime,
  removeRuntime,
  renderDefinition,
  runManager,
  serviceInputs,
  servicePlatform,
  SERVICE_NAME,
  trackerToken,
  writeDefinition,
  type Autostart,
  type Runtime,
} from '@binnacle/daemon';
import { callOperation, isListening } from './client.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { reportFailure, requireToken } from './report.ts';
import { marked, row, say, T, type Text } from './text.ts';

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
  if (service && rewriteDefinition(service) && !managerFor(service).reload()) return EXIT.failed;

  // A live pid is a running daemon, exactly as `binn daemon status` reads it. A slow
  // daemon must never look stale here: replacing its runtime file would orphan it and
  // start a competitor against the same home.
  const running = readRuntime(home);
  if (running && isAlive(running.pid)) {
    report(T.alreadyRunning, running);
    return EXIT.ok;
  }
  // Under the service it is left to the daemon, which replaces a stale file itself: a daemon the
  // manager restarted meanwhile may already have written its own, which removing would orphan.
  if (service) return await startService(service);
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
    report(T.started, runtime);
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
    console.log(T.autostartUnknown(marked((error as Error).message)));
  }
  return code;
}

async function daemonStatus(home: string): Promise<ExitCode> {
  const runtime = readRuntime(home);
  if (!runtime) {
    console.log(T.notRunning);
    return EXIT.unreachable;
  }
  if (!isAlive(runtime.pid)) {
    console.log(T.stale(runtime.pid));
    return EXIT.unreachable;
  }

  try {
    const status = await callOperation<Runtime>(runtime, requireToken(home), 'daemon.status');
    report(T.running, status);
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
  const service = serviceFor(home);
  const supervised = service !== null;
  if (service && !managerFor(service).stop()) return EXIT.failed;
  if (!runtime) {
    console.log(T.notRunning);
    return EXIT.ok;
  }
  if (!alive) {
    removeRuntime(home);
    console.log(T.removedStale(runtime.pid));
    return EXIT.ok;
  }

  try {
    process.kill(runtime.pid, 'SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      console.error(`binn: ${T.cannotSignal(runtime.pid, (error as Error).message)}`);
      return EXIT.failed;
    }
  }

  if (!(await waitFor(() => !isAlive(runtime.pid), STOP_TIMEOUT_MS))) {
    console.error(`binn: ${T.didNotStop(runtime.pid, STOP_TIMEOUT_MS / 1000)}`);
    return EXIT.failed;
  }

  // The daemon removes its own runtime file on a clean stop. Windows has no graceful
  // SIGTERM, so the file is removed here too rather than left for the next start.
  removeRuntime(home);
  console.log(T.stopped(runtime.pid, supervised));
  return EXIT.ok;
}

const AUTOSTART_ON = 'binn daemon autostart on';

/** `binn daemon autostart [on|off]`: turns autostart on or off for this home, or, with no action, says which it is (ADR-0043). */
export async function autostart(
  home: string,
  action: 'on' | 'off' | undefined,
  {
    warn = (text) => console.error(`binn: ${T.warning}: ${text}`),
    root,
  }: {
    /** Where `on` puts its warnings: stderr, or `binn init`'s Summary. */
    warn?: (text: string) => void;
    /** A repository whose tracker counts beside the registered ones: the one `binn init` sets up, registered or not. */
    root?: string;
  } = {},
): Promise<ExitCode> {
  let current: Autostart;
  try {
    servicePlatform();
  } catch (error) {
    console.error(`binn: ${marked((error as Error).message)}`);
    return EXIT.usage;
  }
  try {
    current = readAutostart(home);
  } catch (error) {
    console.error(`binn: ${marked((error as Error).message)}`);
    return EXIT.failed;
  }
  if (action === undefined) {
    console.log(describeAutostart(current));
    return EXIT.ok;
  }
  return action === 'on' ? await autostartOn(current, warn, root) : await autostartOff(current);
}

/** One platform's service manager: each step a sequence of calls that reports the first refusal. */
type Manager = {
  /** Why autostart cannot be turned on here, worded by `text`, or null when it can. */
  unavailable(text?: Text): string | null;
  /** Registered and its daemon running, so that `on` has nothing to do once the definition is current. */
  isOn(): boolean;
  /** What makes the manager read a rewritten definition. */
  reload(): boolean;
  /** Registers the written definition and (re)starts the daemon under it. */
  on(): boolean;
  /** Stops the daemon, unregisters the service and removes its definition. */
  off(): boolean;
  start(): boolean;
  stop(): boolean;
  /** Where to look when the daemon does not answer. */
  output: string;
};

/** Runs each call in turn, stopping at the first refusal, which it reports as the manager printed it. */
function runAll(command: string, ...calls: string[][]): boolean {
  for (const args of calls) {
    const result = runManager(command, args);
    if (!result.ok) {
      console.error(`binn: ${T.managerFailed(`${command} ${args.join(' ')}`, result.message)}`);
      return false;
    }
  }
  return true;
}

function managerFor({ platform, path, home }: Autostart): Manager {
  if (platform === 'win32') {
    const task = ['/TN', SERVICE_NAME];
    const create = () => runAll('schtasks', ['/Create', ...task, '/XML', path, '/F']);
    const registered = () => runManager('schtasks', ['/Query', ...task]).ok;
    const run = () => runAll('schtasks', ['/Run', ...task]);
    // The task's daemon is this home's: whether it runs is read from the home, since schtasks words its status in the system's language.
    const end = () => !daemonAlive(home) || runAll('schtasks', ['/End', ...task]);
    return {
      unavailable(text = T) {
        const scheduler = runManager('schtasks', ['/Query']);
        return scheduler.ok ? null : text.noScheduler(scheduler.message);
      },
      isOn: () => registered() && daemonAlive(home),
      // Task Scheduler keeps the definition it was given: a rewritten one is created again over it.
      reload: create,
      on: () => create() && run(),
      off() {
        if (!end() || !runAll('schtasks', ['/Delete', ...task, '/F'])) return false;
        rmSync(path, { force: true });
        return true;
      },
      // A task deleted by hand leaves its XML behind, which still reads on: start creates it again.
      start: () => (registered() || create()) && run(),
      stop: end,
      output: T.logHolds(logPath(home)),
    };
  }
  if (platform === 'darwin') {
    // The user's GUI domain, where a LaunchAgent runs; bootstrap starts it, the definition saying RunAtLoad.
    const domain = `gui/${process.getuid?.()}`;
    const target = `${domain}/${SERVICE_NAME}`;
    const loaded = () => runManager('launchctl', ['print', target]).ok;
    const unload = () => !loaded() || runAll('launchctl', ['bootout', target]);
    // Out first: launchd keeps the definition it loaded, and refuses to bootstrap a loaded one.
    const load = () => unload() && runAll('launchctl', ['bootstrap', domain, path]);
    return {
      unavailable(text = T) {
        const session = runManager('launchctl', ['print', domain]);
        return session.ok ? null : text.noGuiSession(session.message);
      },
      isOn() {
        const print = runManager('launchctl', ['print', target]);
        return print.ok && /^\s*state = running$/m.test(print.output);
      },
      // launchd reads the definition when it loads it, which `start` does.
      reload: () => true,
      on: load,
      off() {
        if (!unload()) return false;
        rmSync(path, { force: true });
        return true;
      },
      start: load,
      stop: unload,
      output: T.logHolds(logPath(home)),
    };
  }
  const user = (...args: string[]) => ['--user', ...args];
  const systemctl = (...calls: string[][]) => runAll('systemctl', ...calls.map((args) => user(...args)));
  return {
    unavailable(text = T) {
      const manager = runManager('systemctl', user('show-environment'));
      return manager.ok ? null : text.noSystemd(manager.message);
    },
    isOn: () => runManager('systemctl', user('is-enabled', SERVICE_NAME)).ok && runManager('systemctl', user('is-active', SERVICE_NAME)).ok,
    reload: () => systemctl(['daemon-reload']),
    // `restart`, not `enable --now`: a service already running under the old definition must pick up the new one.
    on: () => systemctl(['daemon-reload'], ['enable', SERVICE_NAME], ['restart', SERVICE_NAME]),
    off() {
      if (!systemctl(['disable', '--now', SERVICE_NAME])) return false;
      rmSync(path, { force: true });
      return systemctl(['daemon-reload']);
    },
    start: () => systemctl(['start', SERVICE_NAME]),
    stop: () => systemctl(['stop', SERVICE_NAME]),
    output: T.journal(SERVICE_NAME),
  };
}

/** Why autostart cannot be turned on here, in `text`'s language, or null when it can: no service manager answering. */
export const autostartUnavailable = (current: Autostart, text: Text = T): string | null => managerFor(current).unavailable(text);

async function autostartOn(current: Autostart, warn: (text: string) => void, root: string | undefined): Promise<ExitCode> {
  const { home, path } = current;
  const unavailable = autostartUnavailable(current);
  if (unavailable) {
    console.error(`binn: ${T.autostartUnavailable(unavailable)}`);
    return EXIT.failed;
  }

  const manager = managerFor(current);
  const installed = readInstalled(current.platform, path);
  if (installed?.text === renderDefinition(current.platform, serviceInputs(home)) && manager.isOn()) {
    console.log(T.alreadyOn(home));
    return EXIT.ok;
  }

  // A daemon of this home started by hand holds the home: the service's could not claim it.
  if (daemonAlive(home)) {
    const stopped = await stop(home);
    if (stopped !== EXIT.ok) return stopped;
  }

  // The service's output goes to the home's log, which neither cmd nor launchd creates a directory for.
  ensureHome(home);
  rewriteDefinition(current, installed);

  if (!manager.on()) {
    console.error(`binn: ${T.mayNotBeOn(path, 'binn daemon autostart off')}`);
    return EXIT.failed;
  }
  console.log(T.turnedOn(home, path));
  for (const warning of unseenTokenWarnings(home, root)) warn(warning);
  return EXIT.ok;
}

/**
 * One warning for each `BINNACLE_<PROVIDER>_TOKEN` set in this shell while the credentials file
 * holds no usable token for that provider's trackers: those of the registered projects and of
 * `root`, or the provider's default host when there are none. The service's daemon starts with
 * only the environment its definition carries, so it will not see the shell's. Names the
 * variable and the file's key, never the token, which is neither copied nor written anywhere.
 */
function unseenTokenWarnings(home: string, root: string | undefined): string[] {
  let roots: string[];
  try {
    roots = readRegistry(home).map(({ path }) => path);
  } catch {
    roots = [];
  }
  const trackers = [...roots, ...(root ? [root] : [])].flatMap((repository) => {
    try {
      return [readManifest(repository).manifest.tracker];
    } catch {
      return [];
    }
  });
  const path = credentialsPath(home);
  const warnings: string[] = [];
  for (const provider of ['github', 'gitlab'] as const) {
    const variable = `BINNACLE_${provider.toUpperCase()}_TOKEN`;
    if (!process.env[variable]?.trim()) continue;
    const hosts = trackers.filter((tracker) => tracker.provider === provider).map(({ host }) => host);
    const problems = [...new Set(hosts.length > 0 ? hosts : [null])].flatMap((host) => {
      // The file alone, as the service's daemon reads it: an empty environment.
      const found = trackerToken(home, provider, host, {});
      if ('failure' in found) return [say(found.failure)];
      return found.token ? [] : [T.noTokenFor(path, credentialsKey(provider, host))];
    });
    if (problems.length === 0) continue;
    // The key is a manifest's tracker host: no control or bidi character in it reaches the terminal.
    warnings.push(terminalText(T.unseenToken(variable, [...new Set(problems)], path)));
  }
  return warnings;
}

/** Off for this home only: a service that starts another home's daemon, such as the owner's seen from an agent's temporary home, is left alone. */
async function autostartOff(current: Autostart): Promise<ExitCode> {
  const { home, path, serves } = current;
  if (serves !== home) {
    console.log(T.alreadyOff(home, serves));
    return EXIT.ok;
  }
  if (!managerFor(current).off()) return EXIT.failed;

  // A daemon of this home started by hand while the service was on: off leaves none running.
  if (daemonAlive(home)) {
    const stopped = await stop(home);
    if (stopped !== EXIT.ok) return stopped;
  }
  console.log(T.turnedOff(home, path));
  return EXIT.ok;
}

function daemonAlive(home: string): boolean {
  const runtime = readRuntime(home);
  return runtime !== null && isAlive(runtime.pid);
}

function describeAutostart({ state, platform, home, path, serves, missing }: Autostart): string {
  const where = `${platform}, ${path}`;
  if (state === 'on') return T.isOn(home, where);
  if (state === 'broken') return T.isBroken(home, where, missing, AUTOSTART_ON);
  return T.isOff(home, platform, serves && serves !== home ? serves : null, AUTOSTART_ON);
}

/** The service when autostart is on, or broken, for this home: then start and stop go through the manager. Anything unreadable leaves them as they were. */
function serviceFor(home: string): Autostart | null {
  try {
    const current = readAutostart(home);
    return current.state === 'off' ? null : current;
  } catch {
    return null;
  }
}

/** Writes the definition with the current paths when the installed one differs, saying what it replaced; true when it wrote. */
function rewriteDefinition({ platform, home, path }: Autostart, installed = readInstalled(platform, path)): boolean {
  const definition = renderDefinition(platform, serviceInputs(home));
  if (installed?.text === definition) return false;
  writeDefinition(platform, path, definition);
  if (installed && !installed.ours) console.error(`binn: ${T.warning}: ${T.replaced(path)}`);
  else if (installed && installed.home !== home) console.log(T.moves(installed.home, home));
  else if (installed) console.log(T.rewrote(path));
  return true;
}

async function startService(service: Autostart): Promise<ExitCode> {
  const manager = managerFor(service);
  if (!manager.start()) return EXIT.failed;
  try {
    report(T.startedService, await waitForStart(service.home));
    return EXIT.ok;
  } catch (error) {
    console.error(`binn: ${(error as Error).message} ${manager.output}`);
    return EXIT.failed;
  }
}

function report(headline: string, runtime: Runtime): void {
  console.log(headline);
  console.log(row('address', `http://${runtime.host}:${runtime.port}`));
  // A daemon older than 0.7.0 answers `daemon.status` without them: it bound `host` and accepted nothing else.
  console.log(row('bound', runtime.bind ?? runtime.host));
  console.log(row('accepts', [`${runtime.host}:${runtime.port}`, ...(runtime.allowedHosts ?? [])].join(', ')));
  console.log(row('pid', String(runtime.pid)));
  console.log(row('since', runtime.startedAt));
  console.log(row('version', runtime.version));
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
    if (code !== null) throw new Error(T.exitedEarly(code));
    if (Date.now() >= deadline) throw new Error(T.didNotStart(START_TIMEOUT_MS / 1000));
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
