import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { preparePlugin } from '../src/prepare.ts';

const PACKAGE = fileURLToPath(new URL('..', import.meta.url));
const PLUGIN_SOURCE = fileURLToPath(new URL('../../../.claude/skills/binnacle', import.meta.url));
const skillText = (name: string): string => readFileSync(join(PLUGIN_SOURCE, 'skills', name, 'SKILL.md'), 'utf8');

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
    ['audit', 'autopilot', 'checkpoint', 'daemon', 'daily', 'dashboard', 'help', 'init', 'product', 'register', 'status', 'task'].map((skill) => join('skills', skill, 'SKILL.md')),
  );
  const manifest = join('.claude-plugin', 'plugin.json');
  for (const path of source.filter((path) => path !== manifest)) {
    assert.equal(readFileSync(join(packed, 'plugin', path), 'utf8'), readFileSync(join(PLUGIN_SOURCE, path), 'utf8'), path);
  }

  const marketplace = JSON.parse(readFileSync(join(packed, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.equal(marketplace.name, 'binnacle');
  assert.deepEqual(
    marketplace.plugins.map((plugin: { name: string; source: string }) => [plugin.name, plugin.source]),
    [['binnacle', './plugin']],
  );
  const { version, ...plugin } = JSON.parse(readFileSync(join(packed, 'plugin', manifest), 'utf8'));
  assert.deepEqual(plugin, JSON.parse(readFileSync(join(PLUGIN_SOURCE, manifest), 'utf8')));
  assert.equal(version, preparePlugin(PLUGIN_SOURCE, join(out, 'prepared')));
  assert.equal(plugin.name, 'binnacle');
  for (const description of [plugin.description, marketplace.plugins[0].description]) {
    assert.match(description, /\binit\b/);
    assert.match(description, /\bhelp\b/);
  }
});

/** Epic 9: Claude Code's `plugin update` refreshes its copy only when the version changes, and a manifest with none installs as `unknown` for good. */
test('the packaged plugin\'s version changes when a skill\'s text changes, and stays the same when nothing does', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'binnacle-version-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = join(dir, 'source');
  const target = join(dir, 'plugin');
  cpSync(PLUGIN_SOURCE, source, { recursive: true });
  const written = (): unknown => JSON.parse(readFileSync(join(target, '.claude-plugin', 'plugin.json'), 'utf8')).version;

  const version = preparePlugin(source, target);
  assert.match(version, /^[0-9a-f]{12}$/);
  assert.equal(written(), version);
  assert.equal(preparePlugin(source, target), version);

  appendFileSync(join(source, 'skills', 'status', 'SKILL.md'), 'One more line.\n');
  const changed = preparePlugin(source, target);
  assert.notEqual(changed, version);
  assert.equal(written(), changed);
  assert.match(readFileSync(join(target, 'skills', 'status', 'SKILL.md'), 'utf8'), /One more line\.\n$/);
});

