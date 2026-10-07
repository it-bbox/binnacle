import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readOtlpLogs } from '@binnacle/adapters';
import { extname, isAbsolute, join, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { GRAPH_POLL_MS, startGraphRunner } from './graph.ts';
import { startVaultProjector, VAULT_POLL_MS } from './vault.ts';
import { operations, type OperationContext } from './operations.ts';
import { projectRegistry } from './projection.ts';
import { openStore } from './store.ts';
import { importer, INGEST_BUDGET_MS, projectCheckouts, receiveTelemetry, SETTLED_AFTER_MS, startIngest, stopImporting } from './usage.ts';
import { VERSION } from './version.ts';

export const LOOPBACK = '127.0.0.1';
export const HEALTH_PATH = '/health';
export const OPS_PREFIX = '/ops/';
/** OTLP over HTTP's paths: logs carry the calls; metrics and traces are answered and not stored, since they would count the same calls again. */
export const OTLP_LOGS_PATH = '/v1/logs';
const OTLP_PATHS = new Set([OTLP_LOGS_PATH, '/v1/metrics', '/v1/traces']);
/** Where `pnpm dashboard:generate` writes the dashboard, found from the daemon's own place in the workspace. */
export const DASHBOARD_DIRECTORY = fileURLToPath(new URL('../../dashboard/.output/public/', import.meta.url));
const DASHBOARD_GENERATE = 'pnpm dashboard:generate';

/** A hostile client should not be able to make the daemon buffer an arbitrary amount. */
const MAX_BODY_BYTES = 1024 * 1024;
/** An exporter's batch is larger than any operation's body: up to 512 events of every kind a harness exports. */
const MAX_OTLP_BODY_BYTES = 16 * 1024 * 1024;

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
  /** How long a Claude Code file goes unwritten before its last message counts as finished. */
  settledAfterMs?: number;
  /** The dashboard's generated directory; `DASHBOARD_DIRECTORY` when omitted. */
  dashboard?: string;
  /** Where `graphify` is looked for, as `PATH` is read; the daemon's own `PATH` when omitted. */
  searchPath?: string;
  /** How often the default branch of each project is read for the graph (ADR-0036). */
  graphPollMs?: number;
  /** How often each project's default branch and the vault setting are read for the vault projection (ADR-0036). */
  vaultPollMs?: number;
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
  const searchPath = options.searchPath ?? process.env.PATH ?? '';
  const context: OperationContext = { home, runtime, store, searchPath, importer: importer(options.ingestBudgetMs ?? INGEST_BUDGET_MS, options.settledAfterMs ?? SETTLED_AFTER_MS) };

  const server = createServer((request, response) => {
    handle(request, response, context, token, options.dashboard ?? DASHBOARD_DIRECTORY).catch((error: unknown) => fail(response, error));
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
  const graph = startGraphRunner(home, store, searchPath, options.graphPollMs ?? GRAPH_POLL_MS);
  const vault = startVaultProjector(home, store, options.vaultPollMs ?? VAULT_POLL_MS);
  // Every registered project's history starts importing now, in the background, rather than on its first call.
  // Its linked worktrees are asked of Git first, and a daemon stopped meanwhile starts none.
  for (const { row, manifest } of projects) {
    void projectCheckouts(row.path).then(({ linked }) => {
      if (!context.importer.stopped) void startIngest(context, row.path, manifest, linked);
    });
  }

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
      await stopImporting(context.importer);
      await graph.stop();
      await vault.stop();
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
  dashboard: string,
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

  if (OTLP_PATHS.has(path)) return receiveOtlp(request, response, context, path);
  if (!path.startsWith(OPS_PREFIX)) return serveStatic(request, response, dashboard);
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

/**
 * OTLP over HTTP, JSON-encoded only, which every harness Binnacle reads can export: no
 * OpenTelemetry dependency decodes protobuf or a compressed body, and either is refused with
 * 415 so that the exporter says why. Like `/health` it needs no token, since an exporter is
 * configured with an endpoint and nothing else; the Host and Origin checks have already run,
 * and what it accepts is never more than the calls' metadata and token counts.
 */
async function receiveOtlp(request: IncomingMessage, response: ServerResponse, context: OperationContext, path: string): Promise<void> {
  if (request.method !== 'POST') return fail(response, methodNotAllowed(request.method, 'POST'));
  const type = (request.headers['content-type'] ?? '').split(';', 1)[0]!.trim().toLowerCase();
  const encoding = (request.headers['content-encoding'] ?? 'identity').trim().toLowerCase();
  if (type !== 'application/json' || encoding !== 'identity') {
    const received = `${type || 'no content type'}${encoding === 'identity' ? '' : `, ${encoding}`}`;
    return fail(response, new OperationError('request.unsupported_media_type', `Binnacle accepts OTLP over HTTP as uncompressed JSON (application/json) only, not ${received}: set the exporter's protocol to http/json.`, 415));
  }
  const body = await readJsonBody(request, MAX_OTLP_BODY_BYTES);
  if (path === OTLP_LOGS_PATH) await receiveTelemetry(context, readOtlpLogs(body));
  // An `Export…ServiceResponse` with nothing rejected.
  send(response, 200, {});
}

/** Content types of what `nuxt generate` writes; anything else is served as `application/octet-stream`. */
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

/**
 * The dashboard's generated files (ADR-0031). They hold no project data, so they need no
 * token; the Host and Origin checks have already run. `/` is `index.html`, a file in the
 * directory is itself, and any other path is the client-side routing fallback, `200.html`.
 * A path whose resolution would leave the directory is not found, never the fallback.
 *
 * ponytail: files are read synchronously on every request, which blocks the event loop for
 * the read; the files are small and the one client is local. Stream them if that shows.
 */
function serveStatic(request: IncomingMessage, response: ServerResponse, dashboard: string): void {
  if (request.method !== 'GET' && request.method !== 'HEAD') return fail(response, methodNotAllowed(request.method, 'GET or HEAD'));
  const path = staticPath(request.url ?? '/');
  if (path === null) return fail(response, new OperationError('request.not_found', `No route ${JSON.stringify(request.url)}.`, 404));

  let file = join(dashboard, path === '/' ? 'index.html' : path);
  if (!isFile(join(dashboard, 'index.html'))) {
    return sendStatic(request, response, 503, '.html', Buffer.from(NOT_GENERATED));
  }
  if (!isFile(file)) file = join(dashboard, '200.html');
  sendStatic(request, response, 200, extname(file), readFileSync(file));
}

/**
 * The request's path, decoded, when it stays inside the directory; null when it does not.
 * The raw request line is read rather than a parsed URL, because parsing resolves `..` and
 * its encoded forms away, and a path that tries them is refused rather than silently mapped.
 */
function staticPath(url: string): string | null {
  let path;
  try {
    path = decodeURIComponent(url.split(/[?#]/, 1)[0] ?? '');
  } catch {
    return null;
  }
  if (!path.startsWith('/') || /[\\\0]/.test(path) || path.split('/').includes('..')) return null;
  // `//etc/passwd` and `/C:/…` name absolute paths once the leading slash is dropped.
  const inside = path.slice(1);
  return isAbsolute(inside) || win32.isAbsolute(inside) ? null : path;
}

const isFile = (path: string): boolean => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;

const NOT_GENERATED = `<!doctype html>
<meta charset="utf-8">
<title>Binnacle</title>
<p>The Binnacle dashboard has not been generated. In the Binnacle workspace, run <code>${DASHBOARD_GENERATE}</code>, then reload this page.</p>
`;

/**
 * Every static response limits the page to its own origin: it loads and connects nowhere
 * else, and of inline scripts runs only those the served HTML itself carries, by hash.
 * HTML is never cached, so a regenerated dashboard is picked up on the next load.
 */
function sendStatic(request: IncomingMessage, response: ServerResponse, status: number, extension: string, body: Buffer): void {
  const html = extension === '.html';
  const scripts = html ? inlineScriptHashes(body.toString('utf8')) : [];
  response.writeHead(status, {
    'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
    'content-length': body.length,
    'content-security-policy': [
      "default-src 'self'",
      `script-src 'self'${scripts.map((hash) => ` '${hash}'`).join('')}`,
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...(html ? { 'cache-control': 'no-store' } : {}),
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

/**
 * The hash of every inline `<script>` in the served HTML: Nuxt's import map and runtime
 * configuration are inline. A data block's hash is listed too, which lets nothing run that
 * the file does not already hold.
 */
function inlineScriptHashes(html: string): string[] {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attributes = '']) => !/\bsrc\s*=/i.test(attributes))
    .map(([, , text = '']) => `sha256-${createHash('sha256').update(text).digest('base64')}`);
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

async function readJsonBody(request: IncomingMessage, limit = MAX_BODY_BYTES): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > limit) {
      throw new OperationError('request.body_too_large', `Request body exceeds ${limit} bytes.`, 413);
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
