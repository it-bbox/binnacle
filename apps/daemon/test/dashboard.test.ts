import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * The static route (ADR-0031): the daemon serves the dashboard's generated files at its own
 * address, beside `/health` and `/ops/`, and nothing outside them.
 */

const INDEX = '<!doctype html><title>index</title><script>window.inline = 1</script><script type="module" src="/_nuxt/entry.js"></script>';
const FALLBACK = '<!doctype html><title>fallback</title><script>window.inline = 2</script>';

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A generated directory beside a secret file that no path may reach. */
function makeDashboard(): { dashboard: string; secret: string } {
  const root = mkdtempSync(join(tmpdir(), 'binnacle-dashboard-'));
  roots.push(root);
  const dashboard = join(root, 'public');
  mkdirSync(join(dashboard, '_nuxt'), { recursive: true });
  writeFileSync(join(dashboard, 'index.html'), INDEX);
  writeFileSync(join(dashboard, '200.html'), FALLBACK);
  writeFileSync(join(dashboard, '_nuxt', 'entry.js'), 'console.log("entry");');
  writeFileSync(join(dashboard, '_nuxt', 'entry.css'), 'body{}');
  writeFileSync(join(dashboard, '_nuxt', 'blob.unknown'), 'blob');
  writeFileSync(join(root, 'secret.txt'), 'the secret contents');
  return { dashboard, secret: 'the secret contents' };
}

async function withDaemon(dashboard: string | undefined, body: (daemon: TestDaemon) => Promise<void>): Promise<void> {
  const daemon = await startTestDaemon(dashboard === undefined ? {} : { dashboard });
  try {
    await body(daemon);
  } finally {
    await daemon.stop();
  }
}

type Raw = { status: number; headers: Record<string, string | string[] | undefined>; text: string };

/** fetch() normalises `..` away and refuses to set Host, so these cases need a raw request. */
function raw(daemon: TestDaemon, path: string, options: { method?: string; headers?: Record<string, string> } = {}): Promise<Raw> {
  return new Promise((resolve, reject) => {
    const call = request(
      {
        host: '127.0.0.1',
        port: daemon.runtime.port,
        path,
        method: options.method ?? 'GET',
        headers: { host: `127.0.0.1:${daemon.runtime.port}`, ...options.headers },
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (text += chunk));
        response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, text }));
      },
    );
    call.on('error', reject);
    call.end();
  });
}

const code = (response: Raw): string => (JSON.parse(response.text) as { error: { code: string } }).error.code;

/** Every source a directive allows is the page's own origin, nothing, or an inline script's hash. */
function assertSecurityHeaders(response: Raw): void {
  const policy = String(response.headers['content-security-policy']);
  const directives = new Map(policy.split(';').map((directive) => {
    const [name = '', ...sources] = directive.trim().split(/\s+/);
    return [name, sources];
  }));
  assert.deepEqual(directives.get('default-src'), ["'self'"], policy);
  for (const [name, sources] of directives) {
    for (const source of sources) assert.match(source, /^'(self|none|sha256-[A-Za-z0-9+/]+=*)'$/, `${name} allows ${source}`);
  }
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
}

