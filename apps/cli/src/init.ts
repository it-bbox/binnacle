import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, posix, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { isIgnored, readGitFacts, workingTree, type GitRemote } from '@binnacle/adapters';
import { forgeRemote, instructionSets, ROLES, TASK_STATES, type ImportWindow, type ProjectManifest, type TrackerProvider } from '@binnacle/core';
import {
  credentialsKey,
  credentialsPath,
  DEFAULT_WINDOW_DAYS,
  ensureHome,
  GRAPH_CLUSTER,
  GRAPH_DIRECTORY,
  GRAPH_EXTRACT,
  GRAPH_FILE,
  GRAPH_RUN_TIMEOUT_MS,
  isAlive,
  MANIFEST_RELATIVE,
  OperationError,
  OWNER_ONLY_FILE,
  readManifest,
  readTracker,
  readRuntime,
  resolveGitTimeout,
  settingsPath,
} from '@binnacle/daemon';
import { EXIT, type ExitCode } from './exit.ts';
import { daemonAddress, detected, exporters, NO_EXPORT, settingsText } from './export.ts';
import { isRecord, sessionHistory } from './history.ts';
import { describeSets, hasTicketHeaderSection, instructionFiles, ISSUE_TRACKER, mattPocockFiles, ROADMAP_SKELETON, roadmapGaps } from './layout.ts';
import { register } from './project-commands.ts';
import { binnacleSkills, CONFIG_HOME, declaredCapabilities, INSTALLED_SKILLS, mcpSources, onPath, PACKAGE_DIR, registeredWith, SKILLS_COPY, tilde, TOOLS, VSCODE_USER_DIRECTORY, type Tool } from './tools.ts';

type Outcome = 'created' | 'extended' | 'updated' | 'printed' | 'ran' | 'found' | 'checked' | 'failed' | 'declined' | 'skipped';

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
  /** Once `skills add` ran: the harnesses it said it installed Binnacle's skills into, Claude Code apart, and the `--skip-harness` ids the removal named. */
  skills: { into: string[]; skipped: string[] } | null;
  /** Only the plan is worked out, for `--plan --json`: nothing is asked, and what is said is kept as notes. */
  planOnly: boolean;
  /** Each harness's sessions in this repository, and the local date of the oldest. */
  history: { harness: string; sessions: number; oldest: string | null }[];
  /** The import window the plan uses, whether the manifest already declares it, and whether it is the default. */
  window: { days: ImportWindow; declared: boolean; default: boolean };
};

/**
 * `binn init [path]`: the one command that writes into a project's repository (ADR-0026).
 * It works out every write first, asking only the questions that are not about a write, shows
 * them together as one plan and asks once (ADR-0034): Enter or `y` accepts it at a terminal,
 * anything else declines it, and with stdin not a terminal nothing is written. It never commits.
 * `window` answers the window question unasked. With `plan`, the plan is printed as JSON with
 * its id (ADR-0037), and nothing is asked, written or run after it, the tracker check included.
 * With `apply`, the plan is worked out again and written unasked only if its id is `apply`: the
 * human confirmed that plan in the chat (ADR-0037). Any other plan is refused, and nothing is written.
 */
export async function init(
  home: string,
  path?: string,
  options: { plan?: boolean; apply?: string | undefined; window?: ImportWindow | undefined; skipHarness?: string[] } = {},
): Promise<ExitCode> {
  const git = await readGitFacts(resolve(path ?? process.cwd()), resolveGitTimeout());
  if (!git.available) {
    console.error(`binn: ${git.reason} binn init works at the root of a Git repository.`);
    return EXIT.failed;
  }

  const planOnly = options.plan === true;
  const { apply } = options;
  // Only the interactive form asks: the window, then the plan.
  const asks = !planOnly && apply === undefined;
  // Opened at the first question only: a run that asks nothing never reads stdin, nor holds it open.
  let lines: ReturnType<typeof createInterface> | undefined;
  let answers: AsyncIterator<string> | undefined;
  const answer = async (prompt: string): Promise<string | null> => {
    lines ??= createInterface({ input: process.stdin });
    answers ??= lines[Symbol.asyncIterator]();
    process.stdout.write(prompt);
    const next = await answers.next();
    if (next.done) process.stdout.write('\n');
    return next.done ? null : next.value;
  };
  const notes: string[] = [];
  const session: Session = {
    root: git.root,
    answer,
    // A note keeps its first line's indentation, as in a printed entry; only blank lines around it go.
    say: planOnly ? (text) => void (text.trim() && notes.push(text.replace(/^\s*\n|\s+$/g, ''))) : (text) => console.log(text),
    plan: [],
    outcomes: [],
    otherHarnesses: [],
    skills: null,
    planOnly,
    history: [],
    window: { days: DEFAULT_WINDOW_DAYS, declared: false, default: true },
  };

  try {
    if (asks) session.say(`Setting up Binnacle in ${session.root}. Nothing is written until you have seen the whole plan and confirmed it.\n`);
    const manifest = manifestStep(session);
    session.say('');
    // `--plan` and `--apply` ask nothing: without --window, the default, as Enter at the question gives it.
    const windowSection = await windowStep(session, manifest, options.window ?? (asks ? undefined : DEFAULT_WINDOW_DAYS));
    // Read before the manifest is proposed, which declares what is found or installed; planned after the other writes.
    const plugins = listClaudePlugins(session);
    const tools = detectTools(session.root, plugins);
    const toDeclare = tools.filter(({ state }) => state === 'found' || state === 'install').map(({ tool }) => tool.name);
    if (manifest === 'new') planFile(session, MANIFEST_RELATIVE, proposeManifest(session.root, git.remotes, toDeclare) + (windowSection ? `\n${windowSection}` : ''));
    session.say('');
    registrationStep(session, home, manifest !== 'invalid');
    session.say('');
    const harnesses = harnessStep(session);
    session.say('');
    pluginStep(session, plugins);
    session.say('');
    skillsStep(session, harnesses, tools, options.skipHarness ?? []);
    session.say('');
    // The manifest as it is now, or the tracker it would propose: the plan is not yet written.
    mattPocockStep(session, declaredManifest(session.root)?.tracker.provider ?? forgeRemote(git.remotes)?.provider ?? 'local');
    session.say('');
    if (manifest !== 'invalid') {
      layoutStep(session, manifest === 'new' ? { ...NEW_LAYOUT, issues: forgeRemote(git.remotes) ? null : NEW_LAYOUT.issues } : declaredLayout(declaredManifest(session.root)!));
      session.say('');
    }
    instructionsStep(session);
    session.say('');
    toolsStep(session, tools);
    session.say('');
    serversStep(session, tools, harnesses);
    session.say('');
    telemetryStep(session, home);
    session.say('');
    const builds = await graphIgnoreStep(session, tools);
    session.say('');
    vaultStep(session, home);
    session.say('');
    if (builds) {
      graphBuildStep(session);
      session.say('');
    }
    if (planOnly) {
      const { root, history, window } = session;
      const plan = session.plan.map(({ heading, body }) => ({ heading, body }));
      console.log(JSON.stringify({ root, id: planId(root, plan), plan, notes, history, window }, null, 2));
      return EXIT.ok;
    }
    // The same plan shown has the same id; a change to a file that leaves every item as shown is left to ADR-0026's guards.
    if (apply !== undefined && apply !== planId(session.root, session.plan)) {
      console.error('binn: init.plan_changed: the plan is not the one confirmed, so nothing is written. Run binn init --plan --json to see it, and confirm it again.');
      return EXIT.failed;
    }
    if (session.plan.length === 0) session.say('There is nothing to write.');
    else if (apply === undefined) await confirmPlan(session, process.stdin.isTTY === true);
    else await applyPlan(session);
    session.say('');
    // After the plan is written: the manifest it created is the one whose tracker is read.
    await trackerStep(session, home, declaredManifest(session.root));
    session.say('');
  } finally {
    // Closed, not only its iterator ended: a terminal's stdin would otherwise keep init running after its summary.
    lines?.close();
  }

  session.say('Summary:');
  for (const { outcome, what } of session.outcomes) session.say(`  ${outcome.padEnd(8)}  ${what}`);
  session.say('Nothing was committed. Review what binn init wrote, and commit it yourself.');
  session.say('To see how far this repository is from the way Binnacle works, run `binn audit`. It reads and writes nothing.');
  if (session.skills && session.skills.into.length > 0) {
    // The removal names skills CLI ids, the add's output display names: the skipped are named apart rather than matched.
    const skipped = session.skills.skipped.length > 0 ? `, then removed from ${inSentence(session.skills.skipped)}` : '';
    session.say(`Binnacle's skills are installed into ${inSentence(session.skills.into)}${skipped}: run \`binnacle-product\` there.`);
  }
  for (const harness of session.otherHarnesses) nextSteps(session, harness);
  return EXIT.ok;
}

