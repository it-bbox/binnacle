import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const PACKAGE = fileURLToPath(new URL('..', import.meta.url));
const PLUGIN_SOURCE = fileURLToPath(new URL('../../../.claude/skills/binnacle', import.meta.url));

/** ADR-0027's promise, checked on the packed tarball rather than assumed. */
test('the packed CLI carries the binnacle plugin, every file of its source, and a marketplace listing it', (t) => {
  const out = mkdtempSync(join(tmpdir(), 'binnacle-pack-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));

  const pack = spawnSync('pnpm', ['pack', '--pack-destination', out], { cwd: PACKAGE, encoding: 'utf8' });
  assert.equal(pack.status, 0, pack.stderr || pack.stdout);
  const [tarball] = readdirSync(out);
  assert.ok(tarball, pack.stdout);
  const untar = spawnSync('tar', ['-xzf', join(out, tarball), '-C', out]);
  assert.equal(untar.status, 0, String(untar.stderr));
  const packed = join(out, 'package');

  const source = readdirSync(PLUGIN_SOURCE, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(PLUGIN_SOURCE.length + 1))
    .sort();
  assert.ok(source.includes(join('.claude-plugin', 'plugin.json')));
  assert.deepEqual(
    source.filter((path) => path.endsWith('SKILL.md')),
    ['audit', 'autopilot', 'checkpoint', 'daily', 'product', 'task'].map((skill) => join('skills', skill, 'SKILL.md')),
  );
  for (const path of source) {
    assert.equal(readFileSync(join(packed, 'plugin', path), 'utf8'), readFileSync(join(PLUGIN_SOURCE, path), 'utf8'), path);
  }

  const marketplace = JSON.parse(readFileSync(join(packed, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.equal(marketplace.name, 'binnacle');
  assert.deepEqual(
    marketplace.plugins.map((plugin: { name: string; source: string }) => [plugin.name, plugin.source]),
    [['binnacle', './plugin']],
  );
  assert.equal(JSON.parse(readFileSync(join(packed, 'plugin', '.claude-plugin', 'plugin.json'), 'utf8')).name, 'binnacle');
});

/** The baseline's rule that only low-risk Tasks run in parallel, held by the one process that starts agents in parallel (ADR-0022). */
test('autopilot starts a second ticket only for a low pair, and says when the risk was not assessed', () => {
  const skill = readFileSync(join(PLUGIN_SOURCE, 'skills', 'autopilot', 'SKILL.md'), 'utf8');
  assert.match(skill, /`tasks\.parallel\.impact`/);
  assert.match(skill, /only when the pair's `risk` is `low`/);
  assert.match(skill, /`medium`, `high` or `unknown`/);
  assert.match(skill, /risk was not assessed/);
});

/** The Next action is the owner's, set by a Product session (docs/workflow/02-development-workflow.md, step 3). */
test('autopilot leaves the Next action to the owner, in the brief and in its report', () => {
  const skill = readFileSync(join(PLUGIN_SOURCE, 'skills', 'autopilot', 'SKILL.md'), 'utf8');
  assert.match(skill, /never its `Next action:` paragraph/);
  assert.match(skill, /stale `Next action:`/);
});
