import { spawn, type ChildProcess } from 'node:child_process';
import { closeSync, openSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ensureHome,
  isAlive,
  logPath,
  OWNER_ONLY_FILE,
  readRuntime,
  readToken,
  removeRuntime,
  type Runtime,
} from '@binnacle/daemon';
import { callOperation, isListening } from './client.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { reportFailure } from './report.ts';

const START_TIMEOUT_MS = 10_000;
const STOP_TIMEOUT_MS = 10_000;

export async function start(home: string): Promise<ExitCode> {
  ensureHome(home);

  // A live pid is a running daemon, exactly as `binn daemon status` reads it. A slow
  // daemon must never look stale here: replacing its runtime file would orphan it and
  // start a competitor against the same home.
  const running = readRuntime(home);
  if (running && isAlive(running.pid)) {
    report('Binnacle daemon is already running.', running);
    return EXIT.ok;
  }
  // Absent, or a runtime file whose pid is gone: stale, not a blocker.
  if (running) removeRuntime(home);

  const log = openSync(logPath(home), 'a', OWNER_ONLY_FILE);
  let child;
  try {
    child = spawn(process.execPath, [fileURLToPath(import.meta.resolve('@binnacle/daemon/bin'))], {
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
  const runtime = readRuntime(home);
  if (!runtime) {
    console.log('Binnacle daemon is not running.');
    return EXIT.unreachable;
  }
  if (!isAlive(runtime.pid)) {
    console.log(`Binnacle daemon is not running (stale runtime file for pid ${runtime.pid}).`);
    return EXIT.unreachable;
  }

  const token = readToken(home);
  if (!token) {
    console.error(`binn: no Binnacle API token in ${home}.`);
    return EXIT.failed;
  }

  try {
    report('Binnacle daemon is running.', await callOperation<Runtime>(runtime, token, 'daemon.status'));
    return EXIT.ok;
  } catch (error) {
    return reportFailure(error);
  }
}

export async function stop(home: string): Promise<ExitCode> {
  const runtime = readRuntime(home);
  if (!runtime) {
    console.log('Binnacle daemon is not running.');
    return EXIT.ok;
  }
  if (!isAlive(runtime.pid)) {
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
  console.log(`Binnacle daemon stopped (pid ${runtime.pid}).`);
  return EXIT.ok;
}

function report(headline: string, runtime: Runtime): void {
  console.log(headline);
  console.log(`  address  http://${runtime.host}:${runtime.port}`);
  console.log(`  pid      ${runtime.pid}`);
  console.log(`  since    ${runtime.startedAt}`);
  console.log(`  version  ${runtime.version}`);
}

async function waitForStart(home: string, child: ChildProcess): Promise<Runtime> {
  let exitCode: number | null = null;
  const exited = (): number | null => exitCode;
  child.once('exit', (code) => {
    exitCode = code ?? -1;
  });

  const deadline = Date.now() + START_TIMEOUT_MS;
  for (;;) {
    const runtime = readRuntime(home);
    if (runtime && runtime.pid === child.pid && (await isListening(runtime))) return runtime;

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
