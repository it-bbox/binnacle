import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import type { ErrorEnvelope } from '../src/index.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

type Problem = { path: string; message: string };

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function makeProject(manifest: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-manifest-')));
  roots.push(root);
  mkdirSync(join(root, '.binnacle'));
  writeFileSync(join(root, '.binnacle', 'project.yaml'), manifest);
  return root;
}

async function withDaemon(body: (daemon: TestDaemon) => Promise<void>): Promise<void> {
  const daemon = await startTestDaemon();
  try {
    await body(daemon);
  } finally {
    await daemon.stop();
  }
}

describe('a manifest with several problems', () => {
  it('reports every one of them in a single response, each naming its field', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject(`version: 1

project:
  id: 42

tracker:
  provider: bitbucket

automation:
  mode: autonomous
  max_parallel_development_tasks: -1

telemetry:
  privacy: everything
`);

      const { status, body } = await daemon.call<ErrorEnvelope>('project.register', { path: root });
      assert.equal(status, 400);
      assert.equal(body.error.code, 'manifest.invalid');

      const reported = (body.error.details ?? []).map((detail) => detail.path).sort();
      assert.deepEqual(reported, [
        'automation.max_parallel_development_tasks',
        'automation.mode',
        'project.id',
        'telemetry.privacy',
        'tracker.provider',
      ]);
      for (const detail of body.error.details ?? []) assert.ok(detail.message.length > 0, detail.path);
    });
  });
});

describe('a manifest a newer Binnacle might have written', () => {
  it('warns about unknown keys and registers anyway', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject(`version: 1

project:
  id: example-project
  name: Example Project

telemetry:
  privacy: metadata
  retention_days: 90

orchestration:
  autopilot: true
`);

      const { status, body } = await daemon.call<{ project: { id: string }; warnings: Problem[] }>(
        'project.register',
        { path: root },
      );
      assert.equal(status, 200);
      assert.equal(body.project.id, 'example-project');
      assert.deepEqual(
        body.warnings.map((warning) => warning.path).sort(),
        ['orchestration', 'telemetry.retention_days'],
      );
    });
  });

  it('reads no secret out of the manifest and echoes none back', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject(`version: 1

project:
  id: example-project

tracker:
  provider: github
  token: ghp_thisMustNeverLeaveTheFile
`);

      const { status, body } = await daemon.call('project.register', { path: root });
      assert.equal(status, 200);
      assert.ok(!JSON.stringify(body).includes('ghp_thisMustNeverLeaveTheFile'));

      const listed = await daemon.call('project.list');
      assert.ok(!JSON.stringify(listed.body).includes('ghp_thisMustNeverLeaveTheFile'));
    });
  });

  it('answers rather than throws when the document is not a mapping at all', async () => {
    await withDaemon(async (daemon) => {
      for (const contents of ['- one\n- two\n', 'just a string\n', '']) {
        const root = makeProject(contents);
        const { status, body } = await daemon.call<ErrorEnvelope>('project.register', { path: root });
        assert.ok(status === 400, `${JSON.stringify(contents)} answered ${status}`);
        assert.match(body.error.code, /^manifest\./);
      }
    });
  });
});

describe('a manifest that changed since it was last projected', () => {
  it('is re-read on the next start and the change is recorded', async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-home-')));
    roots.push(home);
    const root = makeProject('version: 1\n\nproject:\n  id: example-project\n  name: Before\n');

    const first = await startTestDaemon({ home });
    await first.call('project.register', { path: root });
    await first.stop();

    writeFileSync(join(root, '.binnacle', 'project.yaml'), 'version: 1\n\nproject:\n  id: example-project\n  name: After\n');

    const second = await startTestDaemon({ home });
    try {
      const { body } = await second.call<{ events: { type: string; payload: Record<string, unknown> }[] }>(
        'event.list',
      );
      const changed = body.events.find((event) => event.type === 'project.manifest_changed');
      assert.ok(changed, `no manifest_changed among ${body.events.map((e) => e.type).join(', ')}`);
      assert.equal(changed.payload.name, 'After');
    } finally {
      await second.stop();
    }
  });

  it('records nothing when the manifest did not change', async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-home-')));
    roots.push(home);
    const root = makeProject('version: 1\n\nproject:\n  id: example-project\n  name: Steady\n');

    const first = await startTestDaemon({ home });
    await first.call('project.register', { path: root });
    await first.stop();

    const second = await startTestDaemon({ home });
    try {
      const { body } = await second.call<{ events: { type: string }[] }>('event.list');
      assert.deepEqual(
        body.events.map((event) => event.type),
        ['project.registered'],
      );
    } finally {
      await second.stop();
    }
  });
});

describe('the core package', () => {
  it('validates without reaching the filesystem or any dependency', () => {
    const source = new URL('../../../packages/core/src/', import.meta.url);
    for (const name of readdirSync(source).filter((file) => file.endsWith('.ts'))) {
      const text = readFileSync(new URL(name, source), 'utf8');
      assert.ok(!/from 'node:/.test(text), `${name} must stay pure: no node: imports`);
      assert.ok(!/^import .* from '(?!\.)/m.test(text), `${name} must import nothing outside the package`);
    }

    const manifest = JSON.parse(readFileSync(new URL('../package.json', source), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    assert.equal(manifest.dependencies, undefined);
  });
});
