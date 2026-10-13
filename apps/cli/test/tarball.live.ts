import assert from 'node:assert/strict';
import { spawn, spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';

/**
 * The tarball test (release spec, *The tarball test*): the package the build writes, packed with
 * `npm pack`, installed globally into an empty prefix with a temporary `HOME` and `BINNACLE_HOME`,
 * and driven through the commands npm installed, as a user drives them. It builds the dashboard
 * and the bundles, so `pnpm test` does not run it; the workflow's `tarball-live` job does, on
 * Linux, macOS and Windows. Run it with `node --test apps/cli/test/tarball.live.ts`.
 */

const BUILD = fileURLToPath(new URL('../src/build.ts', import.meta.url));
const PACKAGE = fileURLToPath(new URL('../dist', import.meta.url));
const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
const windows = process.platform === 'win32';
/** A command or argument for a shell: on Windows the shell gets them joined by spaces, so a path with a space is quoted. */
const quoted = (word: string): string => (windows && /\s/.test(word) ? `"${word}"` : word);

test('the packed @it-bbox/binnacle, installed into an empty prefix, runs binn, its daemon, the dashboard and MCP', { timeout: 10 * 60_000 }, async (t: TestContext) => {
  const scratch = mkdtempSync(join(tmpdir(), 'binnacle-tarball-'));
  const prefix = join(scratch, 'prefix');
  const home = join(scratch, 'home');
  // No ~/.npmrc, no user cache and no Binnacle home of the developer's; port 0, so that it never meets a running daemon.
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, BINNACLE_HOME: join(home, '.binnacle'), BINNACLE_PORT: '0' };
  // npm and the commands it installs are `.cmd` shims on Windows, which only a shell runs. A synchronous
  // call blocks the test's own timeout, so each has its own: a hung npm or binn fails, never hangs.
  const run = (command: string, args: string[], options: SpawnSyncOptions = {}) =>
    spawnSync(quoted(command), args.map(quoted), { encoding: 'utf8', env, shell: windows, timeout: 120_000, ...options }) as ReturnType<typeof spawnSync> & {
      stdout: string;
      stderr: string;
    };
  const binnPath = windows ? join(prefix, 'binn.cmd') : join(prefix, 'bin', 'binn');
  const binn = (...args: string[]) => run(binnPath, args);
  t.after(() => {
    if (existsSync(binnPath)) binn('daemon', 'stop');
    // A Windows daemon stopped a moment ago may still hold its log.
    rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  });

  const build = spawnSync(process.execPath, [BUILD], { encoding: 'utf8', timeout: 5 * 60_000 });
  assert.equal(build.status, 0, build.stderr || build.stdout);

  // The tarball and the files it holds, as npm reports them.
  const pack = run('npm', ['pack', '--json', '--pack-destination', scratch], { cwd: PACKAGE });
  assert.equal(pack.status, 0, pack.stderr);
  const [packed] = JSON.parse(pack.stdout) as { name: string; version: string; filename: string; files: { path: string }[] }[];
  assert.ok(packed);
  assert.equal(packed.name, '@it-bbox/binnacle');
  assert.equal(packed.version, VERSION);
  const files = packed.files.map((file) => file.path);
  for (const file of ['package.json', 'LICENSE', 'README.md', 'bin/binn.js', 'bin/binnd.js', 'dashboard/index.html', '.claude-plugin/marketplace.json', 'plugin/.claude-plugin/plugin.json']) {
    assert.ok(files.includes(file), `${file} in the tarball`);
  }
  assert.ok(files.some((file) => /^skills\/binnacle-[a-z-]+\/SKILL\.md$/.test(file)), 'the skills copy in the tarball');

  const install = run('npm', ['install', '--global', '--prefix', prefix, '--offline', '--no-audit', '--no-fund', join(scratch, packed.filename)]);
  assert.equal(install.status, 0, install.stderr);
  const installed = windows ? join(prefix, 'node_modules', '@it-bbox', 'binnacle') : join(prefix, 'lib', 'node_modules', '@it-bbox', 'binnacle');
  const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')) as Record<string, unknown>;
  assert.equal(manifest.dependencies, undefined, 'no runtime dependencies');
  assert.deepEqual(manifest.publishConfig, { access: 'public' });
  const marketplace = JSON.parse(readFileSync(join(installed, '.claude-plugin', 'marketplace.json'), 'utf8')) as { plugins: { source: string }[] };
  assert.deepEqual(marketplace.plugins.map((plugin) => plugin.source), ['./plugin']);
  const plugin = JSON.parse(readFileSync(join(installed, 'plugin', '.claude-plugin', 'plugin.json'), 'utf8')) as { name: string; version?: string };
  assert.equal(plugin.name, 'binnacle');
  assert.match(plugin.version ?? '', /^[0-9a-f]{12}$/, 'a versioned plugin manifest');

  const version = binn('--version');
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), VERSION);

  const start = binn('daemon', 'start');
  assert.equal(start.status, 0, start.stderr || start.stdout);
  const status = binn('daemon', 'status');
  const address = /address\s+(http:\/\/\S+)/.exec(status.stdout)?.[1];
  assert.ok(address, status.stdout);
  const health = await fetch(`${address}/health`);
  assert.equal(health.status, 200);
  const page = await fetch(`${address}/`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.doesNotMatch(html, /dashboard:generate/, 'the generated dashboard, not the page naming the generate command');
  assert.match(html, /\/_nuxt\//);

  const tools = await mcpTools(binnPath, env);
  assert.ok(tools.includes('project_snapshot'), tools.join(', '));

  const stop = binn('daemon', 'stop');
  assert.equal(stop.status, 0, stop.stderr || stop.stdout);
  await assert.rejects(fetch(`${address}/health`), 'the daemon no longer answers');
});

/** `binn mcp`, sent an MCP `initialize` and a `tools/list`, and the names of the tools it lists. */
async function mcpTools(binn: string, env: NodeJS.ProcessEnv): Promise<string[]> {
  const child = spawn(quoted(binn), ['mcp'], { env, shell: windows, stdio: ['pipe', 'pipe', 'inherit'] });
  const send = (message: object) => child.stdin.write(`${JSON.stringify(message)}\n`);
  const answers = new Map<number, { result?: { tools?: { name: string }[] } }>();
  let buffered = '';
  const listed = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    setTimeout(() => reject(new Error('binn mcp did not list its tools within 30 seconds')), 30_000).unref();
    child.on('exit', (code) => reject(new Error(`binn mcp exited with ${code} before it listed its tools`)));
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      buffered += chunk;
      for (let end = buffered.indexOf('\n'); end >= 0; end = buffered.indexOf('\n')) {
        const message = JSON.parse(buffered.slice(0, end)) as { id?: number; result?: { tools?: { name: string }[] } };
        buffered = buffered.slice(end + 1);
        if (typeof message.id === 'number') answers.set(message.id, message);
        if (message.id === 1) {
          send({ jsonrpc: '2.0', method: 'notifications/initialized' });
          send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
        }
        if (message.id === 2) resolve();
      }
    });
  });
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'tarball-test', version: '0' } } });
  try {
    await listed;
  } finally {
    child.removeAllListeners('exit');
    child.stdin.end();
    child.kill();
  }
  assert.ok(answers.get(1)?.result, 'initialize answered');
  return (answers.get(2)?.result?.tools ?? []).map((tool) => tool.name);
}