/** The baseline's rule that only low-risk Tasks run in parallel, held by the one process that starts agents in parallel (ADR-0022). */
test('autopilot starts a second ticket only for a low pair, and says when the risk was not assessed', () => {
  const skill = skillText('autopilot');
  assert.match(skill, /`tasks\.parallel\.impact`/);
  assert.match(skill, /only when the pair's `risk` is `low`/);
  assert.match(skill, /`medium`, `high` or `unknown`/);
  assert.match(skill, /risk was not assessed/);
});

/** Epic 8's exit demonstration: the snapshot carried the graph and the conflict risk, and the Product session never said either. */
test('/binnacle:product presents the graph\'s freshness in one line and each pair\'s conflict risk beside the Tasks ready to start', () => {
  const skill = skillText('product');
  assert.match(skill, /\*\*Graph\*\*, in one line: current or behind from `graph\.behind`, built from `graph\.builtFrom`'s commit and time, and `graph\.lastRun`'s outcome and time, with its reason when it failed/);
  assert.match(skill, /When `graph` is marked `available: false`, give its reason instead/);
  assert.match(skill, /\*\*Conflict risk\*\*, beside the Tasks ready to start: each pair in `tasks\.parallel\.impact\.pairs`, by Task id, with its `risk` and its `reason`/);
  assert.match(skill, /Binnacle's calculation from the graph, not a fact; say so once/);
  assert.match(skill, /When `impact` is marked `available: false`, say the risk was not assessed, with its reason/);
});

/** The Next action is the owner's, set by a Product session (docs/workflow/02-development-workflow.md, step 3). */
test('autopilot leaves the Next action to the owner, in the brief and in its report', () => {
  const skill = skillText('autopilot');
  assert.match(skill, /never its `Next action:` paragraph/);
  assert.match(skill, /stale `Next action:`/);
});

/** Epic 9: the installed binnacle@binnacle shadows the skills-directory plugin here, so a merged skill reaches the owner only once refreshed. */
test('autopilot refreshes the plugin only when a merge changed its skills and binnacle@binnacle is installed, and a failure does not stop the run', () => {
  const skill = skillText('autopilot');
  assert.match(skill, /changed `\.claude\/skills\/binnacle\/` \(only when this project is Binnacle itself\)/);
  assert.match(skill, /after any frozen install and before regenerating the dashboard/);
  assert.match(skill, /`pnpm --filter @binnacle\/cli run prepare`/);
  assert.match(skill, /only if `claude plugin list --json` lists `binnacle@binnacle`, `claude plugin marketplace update binnacle` then `claude plugin update binnacle@binnacle`/);
  assert.match(skill, /A failure here never stops the run/);
  assert.match(skill, /the plugin refreshed and that a new session loads it, or why it was skipped, or which command failed and the commands run before it/);
});

/** Epic 9's ticket 13: with no terminal, a push that waits on a prompt hangs the run instead of failing. */
test('autopilot pulls and pushes main so that no prompt can hold it, and reports a failed push to the owner', () => {
  const skill = skillText('autopilot');
  assert.match(skill, /`GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND='ssh -o BatchMode=yes' git pull --ff-only`/);
  assert.match(skill, /`GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND='ssh -o BatchMode=yes' git push origin main`, never forced/);
  assert.match(skill, /If the push fails, keep going and report it under \*Waiting for the owner\*/);
});

/** Epic 9: the daemon and registration from the chat, run through binn so that they need no daemon. */
test('/binnacle:daemon, /binnacle:register and /binnacle:init run binn, are started by a human only, and handle a missing binn as /binnacle:audit does', () => {
  for (const name of ['daemon', 'register', 'init']) {
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
  for (const name of ['product', 'daily', 'task', 'status', 'checkpoint', 'autopilot']) {
    const skill = skillText(name);
    assert.match(skill, /`daemon\.unreachable`: `\/binnacle:daemon start`, or `binn daemon start`/, name);
    assert.match(skill, /`project\.not_registered`: `\/binnacle:register`, or `binn project register`/, name);
  }
});

/** Epic 9: the baseline's /status, over project_status alone and short; its two fixes are held with the other daemon-dependent skills below. */
test('/binnacle:status calls project_status and nothing else, says a linked worktree plainly and shows diagnostics', () => {
  const skill = skillText('status');
  assert.match(skill, /^disable-model-invocation: true$/m);
  assert.match(skill, /Call the `binnacle` MCP server's `project_status` tool once/);
  assert.match(skill, /no Binnacle call other than `project_status`/);
  assert.match(skill, /`registered` is false/);
  assert.match(skill, /"no commits yet" when `git\.commit` is null/);
  assert.match(skill, /a linked worktree, not the registered checkout/);
  assert.match(skill, /\*\*Diagnostics\*\*: every item with its code/);
  assert.match(skill, /leave them to `\/binnacle:product`/);
});

/** Epic 9: the dashboard from the chat, with its token kept out of the chat; a skill's shell output reaches the model's provider (ADR-0031). */
test('/binnacle:dashboard runs binn dashboard, never --print, and never shows a token', () => {
  const skill = skillText('dashboard');
  assert.match(skill, /^disable-model-invocation: true$/m);
  assert.match(skill, /needs no daemon/);
  assert.match(skill, /Run `binn dashboard` once/);
  assert.match(skill, /`command not found`, exit 127/);
  assert.match(skill, /README's setup section/);
  assert.match(skill, /give the exit code and quote what it printed on stderr/);
  assert.match(skill, /Exit 4 means the daemon is not running/);
  assert.match(skill, /`\/binnacle:daemon start`/);
  assert.match(skill, /Never run `binn dashboard --print`/);
  assert.match(skill, /never show, read or ask for the token/);
  // The skill names --print only where it forbids running it or tells the human to run it at a terminal.
  for (const line of skill.split('\n').filter((line) => line.includes('--print'))) {
    assert.match(line, /Never run `binn dashboard --print`|at a terminal/, line);
  }
  assert.doesNotMatch(skill, /#token=|token\.json|cat .*token/);
});

/** Epic 9's exit demonstration: the answer spoke of a masked token and asked for an address with its token copied from a terminal. */
test('/binnacle:dashboard answers plainly: the dashboard opened at the printed address, or --print at a terminal, never pasted into the chat', () => {
  const skill = skillText('dashboard');
  assert.match(skill, /prints the address alone, which carries no token: nothing in it was masked, cut or hidden/);
  assert.match(skill, /Show the address it printed on stdout, whether or not a browser opened/);
  assert.match(skill, /the dashboard opened in the browser at that address/);
  assert.match(skill, /run `binn dashboard --print` at a terminal and open what it prints there, without pasting it into the chat/);
  assert.match(skill, /Never say that a token was masked or hidden, and never ask the human to copy an address from `binn dashboard`'s output in step 1/);
  // Wording that once led the answer to a stripped token: an address "without its token", or "with its token" to fetch.
  assert.doesNotMatch(skill, /without (its|the) token|with its token|token-free/);
});

/** Epic 9, ADR-0037: binn init confirmed in the chat, by the human's yes and never by the agent; its frontmatter and failures are held with /binnacle:daemon's above. */
test('/binnacle:init shows the plan from --plan --json, asks once, applies only after the human\'s yes with the id, shows a changed plan again, and never commits', () => {
  const skill = skillText('init');
  assert.match(skill, /`binn init --plan --json`/);
  assert.match(skill, /every plan item in full, numbered/);
  assert.match(skill, /Ask once/);
  assert.match(skill, /Only a clear yes from the human in the chat/);
  assert.match(skill, /Never answer the question yourself/);
  assert.match(skill, /`--window <days\|all>` when the human named a window/);
  assert.match(skill, /`binn init --apply <id>`/);
  assert.match(skill, /`init\.plan_changed`/);
  assert.match(skill, /show the new plan and ask again/);
  assert.match(skill, /Never commit/);
});

/** Epic 9's exit demonstration: after init wrote .mcp.json the same session had no binnacle server, and a missing registration was sent back to init. */
test('/binnacle:init says to open a new session only when it created .mcp.json, and /binnacle:init and /binnacle:daemon start name /binnacle:register for a missing registration', () => {
  const init = skillText('init');
  // init never rewrites an existing JSON file (ADR-0026): created is the only Summary line in which it changed .mcp.json.
  assert.match(init, /When the Summary shows `\.mcp\.json` created/);
  assert.match(init, /open a new session in the repository at the `root`, and approve the project's `binnacle` server when Claude Code asks/);
  assert.match(init, /Otherwise, say nothing of a new session/);
  assert.match(init, /`\/binnacle:daemon start` then `\/binnacle:register` adds the registration, with the same path when one was passed/);
  const daemon = skillText('daemon');
  assert.match(daemon, /a project not registered yet is registered by `\/binnacle:register`/);
  for (const skill of [init, daemon]) assert.doesNotMatch(skill, /`\/binnacle:init` again/);
});

/** Epic 9: /binnacle:help, a guide in the user's language that names every skill the plugin ships, so a skill added later fails here until it does. */
test('/binnacle:help names every skill of the plugin and no other, answers in the user\'s language, and calls no tool and runs no command', () => {
  const skill = skillText('help');
  assert.match(skill, /^disable-model-invocation: true$/m);
  assert.doesNotMatch(skill, /^argument-hint:/m);
  assert.match(skill, /in the language the user writes in/);
  assert.match(skill, /Call no tool and run no command/);
  const named = new Set([...skill.matchAll(/`\/binnacle:([a-z-]+)`/g)].map(([, name]) => name));
  assert.deepEqual([...named].sort(), readdirSync(join(PLUGIN_SOURCE, 'skills')).sort());
  assert.match(skill, /`\/grill-with-docs` → `\/to-spec` → `\/to-tickets`/);
  assert.match(skill, /`\/binnacle:product`, the work, `\/binnacle:checkpoint`/);
});
