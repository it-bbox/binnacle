import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ArtifactRoots, Runtime } from './home.ts';
import { OPS_PREFIX, startDaemon } from './server.ts';

/**
 * The one test seam for this repository: a daemon started in-process on an ephemeral
 * port against a temporary Binnacle home, plus a single call function. Everything
 * below it — the store, the manifest, the Git adapter, authentication, the event log —
 * is exercised through here rather than through a second seam.
 */
export type CallOptions = {
  /** `null` sends no Authorization header at all. Omit to send the daemon's real token. */
  token?: string | null;
  headers?: Record<string, string>;
  method?: string;
  /** Bypasses JSON encoding, for tests that send a malformed body. */
  rawBody?: string;
};

export type CallResult<T = unknown> = {
  status: number;
  body: T;
};

export type TestDaemon = {
  home: string;
  token: string;
  runtime: Runtime;
  url(path: string): string;
  call<T = unknown>(operation: string, body?: unknown, options?: CallOptions): Promise<CallResult<T>>;
  stop(): Promise<void>;
};

/**
 * `artifacts` defaults to directories inside the home that do not exist, so that no test
 * reads the harness artifacts of the machine it runs on, and `dashboard` likewise, so that no
 * test depends on a generated dashboard. `settledAfterMs` defaults to `0`, so
 * that a file a test has just written is read to its end.
 */
export async function startTestDaemon(
  options: { home?: string; artifacts?: ArtifactRoots; ingestBudgetMs?: number; settledAfterMs?: number; dashboard?: string; searchPath?: string; graphPollMs?: number; vaultPollMs?: number } = {},
): Promise<TestDaemon> {
  const home = options.home ?? mkdtempSync(join(tmpdir(), 'binnacle-test-'));
  const temporary = options.home === undefined;
  const daemon = await startDaemon({
    home,
    port: 0,
    artifacts: options.artifacts ?? { claudeCode: join(home, 'no-claude-code-artifacts'), codex: join(home, 'no-codex-sessions') },
    ...(options.ingestBudgetMs === undefined ? {} : { ingestBudgetMs: options.ingestBudgetMs }),
    settledAfterMs: options.settledAfterMs ?? 0,
    dashboard: options.dashboard ?? join(home, 'no-dashboard'),
    // No `graphify` from the machine the tests run on, unless a test brings its own.
    searchPath: options.searchPath ?? join(home, 'no-tools'),
    ...(options.graphPollMs === undefined ? {} : { graphPollMs: options.graphPollMs }),
    ...(options.vaultPollMs === undefined ? {} : { vaultPollMs: options.vaultPollMs }),
  });
  const url = (path: string): string => `http://${daemon.runtime.host}:${daemon.runtime.port}${path}`;

  return {
    home: daemon.home,
    token: daemon.token,
    runtime: daemon.runtime,
    url,
    async call<T>(operation: string, body?: unknown, callOptions: CallOptions = {}): Promise<CallResult<T>> {
      const token = callOptions.token === undefined ? daemon.token : callOptions.token;
      const method = callOptions.method ?? 'POST';
      const response = await fetch(url(`${OPS_PREFIX}${operation}`), {
        method,
        headers: {
          'content-type': 'application/json',
          ...(token === null ? {} : { authorization: `Bearer ${token}` }),
          ...callOptions.headers,
        },
        // fetch refuses a body on GET/HEAD, which tests of the wrong method need to send.
        ...(method === 'GET' || method === 'HEAD'
          ? {}
          : { body: callOptions.rawBody ?? JSON.stringify(body ?? {}) }),
      });
      return { status: response.status, body: (await response.json()) as T };
    },
    async stop() {
      await daemon.stop();
      if (temporary) rmSync(home, { recursive: true, force: true });
    },
  };
}