/** A plan's id (ADR-0037): a hash of the repository root and every item's heading and body, in order, so that no state is kept between showing a plan and confirming it. */
const planId =(root: string, plan: { heading: string; body: string }[]): string =>
  createHash('sha256')
    .update(JSON.stringify([root, ...plan.map(({ heading, body }) => [heading, body])]))
    .digest('hex');

/** What to do next to work from a harness other than Claude Code, which has the plugin: the skills step gave it `binnacle-<action>` skills. */
function nextSteps(session: Session, harness: Harness): void {
  const steps = [
    harness.note,
    harness.open,
    harness.offPath && !onPath(harness.executable) ? harness.offPath : undefined,
    session.skills
      ? `Run \`binnacle-product\` in ${harness.name}.`
      : `Once binn init has installed Binnacle's skills, run \`binnacle-product\` in ${harness.name}.`,
  ].filter((step): step is string => step !== undefined);
  session.say(`\nTo work from ${harness.name}, once its configuration names binnacle:`);
  steps.forEach((step, index) => session.say(`  ${index + 1}. ${step}`));
}

/** Shows the plan whole and asks once. Without a terminal there is no one to confirm it, so nothing is written. */
async function confirmPlan(session: Session, terminal: boolean): Promise<void> {
  const { plan } = session;
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
  await applyPlan(session);
}

