import { timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  DEFAULT_PORT,
  ensureHome,
  ensureToken,
  isAlive,
  readRuntime,
  resolveArtifactRoots,
  releaseRuntime,
  removeRuntime,
  tryClaimRuntime,
  writeRuntime,
  type Runtime,
} from './home.ts';
import { OperationError } from './errors.ts';
import { operations, type OperationContext } from './operations.ts';
import { projectRegistry } from './projection.ts';
import { openStore } from './store.ts';
import { importer, INGEST_BUDGET_MS, startIngest } from './usage.ts';
import { VERSION } from './version.ts';

export const LOOPBACK = '127.0.0.1';
export const HEALTH_PATH = '/health';
export const OPS_PREFIX = '/ops/';

/** A hostile client should not be able to make the daemon buffer an arbitrary amount. */
const MAX_BODY_BYTES = 1024 * 1024;

export class DaemonAlreadyRunningError extends Error {
  runtime: Runtime;

  constructor(runtime: Runtime) {
    super(`A Binnacle daemon is already running on ${runtime.host}:${runtime.port} (pid ${runtime.pid}).`);
    this.name = 'DaemonAlreadyRunningError';
    this.runtime = runtime;
  }
}

export type DaemonOptions = {
  home: string;
  /** `0` takes an ephemeral port. */
  port?: number;
  host?: string;
  /** Resolved from the environment when omitted. */
  artifacts?: Runtime['artifacts'];
  /** How long a call waits for its project's ingest; `0` never waits. */
  ingestBudgetMs?: number;
};

export type Daemon = {
  home: string;
  token: string;
  runtime: Runtime;
  stop(): Promise<void>;
};

/**
 * Starts the daemon bound to loopback. Exactly one daemon per Binnacle home: a runtime
 * file whose pid is alive refuses the start, a runtime file whose pid is gone is stale
 * and replaced.
 */
export async function startDaemon(options: DaemonOptions): Promise<Daemon> {
  const home = ensureHome(options.home);
  const host = options.host ?? LOOPBACK;
  const requestedPort = options.port ?? DEFAULT_PORT;
  const runtime: Runtime = {
    pid: process.pid,
    host,
    port: requestedPort,
    startedAt: new Date().toISOString(),
    version: VERSION,
    artifacts: options.artifacts ?? resolveArtifactRoots(),
  };
  const token = ensureToken(home);

  claimHome(home, runtime);

  // The daemon is the only process that opens the store, and the projection is derived
  // from the registry file on every start — which is what makes losing the database
  // cost runtime history only (ADR-0019, ADR-0015).
  let store;
  let projects;
  try {
    store = openStore(home);
    projects = projectRegistry(home, store);
  } catch (error) {
    store?.close();
    releaseRuntime(home, runtime.pid);
    throw error;
  }
  const context: OperationContext = { home, runtime, store, importer: importer(options.ingestBudgetMs ?? INGEST_BUDGET_MS) };

  const server = createServer((request, response) => {
    handle(request, response, context, token).catch((error: unknown) => fail(response, error));
  });
  try {
    await listen(server, host, requestedPort);
  } catch (error) {
    store.close();
    releaseRuntime(home, runtime.pid);
    throw error;
  }
  runtime.port = boundPort(server, requestedPort);
  writeRuntime(home, runtime);
  // Recorded once the daemon is listening, so a start that failed is not in the history.
  store.appendEvent({ type: 'daemon.started', payload: { pid: runtime.pid, port: runtime.port, version: VERSION } });
  // Every registered project's history starts importing now, in the background, rather than on its first call.
  for (const { row, manifest } of projects) void startIngest(context, row.path, manifest);

  return {
    home,
    token,
    runtime,
    async stop() {
      releaseRuntime(home, runtime.pid);
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      // An ingest stops between files, each of which committed whole, before the store closes.
      context.importer.stopped = true;
      await context.importer.queue;
      // Only a clean stop is recorded. A killed daemon leaves a start with no stop after
      // it, which is the honest record of what happened.
      store.appendEvent({ type: 'daemon.stopped', payload: { pid: runtime.pid, version: VERSION } });
      store.close();
    },
  };
}

/**
 * Claims the Binnacle home by creating the runtime file exclusively, and only looks at
 * what is there when that fails: a live pid is a running daemon, anything else — a dead
 * pid, an unreadable file — is stale and replaced rather than treated as a blocker.
 *
 * ponytail: two starts racing on the same *stale* file can still both claim it. The
 * consequence is caught downstream by the store's own locking; a real lock service is
 * the upgrade if that ever bites.
 */
