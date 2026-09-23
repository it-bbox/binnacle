import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
      // Scoped to the project: the daemon's own start and stop are history too.
      const { body } = await second.call<{ events: { type: string }[] }>('event.list', { path: root });
      assert.deepEqual(
        body.events.map((event) => event.type),
        ['project.registered'],
      );
    } finally {
      await second.stop();
    }
  });
});

describe('what the manifest must not hide or leak', () => {
  it('names the document, not a version the user never wrote, when it is not a mapping', async () => {
    await withDaemon(async (daemon) => {
      for (const contents of ['- one\n- two\n', 'just a string\n', '42\n', '']) {
        const root = makeProject(contents);
        const { status, body } = await daemon.call<ErrorEnvelope>('project.register', { path: root });
        assert.equal(status, 400, JSON.stringify(contents));
        assert.equal(body.error.code, 'manifest.invalid', JSON.stringify(contents));
        assert.deepEqual(
          (body.error.details ?? []).map((detail) => detail.path),
          ['(document)'],
          JSON.stringify(contents),
        );
      }
    });
  });

  it('records a change to a field the projection does not itself carry', async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-home-')));
    roots.push(home);
    const root = makeProject('version: 1\n\nproject:\n  id: example-project\n\ntracker:\n  provider: github\n');

    const first = await startTestDaemon({ home });
    await first.call('project.register', { path: root });
    await first.stop();

    // Neither the id nor the name moves. Only the tracker does, and the projection keeps
    // no column for it — the digest is what makes the change visible at all.
    writeFileSync(
      join(root, '.binnacle', 'project.yaml'),
      'version: 1\n\nproject:\n  id: example-project\n\ntracker:\n  provider: gitlab\n',
    );

    const second = await startTestDaemon({ home });
    try {
      const { body } = await second.call<{ events: { type: string }[] }>('event.list');
      assert.ok(body.events.some((event) => event.type === 'project.manifest_changed'));
    } finally {
      await second.stop();
    }
  });

  it('lets no manifest text into the event history, even through a failure reason', async () => {
    const home = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-home-')));
    roots.push(home);
    const secret = 'ghp_thisMustNeverReachTheEventTable';
    const root = makeProject(`version: 1\n\nproject:\n  id: example-project\n  name: ${secret}\n`);

    const first = await startTestDaemon({ home });
    await first.call('project.register', { path: root });
    await first.stop();

    // A manifest that stops parsing: the reason a project became unavailable can quote
    // the file, and the event table is the tier that is never dropped.
    writeFileSync(join(root, '.binnacle', 'project.yaml'), `version: 1\nproject: [${secret}\n`);

    const second = await startTestDaemon({ home });
    try {
      const { body } = await second.call<{ events: unknown[] }>('event.list');
      assert.ok(body.events.length > 1, 'the change was recorded');
      assert.ok(!JSON.stringify(body.events).includes(secret));
    } finally {
      await second.stop();
    }
  });

  it('accepts a capability name it has never heard of', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject('version: 1\n\nproject:\n  id: example-project\n\ncapabilities:\n  some_new_tool: true\n');
      const { status, body } = await daemon.call<{ warnings: Problem[] }>('project.register', { path: root });
      assert.equal(status, 200);
      assert.deepEqual(body.warnings, []);
    });
  });
});
