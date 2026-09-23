import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { isAlive, readRuntime } from '@binnacle/daemon';

const BINN = fileURLToPath(new URL('../src/bin.ts', import.meta.url));

const MANIFEST = `version: 1

project:
  id: example-project
  name: Example Project
`;

function makeProject(manifest: string = MANIFEST): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-cli-project-')));
  mkdirSync(join(root, '.binnacle'));
  writeFileSync(join(root, '.binnacle', 'project.yaml'), manifest);
  return root;
}

test('binn project register, list and unregister', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'binnacle-cli-'));
  const root = makeProject();
  const binn = (...args: string[]) =>
    spawnSync(process.execPath, [BINN, ...args], {
      encoding: 'utf8',
      cwd: root,
      env: { ...process.env, BINNACLE_HOME: home, BINNACLE_PORT: '0' },
    });

  t.after(() => {
    const leftover = readRuntime(home);
    if (leftover && isAlive(leftover.pid)) process.kill(leftover.pid, 'SIGKILL');
    rmSync(home, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  });

  await t.test('registering without a daemon says the daemon is unreachable', () => {
    const result = binn('project', 'register', root);
    assert.equal(result.status, 4, result.stderr);
  });

  await t.test('registers the repository once a daemon is running', () => {
    assert.equal(binn('daemon', 'start').status, 0);

    const result = binn('project', 'register', root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /example-project/);
    assert.match(result.stdout, new RegExp(root.replaceAll('.', '\\.')));
  });

  await t.test('lists what this machine tracks, with a name and a path for each', () => {
    const result = binn('project', 'list');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /example-project/);
    assert.match(result.stdout, /Example Project/);
    assert.match(result.stdout, new RegExp(root.replaceAll('.', '\\.')));
  });

  await t.test('takes the working directory when no path is given', () => {
    const result = binn('project', 'register');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /example-project/);
  });

  await t.test('shows the manifest warnings without failing the registration', () => {
    const odd = makeProject(`version: 1

project:
  id: odd-project
  name: Odd Project

orchestration:
  autopilot: true
`);
    try {
      const result = binn('project', 'register', odd);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /odd-project/);
      assert.match(result.stderr, /orchestration/);
      assert.equal(binn('project', 'unregister', odd).status, 0);
    } finally {
      rmSync(odd, { recursive: true, force: true });
    }
  });

  await t.test('reports a directory with no manifest as an operation failure', () => {
    const bare = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-cli-bare-')));
    try {
      const result = binn('project', 'register', bare);
      assert.equal(result.status, 3, result.stdout);
      assert.match(result.stderr, /manifest\.missing/);
      assert.match(result.stderr, /project\.yaml\.example/);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  await t.test('unregisters it and leaves the repository alone', () => {
    const result = binn('project', 'unregister', root);
    assert.equal(result.status, 0, result.stderr);

    assert.match(binn('project', 'list').stdout, /No projects/);
    assert.ok(readFileSync(join(root, '.binnacle', 'project.yaml'), 'utf8').includes('example-project'));

    assert.equal(binn('daemon', 'stop').status, 0);
  });
});

test('the daemon is the only process that opens the database', () => {
  const source = new URL('../src/', import.meta.url);
  for (const name of readdirSync(source).filter((file) => file.endsWith('.ts'))) {
    const text = readFileSync(new URL(name, source), 'utf8');
    // The store is never exported from the package root, so this is the line that holds:
    // the CLI cannot open the database, and reaches state only by calling an operation.
    assert.ok(!text.includes('node:sqlite'), `${name} must not open the store directly`);
    assert.ok(!/openStore|DatabaseSync/.test(text), `${name} must reach state through the API`);
  }
});
