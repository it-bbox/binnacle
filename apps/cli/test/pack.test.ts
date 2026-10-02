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
    ['audit', 'autopilot', 'checkpoint', 'daemon', 'daily', 'product', 'register', 'task'].map((skill) => join('skills', skill, 'SKILL.md')),
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

const skillText = (name: string): string => readFileSync(join(PLUGIN_SOURCE, 'skills', name, 'SKILL.md'), 'utf8');

/** Epic 9: the daemon and registration from the chat, run through binn so that they need no daemon. */
test('/binnacle:daemon and /binnacle:register run binn, are started by a human only, and handle a missing binn as /binnacle:audit does', () => {
  for (const name of ['daemon', 'register']) {
    const skill = skillText(name);
    assert.match(skill, /^disable-model-invocation: true$/m, name);
    assert.match(skill, /^argument-hint: "\[.+\]"$/m, name);
    assert.match(skill, /needs no daemon/, name);
    assert.match(skill, /`command not found`, exit 127/, name);
    assert.match(skill, /README's setup section/, name);
    assert.match(skill, /give the exit code and quote what it printed on stderr/, name);
  }

  const daemon = skillText('daemon');
  assert.match(daemon, /`binn daemon <action>`/);
  assert.match(daemon, /`status` when no action was passed/);
  assert.match(daemon, /log tail/);

  const register = skillText('register');
  assert.match(register, /`binn project register <path>`/);
  assert.match(register, /first path `git worktree list` prints/);
  assert.match(register, /differs from this session's checkout/);
  assert.match(register, /`\/binnacle:daemon start`/);
});

/** Where the daemon is down or the project unregistered, the fix is one skill away. */
test('every daemon-dependent skill names /binnacle:daemon start and /binnacle:register beside the binn command', () => {
  for (const name of ['product', 'daily', 'task', 'checkpoint', 'autopilot']) {
    const skill = skillText(name);
    assert.match(skill, /`daemon\.unreachable`: `\/binnacle:daemon start`, or `binn daemon start`/, name);
    assert.match(skill, /`project\.not_registered`: `\/binnacle:register`, or `binn project register`/, name);
  }
});
