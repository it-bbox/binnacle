import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { readGitFacts, workingTree, type GitRemote } from '@binnacle/adapters';
import { forgeRemote, instructionSets, TASK_STATES, type ImportWindow, type ProjectManifest, type TrackerProvider } from '@binnacle/core';
import {
  credentialsKey,
  credentialsPath,
  DEFAULT_WINDOW_DAYS,
  isAlive,
  MANIFEST_RELATIVE,
  OperationError,
  readManifest,
  readTracker,
  readRuntime,
  resolveGitTimeout,
} from '@binnacle/daemon';
import { EXIT, type ExitCode } from './exit.ts';
import { sessionHistory } from './history.ts';
import { describeSets, hasTicketHeaderSection, instructionFiles, ISSUE_TRACKER, mattPocockFiles } from './layout.ts';
import { register } from './project-commands.ts';
import { declaredCapabilities, onPath, registeredWith, TOOLS, VSCODE_USER_DIRECTORY, type Tool } from './tools.ts';

type Outcome = 'created' | 'extended' | 'printed' | 'ran' | 'found' | 'checked' | 'failed' | 'declined' | 'skipped';

/** One write the plan proposes: shown in full before the one question, applied only after a yes. */
type PlanItem = {
  heading: string;
  body: string;
  /** What the Summary says when the plan is not confirmed. */
  declined: string;
  apply(): Promise<void> | void;
};

/** What one run of `binn init` knows and has done: where it works, how it asks, the plan it has built, and what it will summarise. */
type Session = {
  root: string;
  /** The next line of input after `prompt`, or null at the end of input. */
  answer(prompt: string): Promise<string | null>;
  say(text: string): void;
  plan: PlanItem[];
  outcomes: { outcome: Outcome; what: string }[];
  /** The harnesses other than Claude Code that were detected: the Summary says how to continue in each. */
  otherHarnesses: Harness[];
};

/**
 * `binn init [path]`: the one command that writes into a project's repository (ADR-0026).
 * It works out every write first, asking only the questions that are not about a write, shows
 * them together as one plan and asks once (ADR-0034): Enter or `y` accepts it at a terminal,
 * anything else declines it, and with stdin not a terminal nothing is written. It never commits.
 */
export async function init(home: string, path?: string): Promise<ExitCode> {
  const git = await readGitFacts(resolve(path ?? process.cwd()), resolveGitTimeout());
  if (!git.available) {
    console.error(`binn: ${git.reason} binn init works at the root of a Git repository.`);
    return EXIT.failed;
  }

  const lines = createInterface({ input: process.stdin });
  const answers = lines[Symbol.asyncIterator]();
  const answer = async (prompt: string): Promise<string | null> => {
    process.stdout.write(prompt);
    const next = await answers.next();
    if (next.done) process.stdout.write('\n');
    return next.done ? null : next.value;
  };
  const session: Session = { root: git.root, answer, say: (text) => console.log(text), plan: [], outcomes: [], otherHarnesses: [] };

  try {
    session.say(`Setting up Binnacle in ${session.root}. Nothing is written until you have seen the whole plan and confirmed it.\n`);
    const manifest = manifestStep(session);
    session.say('');
    const windowSection = await windowStep(session, manifest);
    // Read before the manifest is proposed, which declares what is found or installed; planned after the other writes.
    const tools = detectTools(session.root);
    const toDeclare = tools.filter(({ state }) => state === 'found' || state === 'install').map(({ tool }) => tool.name);
    if (manifest === 'new') planFile(session, MANIFEST_RELATIVE, proposeManifest(session.root, git.remotes, toDeclare) + (windowSection ? `\n${windowSection}` : ''));
    session.say('');
    registrationStep(session, home, manifest !== 'invalid');
    session.say('');
    const harnesses = harnessStep(session);
    session.say('');
    pluginStep(session);
    session.say('');
    // The manifest as it is now, or the tracker it would propose: the plan is not yet written.
    mattPocockStep(session, declaredManifest(session.root)?.tracker.provider ?? forgeRemote(git.remotes)?.provider ?? 'local');
    session.say('');
    instructionsStep(session);
    session.say('');
    toolsStep(session, tools);
    session.say('');
    serversStep(session, tools, harnesses);
    session.say('');
    await confirmPlan(session, process.stdin.isTTY === true);
    session.say('');
    // After the plan is written: the manifest it created is the one whose tracker is read.
    await trackerStep(session, home, declaredManifest(session.root));
    session.say('');
  } finally {
    // Closed, not only its iterator ended: a terminal's stdin would otherwise keep init running after its summary.
    lines.close();
  }

  session.say('Summary:');
  for (const { outcome, what } of session.outcomes) session.say(`  ${outcome.padEnd(8)}  ${what}`);
  session.say('Nothing was committed. Review what binn init wrote, and commit it yourself.');
  session.say('To see how far this repository is from the way Binnacle works, run `binn audit`. It reads and writes nothing.');
  for (const harness of session.otherHarnesses) nextSteps(session, harness);
  return EXIT.ok;
}

