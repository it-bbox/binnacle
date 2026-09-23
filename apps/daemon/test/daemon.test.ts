import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import {
  DaemonAlreadyRunningError,
  DEFAULT_PORT,
  readRuntime,
  resolvePort,
  runtimePath,
  startDaemon,
  tokenPath,
} from '../src/index.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

const POSIX = process.platform !== 'win32';

async function withDaemon(body: (daemon: TestDaemon) => Promise<void>): Promise<void> {
  const daemon = await startTestDaemon();
  try {
    await body(daemon);
  } finally {
    await daemon.stop();
  }
}

/** fetch() refuses to set Host, so hostile-header cases need a raw request. */
function rawRequest(
  port: number,
  options: { path: string; method?: string; headers?: Record<string, string> },
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const call = request(
      { host: '127.0.0.1', port, path: options.path, method: options.method ?? 'POST', headers: options.headers },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (text += chunk));
        response.on('end', () => resolve({ status: response.statusCode ?? 0, body: text ? JSON.parse(text) : null }));
      },
    );
    call.on('error', reject);
    call.end('{}');
  });
}

type Envelope = { error: { code: string; message: string } };

describe('daemon operations', () => {
  it('answers daemon.status with pid, host, port, start time and version', async () => {
    await withDaemon(async (daemon) => {
      const { status, body } = await daemon.call<Record<string, unknown>>('daemon.status');
      assert.equal(status, 200);
      assert.deepEqual(body, {
        pid: daemon.runtime.pid,
        host: '127.0.0.1',
        port: daemon.runtime.port,
        startedAt: body.startedAt,
        version: daemon.runtime.version,
      });
      assert.ok(!Number.isNaN(Date.parse(String(body.startedAt))), 'startedAt is a timestamp');
      assert.match(String(body.version), /^\d+\.\d+\.\d+/);
    });
  });

  it('rejects an unknown operation with the shared error envelope', async () => {
    await withDaemon(async (daemon) => {
      const { status, body } = await daemon.call<Envelope>('daemon.explode');
      assert.equal(status, 404);
      assert.equal(body.error.code, 'operation.unknown');
      assert.ok(body.error.message.length > 0);
    });
  });

  it('rejects an operation named after an inherited property, not just an invented one', async () => {
    await withDaemon(async (daemon) => {
      for (const name of ['toString', 'constructor', 'hasOwnProperty', 'valueOf', '__proto__']) {
        const { status, body } = await daemon.call<Envelope>(name);
        assert.equal(status, 404, `${name} answered ${status}`);
        assert.equal(body.error.code, 'operation.unknown');
      }
    });
  });

  it('rejects a non-POST call on an operation route', async () => {
    await withDaemon(async (daemon) => {
      const { status, body } = await daemon.call<Envelope>('daemon.status', undefined, { method: 'GET' });
      assert.equal(status, 405);
      assert.equal(body.error.code, 'request.method_not_allowed');
    });
  });

  it('rejects a body that is not JSON', async () => {
    await withDaemon(async (daemon) => {
      const { status, body } = await daemon.call<Envelope>('daemon.status', undefined, { rawBody: 'not json' });
      assert.equal(status, 400);
      assert.equal(body.error.code, 'request.body_invalid');
    });
  });

  it('rejects an unknown route', async () => {
    await withDaemon(async (daemon) => {
      const response = await fetch(daemon.url('/'), { method: 'POST' });
      assert.equal(response.status, 404);
      assert.equal(((await response.json()) as Envelope).error.code, 'request.not_found');
    });
  });
});

describe('liveness', () => {
  it('answers without a token, with the service and its version and nothing else', async () => {
    await withDaemon(async (daemon) => {
      const response = await fetch(daemon.url('/health'));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { service: 'binnacle', version: daemon.runtime.version });
    });
  });
});

