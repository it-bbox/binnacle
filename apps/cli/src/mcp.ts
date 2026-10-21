import { isAlive, readRuntime, type ErrorEnvelope } from '@binnacle/daemon';
import { serveStdio, toolRequest, type CallDaemon } from '@binnacle/mcp';
import { callOperation, DaemonUnreachableError, OperationFailedError } from './client.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { requireToken } from './report.ts';

const unreachable = (reason: string): ErrorEnvelope => ({
  error: { code: 'daemon.unreachable', message: `${reason} Start it with \`binn daemon start\`.` },
});

/**
 * One call to the running daemon, answered with its result or an error envelope, never by
 * throwing. The runtime file and the token are read on every call, so a daemon started after
 * the harness connected is found. The daemon is never started from here, and no database is opened.
 */
const callDaemon = (home: string): CallDaemon => async (operation, body) => {
  const runtime = readRuntime(home);
  if (!runtime || !isAlive(runtime.pid)) return unreachable('The Binnacle daemon is not running.');
  try {
    return { result: await callOperation(runtime, requireToken(home), operation, body) };
  } catch (error) {
    if (error instanceof DaemonUnreachableError) return unreachable(error.message);
    if (error instanceof OperationFailedError) {
      const { code, message, details, params } = error;
      return { error: { code, message, ...(details && { details }), ...(params && { params }) } };
    }
    throw error;
  }
};

/** `binn mcp`: a stdio proxy to the running daemon. */
export async function mcp(home: string, version: string): Promise<void> {
  await serveStdio(version, process.cwd(), callDaemon(home));
}

/**
 * `binn call <tool> [json]`: one of the same tools, for a harness without the MCP server. It prints
 * what the tool returns, or the daemon's error envelope, as the tool's JSON; what it refuses itself
 * goes to stderr with the usage exit code.
 */
export async function call(home: string, tool: string, json: string | undefined): Promise<ExitCode> {
  let args: unknown;
  try {
    args = json === undefined ? {} : JSON.parse(json);
  } catch {
    console.error(`binn: the arguments are not JSON; give them as one JSON object, such as '{"id":"<task id>"}'.`);
    return EXIT.usage;
  }
  const request = toolRequest(tool, args, process.cwd());
  if ('refused' in request) {
    console.error(`binn: ${request.refused}. \`binn call --help\` lists the tools and their arguments.`);
    return EXIT.usage;
  }
  const answer = await callDaemon(home)(request.operation, request.body);
  console.log(JSON.stringify('error' in answer ? answer : answer.result));
  if (!('error' in answer)) return EXIT.ok;
  return answer.error.code === 'daemon.unreachable' ? EXIT.unreachable : EXIT.failed;
}
