import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validateManifest } from '../src/index.ts';

/**
 * The spec puts validation in this package precisely because it depends on nothing.
 * The assertion lives here rather than in the daemon's tests: a package checks its own
 * boundary, and the daemon has no business reading these sources.
 */
test('core stays pure: no dependencies and nothing imported from outside it', () => {
  const source = new URL('../src/', import.meta.url);
  for (const name of readdirSync(source).filter((file) => file.endsWith('.ts'))) {
    const text = readFileSync(new URL(name, source), 'utf8');
    assert.ok(!/from 'node:/.test(text), `${name} must not import a node: module`);
    assert.ok(!/^import .* from '(?!\.)/m.test(text), `${name} must import nothing outside this package`);
  }

  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  assert.equal(manifest.dependencies, undefined);
});

/**
 * A second seam, deliberately. The spec fixes one seam at the daemon's HTTP API, and
 * that rule holds for the daemon's own behaviour. This is a different thing: the public
 * function of a separate package, whose contract — a field the user did not write comes
 * back null — three later epics consume and the daemon API does not expose until ticket
 * 04 puts manifest facts on `project.status`. Testing it there instead would mean
 * shipping the rule untested until then.
 */
test('a field the user did not write comes back null, never a substituted default', () => {
  const { manifest, problems } = validateManifest({ version: 1, project: { id: 'only-an-id' } });

  assert.deepEqual(problems, []);
  assert.ok(manifest);
  assert.equal(manifest.project.name, null);
  assert.equal(manifest.tracker.provider, null);
  assert.equal(manifest.tracker.local.issues, null);
  assert.equal(manifest.knowledge.context, null);
  assert.equal(manifest.workflow.scratch, null);
  assert.equal(manifest.automation.mode, null);
  assert.equal(manifest.automation.maxParallelDevelopmentTasks, null);
  assert.equal(manifest.telemetry.privacy, null);
  assert.equal(manifest.telemetry.import.windowDays, null);
  assert.deepEqual(manifest.capabilities, {});
});

test('a declared field comes back as declared', () => {
  const { manifest } = validateManifest({
    version: 1,
    project: { id: 'declared', name: 'Declared' },
    tracker: { provider: 'gitlab' },
    telemetry: { privacy: 'content' },
  });

  assert.ok(manifest);
  assert.equal(manifest.tracker.provider, 'gitlab');
  assert.equal(manifest.telemetry.privacy, 'content');
});

test('an import window is a positive number of days or all, and nothing else', () => {
  const window = (value: unknown) => validateManifest({ version: 1, project: { id: 'window' }, telemetry: { import: { window_days: value } } });
  assert.equal(window('all').manifest?.telemetry.import.windowDays, 'all');
  assert.equal(window(30).manifest?.telemetry.import.windowDays, 30);
  for (const value of ['forever', 0, 1.5]) assert.deepEqual(window(value).problems.map((problem) => problem.path), ['telemetry.import.window_days']);
});