function claimHome(home: string, claim: Runtime): void {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (tryClaimRuntime(home, claim)) return;
    const existing = readRuntime(home);
    if (existing && isAlive(existing.pid)) throw new DaemonAlreadyRunningError(existing);
    removeRuntime(home);
  }
  throw new Error(`Could not claim the Binnacle home ${home}: another process is starting a daemon there.`);
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
  context: OperationContext,
  token: string,
): Promise<void> {
  // Loopback is not an authentication boundary: any browser tab can reach 127.0.0.1.
  // Host and Origin are what stop DNS rebinding turning a web page into a client.
  const rejection = checkHost(request, context.runtime) ?? checkOrigin(request, context.runtime);
  if (rejection) return fail(response, rejection);

  const path = new URL(request.url ?? '/', `http://${boundAddress(context.runtime)}`).pathname;

  if (path === HEALTH_PATH) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return fail(response, methodNotAllowed(request.method, 'GET'));
    }
    // The one unauthenticated endpoint: a daemon is listening, and this is its version.
    return send(response, 200, { service: 'binnacle', version: context.runtime.version });
  }

  if (!path.startsWith(OPS_PREFIX)) {
    return fail(response, new OperationError('request.not_found', `No route ${JSON.stringify(path)}.`, 404));
  }
  if (request.method !== 'POST') {
    return fail(response, methodNotAllowed(request.method, 'POST'));
  }

  const authFailure = checkToken(request, token);
  if (authFailure) return fail(response, authFailure);

  const name = decodeURIComponent(path.slice(OPS_PREFIX.length));
  // Own properties only: a plain object inherits `toString`, `constructor` and the rest
  // of Object.prototype, and each of those would otherwise answer as an operation.
  const operation = Object.hasOwn(operations, name) ? operations[name] : undefined;
  if (!operation) {
    return fail(response, new OperationError('operation.unknown', `Unknown operation ${JSON.stringify(name)}.`, 404));
  }

  send(response, 200, await operation(await readJsonBody(request), context));
}

const boundAddress = (runtime: Runtime): string => `${runtime.host}:${runtime.port}`;

function checkHost(request: IncomingMessage, runtime: Runtime): OperationError | null {
  if (request.headers.host?.toLowerCase() === boundAddress(runtime)) return null;
  return new OperationError(
    'request.forbidden_host',
    `Host ${JSON.stringify(request.headers.host ?? '')} is not ${boundAddress(runtime)}, the address this daemon bound.`,
    403,
  );
}

function checkOrigin(request: IncomingMessage, runtime: Runtime): OperationError | null {
  const origin = request.headers.origin?.toLowerCase();
  if (origin === undefined || origin === `http://${boundAddress(runtime)}`) return null;
  return new OperationError('request.forbidden_origin', `Origin ${JSON.stringify(origin)} is not allowed.`, 403);
}

function checkToken(request: IncomingMessage, token: string): OperationError | null {
  const header = request.headers.authorization;
  if (!header) {
    return new OperationError('auth.missing', 'This operation requires the Binnacle API token.', 401);
  }
  const presented = /^bearer\s+(\S+)$/i.exec(header.trim())?.[1];
  if (!presented || !secretsMatch(presented, token)) {
    return new OperationError('auth.invalid', 'The presented Binnacle API token is not valid.', 401);
  }
  return null;
}

function secretsMatch(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new OperationError('request.body_too_large', `Request body exceeds ${MAX_BODY_BYTES} bytes.`, 413);
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new OperationError('request.body_invalid', 'Request body must be a JSON document.', 400);
  }
}

function methodNotAllowed(method: string | undefined, allowed: string): OperationError {
  return new OperationError(
    'request.method_not_allowed',
    `Method ${JSON.stringify(method ?? '')} is not allowed here; use ${allowed}.`,
    405,
  );
}

function send(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload ?? null);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

function fail(response: ServerResponse, error: unknown): void {
  const failure =
    error instanceof OperationError ? error : new OperationError('internal.error', 'Internal daemon error.', 500);
  if (!(error instanceof OperationError)) console.error(error);
  if (!response.headersSent) send(response, failure.status, failure.toEnvelope());
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
}

function boundPort(server: Server, fallback: number): number {
  const address = server.address();
  return typeof address === 'object' && address !== null ? address.port : fallback;
}
