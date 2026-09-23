import assert from 'node:assert/strict';
import { existsSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * This repository is project number one (`docs/00-scope.md`), so its own committed
 * manifest is a fixture that must keep registering. The paths it declares are checked
 * against the checkout, so the manifest cannot quietly drift from the tree it describes.
 */
const REPOSITORY = realpathSync(resolve(import.meta.dirname, '..', '..', '..'));

type Registered = { project: { id: string; path: string }; warnings: unknown[] };

type Status = {
  manifest: {
    tracker: { provider: string | null; local: { issues: string | null } };
    knowledge: Record<'context' | 'docs' | 'adr' | 'specs', string | null>;
  } | null;
  diagnostics: { code: string }[];
};

describe('this repository', () => {
  let daemon: TestDaemon;
  before(async () => {
    daemon = await startTestDaemon();
  });
  after(async () => {
    await daemon.stop();
  });

  it('registers from its committed manifest with no warnings', async () => {
    const { status, body } = await daemon.call<Registered>('project.register', { path: REPOSITORY });
    assert.equal(status, 200);
    assert.equal(body.project.id, 'binnacle');
    assert.equal(body.project.path, REPOSITORY);
    assert.deepEqual(body.warnings, []);
  });

  it('declares the local Markdown tracker and knowledge paths that exist in the checkout', async () => {
    const { status, body } = await daemon.call<Status>('project.status', { path: REPOSITORY });
    assert.equal(status, 200);
    const { manifest } = body;
    assert.ok(manifest);
    assert.equal(manifest.tracker.provider, 'local');

    const { context, docs, adr, specs } = manifest.knowledge;
    for (const declared of [manifest.tracker.local.issues, context, docs, adr, specs]) {
      assert.ok(declared && existsSync(join(REPOSITORY, declared)), `${declared} is not in the checkout`);
    }
    // A local tracker never disagrees with the GitHub remote that hosts the code, so
    // there is nothing to diagnose.
    assert.deepEqual(body.diagnostics, []);
  });
});
