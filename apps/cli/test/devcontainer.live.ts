import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';

/**
 * Binnacle's dev container feature from this repository, built into a container by the dev container CLI where `docker`
 * and `devcontainer` are installed: CI installs neither, and `pnpm test` does not run this (dev-container spec, *The
 * feature in CI*). `binn` comes from npm, at the feature's default version, which must read `BINNACLE_HOST`: 0.7.0 or
 * later. Run it with `node --test apps/cli/test/devcontainer.live.ts`.
 */

const FEATURE = fileURLToPath(new URL('../../devcontainer-feature/src/binnacle', import.meta.url));
const IMAGE = 'node:24-slim';
const missing = ['docker', 'devcontainer'].filter((tool) => spawnSync(tool, ['--version']).error !== undefined);
const skip = missing.length > 0 && `${missing.join(' and ')} not on PATH.`;

/** Asks the daemon the runtime file names for `/health` and prints the runtime file: run inside the container. */
const HEALTH = `const r = JSON.parse(require('fs').readFileSync(process.env.BINNACLE_HOME + '/runtime.json', 'utf8'));
fetch('http://' + r.host + ':' + r.port + '/health').then((x) => { console.log(JSON.stringify(r)); process.exit(x.ok ? 0 : 1); }, () => process.exit(1));`;

/** The test `devcontainer features test` runs in the container it builds, written here so the repository keeps one script. */
const TEST_SH = `#!/bin/sh
set -e
binn --version
grep -q " $(dirname "$BINNACLE_HOME") " /proc/mounts
node -e "${HEALTH.replaceAll('"', '\\"')}"
`;

/** The feature's volumes on this machine, `binnacle-<devcontainerId>`. */
const volumes = (): string[] => run('docker', ['volume', 'ls', '--quiet', '--filter', 'name=binnacle-']).split('\n').filter(Boolean);

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 10 * 60_000 });
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

test('devcontainer features test builds a container with the feature: binn runs, the daemon answers, its home is on the volume', { skip, timeout: 15 * 60_000 }, (t: TestContext) => {
  const collection = mkdtempSync(join(tmpdir(), 'binnacle-feature-'));
  t.after(() => rmSync(collection, { recursive: true, force: true }));
  cpSync(FEATURE, join(collection, 'src', 'binnacle'), { recursive: true });
  mkdirSync(join(collection, 'test', 'binnacle'), { recursive: true });
  writeFileSync(join(collection, 'test', 'binnacle', 'test.sh'), TEST_SH, { mode: 0o755 });
  // The test removes its container, not the feature's volume.
  const before = new Set(volumes());
  t.after(() => {
    for (const volume of volumes().filter((name) => !before.has(name))) spawnSync('docker', ['volume', 'rm', volume]);
  });

  run('devcontainer', ['features', 'test', '--project-folder', collection, '--features', 'binnacle', '--base-image', IMAGE, '--skip-scenarios']);
});

test('a container started twice starts the daemon both times, the first run\'s runtime file not blocking the second', { skip, timeout: 15 * 60_000 }, (t: TestContext) => {
  const workspace = mkdtempSync(join(tmpdir(), 'binnacle-devcontainer-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  cpSync(FEATURE, join(workspace, '.devcontainer', 'binnacle'), { recursive: true });
  writeFileSync(
    join(workspace, '.devcontainer', 'devcontainer.json'),
    JSON.stringify({ image: IMAGE, remoteUser: 'node', features: { './binnacle': { hostPort: '7719' } } }),
  );
  const up = () => JSON.parse(run('devcontainer', ['up', '--workspace-folder', workspace]).trim().split('\n').at(-1) ?? '{}') as { containerId: string };
  const health = () =>
    JSON.parse(run('devcontainer', ['exec', '--workspace-folder', workspace, 'node', '-e', HEALTH]).trim().split('\n').at(-1) ?? '{}') as {
      startedAt: string;
      bind: string;
      allowedHosts: string[];
    };

  const { containerId } = up();
  const mounted = run('docker', ['inspect', '--format', '{{range .Mounts}}{{if eq .Type "volume"}}{{.Name}} {{end}}{{end}}', containerId]).trim().split(' ');
  t.after(() => {
    spawnSync('docker', ['rm', '-f', containerId]);
    for (const volume of mounted) spawnSync('docker', ['volume', 'rm', volume]);
  });

  const first = health();
  assert.equal(first.bind, '0.0.0.0');
  assert.deepEqual(first.allowedHosts, ['127.0.0.1:7719', 'localhost:7719']);

  // Stopping the container kills the daemon, which leaves its runtime file on the volume.
  run('docker', ['stop', containerId]);
  assert.equal(up().containerId, containerId);
  const second = health();
  assert.notEqual(second.startedAt, first.startedAt);
});
