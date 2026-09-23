import { isAlive, readRuntime, type ErrorEnvelope } from '@binnacle/daemon';
import { serveStdio } from '@binnacle/mcp';
import { callOperation, DaemonUnreachableError, OperationFailedError } from './client.ts';
import { requireToken } from './report.ts';

const unreachable = (reason: string): ErrorEnvelope => ({
  error: { code: 'daemon.unreachable', message: `${reason} Start it with \`binn daemon start\`.` },
});

/**
 * `binn mcp`: a stdio proxy to the running daemon. The runtime file and the token are
 * read on every call, so a daemon started after the harness connected is found. The
 * daemon is never started from here, and no database is opened.
 */
export async function mcp(home: string, version: string): Promise<void> {
  await serveStdio(version, process.cwd(), async (operation, body) => {
    const runtime = readRuntime(home);
    if (!runtime || !isAlive(runtime.pid)) return unreachable('The Binnacle daemon is not running.');
    try {
      return { result: await callOperation(runtime, requireToken(home), operation, body) };
    } catch (error) {
      if (error instanceof DaemonUnreachableError) return unreachable(error.message);
      if (error instanceof OperationFailedError) {
        const { code, message, details } = error;
        return { error: details ? { code, message, details } : { code, message } };
      }
      throw error;
    }
  });
}
