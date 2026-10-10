import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { preparePlugin, prepareSkills } from '../src/prepare.ts';

const PACKAGE = fileURLToPath(new URL('..', import.meta.url));
// The `skills` CLI reads frontmatter as strict YAML; the daemon's `yaml` parser reads it the same way, so the test borrows it rather than adding a dependency.
const { parse: parseYaml } = createRequire(new URL('../../daemon/package.json', import.meta.url))('yaml') as { parse: (text: string) => unknown };
const PLUGIN_SOURCE = fileURLToPath(new URL('../../../.claude/skills/binnacle', import.meta.url));
const skillText = (name: string): string => readFileSync(join(PLUGIN_SOURCE, 'skills', name, 'SKILL.md'), 'utf8');
const workflowText = (): string => readFileSync(fileURLToPath(new URL('../../../docs/workflow/02-development-workflow.md', import.meta.url)), 'utf8');
const ACTIONS = readdirSync(join(PLUGIN_SOURCE, 'skills')).sort();
const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))
    .sort();

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
  prepareSkills(PLUGIN_SOURCE, join(out, 'prepared-skills'), version);
  assert.deepEqual(filesUnder(join(packed, 'skills')), filesUnder(join(out, 'prepared-skills')));
  for (const path of filesUnder(join(out, 'prepared-skills'))) {
    assert.equal(readFileSync(join(packed, 'skills', path), 'utf8'), readFileSync(join(out, 'prepared-skills', path), 'utf8'), path);
  }
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

/** Epic 14 (ADR-0039): the copy the `skills` CLI installs into every other harness, drawn from the plugin and named for a harness without `/binnacle:`. */
test('the skills copy has one binnacle-<action> folder per plugin skill, renamed throughout, with the plugin\'s version and no Claude Code-only field', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'binnacle-skills-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const target = join(dir, 'skills');
  const version = preparePlugin(PLUGIN_SOURCE, join(dir, 'plugin'));
  prepareSkills(PLUGIN_SOURCE, target, version);

  assert.deepEqual(filesUnder(target), ACTIONS.map((action) => join(`binnacle-${action}`, 'SKILL.md')));
  for (const action of ACTIONS) {
    const text = readFileSync(join(target, `binnacle-${action}`, 'SKILL.md'), 'utf8');
    const [, frontmatter = ''] = /^---\n([\s\S]*?)\n---\n/.exec(text) ?? [];
    assert.match(frontmatter, new RegExp(`^name: binnacle-${action}$`, 'm'), action);
    assert.match(frontmatter, new RegExp(`^metadata:\n  version: "${version}"$`, 'm'), action);
    assert.doesNotMatch(frontmatter, /^(disable-model-invocation|argument-hint):/m, action);
    assert.doesNotMatch(text, /\/binnacle:/, action);
    const renamed = (plugin: string): string => plugin.replaceAll(/\/binnacle:([a-z-]+)/g, 'binnacle-$1');
    // Strict YAML, as the `skills` CLI reads it, which skips a skill whose plain description holds `: ` (ticket 12).
    const [, description] = /^description: (.*)$/m.exec(skillText(action)) ?? [];
    assert.ok(description, action);
    assert.equal((parseYaml(frontmatter) as { description?: unknown }).description, renamed(description), action);
    // Nothing else changes: the body is the plugin's with each skill renamed.
    const body = (skill: string): string => skill.slice(skill.indexOf('\n---\n', 4));
    assert.equal(body(text), renamed(body(skillText(action))), action);
  }

  const help = readFileSync(join(target, 'binnacle-help', 'SKILL.md'), 'utf8');
  const named = new Set([...help.matchAll(/`(binnacle-[a-z-]+)`/g)].map(([, name]) => name));
  assert.deepEqual([...named].sort(), ACTIONS.map((action) => `binnacle-${action}`));

  // A skill without frontmatter fails the build rather than reaching a harness half-written.
  const broken = join(dir, 'broken');
  cpSync(PLUGIN_SOURCE, broken, { recursive: true });
  writeFileSync(join(broken, 'skills', 'status', 'SKILL.md'), 'No frontmatter.\n');
  assert.throws(() => prepareSkills(broken, join(dir, 'broken-skills'), version), /status\/SKILL\.md: no frontmatter/);
  // Nor does a description on lines of its own, which quoting its first line would empty.
  for (const description of ['>', '|', '']) {
    writeFileSync(join(broken, 'skills', 'status', 'SKILL.md'), `---\nname: status\ndescription:${description && ` ${description}`}\n  Show this project.\n---\n`);
    assert.throws(() => prepareSkills(broken, join(dir, 'broken-skills'), version), /status\/SKILL\.md: the description is not on one line/, description);
  }

  // A skill the plugin no longer has leaves the copy on the next build.
  mkdirSync(join(target, 'binnacle-gone'));
  prepareSkills(PLUGIN_SOURCE, target, version);
  assert.equal(existsSync(join(target, 'binnacle-gone')), false);
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
  // No invented telemetry: a graph built outside the daemon has no recorded build, and its `behind` reads true.
  assert.match(skill, /A `null` `behind` is "not known". A `null` `builtFrom` is "no build recorded", and then do not call the graph behind; a `null` `lastRun` is "no run recorded"/);
  assert.match(skill, /When `graph` is marked `available: false`, give its reason instead, here rather than under \*\*Not available\*\*/);
  assert.match(skill, /\*\*Conflict risk\*\*, beside the Tasks ready to start: each pair in `tasks\.parallel\.impact\.pairs`, by Task id, with its `risk`, its `reason` and the `modules` it names/);
  assert.match(skill, /Binnacle's calculation from the graph, not a fact; say so once/);
  assert.match(skill, /With no pair, say "no pair to assess"/);
  assert.match(skill, /When `impact` is marked `available: false`, say the risk was not assessed, with its reason, here rather than under \*\*Not available\*\*/);
});