describe('the static route', () => {
  it('serves index.html at /, as HTML that is not cached, with the security headers', async () => {
    const { dashboard } = makeDashboard();
    await withDaemon(dashboard, async (daemon) => {
      for (const path of ['/', '/?refresh=1']) {
        const response = await raw(daemon, path);
        assert.equal(response.status, 200, path);
        assert.equal(response.text, INDEX);
        assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
        assert.equal(response.headers['cache-control'], 'no-store');
        assertSecurityHeaders(response);
      }
    });
  });

  it("lets the page's own inline scripts run, and no other", async () => {
    const { dashboard } = makeDashboard();
    await withDaemon(dashboard, async (daemon) => {
      const index = String((await raw(daemon, '/')).headers['content-security-policy']);
      const fallback = String((await raw(daemon, '/projects')).headers['content-security-policy']);
      assert.match(index, new RegExp(escape(hash('window.inline = 1'))));
      assert.doesNotMatch(index, new RegExp(escape(hash('window.inline = 2'))));
      assert.match(fallback, new RegExp(escape(hash('window.inline = 2'))));
    });
  });

  it('serves a file in the directory with its content type, and an unknown extension as octet-stream', async () => {
    const { dashboard } = makeDashboard();
    await withDaemon(dashboard, async (daemon) => {
      const script = await raw(daemon, '/_nuxt/entry.js');
      assert.equal(script.status, 200);
      assert.equal(script.text, 'console.log("entry");');
      assert.equal(script.headers['content-type'], 'text/javascript; charset=utf-8');
      assertSecurityHeaders(script);

      assert.equal((await raw(daemon, '/_nuxt/entry.css')).headers['content-type'], 'text/css; charset=utf-8');
      assert.equal((await raw(daemon, '/_nuxt/blob.unknown')).headers['content-type'], 'application/octet-stream');
      assert.equal((await raw(daemon, '/index.html')).text, INDEX);
    });
  });

  it('answers any other path with the client-side routing fallback', async () => {
    const { dashboard } = makeDashboard();
    await withDaemon(dashboard, async (daemon) => {
      for (const path of ['/projects', '/projects/some%20project', '/_nuxt/', '/_nuxt/missing.js', '/health/extra']) {
        const response = await raw(daemon, path);
        assert.equal(response.status, 200, path);
        assert.equal(response.text, FALLBACK, path);
        assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
        assert.equal(response.headers['cache-control'], 'no-store');
        assertSecurityHeaders(response);
      }
    });
  });

  it('answers HEAD with the headers and no body', async () => {
    const { dashboard } = makeDashboard();
    await withDaemon(dashboard, async (daemon) => {
      const response = await raw(daemon, '/', { method: 'HEAD' });
      assert.equal(response.status, 200);
      assert.equal(response.text, '');
      assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
      assert.equal(response.headers['content-length'], String(Buffer.byteLength(INDEX)));
      assertSecurityHeaders(response);
    });
  });

  it('accepts only GET and HEAD', async () => {
    const { dashboard } = makeDashboard();
    await withDaemon(dashboard, async (daemon) => {
      for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
        const response = await raw(daemon, '/', { method });
        assert.equal(response.status, 405, method);
        assert.equal(code(response), 'request.method_not_allowed', method);
      }
    });
  });

  it('serves no path whose resolution leaves the directory', async () => {
    const { dashboard, secret } = makeDashboard();
    await withDaemon(dashboard, async (daemon) => {
      const escapes = [
        '/../secret.txt',
        '/_nuxt/../../secret.txt',
        '/%2e%2e/secret.txt',
        '/%2E%2E/secret.txt',
        '/.%2e/secret.txt',
        '/..%2fsecret.txt',
        '/%2e%2e%2fsecret.txt',
        '/_nuxt/%2e%2e/%2e%2e/secret.txt',
        '/..\\secret.txt',
        '/%5c..%5csecret.txt',
        '/_nuxt%5centry.js',
        '//etc/passwd',
        '/%2fetc/passwd',
        '/%2Fetc%2Fpasswd',
        '/C:/Windows/win.ini',
        '/%00',
        '/%zz',
      ];
      for (const path of escapes) {
        const response = await raw(daemon, path);
        assert.equal(response.status, 404, path);
        assert.equal(code(response), 'request.not_found', path);
        assert.ok(!response.text.includes(secret), path);
      }
    });
  });

  it('refuses a foreign Host, as on every route', async () => {
    const { dashboard } = makeDashboard();
    await withDaemon(dashboard, async (daemon) => {
      for (const path of ['/', '/index.html', '/_nuxt/entry.js', '/projects']) {
        const response = await raw(daemon, path, { headers: { host: `attacker.example.com:${daemon.runtime.port}` } });
        assert.equal(response.status, 403, path);
        assert.equal(code(response), 'request.forbidden_host', path);
      }
    });
  });

  it('answers every static path with a page naming the command that generates the dashboard, when it has not been generated', async () => {
    await withDaemon(undefined, async (daemon) => {
      for (const path of ['/', '/projects', '/_nuxt/entry.js']) {
        const response = await raw(daemon, path);
        assert.equal(response.status, 503, path);
        assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
        assert.match(response.text, /pnpm dashboard:generate/);
        assertSecurityHeaders(response);
      }
      // A refused path is still refused.
      assert.equal(code(await raw(daemon, '/../secret.txt')), 'request.not_found');
    });
  });

  it('leaves /ops/ requiring the token, and /health answering as before', async () => {
    const { dashboard } = makeDashboard();
    await withDaemon(dashboard, async (daemon) => {
      const missing = await raw(daemon, '/ops/daemon.status', { method: 'POST' });
      assert.equal(missing.status, 401);
      assert.equal(code(missing), 'auth.missing');
      const invalid = await raw(daemon, '/ops/daemon.status', { method: 'POST', headers: { authorization: 'Bearer wrong' } });
      assert.equal(code(invalid), 'auth.invalid');
      // A static-looking path under /ops/ is an operation, never a file.
      assert.equal(code(await raw(daemon, '/ops/index.html', { method: 'GET' })), 'request.method_not_allowed');
      assert.equal((await daemon.call('daemon.status')).status, 200);
      assert.deepEqual(JSON.parse((await raw(daemon, '/health')).text), { service: 'binnacle', version: daemon.runtime.version });
    });
  });
});

const hash = (script: string): string => `'sha256-${createHash('sha256').update(script).digest('base64')}'`;

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
