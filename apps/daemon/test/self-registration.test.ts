import assert from 'node:assert/strict';
import { existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { ProjectStatus } from '../src/index.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * This repository is project number one (`docs/00-scope.md`), so its own committed
 * manifest is a fixture that must keep registering. The paths it declares are checked
 * against the checkout, so the manifest cannot quietly drift from the tree it describes.
 */
const REPOSITORY = realpathSync(resolve(import.meta.dirname, '..', '..', '..'));

describe('this repository', () => {
  let daemon: TestDaemon;
  before(async () => {
    daemon = await startTestDaemon();
  });
  after(async () => {
    await daemon.stop();
  });

  it('registers from its committed manifest with no warnings', async () => {
    const { status, body } = await daemon.call<{ project: { id: string; path: string }; warnings: unknown[] }>(
      'project.register',
      { path: REPOSITORY },
    );
    assert.equal(status, 200);
    assert.equal(body.project.id, 'binnacle');
    assert.equal(body.project.path, REPOSITORY);
    assert.deepEqual(body.warnings, []);
  });

  it('declares the local Markdown tracker and knowledge paths that exist in the checkout', async () => {
    const { status, body } = await daemon.call<ProjectStatus>('project.status', { path: REPOSITORY });
    assert.equal(status, 200);
    const manifest = body.manifest!;
    assert.equal(manifest.tracker.provider, 'local');

    const { context, docs, adr, specs } = manifest.knowledge;
    for (const declared of [manifest.tracker.local.issues, context, docs, adr, specs]) {
      assert.ok(declared && existsSync(join(REPOSITORY, declared)), `${declared} is not in the checkout`);
    }
    // A local tracker never disagrees with the GitHub remote that hosts the code.
    assert.deepEqual(body.diagnostics, []);
  });
});