/** The Next action is the owner's, set by a Product session (docs/workflow/02-development-workflow.md, step 3). */
test('autopilot leaves the Next action to the owner, in the brief and in its report', () => {
  const skill = skillText('autopilot');
  assert.match(skill, /never its `Next action:` paragraph/);
  assert.match(skill, /stale `Next action:`/);
});

/** Epic 10's ticket 17: review and rework are told apart at the commit that first records `### Review`, so the Review is committed before its fixes (the owner, 2026-10-08). */
test('autopilot asks for the Review\'s commit before its fixes, as the development workflow does, and step 8 sends back a Review recorded only at the end', () => {
  const skill = skillText('autopilot');
  assert.match(workflowText(), /The review's findings go under `### Review` there, each marked to fix or kept with its reason, in a commit of their own before any fix/);
  assert.match(skill, /commit the ticket's `### Review` with every finding, each marked "to fix" or "kept" with its reason, in a commit of its own that changes only the ticket/);
  assert.match(skill, /Commit the fixes in commits of their own\. 5\) The last commit marks each finding fixed, kept or left, ticks the criteria and sets `Status: DONE`/);
  assert.match(skill, /If the review finds nothing to fix, say so in the Review commit, which stays a commit of its own, and the last commit, right after it, may be the DONE one/);
  assert.match(skill, /Binnacle tells review from rework at the commit that first adds `### Review`, so keep this order/);
  assert.doesNotMatch(skill, /the development workflow sets under \*Per ticket\*/);
  assert.match(skill, /the commit that first adds `### Review` to the ticket .+ changes only the ticket, and when the Review marks any finding fixed, a commit after it, before the last, changes more than the ticket \(`git log --format=%H <review>\.\.<branch>~1 -- \. ':\(exclude\)<ticket path>'` prints one\)/);
  assert.match(skill, /Review recorded only in the last commit, after its fixes/);
  assert.doesNotMatch(skill, /record its findings under the ticket's `## Comments` → `### Review` as fixed, kept or left, tick/);
});

/** Epic 9: the installed binnacle@binnacle shadows the skills-directory plugin here, so a merged skill reaches the owner only once refreshed; epic 14 keeps Claude Code's commands in the development workflow, out of the skill. */
test('autopilot refreshes the plugin only when a merge changed its skills, with the development workflow\'s commands, and a failure does not stop the run', () => {
  const skill = skillText('autopilot');
  assert.match(skill, /changed the `binnacle` plugin's skills \(only when this project is Binnacle itself\)/);
  assert.match(skill, /refresh the plugin as `docs\/workflow\/02-development-workflow\.md` says under \*Per ticket\* for a merge that changed the plugin's skills/);
  assert.match(skill, /after any frozen install and before regenerating the dashboard/);
  const workflow = workflowText();
  assert.match(workflow, /run `pnpm --filter @binnacle\/cli run prepare`; then, if `claude plugin list --json` lists `binnacle@binnacle`, `claude plugin marketplace update binnacle` then `claude plugin update binnacle@binnacle`/);
  assert.match(skill, /A failure here never stops the run/);
  assert.match(skill, /the plugin refreshed and that a new session loads it, or why it was skipped, or which command failed and the commands run before it/);
});

/** Epic 14: every other harness runs the package's `binnacle-<action>` copy, which the `skills` CLI installed, so a merged skill reaches it only once reinstalled, right after the plugin refresh and by the same rules. */
test('autopilot reinstalls the skills CLI\'s copy after the plugin refresh, with the development workflow\'s commands, and reports it', () => {
  const skill = skillText('autopilot');
  assert.match(skill, /then reinstall the package's `binnacle-<action>` copy through the `skills` CLI as the same paragraph says, right after the plugin refresh/);
  const workflow = workflowText();
  assert.match(workflow, /Then, if `~\/\.agents\/skills` holds a `binnacle-\*` skill, `npx skills add \.\/apps\/cli\/skills -g -y` then `npx skills remove -g -a claude-code -s \$\(ls apps\/cli\/skills\) -y`/);
  assert.match(skill, /the skills CLI's copy reinstalled, or why it was skipped, or which command failed and the commands run before it/);
  // Without `./` the `skills` CLI reads `apps/cli` as a GitHub repository (ticket 12).
  for (const readme of ['README.md', 'README.ru.md']) {
    assert.match(readFileSync(fileURLToPath(new URL(`../../../${readme}`, import.meta.url)), 'utf8'), /^npx skills add \.\/apps\/cli\/skills -g -y$/m, readme);
  }
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

/** Epic 14: a harness with a shell and no Binnacle MCP server runs every skill that calls a tool, through binn call. */
test('every skill that calls a Binnacle tool falls back to binn call, once, and names a missing binn', () => {
  const fallback = "If this session has no `binnacle` MCP tools, run each Binnacle tool this skill calls as `binn call <tool> '<arguments as one JSON object>'` in the shell instead, with the same arguments, and read the JSON it prints: what the tool returns, or the same error with its code.";
  const calling = ['product', 'daily', 'task', 'status', 'checkpoint', 'autopilot'];
  for (const name of calling) {
    const skill = skillText(name);
    assert.equal(skill.split(fallback).length - 1, 1, name);
    assert.match(skill, /If the shell cannot find `binn` \(`command not found`, exit 127\), `binn` is not on this harness's PATH \(see the README's setup section\)/, name);
    assert.doesNotMatch(skill, /server is missing or disconnected/, name);
  }
  // Skills that call no tool need no fallback.
  for (const name of ACTIONS.filter((action) => !calling.includes(action))) {
    assert.doesNotMatch(skillText(name), /binn call/, name);
  }
});

/** Epic 9: the baseline's /status, over project_status alone and short; its two fixes are held with the other daemon-dependent skills below. */
test('/binnacle:status calls project_status and nothing else, says a linked worktree plainly and shows diagnostics', () => {
  const skill = skillText('status');
  assert.match(skill, /^disable-model-invocation: true$/m);
  assert.match(skill, /Call the `binnacle` MCP server's `project_status` tool once/);
  assert.match(skill, /no Binnacle call other than `project_status`/);
  assert.match(skill, /no shell commands other than `binn call project_status`/);
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

/** Epic 9's exit demonstration: after init wrote .mcp.json the same session had no binnacle server, and a missing registration was sent back to init; epic 14 takes the harness's rule from binn init's output. */
test('/binnacle:init says to open a new session only when binn init\'s output says so for a file the Summary shows written, and /binnacle:init and /binnacle:daemon start name /binnacle:register for a missing registration', () => {
  const init = skillText('init');
  assert.match(init, /When init's output says that a harness reads a file only when a session starts, and the Summary shows that file created or extended/);
  assert.match(init, /open a new session in the repository at the `root`, as the output says/);
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
  // The description names no harness's syntax: the binnacle-<action> copy keeps it as written (epic 14).
  assert.match(skill, /^description: .*which Binnacle skill to use when/m);
  assert.match(skill, /in the language the user writes in/);
  assert.match(skill, /Call no tool and run no command/);
  const named = new Set([...skill.matchAll(/`\/binnacle:([a-z-]+)`/g)].map(([, name]) => name));
  assert.deepEqual([...named].sort(), readdirSync(join(PLUGIN_SOURCE, 'skills')).sort());
  assert.match(skill, /`\/grill-with-docs` → `\/to-spec` → `\/to-tickets`/);
  assert.match(skill, /`\/binnacle:product`, the work, `\/binnacle:checkpoint`/);
});

/** Epic 14, ADR-0039: one text per skill runs in any harness, so none names one harness's mechanism. */
test('no plugin skill names an agent tool, a question tool, claude plugin, a .claude/ path or "Claude Code asks"', () => {
  const mechanisms = [/\bAgent tool\b/, /\bSendMessage\b/, /run_in_background/, /isolation: "worktree"/, /AskUserQuestion/, /claude plugin/, /\.claude\//, /Claude Code asks/];
  for (const name of readdirSync(join(PLUGIN_SOURCE, 'skills'))) {
    const skill = skillText(name);
    for (const mechanism of mechanisms) assert.doesNotMatch(skill, mechanism, name);
  }
});

/** Epic 14: autopilot ships to harnesses that cannot keep a model from invoking it, start an isolated agent, or send a push notification. */
test('autopilot is started by a human only, refuses at its first step where the harness has no background agent in a worktree of its own, and notifies only where it can', () => {
  const skill = skillText('autopilot');
  assert.match(skill, /Only a human starts this skill/);
  const first = skill.slice(skill.indexOf('\n1. '), skill.indexOf('\n2. '));
  assert.match(first, /cannot start a background agent in a worktree of its own/);
  assert.match(first, /start nothing and change nothing/);
  assert.match(first, /the epic's tickets are run by hand/);
  // Ticket 11 of epic 14: the step reads the harness's tool, not the model's belief. ZCode passed it by planning worktrees of its own.
  assert.match(first, /Read the answer from the tool that starts an agent, as the harness defines it, not from what you believe/);
  assert.match(first, /must take a parameter[^.]*that has the harness create the agent's worktree/);
  assert.match(first, /A worktree you would create yourself[^.]* does not count/);
  assert.match(first, /in the background but has no such parameter does not count/);
  assert.match(first, /Unless one tool here both starts a background agent and takes that parameter/);
  assert.match(first, /say which of the two this harness lacks, or both/);
  // A harness that can start such an agent but not message it: what would be sent stops the ticket instead.
  assert.match(skill, /Where the harness cannot send a message to an agent it started, whatever this skill would send to that agent stops its ticket instead/);
  // A linked worktree in general, not the one Claude Code's desktop app opens.
  assert.doesNotMatch(skill, /desktop app|--worktree/);
  const notifications = skill.split('\n').filter((line) => /push notification/.test(line));
  assert.ok(notifications.length >= 3, 'the description, a stopped ticket and the end');
  for (const line of notifications) assert.match(line, /where the harness can send one/, line);
});