/** The skill file an agent without Binnacle's plugin is told to read: the project's own plugin, or the one in this package. */
function productSkill(root: string): string {
  const own = join(root, '.claude', 'skills', 'binnacle', 'skills', 'product', 'SKILL.md');
  return existsSync(own) ? own : join(PACKAGE_DIR, 'plugin', 'skills', 'product', 'SKILL.md');
}

/** What to do next to work from a harness other than Claude Code, which has the plugin: no skill format of its own, so an agent is pointed at the file. */
function nextSteps(session: Session, harness: Harness): void {
  const steps = [
    harness.note,
    harness.open,
    harness.offPath && !onPath(harness.executable) ? harness.offPath : undefined,
    `Ask the agent: read the Binnacle product skill file at ${productSkill(session.root)} and follow it`,
  ].filter((step): step is string => step !== undefined);
  session.say(`\nTo work from ${harness.name}, once its configuration names binnacle:`);
  steps.forEach((step, index) => session.say(`  ${index + 1}. ${step}`));
}

/** Shows the plan whole and asks once. Without a terminal there is no one to confirm it, so nothing is written. */
async function confirmPlan(session: Session, terminal: boolean): Promise<void> {
  const { plan } = session;
  if (plan.length === 0) return session.say('There is nothing to write.');
  session.say('The plan. Nothing is written until you confirm it:\n');
  plan.forEach(({ heading, body }, index) => session.say(`${index + 1}. ${heading}:\n\n${body.trimEnd()}\n`));

  const declineAll = (why: string): void => {
    session.say(`${why} Nothing is written.`);
    for (const { declined } of plan) record(session, 'declined', declined);
  };
  if (!terminal) return declineAll('stdin is not a terminal, so there is no one to confirm the plan.');
  const reply = await session.answer('Write this plan? [Y/n] ');
  // Enter or yes accepts; anything else, and the end of input, declines.
  if (reply === null || !/^\s*(y(es)?)?\s*$/i.test(reply)) return declineAll('The plan was declined.');
  for (const item of plan) {
    // One write that fails is reported, and the rest of the plan still runs.
    try {
      await item.apply();
    } catch (error) {
      record(session, 'failed', `${item.declined}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Where `binn init` plans its writes into the repository, and the rules it writes by
 * (ADR-0026): a missing file is created; an existing file is only ever extended by a
 * pure append at its end; an existing JSON file is never rewritten, and the entry is
 * printed instead; nothing is overwritten. `text` is the whole new file, or the addition.
 * The write itself waits for the plan's confirmation.
 */
function planFile(session: Session, relative: string, text: string): void {
  const path = join(session.root, relative);
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : null;

  if (existing === null) {
    session.plan.push({
      heading: `Create ${relative}`,
      body: text,
      declined: `create ${relative}`,
      apply() {
        mkdirSync(dirname(path), { recursive: true });
        // `wx`: a file that appeared since it was read is still never overwritten.
        writeFileSync(path, text, { flag: 'wx' });
        record(session, 'created', relative);
      },
    });
    return;
  }

  if (/\.jsonc?$/.test(relative)) {
    session.say(`${relative} exists, and binn init never rewrites a JSON file. Add this yourself:\n\n${text}`);
    return record(session, 'printed', `the entry for ${relative}`);
  }

  const addition = existing === '' || existing.endsWith('\n') ? text : `\n${text}`;
  session.plan.push({
    heading: `Append to the end of ${relative}`,
    body: addition,
    declined: `append to ${relative}`,
    apply() {
      // Only the section the human saw: a file that changed since it was read is not extended.
      if (readFileSync(path, 'utf8') !== existing) throw new Error('the file changed since the plan was shown');
      appendFileSync(path, addition);
      record(session, 'extended', relative);
    },
  });
}

function record(session: Session, outcome: Outcome, what: string): void {
  session.outcomes.push({ outcome, what });
}

/** The manifest: there and valid, there with problems, or not there, so that the plan creates it. */
type ManifestState = 'new' | 'valid' | 'invalid';

/**
 * Step 1: an existing manifest is validated and left alone; without one, init proposes one
 * from facts, which the plan shows. Registration needs a usable manifest.
 */
function manifestStep(session: Session): ManifestState {
  try {
    const { warnings } = readManifest(session.root);
    session.say(`${MANIFEST_RELATIVE} exists and is valid. It is left as it is.`);
    for (const warning of warnings) session.say(`  ${warning.path}: ${warning.message}`);
    record(session, 'skipped', `${MANIFEST_RELATIVE}: it exists`);
    return 'valid';
  } catch (error) {
    if (!(error instanceof OperationError)) throw error;
    if (error.code === 'manifest.missing') {
      session.say(`There is no ${MANIFEST_RELATIVE}. A new one is proposed in the plan.`);
      return 'new';
    }
    session.say(`${MANIFEST_RELATIVE} exists and has problems. It is left as it is; fix it by hand.`);
    session.say(`  ${error.code}: ${error.message}`);
    for (const detail of error.details ?? []) session.say(`  ${detail.path}: ${detail.message}`);
    record(session, 'skipped', `${MANIFEST_RELATIVE}: it exists, with problems`);
    return 'invalid';
  }
}

/** Only what is there: a path that does not exist, or a tracker nobody has, is never declared. */
function proposeManifest(root: string, remotes: GitRemote[], capabilities: string[]): string {
  const sections = [`version: 1`, `project:\n  id: ${scalar(basename(root))}`];

  const forge = forgeRemote(remotes);
  if (forge) {
    const host = forge.host === `${forge.provider}.com` ? '' : `\n  host: ${scalar(forge.host)}`;
    sections.push(`tracker:\n  provider: ${forge.provider}\n  repository: ${scalar(forge.repository)}${host}`);
  } else {
    sections.push('tracker:\n  provider: local\n  local:\n    issues: docs/specs');
  }

  const knowledge = Object.entries({ context: 'CONTEXT.md', docs: 'docs', adr: 'docs/adr', specs: 'docs/specs' })
    .filter(([, path]) => existsSync(join(root, path)))
    .map(([key, path]) => `\n  ${key}: ${path}`);
  if (knowledge.length > 0) sections.push(`knowledge:${knowledge.join('')}`);

  if (mattPocockFiles(root).length > 0) sections.push('workflow:\n  provider: matt-pocock');

  if (capabilities.length > 0) sections.push(`capabilities:${capabilities.map((name) => `\n  ${name}: true`).join('')}`);

  return `${sections.join('\n\n')}\n`;
}

/** A YAML scalar: plain when that reads back as the same string, double-quoted (JSON is valid YAML) otherwise. */
const scalar = (value: string): string =>
  /^[A-Za-z_][\w./-]*$/.test(value) && !/^(true|false|null|yes|no|on|off|y|n)$/i.test(value) ? value : JSON.stringify(value);

/**
 * Step 2: how much session history the daemon imports, `telemetry.import.window_days`, asked
 * before the plan, after showing each harness's sessions in this repository. The answer is
 * returned as a section for a manifest the plan creates, so that the plan shows it; for an
 * existing one the line is printed, never written (ADR-0026). The end of input takes the
 * default and declares nothing.
 */
async function windowStep(session: Session, manifest: ManifestState): Promise<string | null> {
  const what = 'import window';
  session.say('Session history in this repository, which Binnacle imports for its usage figures:');
  for (const { name, sessions, oldest } of await sessionHistory(session.root)) {
    const shown = sessions === 0 ? 'no sessions' : `${sessions} session${sessions === 1 ? '' : 's'}, the oldest from ${localDate(oldest)}`;
    session.say(`  ${name}: ${shown}`);
  }

  const declared = manifest === 'valid' ? (declaredManifest(session.root)?.telemetry.import.windowDays ?? null) : null;
  if (declared !== null) {
    session.say(`${MANIFEST_RELATIVE} declares telemetry.import.window_days: ${declared}. It is left as it is.`);
    record(session, 'skipped', `${what}: ${MANIFEST_RELATIVE} declares ${declared}`);
    return null;
  }

  session.say(
    `How much of it should Binnacle import? ${DEFAULT_WINDOW_DAYS} days (the default), another number of days, or all. ` +
      (manifest === 'new'
        ? `The answer goes into the new ${MANIFEST_RELATIVE} in the plan, as telemetry.import.window_days.`
        : `${MANIFEST_RELATIVE} exists, so the line to add is printed and nothing is written.`),
  );
  let window: ImportWindow | null;
  do {
    const answer = await session.answer(`Import window [${DEFAULT_WINDOW_DAYS}]: `);
    if (answer === null) {
      session.say(`No answer: Binnacle imports the default of ${DEFAULT_WINDOW_DAYS} days, and the manifest declares none.`);
      record(session, 'skipped', `${what}: no answer, so the default of ${DEFAULT_WINDOW_DAYS} days applies`);
      return null;
    }
    window = importWindow(answer);
    if (window === null) session.say(`Answer ${DEFAULT_WINDOW_DAYS}, a number of days, or all.`);
  } while (window === null);

  const section = `telemetry:\n  import:\n    window_days: ${window}\n`;
  if (manifest === 'new') return section;
  session.say(`Add this to ${MANIFEST_RELATIVE} yourself:\n\n${section}`);
  record(session, 'printed', `the telemetry.import.window_days line for ${MANIFEST_RELATIVE}`);
  return null;
}

/** An answer to the window question: empty for the default, `all`, or a positive number of days; null for anything else. */
function importWindow(answer: string): ImportWindow | null {
  const text = answer.trim().toLowerCase();
  if (text === '') return DEFAULT_WINDOW_DAYS;
  if (text === 'all') return 'all';
  const days = Number(text);
  return /^\d+$/.test(text) && Number.isSafeInteger(days) && days > 0 ? days : null;
}

/** `YYYY-MM-DD` in local time. */
const localDate = (time: number): string => new Date(time).toLocaleDateString('en-CA');

/** Step 3: registration through `project.register`, a write outside the repository, so it is in the plan too. */
function registrationStep(session: Session, home: string, manifestUsable: boolean): void {
  const what = 'project registration';
  if (!manifestUsable) {
    session.say(`There is no usable ${MANIFEST_RELATIVE}, so the project is not registered. Once there is, run \`binn project register\` from ${session.root}.`);
    return record(session, 'skipped', `${what}: no usable manifest`);
  }

  const runtime = readRuntime(home);
  if (!runtime || !isAlive(runtime.pid)) {
    session.say(`The Binnacle daemon is not running, so the project is not registered. From ${session.root}, run:\n\n  binn daemon start\n  binn project register`);
    return record(session, 'skipped', `${what}: the daemon is not running`);
  }

  session.plan.push({
    heading: 'Register the project with the running Binnacle daemon, outside the repository',
    body: `  binn project register   (project.register, for ${session.root})`,
    declined: what,
    async apply() {
      const code = await register(home, session.root);
      record(session, code === EXIT.ok ? 'ran' : 'failed', 'project.register');
    },
  });
}

/**
 * A harness `binn init` registers the `binnacle` MCP server with: how it is detected, and the
 * project-scoped configuration that declares a stdio server running `binn mcp` (ADR-0014,
 * level 1). Supporting another harness is adding one of these.
 */
type Harness = {
  name: string;
  /** Detected by this executable on PATH… */
  executable: string;
  /** …or by this user configuration directory. */
  userDirectory: string;
  /** The project's configuration file: the first of these that exists, or else the first. */
  files: string[];
  /** The whole new file declaring the stdio server `name` running `command`, which is also the addition for a format that allows a pure append. */
  entry(name: string, command: string[]): string;
  /**
   * The harness's own CLI call that registers the stdio server `name` outside the repository,
   * at user scope or for this project only, as the harness's docs give it (read through
   * Context7 on 2026-10-02), run in the project root; null where it has no such scope.
   * Absent where it has no CLI for adding a server.
   */
  add?(name: string, command: string[], scope: 'user' | 'project'): string[] | null;
  /** Said before the entry is offered. */
  note?: string;
  /** How to start the harness in the project, for the Summary's next step. */
  open?: string;
  /** Said in the next step when `executable` is not on PATH. */
  offPath?: string;
};

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** A stdio server running `command`, as Claude Code's and VS Code's files declare it. */
const stdio = ([command, ...args]: string[]) => ({ type: 'stdio', command, args });

/** The server every template declares: stdio, named `binnacle`, running `binn mcp`. */
const BINNACLE = ['binn', 'mcp'];

/** Where opencode keeps its user configuration. */
const CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');

const HARNESSES: Harness[] = [
  {
    name: 'Claude Code',
    executable: 'claude',
    userDirectory: join(homedir(), '.claude'),
    files: ['.mcp.json'],
    entry: (name, command) => json({ mcpServers: { [name]: stdio(command) } }),
    add: (name, command, scope) => ['claude', 'mcp', 'add', '--scope', scope === 'user' ? 'user' : 'local', name, '--', ...command],
  },
  {
    name: 'Codex',
    executable: 'codex',
    userDirectory: join(homedir(), '.codex'),
    files: ['.codex/config.toml'],
    // JSON strings and arrays of them are TOML too.
    entry: (name, [command, ...args]) => `[mcp_servers.${name}]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\n`,
    // Its only scope outside the repository is the user's config.toml.
    add: (name, command, scope) => (scope === 'user' ? ['codex', 'mcp', 'add', name, '--', ...command] : null),
    note: 'Codex reads .codex/config.toml only in a trusted project: trust this project in Codex for the entry to take effect.',
    open: 'Run `codex` in the repository root, or open the repository in the Codex desktop app.',
    offPath: '`codex` is not on PATH. The Codex desktop app ships its CLI outside it; on Linux it is /usr/lib/chatgpt/resources/codex.',
  },
  {
    name: 'opencode',
    executable: 'opencode',
    userDirectory: join(CONFIG_HOME, 'opencode'),
    files: ['opencode.json', 'opencode.jsonc'],
    entry: (name, command) => json({ $schema: 'https://opencode.ai/config.json', mcp: { [name]: { type: 'local', command } } }),
    // No `add`: its documented `opencode mcp add` is an interactive wizard.
    open: 'Run `opencode` in the repository root.',
  },
  {
    name: 'VS Code',
    executable: 'code',
    userDirectory: VSCODE_USER_DIRECTORY,
    files: ['.vscode/mcp.json'],
    entry: (name, command) => json({ servers: { [name]: stdio(command) } }),
    // `--add-mcp` adds to the user profile; its only per-project place is .vscode/mcp.json, in the repository.
    add: (name, [command, ...args], scope) => (scope === 'user' ? ['code', '--add-mcp', JSON.stringify({ name, command, args })] : null),
    open: 'Open the repository in VS Code, start the binnacle server listed in .vscode/mcp.json and chat in agent mode.',
  },
];

/** Step 4: the MCP registration for each detected harness, then a generic snippet for any other. Returns the detected harnesses. */
function harnessStep(session: Session): Harness[] {
  const found = HARNESSES.map((harness) => ({ harness, reason: detect(harness) })).filter(({ reason }) => reason !== null);
  if (found.length === 0) session.say(`No known harness is installed (${HARNESSES.map(({ name }) => name).join(', ')}).\n`);

  for (const { harness, reason } of found) {
    const file = harness.files.find((candidate) => existsSync(join(session.root, candidate))) ?? harness.files[0]!;
    if (harness.executable !== 'claude') session.otherHarnesses.push(harness);
    session.say(`${harness.name} is installed (${reason}). It reads this project's MCP servers from ${file}.`);
    const path = join(session.root, file);
    if (existsSync(path) && namesBinnacle(readFileSync(path, 'utf8'))) {
      session.say(`${file} already names binnacle. It is left as it is.`);
      record(session, 'skipped', `${file}: it already names binnacle`);
    } else {
      if (harness.note) session.say(harness.note);
      planFile(session, file, harness.entry('binnacle', BINNACLE));
    }
    session.say('');
  }

  session.say(
    `For any other harness that speaks MCP, register a stdio server named binnacle that runs \`binn mcp\`, for example:\n\n${json({ mcpServers: { binnacle: stdio(BINNACLE) } }).trimEnd()}`,
  );
  return found.map(({ harness }) => harness);
}

function detect(harness: Harness): string | null {
  if (onPath(harness.executable)) return `${harness.executable} is on PATH`;
  if (existsSync(harness.userDirectory)) return `${harness.userDirectory} exists`;
  return null;
}

/**
 * ponytail: a textual check, not a parse. A `"binnacle":` key anywhere in a JSON file counts as
 * naming it, and so does, in a TOML file, a `[mcp_servers.binnacle]` table or a `binnacle` or
 * `mcp_servers.binnacle` key at the start of a line. Anything it misses would make the append
 * a duplicate key, so it errs towards a skip: a `binnacle` key under another table is taken
 * for the server too, and nothing is written. A parser per format would tell them apart.
 */
const namesBinnacle = (text: string): boolean =>
  /"binnacle"\s*:|^\s*\[\s*mcp_servers\s*\.\s*["']?binnacle["']?\s*[\].]|^\s*(mcp_servers\s*\.\s*)?["']?binnacle["']?\s*[=.]/m.test(text);

/** This package's directory, which carries the plugin and the marketplace that lists it (ADR-0027). */
const PACKAGE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Step 5: the `binnacle` plugin from this very package, so that the skills match the `binn`
 * that serves their tools (ADR-0027). Only through Claude Code's own CLI, at user scope:
 * binn init never edits Claude Code's settings files.
 */
function pluginStep(session: Session): void {
  const what = 'the binnacle plugin';
  // A skills-directory plugin loads as `<directory>@skills-dir` (ADR-0023): a user-scope copy would show every skill twice.
  const own = join('.claude', 'skills', 'binnacle');
  if (existsSync(join(session.root, own, '.claude-plugin', 'plugin.json'))) {
    session.say(`The project provides its own binnacle plugin, at ${own}, so no copy is installed.`);
    return record(session, 'skipped', `${what}: the project provides its own, at ${own}`);
  }

  if (!detect(HARNESSES.find(({ executable }) => executable === 'claude')!)) {
    session.say('Claude Code is not detected, so the binnacle plugin is not installed.');
    return record(session, 'skipped', `${what}: Claude Code is not detected`);
  }
  const shown = (args: string[]): string => `claude ${args.join(' ')}`;
  const listing = ['plugin', 'list', '--json'];
  session.say(`Asking Claude Code for its plugins (${shown(listing)})...`);
  const list = spawnSync('claude', listing, { cwd: session.root, encoding: 'utf8' });
  // Detected by its user directory alone, Claude Code may have no `claude` to run.
  if ((list.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
    session.say('Claude Code is detected, but `claude` is not on PATH, so the binnacle plugin is not installed.');
    return record(session, 'skipped', `${what}: \`claude\` is not on PATH`);
  }
  const ids = list.status === 0 ? pluginIds(list.stdout) : null;
  if (!ids) {
    session.say(`\`${shown(listing)}\` failed, so the binnacle plugin is not installed.${list.stderr ? `\n${list.stderr.trim()}` : ''}`);
    return record(session, 'failed', shown(listing));
  }
  const listed = ids.find((id) => id.startsWith('binnacle@'));
  if (listed) {
    session.say(`Claude Code already lists ${listed}. It is left as it is.`);
    return record(session, 'skipped', `${what}: Claude Code already lists ${listed}`);
  }

  const commands = [
    ['plugin', 'marketplace', 'add', PACKAGE_DIR, '--scope', 'user'],
    ['plugin', 'install', 'binnacle@binnacle', '--scope', 'user'],
  ];
  session.plan.push({
    heading: 'Install the binnacle plugin from this Binnacle package, at user scope, outside the repository, by running',
    body: commands.map((args) => `  ${shown(args)}`).join('\n'),
    declined: what,
    apply() {
      for (const args of commands) {
        session.say(`Running ${shown(args)}...`);
        // stdin stays with binn init's own questions; Claude Code's output is shown as it comes.
        const run = spawnSync('claude', args, { cwd: session.root, stdio: ['ignore', 'inherit', 'inherit'] });
        if (run.status !== 0) return record(session, 'failed', shown(args));
        record(session, 'ran', shown(args));
      }
    },
  });
}

/** The plugin ids in `claude plugin list --json` output, or null when it is not that. */
function pluginIds(output: string): string[] | null {
  try {
    const plugins: unknown = JSON.parse(output);
    return Array.isArray(plugins) ? plugins.map((plugin) => String((plugin as { id?: unknown }).id)) : null;
  } catch {
    return null;
  }
}

/** The readable manifest, or null when there is none. */
function declaredManifest(root: string): ProjectManifest | null {
  try {
    return readManifest(root).manifest;
  } catch (error) {
    if (error instanceof OperationError) return null;
    throw error;
  }
}

/**
 * Step 6: `/to-tickets` learns the ticket header (ADR-0024) from the issue tracker file, so the
 * section is offered as an append to it. `provider` is the tracker the manifest declares, or
 * the one it would propose.
 */
function mattPocockStep(session: Session, provider: TrackerProvider): void {
  const what = 'ticket-header section';
  const found = mattPocockFiles(session.root);
  if (found.length === 0) {
    session.say(
      `There is no Matt Pocock layout here: no ${ISSUE_TRACKER}, nor its sibling convention files. ` +
        'Run /setup-matt-pocock-skills in your agent harness to set it up; binn init runs nothing for you.',
    );
    return record(session, 'skipped', `${what}: no Matt Pocock layout; /setup-matt-pocock-skills sets it up`);
  }
  session.say(`Matt Pocock layout: ${found.join(', ')}.`);
  if (!found.includes(ISSUE_TRACKER)) {
    session.say(`${ISSUE_TRACKER} is missing, so there is nothing to extend. /setup-matt-pocock-skills writes it.`);
    return record(session, 'skipped', `${what}: no ${ISSUE_TRACKER}`);
  }
  if (hasTicketHeaderSection(session.root)) {
    session.say(`${ISSUE_TRACKER} already has its ticket-header section.`);
    return record(session, 'skipped', `${what}: ${ISSUE_TRACKER} has it`);
  }
  planFile(session, ISSUE_TRACKER, ticketHeaderSection(provider));
}

const ISSUE_NUMBERS = 'the issue numbers of the issues it waits for, such as `#12, #15`';
const PATH_OR_LINK = 'its path, such as `docs/specs/<slug>/spec.md`, or a link to that file pinned to a commit';
const KEEP_CURRENT = 'Binnacle reports any disagreement between the two, so keep the line current when you close the issue.';

/**
 * What the section says differently on each tracker (ADR-0024). `rule` follows the fields: on
 * the local tracker, the unique slug a ticket's branch needs; on a remote one, the spec's closed-issue states.
 */
const CONVENTIONS: Record<TrackerProvider, { ticket: string; blockedBy: string; example: string; spec: string; rule: string }> = {
  local: {
    ticket: 'ticket',
    blockedBy: 'the numbers of the tickets in the same spec it waits for, such as `01, 03`',
    example: '01, 03',
    spec: 'its path, such as `docs/specs/<slug>/spec.md`',
    rule:
      "A ticket's slug, its file name without the number, is unique across every spec's tickets: it names the ticket's branch, `feat/<slug>`, " +
      'and Binnacle credits the work on a branch two tickets share to neither.',
  },
  github: {
    ticket: 'issue body',
    blockedBy: ISSUE_NUMBERS,
    example: '#12, #15',
    spec: PATH_OR_LINK,
    rule:
      'Closing an issue outranks its `Status:` line: an issue closed as completed is done, and one closed as not planned or as a duplicate is cancelled, whatever the line says. ' +
      `An issue closed with no reason is cancelled when its \`Status:\` says \`CANCELLED\`, and done otherwise. ${KEEP_CURRENT}`,
  },
  gitlab: {
    ticket: 'issue body',
    blockedBy: ISSUE_NUMBERS,
    example: '#12, #15',
    spec: PATH_OR_LINK,
    rule:
      'Closing an issue outranks its `Status:` line, and GitLab reports no reason for closing: a closed issue is done, unless its `Status:` says `CANCELLED`. ' +
      `Set \`Status: CANCELLED\` before closing work that was abandoned. ${KEEP_CURRENT}`,
  },
};

/** The convention `/to-tickets` writes by, for the tracker in use. It leads with a blank line, after the file's last section. */
function ticketHeaderSection(provider: TrackerProvider): string {
  const { ticket, blockedBy, example, spec, rule } = CONVENTIONS[provider];
  const states = TASK_STATES.map((state) => `\`${state}\``).join(', ');
  return `
## Ticket header

Binnacle reads a ticket's state, dependencies and spec from its header: these lines, one per line, at the top of every ${ticket}, before anything else. Write them in every ticket, and keep \`Status:\` current.

- \`Status:\` — the ticket's state, one of ${states}.
- \`Blocked by:\` — ${blockedBy}, or \`None\`.
- \`Spec:\` — the spec it implements, as ${spec}.

${rule}

For example:

\`\`\`text
Status: READY
Blocked by: ${example}
Spec: \`docs/specs/<slug>/spec.md\`
\`\`\`
`;
}

/** Step 7: the agent instruction files, reported as the sets an agent reads. Nothing is written to either. */
function instructionsStep(session: Session): void {
  const files = instructionFiles(session.root);
  const sets = instructionSets(files);
  if (sets.length === 0) return session.say('There is no AGENTS.md or CLAUDE.md, so there are no agent instructions to report.');
  const count = sets.length === 1 ? 'one instruction set' : 'two instruction sets';
  session.say(`Agent instructions: ${count}: ${describeSets(sets)}. binn init writes nothing to them.`);
}

/**
 * Step 10: one read of a remote tracker through its adapter, with the credentials lookup the
 * daemon uses. On a failure it says how to make a read-only token and where to put it; it
 * never asks for, stores or prints one. `manifest` is the readable manifest, if any.
 */
async function trackerStep(session: Session, home: string, manifest: ProjectManifest | null): Promise<void> {
  if (!manifest) return session.say('There is no usable manifest, so no tracker is checked.');
  const { provider, repository, host } = manifest.tracker;
  if (provider !== 'github' && provider !== 'gitlab') return session.say('The tracker is not a remote one, so there is nothing to check.');
  const name = repository ?? `the ${provider} tracker`;
  const variable = `BINNACLE_${provider.toUpperCase()}_TOKEN`;
  // The check reads binn init's own environment; the daemon reads the one it was started with.
  const fromShell = process.env[variable]?.trim()
    ? `\nThis check used ${variable} from this shell. The daemon reads it only from the environment it starts with, so start it from a shell that has it, or use the credentials file.`
    : '';

  // A remote tracker is read from its host, never from the tree.
  session.say(`Reading ${name}...`);
  const reading = await readTracker(home, workingTree(session.root), manifest);
  if (reading.tasks !== null) {
    session.say(`${name} is readable: ${reading.tasks.length} issues read.${fromShell}`);
    return record(session, 'checked', 'tracker: readable');
  }
  const failure = reading.diagnostics[0]!;
  record(session, 'failed', `tracker check: ${failure.code}`);
  session.say(`${name} could not be read. ${failure.code}: ${failure.message}`);
  // Without a repository the fix is in the manifest, not a token.
  if (repository === null) return;

  const how =
    provider === 'github'
      ? `On GitHub, create a fine-grained personal access token with read-only access to the issues of ${repository} ` +
        '(Settings, Developer settings, Personal access tokens, Fine-grained tokens; Repository permissions, Issues: Read-only).'
      : "On GitLab, create a personal, group or project access token with the read_api scope and nothing else (User settings, or the project's Settings, then Access tokens).";
  session.say(
    `\n${how} A public repository needs none.\n` +
      `Put it in ${variable} in the environment the daemon starts with, or in ${credentialsPath(home)} ` +
      `under the key ${JSON.stringify(credentialsKey(provider, host))}, owner-only (chmod 600). ` +
      `Generic variables such as ${provider.toUpperCase()}_TOKEN are not read: they commonly hold tokens that can write. ` +
      `Binnacle's docs/operations/05-installation-checklist.md, under Tracker credentials, has the details.${fromShell}`,
  );
}

/**
 * A tool of the Standard setup, and what init found about it on this machine: declared false in
 * the manifest, found on PATH by its own executable, waiting on its prerequisite, to install, or
 * with nothing to install, only a server to register.
 */
type ToolState = { tool: Tool; state: 'declared-false' | 'found' | 'no-prerequisite' | 'install' | 'server-only' };

/** ponytail: PATH only, so a tool installed off PATH is proposed again; a per-tool probe if that bites. */
function detectTools(root: string): ToolState[] {
  const declared = declaredCapabilities(root);
  return TOOLS.map((tool) => ({
    tool,
    state:
      declared[tool.name] === false
        ? 'declared-false'
        : tool.executable && onPath(tool.executable)
          ? 'found'
          : tool.prerequisite && !onPath(tool.prerequisite.executable)
            ? 'no-prerequisite'
            : tool.install
              ? 'install'
              : 'server-only',
  }));
}

/**
 * Step 8: the tools of the Standard setup that are executables (ADR-0035), installed through a
 * package manager outside the repository. A prerequisite is named, never installed, and no
 * installer script is ever run; a tool that needs it is left out, its server included. One
 * install that fails leaves the others to run.
 */
function toolsStep(session: Session, tools: ToolState[]): void {
  const named = new Set<string>();
  for (const { tool, state } of tools) {
    const { title, name, executable, install, prerequisite } = tool;
    if (state === 'declared-false') {
      session.say(`${MANIFEST_RELATIVE} declares ${name}: false, so ${title} is not proposed.`);
      record(session, 'skipped', `${title}: ${MANIFEST_RELATIVE} declares it false`);
    } else if (state === 'found') {
      session.say(`${title} is installed (${executable} is on PATH). It is left as it is.`);
      record(session, 'found', `${title}: ${executable} is on PATH`);
    } else if (state === 'no-prerequisite') {
      const { executable: needed, how } = prerequisite!;
      if (!named.has(needed)) session.say(`${needed} is not on PATH, and binn init does not install it. Install it with ${how}, then run binn init again.`);
      named.add(needed);
      session.say(`${title} needs ${needed}, so it is not proposed.`);
      record(session, 'skipped', `${title}: ${needed} is not on PATH`);
    } else if (state === 'install') {
      const shown = install!.join(' ');
      session.say(`${title} is not installed (no ${executable} on PATH). Its install is in the plan.`);
      session.plan.push({
        heading: `Install ${title}, outside the repository, by running`,
        body: `  ${shown}`,
        declined: `install ${title}`,
        apply() {
          session.say(`Running ${shown}...`);
          // stdin stays with binn init's own questions; the installer's output is shown as it comes.
          // Through the shell, so that Windows runs `npm.cmd`; the command is the table's own, never input.
          const run = spawnSync(shown, { cwd: session.root, shell: true, stdio: ['ignore', 'inherit', 'inherit'] });
          record(session, run.status === 0 ? 'ran' : 'failed', shown);
        },
      });
    }
  }
}

/** An argument as a POSIX shell reads it back: bare when safe, single-quoted otherwise. Only for showing a command. */
const quoted = (arg: string): string => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`);

/**
 * Step 9: each tool's MCP server registered with every detected harness, through the
 * harness's own CLI, outside the repository: at user scope, or for a server that serves this
 * project only, at the harness's per-project scope outside the repository (Claude Code's local
 * scope). Where the harness has no such CLI or scope, or its CLI is not on PATH, the entry is
 * printed. A server already registered with the harness, in any scope the audit reads, is
 * left as it is. Nothing is written into the repository.
 */
function serversStep(session: Session, tools: ToolState[], harnesses: Harness[]): void {
  const served = tools.filter(({ tool, state }) => tool.server && state !== 'declared-false' && state !== 'no-prerequisite').map(({ tool }) => tool);
  if (served.length === 0) return;
  for (const harness of harnesses) {
    const commands: string[][] = [];
    for (const { name, title, server } of served) {
      const what = `${title}'s MCP server`;
      const registered = registeredWith(harness.executable, session.root, name);
      if (registered) {
        session.say(`${what} is already registered with ${harness.name}, in ${registered}. It is left as it is.`);
        record(session, 'found', `${what}: registered with ${harness.name} in ${registered}`);
        continue;
      }
      const command = server!.command(harness.executable, session.root);
      const scope = server!.project ? 'project' : 'user';
      const add = harness.add?.(name, command, scope);
      if (add && onPath(harness.executable)) {
        commands.push(add);
        continue;
      }
      const why = !harness.add
        ? `${harness.name} has no command for adding an MCP server`
        : !add
          ? `${title} serves this project only, and ${harness.name} keeps no per-project servers outside the repository`
          : `\`${harness.executable}\` is not on PATH`;
      const where = scope === 'project' ? `this project's ${harness.name} configuration` : `${harness.name}'s user configuration`;
      session.say(`${why}, so binn init does not register ${what} with it. Add this to ${where} yourself:\n\n${harness.entry(name, command).trimEnd()}\n`);
      record(session, 'printed', `${what} for ${harness.name}`);
    }
    if (commands.length === 0) continue;
    const shown = commands.map((argv) => argv.map(quoted).join(' '));
    session.plan.push({
      heading: `Register MCP servers with ${harness.name}, outside the repository, by running`,
      body: shown.map((line) => `  ${line}`).join('\n'),
      declined: `register MCP servers with ${harness.name}`,
      apply() {
        commands.forEach(([executable, ...args], index) => {
          session.say(`Running ${shown[index]}...`);
          // ponytail: no shell, so the JSON and paths pass as they are; Windows' `code.cmd` would need one, as for `claude` in the plugin step.
          const run = spawnSync(executable!, args, { cwd: session.root, stdio: ['ignore', 'inherit', 'inherit'] });
          record(session, run.status === 0 ? 'ran' : 'failed', shown[index]!);
        });
      },
    });
  }
}
