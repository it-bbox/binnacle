import { spawn } from 'node:child_process';
import { readRuntime } from '@binnacle/daemon';
import { isListening } from './client.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { reportFailure, requireToken } from './report.ts';
import { T } from './text.ts';

/**
 * `binn dashboard`: the daemon's own address, with the token in the fragment, which never
 * reaches a server; the page moves it into the browser's storage (ADR-0031). The daemon
 * serves the page, so one that does not answer leaves nothing to open. Opening prints the
 * address without the token, since a skill's shell output reaches the model's provider;
 * only `--print`, for a human at a terminal, prints it with the token.
 */
export async function dashboard(home: string, print: boolean): Promise<ExitCode> {
  const runtime = readRuntime(home);
  if (!runtime || !(await isListening(runtime))) {
    console.error(`binn: ${T.notAnswering}`);
    return EXIT.unreachable;
  }
  let token;
  try {
    token = requireToken(home);
  } catch (error) {
    return reportFailure(error);
  }

  const bareAddress = `http://${runtime.host}:${runtime.port}/`;
  const address = `${bareAddress}#token=${token}`;
  console.log(print ? address : bareAddress);
  if (!print) open(address);
  return EXIT.ok;
}

/**
 * The platform's opener, detached; if it cannot run, `--print` gives the address with its token. On
 * Windows `start` takes a window title first, and the address holds nothing cmd would read.
 */
function open(address: string): void {
  const windows = process.platform === 'win32';
  const [command, args] = windows
    ? ['cmd', ['/c', 'start', '""', `"${address}"`]]
    : [process.platform === 'darwin' ? 'open' : 'xdg-open', [address]];
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: windows });
  child.on('error', (error) => console.error(`binn: ${T.noBrowser(error.message)}`));
  child.unref();
}