describe('authentication', () => {
  it('rejects an operation with no token', async () => {
    await withDaemon(async (daemon) => {
      const { status, body } = await daemon.call<Envelope>('daemon.status', undefined, { token: null });
      assert.equal(status, 401);
      assert.equal(body.error.code, 'auth.missing');
    });
  });

  it('rejects an operation with the wrong token', async () => {
    await withDaemon(async (daemon) => {
      const { status, body } = await daemon.call<Envelope>('daemon.status', undefined, { token: 'not-the-token' });
      assert.equal(status, 401);
      assert.equal(body.error.code, 'auth.invalid');
    });
  });

  it('rejects a token of the right length but the wrong value', async () => {
    await withDaemon(async (daemon) => {
      const wrong = daemon.token.replace(/^./, (first) => (first === 'a' ? 'b' : 'a'));
      const { status, body } = await daemon.call<Envelope>('daemon.status', undefined, { token: wrong });
      assert.equal(status, 401);
      assert.equal(body.error.code, 'auth.invalid');
    });
  });

  it('writes the token into the Binnacle home directory, owner-only where enforced', async () => {
    await withDaemon(async (daemon) => {
      const path = tokenPath(daemon.home);
      assert.equal(readFileSync(path, 'utf8').trim(), daemon.token);
      if (POSIX) {
        assert.equal(statSync(path).mode & 0o077, 0, 'token is not readable by group or other');
        assert.equal(statSync(daemon.home).mode & 0o077, 0, 'home is not readable by group or other');
      }
    });
  });

  it('reuses the token across restarts in the same home', async () => {
    const home = await mkdtemp(join(tmpdir(), 'binnacle-token-'));
    try {
      const first = await startTestDaemon({ home });
      const token = first.token;
      await first.stop();
      const second = await startTestDaemon({ home });
      assert.equal(second.token, token);
      await second.stop();
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe('rebinding defence', () => {
  it('rejects a request whose Host is not the address the daemon bound', async () => {
    await withDaemon(async (daemon) => {
      const hostile = await rawRequest(daemon.runtime.port, {
        path: '/ops/daemon.status',
        headers: { host: `attacker.example.com:${daemon.runtime.port}`, authorization: `Bearer ${daemon.token}` },
      });
      assert.equal(hostile.status, 403);
      assert.equal((hostile.body as Envelope).error.code, 'request.forbidden_host');
    });
  });

  it('rejects a request whose Host carries the wrong port', async () => {
    await withDaemon(async (daemon) => {
      const hostile = await rawRequest(daemon.runtime.port, {
        path: '/ops/daemon.status',
        headers: { host: `127.0.0.1:${daemon.runtime.port + 1}`, authorization: `Bearer ${daemon.token}` },
      });
      assert.equal(hostile.status, 403);
      assert.equal((hostile.body as Envelope).error.code, 'request.forbidden_host');
    });
  });

  it('rejects the liveness endpoint too when the Host is hostile', async () => {
    await withDaemon(async (daemon) => {
      const hostile = await rawRequest(daemon.runtime.port, {
        path: '/health',
        method: 'GET',
        headers: { host: 'attacker.example.com' },
      });
      assert.equal(hostile.status, 403);
    });
  });

  it('rejects a request carrying an Origin outside the allowlist', async () => {
    await withDaemon(async (daemon) => {
      const { status, body } = await daemon.call<Envelope>('daemon.status', undefined, {
        headers: { origin: 'https://attacker.example.com' },
      });
      assert.equal(status, 403);
      assert.equal(body.error.code, 'request.forbidden_origin');
    });
  });

  it('accepts the Origin of the address it bound, and only that one', async () => {
    await withDaemon(async (daemon) => {
      const allowed = await daemon.call('daemon.status', undefined, {
        headers: { origin: `http://127.0.0.1:${daemon.runtime.port}` },
      });
      assert.equal(allowed.status, 200);

      // `localhost` is a different name for the same address, and is not the one bound.
      const other = await daemon.call<Envelope>('daemon.status', undefined, {
        headers: { origin: `http://localhost:${daemon.runtime.port}` },
      });
      assert.equal(other.status, 403);
      assert.equal(other.body.error.code, 'request.forbidden_origin');
    });
  });
});

describe('single instance per Binnacle home', () => {
  it('takes an ephemeral port when asked for port 0', async () => {
    await withDaemon(async (daemon) => {
      assert.ok(daemon.runtime.port > 0 && daemon.runtime.port <= 65535);
    });
  });

  it('takes the port the environment names, and rejects one it cannot bind to', () => {
    assert.equal(resolvePort({}), DEFAULT_PORT);
    assert.equal(resolvePort({ BINNACLE_PORT: '0' }), 0);
    assert.equal(resolvePort({ BINNACLE_PORT: ' 9001 ' }), 9001);
    for (const value of ['not-a-port', '-1', '70000', '80.5']) {
      assert.throws(() => resolvePort({ BINNACLE_PORT: value }), /BINNACLE_PORT/, value);
    }
  });

  it('records pid, port, start time and version in the runtime file, and removes it on stop', async () => {
    const daemon = await startTestDaemon();
    assert.deepEqual(readRuntime(daemon.home), daemon.runtime);
    assert.ok(daemon.runtime.port > 0);
    await daemon.stop();
    assert.equal(readRuntime(daemon.home), null);
  });

  it('refuses a second start and reports the running instance', async () => {
    await withDaemon(async (daemon) => {
      const second = await startDaemon({ home: daemon.home, port: 0 }).then(
        () => null,
        (error: unknown) => error,
      );
      assert.ok(second instanceof DaemonAlreadyRunningError);
      assert.equal(second.runtime.pid, daemon.runtime.pid);
      assert.equal(second.runtime.port, daemon.runtime.port);
      // The running daemon is untouched.
      assert.equal((await daemon.call('daemon.status')).status, 200);
    });
  });

  it('treats a runtime file whose pid is dead as stale and replaces it', async () => {
    const home = await mkdtemp(join(tmpdir(), 'binnacle-stale-'));
    try {
      const reaped = spawnSync(process.execPath, ['-e', '']);
      assert.ok(reaped.pid);
      writeFileSync(
        runtimePath(home),
        JSON.stringify({ pid: reaped.pid, host: '127.0.0.1', port: 7717, startedAt: '2020-01-01T00:00:00.000Z', version: '0.0.1' }),
      );

      const daemon = await startTestDaemon({ home });
      assert.equal((await daemon.call('daemon.status')).status, 200);
      assert.equal(readRuntime(home)?.pid, daemon.runtime.pid);
      await daemon.stop();
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it('leaves no claim behind when the port is already taken', async () => {
    const home = await mkdtemp(join(tmpdir(), 'binnacle-bind-'));
    const occupant = await startTestDaemon();
    try {
      const failed = await startDaemon({ home, port: occupant.runtime.port }).then(
        () => null,
        (error: unknown) => error,
      );
      assert.ok(failed instanceof Error);
      assert.equal((failed as NodeJS.ErrnoException).code, 'EADDRINUSE');
      assert.equal(readRuntime(home), null, 'a failed bind leaves no runtime file to block the next start');
    } finally {
      await occupant.stop();
      await rm(home, { recursive: true, force: true });
    }
  });

  it('treats an unreadable runtime file as stale rather than as a blocker', async () => {
    const home = await mkdtemp(join(tmpdir(), 'binnacle-corrupt-'));
    try {
      writeFileSync(runtimePath(home), 'this is not json');
      const daemon = await startTestDaemon({ home });
      assert.equal((await daemon.call('daemon.status')).status, 200);
      await daemon.stop();
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe('ADR-0012: the daemon opens no outbound connections', () => {
  it('has no outbound client in its runtime sources and no runtime dependencies', () => {
    const source = new URL('../src/', import.meta.url);
    const runtimeSources = readdirSync(source).filter((name) => name.endsWith('.ts') && name !== 'testing.ts');
    assert.ok(runtimeSources.length > 0);

    const forbidden = [/\bfetch\s*\(/, /node:https/, /node:net/, /node:tls/, /node:dgram/, /XMLHttpRequest/, /undici/];
    for (const name of runtimeSources) {
      const text = readFileSync(new URL(name, source), 'utf8');
      for (const pattern of forbidden) {
        assert.ok(!pattern.test(text), `${name} must not reach the network (${String(pattern)})`);
      }
      // testing.ts is excluded above because it is the test client, not the daemon.
      // That exclusion only holds while nothing the daemon runs can reach it.
      assert.ok(!text.includes('./testing.ts'), `${name} must not import the test harness`);
    }

    // Every runtime dependency is named here on purpose. The property under test is that
    // nothing the daemon runs can reach the network or a model, not that the list is empty:
    // Node has no YAML parser, and the project manifest is YAML.
    const allowed = new Set(['@binnacle/core', 'yaml']);
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      assert.ok(allowed.has(name), `${name} is a new runtime dependency; justify it here before adding it`);
    }
  });
});