/** Runs every item of a confirmed plan. */
async function applyPlan(session: Session): Promise<void> {
  for (const item of session.plan) {
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
    sections.push(`tracker:\n  provider: local\n  local:\n    issues: ${NEW_LAYOUT.issues}`);
  }

  // docs/, and docs/specs/ on the local tracker, are also declared when missing: the plan creates them (layoutStep).
  const knowledge = Object.entries({ context: 'CONTEXT.md', docs: NEW_LAYOUT.docs, adr: 'docs/adr', specs: NEW_LAYOUT.issues })
    .filter(([key, path]) => existsSync(join(root, path)) || key === 'docs' || (key === 'specs' && !forge))
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
 * default and declares nothing. A `given` window is taken as the answer, and nothing is asked.
 */
async function windowStep(session: Session, manifest: ManifestState, given: ImportWindow | undefined): Promise<string | null> {
  const what = 'import window';
  const history = await sessionHistory(session.root);
  session.history = history.map(({ name, sessions, oldest }) => ({ harness: name, sessions, oldest: sessions === 0 ? null : localDate(oldest) }));
  // `--plan --json` carries the history as its own field, not as notes.
  if (!session.planOnly) {
    session.say('Session history in this repository, which Binnacle imports for its usage figures:');
    for (const { harness, sessions, oldest } of session.history) {
      session.say(`  ${harness}: ${sessions === 0 ? 'no sessions' : `${sessions} session${sessions === 1 ? '' : 's'}, the oldest from ${oldest}`}`);
    }
  }

  const declared = manifest === 'valid' ? (declaredManifest(session.root)?.telemetry.import.windowDays ?? null) : null;
  if (declared !== null) {
    session.window = { days: declared, declared: true, default: declared === DEFAULT_WINDOW_DAYS };
    session.say(`${MANIFEST_RELATIVE} declares telemetry.import.window_days: ${declared}. It is left as it is.`);
    record(session, 'skipped', `${what}: ${MANIFEST_RELATIVE} declares ${declared}`);
    return null;
  }

  let window = given ?? null;
  if (window === null) {
    session.say(
      `How much of it should Binnacle import? ${DEFAULT_WINDOW_DAYS} days (the default), another number of days, or all. ` +
        (manifest === 'new'
          ? `The answer goes into the new ${MANIFEST_RELATIVE} in the plan, as telemetry.import.window_days.`
          : `${MANIFEST_RELATIVE} exists, so the line to add is printed and nothing is written.`),
    );
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
  }
  session.window = { days: window, declared: false, default: window === DEFAULT_WINDOW_DAYS };

  const section = `telemetry:\n  import:\n    window_days: ${window}\n`;
  if (manifest === 'new') return section;
  session.say(`Add this to ${MANIFEST_RELATIVE} yourself:\n\n${section}`);
  record(session, 'printed', `the telemetry.import.window_days line for ${MANIFEST_RELATIVE}`);
  return null;
}

/** An answer to the window question: empty for the default, `all`, or a positive number of days; null for anything else. */
export function importWindow(answer: string): ImportWindow | null {
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

const HARNESSES: Harness[] = [
  {
    name: 'Claude Code',
    executable: 'claude',
    userDirectory: join(homedir(), '.claude'),
    files: ['.mcp.json'],
    entry: (name, command) => json({ mcpServers: { [name]: stdio(command) } }),
    add: (name, command, scope) => ['claude', 'mcp', 'add', '--scope', scope === 'user' ? 'user' : 'local', name, '--', ...command],
    note: "Claude Code reads .mcp.json only when a session starts: once it is written, open a new session in the repository and approve the project's binnacle server when Claude Code offers it.",
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
  const found = HARNESSES.map((harness) => ({ harness, reason: detected(harness) })).filter(({ reason }) => reason !== null);
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

/**
 * ponytail: a textual check, not a parse. A `"binnacle":` key anywhere in a JSON file counts as
 * naming it, and so does, in a TOML file, a `[mcp_servers.binnacle]` table or a `binnacle` or
 * `mcp_servers.binnacle` key at the start of a line. Anything it misses would make the append
 * a duplicate key, so it errs towards a skip: a `binnacle` key under another table is taken
 * for the server too, and nothing is written. A parser per format would tell them apart.
 */
const namesBinnacle = (text: string): boolean =>
  /"binnacle"\s*:|^\s*\[\s*mcp_servers\s*\.\s*["']?binnacle["']?\s*[\].]|^\s*(mcp_servers\s*\.\s*)?["']?binnacle["']?\s*[=.]/m.test(text);

/**
 * Step 5: the `binnacle` plugin from this very package, so that the skills match the `binn`
 * that serves their tools (ADR-0027). Only through Claude Code's own CLI, at user scope:
 * the plugins are never written into Claude Code's settings files by hand.
 */
function pluginStep(session: Session, plugins: ClaudePlugins): void {
  const what = 'the binnacle plugin';
  // A skills-directory plugin loads as `<directory>@skills-dir` (ADR-0023): a user-scope copy would show every skill twice.
  const own = join('.claude', 'skills', 'binnacle');
  if (existsSync(join(session.root, own, '.claude-plugin', 'plugin.json'))) {
    session.say(`The project provides its own binnacle plugin, at ${own}, so no copy is installed.`);
    return record(session, 'skipped', `${what}: the project provides its own, at ${own}`);
  }
  if ('reason' in plugins) {
    session.say(`${plugins.reason}, so the binnacle plugin is not installed.`);
    return record(session, 'skipped', `${what}: ${plugins.reason}`);
  }
  const listed = listedAs(plugins.ids, 'binnacle@binnacle');
  if (listed) {
    session.say(`Claude Code already lists ${listed}. It is left as it is.`);
    return record(session, 'skipped', `${what}: Claude Code already lists ${listed}`);
  }

  planClaude(session, 'Install the binnacle plugin from this Binnacle package, at user scope, outside the repository, by running', what, [
    ['plugin', 'marketplace', 'add', PACKAGE_DIR, '--scope', 'user'],
    ['plugin', 'install', 'binnacle@binnacle', '--scope', 'user'],
  ]);
}

/**
 * Step 5b: each skill set into every harness the `skills` CLI detects, at user scope, then out
 * of Claude Code again, which has it as a plugin (ADR-0039), and out of every `skipHarness` id:
 * Binnacle's, as this package's `binnacle-<action>` copy, then Matt Pocock Skills and Ponytail
 * from their repositories, unless the manifest declares one false. Only when `binn` detected a
 * harness: with none detected and `-y`, the `skills` CLI installs into every harness it knows.
 * Without `npx` the commands are printed. A failed call is reported with its output, and the
 * next still runs. An add is read by what it installed, not by its exit status alone.
 */
function skillsStep(session: Session, harnesses: Harness[], tools: ToolState[], skipHarness: string[]): void {
  const sets: SkillSet[] = [
    { what: "Binnacle's skills", claudeCodeHas: 'the binnacle plugin', source: SKILLS_COPY, skills: readdirSync(SKILLS_COPY).sort() },
    ...tools.flatMap(({ tool: { title, plugin }, state }) =>
      plugin && state !== 'declared-false' ? [{ what: title, claudeCodeHas: 'its plugin', source: plugin.source, skills: null }] : [],
    ),
  ];
  if (harnesses.length === 0) {
    session.say(
      `No harness is detected, so ${inSentence(sets.map(({ what }) => what))} are not installed: the skills CLI would install into every harness it knows. Install a harness, then run binn init again.`,
    );
    for (const { what } of sets) record(session, 'skipped', `${what}: no harness is detected`);
    return;
  }
  for (const set of sets) planSkillSet(session, set, skipHarness);
}

/**
 * A skill set the `skills` CLI installs: what it is, what Claude Code has it as, where it comes
 * from, and its skills: Binnacle's copy's own, or null for a repository's, which its add reports
 * as JSON once it has run.
 */
type SkillSet = { what: string; claudeCodeHas: string; source: string; skills: string[] | null };

function planSkillSet(session: Session, { what, claudeCodeHas, source, skills }: SkillSet, skipHarness: string[]): void {
  const binnacle = skills !== null;
  const add = ['skills', 'add', source, '-g', '-y', '--json'];
  const fromClaudeCode = ['skills', 'remove', '-g', '-a', 'claude-code', ...skipHarness];
  const removal = (names: string[]): string[] => [...fromClaudeCode, '-s', ...names, '-y'];
  const shownRemoval = binnacle ? shownSkills(removal(skills)) : `${shownSkills(fromClaudeCode)} -s <each skill the add installed> -y`;
  const body = `  ${shownSkills(add)}\n  ${shownRemoval}`;
  // Binnacle's set alone is versioned by Binnacle (spec, *Freshness*): a current one is installed again all the same, for a harness installed since.
  const installed = binnacle ? binnacleSkills() : null;
  const where = `${what} in ${tilde(INSTALLED_SKILLS)}`;
  if (installed?.state === 'current') {
    session.say(`${where} are current. The plan installs them again, so that a harness installed since they were gets them.`);
    record(session, 'found', `${what}: current`);
  } else if (installed?.state === 'stale') session.say(`${where} are stale: ${installed.reason}. The plan installs them again.`);
  if (!onPath('npx')) {
    session.say(`\`npx\` is not on PATH, so binn init does not install ${what}. Once it is, run:\n\n${body}\n`);
    return record(session, 'printed', `${what}: \`npx\` is not on PATH`);
  }
  session.plan.push({
    heading:
      `Install ${what}${binnacle ? '' : ` from ${source}`} into every harness the skills CLI detects, at user scope, outside the repository, then remove them from Claude Code, which has ${claudeCodeHas}` +
      `${skipHarness.length > 0 ? `, and from ${inSentence(skipHarness)}` : ''}, by running`,
    body,
    declined: binnacle ? `install ${what}` : `install ${what} into every harness`,
    apply() {
      const added = addSkills(session, what, add);
      if (binnacle && added) session.skills = { into: added.into, skipped: skipHarness };
      const names = skills ?? added?.names ?? [];
      if (names.length === 0) {
        const why = added ? 'its add named no skills it installed' : 'its add failed';
        session.say(`${what} are not removed from Claude Code: ${why}.`);
        return record(session, 'skipped', `removing ${what} from Claude Code: ${why}`);
      }
      runSkills(session, removal(names));
    },
  });
}

const shownSkills = (args: string[]): string => `npx ${args.map(quoted).join(' ')}`;

/** Runs one `skills` CLI call through `npx`, said before it runs; its status and output. */
function spawnSkills(session: Session, args: string[]): { status: number | null; stdout: string; stderr: string } {
  session.say(`Running ${shownSkills(args)}...`);
  // ponytail: no shell, so a --skip-harness id and the package's path pass as they are; Windows' `npx.cmd` would need one, as in the servers step.
  const run = spawnSync('npx', args, { cwd: session.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { status: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '' };
}

/** A failed `skills` call, reported with its output and recorded. */
function skillsFailed(session: Session, args: string[], { stdout, stderr }: { stdout: string; stderr: string }): void {
  const output = `${stdout}${stderr}`.trim();
  session.say(`${shownSkills(args)} failed${output ? `:\n${output}` : '.'}`);
  record(session, 'failed', shownSkills(args));
}

/** Runs one `skills` CLI call, reported and recorded; its stdout once it succeeded, null once it failed. */
function runSkills(session: Session, args: string[]): string | null {
  const run = spawnSkills(session, args);
  if (run.status !== 0) {
    skillsFailed(session, args, run);
    return null;
  }
  record(session, 'ran', shownSkills(args));
  return run.stdout;
}

/**
 * Runs a set's `skills add --json` and reads what it installed: the harnesses, Claude Code apart,
 * and the skills to remove from Claude Code. Exiting 0, the harnesses are those its `Installing
 * to:` line names, and the skills those its JSON lists as installed: one it did not install, such
 * as a skill of the human's own by that name, is never removed. Exiting non-zero, as `skills` does
 * when one harness fails while the others install, its JSON calls every such skill failed and the
 * line names the failing harness too: `skills list` then tells which of its skills were installed
 * and where, the ones in Claude Code are removed, and the Summary names each reason the add gave
 * for a harness. With none of them listed, or a listing that fails, it is recorded as failed: null.
 * ponytail: a skill of the set from an earlier run, or one Claude Code failed while it holds the human's own by that name, counts as installed; a listing before the add tells them apart if that matters.
 */
function addSkills(session: Session, what: string, args: string[]): { into: string[]; names: string[] } | null {
  const run = spawnSkills(session, args);
  const report = parsedArray(run.stdout);
  const named = (status?: string): string[] => report.flatMap((skill) => (status === undefined || skill.status === status ? nameOf(skill) : []));
  if (run.status === 0) {
    record(session, 'ran', shownSkills(args));
    return { into: installedInto(`${run.stdout}${run.stderr}`), names: named('installed') };
  }
  const all = named();
  // Spawned rather than run, so that the Summary lists the add before it; a failed listing is recorded all the same.
  const listing = all.length > 0 ? spawnSkills(session, LIST_SKILLS) : null;
  if (listing && listing.status !== 0) skillsFailed(session, LIST_SKILLS, listing);
  const installed = parsedArray(listing?.status === 0 ? listing.stdout : '').flatMap((skill) => {
    const [name] = nameOf(skill);
    const agents = Array.isArray(skill.agents) ? skill.agents.filter((agent): agent is string => typeof agent === 'string') : [];
    return name !== undefined && all.includes(name) ? [{ name, agents }] : [];
  });
  if (installed.length === 0) {
    skillsFailed(session, args, run);
    return null;
  }
  record(session, 'ran', shownSkills(args));
  const reasons = [...new Set(report.flatMap(({ status, error }) => (status === 'failed' && typeof error === 'string' ? [error] : [])))];
  session.say(`${shownSkills(args)} installed ${what}, but not into every harness:\n${reasons.join('\n')}`);
  for (const reason of reasons) record(session, 'failed', `${what} for a harness: ${reason}`);
  return {
    into: [...new Set(installed.flatMap(({ agents }) => agents))].filter((agent) => agent !== 'Claude Code'),
    names: installed.filter(({ agents }) => agents.includes('Claude Code')).map(({ name }) => name),
  };
}

/** What the step asks after an add that exits non-zero: the skills at user scope, each with the harnesses it is in, by display name. */
const LIST_SKILLS = ['skills', 'list', '-g', '--json'];

/** One skill of a `skills` CLI JSON listing, as far as it is read: an add's report, or `skills list`'s. */
type ListedSkill = { name?: unknown; status?: unknown; error?: unknown; agents?: unknown };

/** A listed skill's name, as a list of one, or none when it has none. */
const nameOf = ({ name }: ListedSkill): string[] => (typeof name === 'string' ? [name] : []);

/**
 * A `skills` CLI call's stdout read whole as the JSON array it prints with `--json`; empty when it is not one.
 * ponytail: anything else on stdout, and nothing is read as installed, so no removal follows and the Summary says so.
 */
function parsedArray(json: string): ListedSkill[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as ListedSkill[]) : [];
  } catch {
    return [];
  }
}

/**
 * The harnesses `skills add` names in its `Installing to: A, B` line, Claude Code apart: those it
 * installed into, once it exits 0.
 * ponytail: a textual read of the CLI's own line, colours stripped; `skills list -g --json` names them per skill if the line changes.
 */
const installedInto = (output: string): string[] =>
  (output.replace(/\x1b\[[0-9;]*m/g, '').match(/Installing to: (.+)/)?.[1] ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '' && name !== 'Claude Code');

/** What Claude Code lists, asked once for every plugin init installs: the plugin ids, or why it could not be asked. */
type ClaudePlugins = { ids: string[] } | { reason: string };

const shownClaude = (args: string[]): string => `claude ${args.join(' ')}`;

/** The plugin listed under `id`'s name, from any marketplace: `name@marketplace`. */
const listedAs = (ids: string[], id: string): string | undefined => ids.find((listed) => listed.split('@')[0] === id.split('@')[0]);

/**
 * Asks Claude Code for its plugins, once, through `claude plugin list --json`: before the
 * manifest is proposed, which declares what is found. A failed listing is reported here.
 */
function listClaudePlugins(session: Session): ClaudePlugins {
  if (!detected(HARNESSES.find(({ executable }) => executable === 'claude')!)) return { reason: 'Claude Code is not detected' };
  const listing = ['plugin', 'list', '--json'];
  session.say(`Asking Claude Code for its plugins (${shownClaude(listing)})...`);
  const list = spawnSync('claude', listing, { cwd: session.root, encoding: 'utf8' });
  // Detected by its user directory alone, Claude Code may have no `claude` to run.
  if ((list.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') return { reason: '`claude` is not on PATH' };
  const ids = list.status === 0 ? pluginIds(list.stdout) : null;
  if (ids) return { ids };
  session.say(`\`${shownClaude(listing)}\` failed, so no Claude Code plugin is installed.${list.stderr ? `\n${list.stderr.trim()}` : ''}`);
  record(session, 'failed', shownClaude(listing));
  return { reason: `\`${shownClaude(listing)}\` failed` };
}

/** A plan item running Claude Code's plugin CLI, outside the repository: each command in turn, stopping at the first that fails. */
function planClaude(session: Session, heading: string, declined: string, commands: string[][]): void {
  session.plan.push({
    heading,
    body: commands.map((args) => `  ${shownClaude(args)}`).join('\n'),
    declined,
    apply() {
      for (const args of commands) {
        session.say(`Running ${shownClaude(args)}...`);
        // stdin stays with binn init's own questions; Claude Code's output is shown as it comes.
        const run = spawnSync('claude', args, { cwd: session.root, stdio: ['ignore', 'inherit', 'inherit'] });
        if (run.status !== 0) return record(session, 'failed', shownClaude(args));
        record(session, 'ran', shownClaude(args));
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

/** Where a manifest has the local tracker read tickets, and its roadmap's directory. */
type Layout = { issues: string | null; docs: string | null };

/** What a manifest `binn init` proposes declares: the issues directory on the local tracker, and docs. */
const NEW_LAYOUT = { issues: 'docs/specs', docs: 'docs' } as const;

const declaredLayout = ({ tracker, knowledge }: ProjectManifest): Layout => ({
  issues: tracker.provider === 'local' ? tracker.local.issues : null,
  docs: knowledge.docs,
});

/**
 * The layout Binnacle reads: the local tracker's issues directory, kept in Git by an empty
 * `.gitkeep`, and `<knowledge.docs>/roadmap.md`, a skeleton in Binnacle's format. Each is
 * proposed only when missing; an existing roadmap is never rewritten, and one not in the
 * format is left to `binn audit` to explain.
 */
function layoutStep(session: Session, { issues, docs }: Layout): void {
  if (issues !== null && !existsSync(join(session.root, issues))) {
    session.say(`The tracker reads tickets from ${issues}/, which does not exist. The plan creates it.`);
    planFile(session, posix.join(issues, '.gitkeep'), '');
  }
  if (docs === null) {
    session.say(`${MANIFEST_RELATIVE} declares no knowledge.docs, so Binnacle reads no roadmap. Declare it to have one.`);
    return record(session, 'skipped', `the roadmap: ${MANIFEST_RELATIVE} declares no knowledge.docs`);
  }
  const path = posix.join(docs, 'roadmap.md');
  const existing = join(session.root, path);
  if (!existsSync(existing)) {
    session.say(`There is no roadmap at ${path}. The plan creates a skeleton in Binnacle's format.`);
    return planFile(session, path, ROADMAP_SKELETON);
  }
  const gaps = roadmapGaps(readFileSync(existing, 'utf8'));
  if (gaps.length === 0) {
    session.say(`${path} is in Binnacle's format. It is left as it is.`);
    return record(session, 'skipped', `${path}: it exists`);
  }
  session.say(`${path} is not in Binnacle's format, and binn init never rewrites it. ${gaps.join(' ')}`);
  record(session, 'skipped', `${path}: it exists, and is not in Binnacle's format; binn audit names what is missing`);
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
const REMOTE_QUESTIONS =
  'A question only the owner can answer, and its answer, are issue comments that start with `### Question` and `### Answer`; ' +
  'the answer is written by the owner or `/binnacle:answer`, never by an agent.';

/**
 * What the section says differently on each tracker (ADR-0024). `rule` follows the fields: on
 * the local tracker, the unique slug a ticket's branch needs; on a remote one, the spec's closed-issue states.
 * `questions` says where a question for the owner and its answer go (ADR-0040).
 */
const CONVENTIONS: Record<TrackerProvider, { ticket: string; blockedBy: string; example: string; spec: string; rule: string; questions: string }> = {
  local: {
    ticket: 'ticket',
    blockedBy: 'the numbers of the tickets in the same spec it waits for, such as `01, 03`',
    example: '01, 03',
    spec: 'its path, such as `docs/specs/<slug>/spec.md`',
    rule:
      "A ticket's slug, its file name without the number, is unique across every spec's tickets: it names the ticket's branch, `feat/<slug>`, " +
      'and Binnacle credits the work on a branch two tickets share to neither.',
    questions:
      'A question only the owner can answer goes under a `### Question` heading inside `## Comments`, in a commit that changes only the ticket, on the branch where the work is; ' +
      "the owner's reply goes right after it under `### Answer`, written by the owner or `/binnacle:answer`, never by an agent. " +
      "Binnacle reads them from the Task's branch while it is unmerged.",
  },
  github: {
    ticket: 'issue body',
    blockedBy: ISSUE_NUMBERS,
    example: '#12, #15',
    spec: PATH_OR_LINK,
    rule:
      'Closing an issue outranks its `Status:` line: an issue closed as completed is done, and one closed as not planned or as a duplicate is cancelled, whatever the line says. ' +
      `An issue closed with no reason is cancelled when its \`Status:\` says \`CANCELLED\`, and done otherwise. ${KEEP_CURRENT}`,
    questions: REMOTE_QUESTIONS,
  },
  gitlab: {
    ticket: 'issue body',
    blockedBy: ISSUE_NUMBERS,
    example: '#12, #15',
    spec: PATH_OR_LINK,
    rule:
      'Closing an issue outranks its `Status:` line, and GitLab reports no reason for closing: a closed issue is done, unless its `Status:` says `CANCELLED`. ' +
      `Set \`Status: CANCELLED\` before closing work that was abandoned. ${KEEP_CURRENT}`,
    questions: REMOTE_QUESTIONS,
  },
};

/** The convention `/to-tickets` writes by, for the tracker in use. It leads with a blank line, after the file's last section. */
function ticketHeaderSection(provider: TrackerProvider): string {
  const { ticket, blockedBy, example, spec, rule, questions } = CONVENTIONS[provider];
  const states = TASK_STATES.map((state) => `\`${state}\``).join(', ');
  return `
## Ticket header

Binnacle reads a ticket's state, dependencies and spec from its header: these lines, one per line, at the top of every ${ticket}, before anything else. Write them in every ticket, and keep \`Status:\` current.

- \`Status:\` — the ticket's state, one of ${states}.
- \`Blocked by:\` — ${blockedBy}, or \`None\`.
- \`Spec:\` — the spec it implements, as ${spec}.
- \`Roles:\` — the roles the Task needs, comma-separated, from ${ROLES.join(', ').replace(/, (\w+)$/, ' and $1')}, such as \`Developer, Reviewer, Security\`. Optional: without it a Task needs a Developer and a Reviewer. Binnacle shows its own suggested roles beside the line and never changes it.

${rule}

${questions}

For example:

\`\`\`text
Status: READY
Blocked by: ${example}
Spec: \`docs/specs/<slug>/spec.md\`
Roles: Developer, Reviewer, Security
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
 * Step 13: one read of a remote tracker through its adapter, with the credentials lookup the
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
 * the manifest, found (on PATH by its own executable, or listed by Claude Code), waiting on its
 * prerequisite, a plugin with no Claude Code to install it into, to install, or with nothing to
 * install, only a server to register. `why` says how it was found, or why it has no channel.
 */
type ToolState = { tool: Tool; state: 'declared-false' | 'found' | 'no-prerequisite' | 'no-channel' | 'install' | 'server-only'; why?: string };

/** ponytail: PATH and Claude Code's plugin list only, so a tool installed off PATH is proposed again; a per-tool probe if that bites. */
function detectTools(root: string, plugins: ClaudePlugins): ToolState[] {
  const declared = declaredCapabilities(root);
  return TOOLS.map((tool): ToolState => {
    if (declared[tool.name] === false) return { tool, state: 'declared-false' };
    if (tool.executable && onPath(tool.executable)) return { tool, state: 'found', why: `${tool.executable} is on PATH` };
    if (tool.plugin) {
      if ('reason' in plugins) return { tool, state: 'no-channel', why: `a Claude Code plugin, and ${plugins.reason}` };
      const listed = listedAs(plugins.ids, tool.plugin.id);
      return listed ? { tool, state: 'found', why: `Claude Code lists ${listed}` } : { tool, state: 'install' };
    }
    if (tool.prerequisite && !onPath(tool.prerequisite.executable)) return { tool, state: 'no-prerequisite' };
    return { tool, state: tool.install ? 'install' : 'server-only' };
  });
}

/** Names as a sentence lists them: `A`, `A and B`, `A, B and C`. */
const inSentence = (names: string[]): string => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/**
 * Step 8: the tools of the Standard setup (ADR-0035), installed outside the repository: the
 * executables through a package manager, the skill sets that ship as Claude Code plugins through
 * Claude Code's plugin CLI at user scope, as the binnacle plugin is (ADR-0027). A prerequisite is
 * named, never installed, and no installer script is ever run; a tool that needs it is left out,
 * its server included. Every other harness gets the skill sets from the skills step. One install
 * that fails leaves the others to run.
 */
function toolsStep(session: Session, tools: ToolState[]): void {
  const named = new Set<string>();
  for (const { tool, state, why } of tools) {
    const { title, name, executable, install, prerequisite, plugin } = tool;
    if (state === 'declared-false') {
      session.say(`${MANIFEST_RELATIVE} declares ${name}: false, so ${title} is not proposed.`);
      record(session, 'skipped', `${title}: ${MANIFEST_RELATIVE} declares it false`);
    } else if (state === 'found') {
      session.say(`${title} is installed (${why}). It is left as it is.`);
      record(session, 'found', `${title}: ${why}`);
    } else if (state === 'no-channel') {
      session.say(`${title} is ${why}, so its Claude Code plugin is not installed.`);
      record(session, 'skipped', `${title}: ${why}`);
    } else if (state === 'install' && plugin) {
      session.say(`Claude Code does not list ${title}. Its install is in the plan.`);
      planClaude(session, `Install ${title}'s Claude Code plugin, at user scope, outside the repository, by running`, `install ${title}`, [
        ...(plugin.marketplace ? [['plugin', 'marketplace', 'add', plugin.marketplace, '--scope', 'user']] : []),
        ['plugin', 'install', plugin.id, '--scope', 'user'],
      ]);
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

/**
 * Whether a Codex TOML file's `[mcp_servers.serena]` table starts Serena with Claude Code's
 * context, as `--context=claude-code` or `"--context", "claude-code"`.
 * ponytail: a textual check of that table only; an inline `serena = { ... }` entry is not read. A TOML parser if that misses a real entry.
 */
const hasClaudeContext = (toml: string): boolean =>
  /--context(=|["']\s*,\s*["'])claude-code\b/.test(toml.match(/^\s*\[\s*mcp_servers\s*\.\s*["']?serena["']?\s*\]([\s\S]*?)(?=^\s*\[|(?![\s\S]))/m)?.[1] ?? '');

/** An argument as a POSIX shell reads it back: bare when safe, single-quoted otherwise. Only for showing a command. */
const quoted = (arg: string): string => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`);

/**
 * Step 9: each tool's MCP server registered with every detected harness, through the
 * harness's own CLI, outside the repository: at user scope, or for a server that serves this
 * project only, at the harness's per-project scope outside the repository (Claude Code's local
 * scope). Where the harness has no such CLI or scope, or its CLI is not on PATH, the entry is
 * printed. A server already registered with the harness, in any scope the audit reads, is
 * left as it is, except Serena in Codex's user file with Claude Code's context, which the plan
 * registers again with Codex's. Nothing is written into the repository.
 */
function serversStep(session: Session, tools: ToolState[], harnesses: Harness[]): void {
  if (harnesses.length === 0) return;
  const served = tools
    .filter(({ tool, state }) => tool.server && state !== 'declared-false' && state !== 'no-prerequisite')
    .map(({ tool }) => tool)
    .filter(({ title, server }) => {
      // A tool found on PATH may still lack what its server runs through, such as Graphify installed without uv.
      const needed = server!.prerequisite?.executable;
      if (!needed || onPath(needed)) return true;
      session.say(`${title}'s MCP server runs through ${needed}, which is not on PATH, so it is not registered. Install it with ${server!.prerequisite!.how}.`);
      record(session, 'skipped', `${title}'s MCP server: ${needed} is not on PATH`);
      return false;
    });
  for (const harness of harnesses) {
    const commands: string[][] = [];
    for (const { name, title, server } of served) {
      const what = `${title}'s MCP server`;
      const registered = registeredWith(harness.executable, session.root, name);
      // Serena with Claude Code's context in Codex: corrected where `codex mcp add` writes, the user's file; the repository's is the owner's.
      const userFile = registered !== null && mcpSources().user.some(({ file }) => file === registered);
      const claudeContext = registered !== null && harness.executable === 'codex' && name === 'serena' && hasClaudeContext(readFileSync(userFile ? registered : join(session.root, registered), 'utf8'));
      const replace = claudeContext && userFile;
      if (registered && !replace) {
        const context = claudeContext ? `, with Claude Code's context` : '';
        session.say(`${what} is already registered with ${harness.name}, in ${registered}${context}. It is left as it is.`);
        record(session, 'found', `${what}: registered with ${harness.name} in ${registered}${context}`);
        continue;
      }
      if (replace) session.say(`${what} is registered with ${harness.name} in ${registered} with Claude Code's context.`);
      const command = server!.command(harness.executable, session.root);
      const scope = server!.project ? 'project' : 'user';
      const add = harness.add?.(name, command, scope);
      if (add && onPath(harness.executable)) {
        if (replace) session.say(`The plan registers it again with ${harness.name}'s, which replaces it.`);
        commands.push(add);
        continue;
      }
      const why = !harness.add
        ? `${harness.name} has no command for adding an MCP server`
        : !add
          ? `${title} serves this project only, and ${harness.name} keeps per-project servers only in the repository, which binn init does not write for it`
          : `\`${harness.executable}\` is not on PATH`;
      const where = scope === 'project' ? `this project's ${harness.name} configuration yourself, if you want it in the repository` : `${harness.name}'s user configuration yourself`;
      session.say(`${why}, so binn init does not register ${what} with it. Add this to ${where}:\n\n${harness.entry(name, command).trimEnd()}\n`);
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

/**
 * Step 9b: the OpenTelemetry export of each detected harness that has one (spec of epic 10,
 * *`binn init`'s telemetry step*), in its user-scope settings, outside the repository: pointed at
 * the daemon's address, JSON over HTTP, prompt logging off. An export already configured, to
 * Binnacle or elsewhere, is left as it is and named; a file that cannot be read gets the change
 * printed. A detected harness without an export is named with its reason.
 */
function telemetryStep(session: Session, home: string): void {
  const address = daemonAddress(home);
  for (const exporter of exporters()) {
    const why = detected(exporter);
    if (why === null) continue;
    const { name, file } = exporter;
    const what = `${name}'s OpenTelemetry export`;
    const where = tilde(file);
    if (address === null) {
      session.say(`${name} is installed (${why}), but the Binnacle daemon is not running and BINNACLE_PORT is 0, so there is no address to export to. Start the daemon, then run binn init again.`);
      record(session, 'skipped', `${what}: the daemon's address is not known`);
      continue;
    }
    const text = settingsText(file);
    const state = exporter.read(text, address);
    if (state.state === 'binnacle') {
      session.say(`${name} already exports OpenTelemetry to Binnacle at ${address}, in ${where}. It is left as it is.`);
      record(session, 'skipped', `${what}: it already exports to Binnacle`);
      continue;
    }
    if (state.state === 'elsewhere') {
      session.say(`${name} already has OpenTelemetry settings of its own in ${where}: ${state.what}. They are left as they are.`);
      record(session, 'skipped', `${what}: ${where} already has settings of its own (${state.what})`);
      continue;
    }
    const change = exporter.change(address);
    if (state.state === 'unreadable') {
      session.say(`${where} cannot be read as ${name}'s settings: ${state.why}. binn init does not rewrite it. To export to Binnacle, add this yourself:\n\n${change.trimEnd()}\n`);
      record(session, 'printed', `${what} for ${where}`);
      continue;
    }
    session.say(`${name} is installed (${why}) and does not export OpenTelemetry. Pointing it at the Binnacle daemon is in the plan.`);
    session.plan.push({
      heading:
        `Export ${name}'s OpenTelemetry to the Binnacle daemon at ${address}, JSON over HTTP, prompts not logged, at user scope, outside the repository, ` +
        `by ${exporter.how} ${where}${exporter.how === 'merging into' ? ', keeping the rest of it' : ''}`,
      body: change,
      declined: `configure ${what}`,
      apply() {
        // Only the settings the human saw: a file that changed since it was read is not written.
        if (settingsText(file) !== text) throw new Error('the file changed since the plan was shown');
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, exporter.next(text, address), { flag: text === null ? 'wx' : 'w' });
        record(session, text === null ? 'created' : 'updated', where);
      },
    });
  }
  for (const harness of NO_EXPORT) {
    if (detected(harness) === null) continue;
    session.say(`${harness.name} is not configured to export OpenTelemetry: ${harness.reason}.`);
    record(session, 'skipped', `${harness.name}'s OpenTelemetry export: ${harness.reason}`);
  }
}

/** Whether Git ignores Graphify's output directory, asked as the daemon asks it (ADR-0036); asked again before the build, so a fresh answer each time. */
const isGraphIgnored = (root: string): Promise<boolean | null> => isIgnored(root, GRAPH_FILE, resolveGitTimeout());

/**
 * Step 10: for Graphify found on PATH or installed by this plan, its output directory appended
 * to `.gitignore` (ADR-0026) unless Git already ignores it. Returns whether the first graph is
 * built, last in the plan.
 */
async function graphIgnoreStep(session: Session, tools: ToolState[]): Promise<boolean> {
  const { state } = tools.find(({ tool }) => tool.name === 'graphify')!;
  if (state !== 'found' && state !== 'install') return false;
  if (await isGraphIgnored(session.root)) session.say(`Git already ignores ${GRAPH_DIRECTORY}/, Graphify's output directory, so .gitignore is left as it is.`);
  else planFile(session, '.gitignore', `${GRAPH_DIRECTORY}/\n`);
  return true;
}

/** Where Obsidian keeps its own list of vaults on this platform: on Linux, in its own configuration directory, its Flatpak's or its Snap's. */
const OBSIDIAN_LISTS =
  process.platform === 'darwin'
    ? [join(homedir(), 'Library', 'Application Support', 'obsidian', 'obsidian.json')]
    : process.platform === 'win32'
      ? [join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'obsidian', 'obsidian.json')]
      : [
          join(CONFIG_HOME, 'obsidian', 'obsidian.json'),
          join(homedir(), '.var', 'app', 'md.obsidian.Obsidian', 'config', 'obsidian', 'obsidian.json'),
          join(homedir(), 'snap', 'obsidian', 'current', '.config', 'obsidian', 'obsidian.json'),
        ];

/** The vaults Obsidian lists on this machine whose directory is there. A list that cannot be read lists none. */
function obsidianVaults(): string[] {
  const found = new Set<string>();
  for (const file of OBSIDIAN_LISTS) {
    try {
      const { vaults } = JSON.parse(readFileSync(file, 'utf8')) as { vaults?: Record<string, { path?: unknown }> };
      for (const { path } of Object.values(vaults ?? {})) if (typeof path === 'string' && isAbsolute(path) && statSync(path, { throwIfNoEntry: false })?.isDirectory()) found.add(path);
    } catch {
      // Absent, unreadable or not what it should be: no vault listed there.
    }
  }
  return [...found];
}

/**
 * Step 11: the Obsidian vault the daemon projects the Project Brain into (ADR-0036), a write to
 * this machine's settings file in the Binnacle home, outside the repository (decision 13). A
 * path already set is left alone. Otherwise, with exactly one vault in Obsidian's own list, the
 * plan sets it; with none or several, init says how to set it and names those found. Another
 * vault is had by declining the plan and editing the file, as with the tracker (ADR-0034).
 */
function vaultStep(session: Session, home: string): void {
  const what = 'the Obsidian vault';
  const file = settingsPath(home);
  const unreadable = (): void => {
    session.say(`${file} cannot be read as a JSON object of settings, so no vault path is proposed. Fix it by hand.`);
    record(session, 'skipped', `${what}: ${file} cannot be read`);
  };
  let text: string | null;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return unreadable();
    text = null;
  }
  let settings: unknown;
  try {
    settings = text === null ? {} : JSON.parse(text);
  } catch {
    return unreadable();
  }
  if (!isRecord(settings)) return unreadable();
  const obsidian = settings.obsidian ?? {};
  if (!isRecord(obsidian)) return unreadable();

  const set = obsidian.vaultPath;
  if (set !== undefined && set !== null) {
    // Left alone even when the daemon cannot use it, which it reports as `vault.unwritable`.
    const usable = typeof set === 'string' && isAbsolute(set);
    session.say(
      `${file} already names the Obsidian vault ${typeof set === 'string' ? set : JSON.stringify(set)}. It is left as it is` +
        (usable ? '.' : `, though it is not an absolute path, so the daemon projects nothing; fix it by hand.`),
    );
    return record(session, 'skipped', `${what}: ${file} names one`);
  }

  const vaults = obsidianVaults();
  if (vaults.length !== 1) {
    const found = vaults.length === 0 ? 'Obsidian lists no vault on this machine' : `Obsidian lists ${vaults.length} vaults on this machine: ${inSentence(vaults)}`;
    session.say(
      `${found}, so no vault path is proposed. For the Binnacle daemon to project the Project Brain into a vault, ` +
        `put its absolute path in ${file}, owner-only (chmod 600):\n\n${json({ obsidian: { vaultPath: '/absolute/path/to/vault' } }).trimEnd()}`,
    );
    return record(session, 'skipped', `${what}: ${vaults.length === 0 ? 'Obsidian lists none' : 'Obsidian lists several'}; set obsidian.vaultPath in ${file}`);
  }

  const next = json({ ...settings, obsidian: { ...obsidian, vaultPath: vaults[0] } });
  session.say(`Obsidian lists one vault on this machine, ${vaults[0]}. Setting it is in the plan; for another, decline the plan and edit ${file}.`);
  session.plan.push({
    heading: `Set the Obsidian vault in ${file}, owner-only, outside the repository, to`,
    body: next,
    declined: 'set the Obsidian vault',
    apply() {
      ensureHome(home);
      // Only the settings the human saw: a file that changed since it was read is not rewritten.
      if ((existsSync(file) ? readFileSync(file, 'utf8') : null) !== text) throw new Error('the file changed since the plan was shown');
      writeFileSync(file, next, { mode: OWNER_ONLY_FILE, flag: text === null ? 'wx' : 'w' });
      // An existing file keeps its mode through a write.
      chmodSync(file, OWNER_ONLY_FILE);
      record(session, text === null ? 'created' : 'updated', file);
    },
  });
}

/**
 * Step 12: Graphify's first graph, last in the plan, after its output directory is ignored:
 * Graphify's code-only extraction runs in the repository root, then its report, neither of which
 * needs an API key or calls a model (ADR-0012). A failed step is reported with Graphify's reason,
 * a failed report keeps the graph, and the daemon builds both at a later poll.
 */
function graphBuildStep(session: Session): void {
  const shown = `graphify ${GRAPH_EXTRACT.join(' ')}`;
  const report = `graphify ${GRAPH_CLUSTER.join(' ')}`;
  session.say('Graphify builds the first graph and its report in the plan, code-only: no API key, no model.');
  session.plan.push({
    heading: `Build the first graph and its report into ${GRAPH_DIRECTORY}/, code-only, with no API key and no model, by running in the repository root`,
    body: `  ${shown}\n  ${report}`,
    declined: 'build the first graph',
    async apply() {
      // The `.gitignore` append of step 10 failed: Graphify would leave untracked files in the repository (ADR-0036).
      if ((await isGraphIgnored(session.root)) === false) return record(session, 'skipped', `the first graph: Git does not ignore ${GRAPH_DIRECTORY}/`);
      // Its install in this plan failed, or put it in a directory that is not on PATH.
      if (!onPath('graphify')) return record(session, 'skipped', 'the first graph: graphify is not on PATH. The Binnacle daemon builds the graph once it is.');
      const built = runGraphify(session, GRAPH_EXTRACT, 'The Binnacle daemon builds the graph once graphify runs.');
      if (built) runGraphify(session, GRAPH_CLUSTER, 'The graph is kept, and the Binnacle daemon builds the report with its next graph run.');
    },
  });
}

/** Runs `graphify` with `args` in the repository root and records the outcome; `failed` follows a failure's reason. */
function runGraphify(session: Session, args: string[], failed: string): boolean {
  const shown = `graphify ${args.join(' ')}`;
  session.say(`Running ${shown}...`);
  // Its progress is shown as it comes; stderr is kept for a failure's reason, and shown after. The daemon's ceiling for one step.
  const run = spawnSync('graphify', args, { cwd: session.root, encoding: 'utf8', stdio: ['ignore', 'inherit', 'pipe'], timeout: GRAPH_RUN_TIMEOUT_MS });
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.status === 0) {
    record(session, 'ran', shown);
    return true;
  }
  const reason = run.error?.message || run.stderr?.trim().split('\n').at(-1)?.trim() || `graphify exited with code ${run.status}`;
  record(session, 'failed', `${shown}: ${reason}. ${failed}`);
  return false;
}
