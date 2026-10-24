import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, posix, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { isIgnored, readGitFacts, workingTree, type GitRemote } from '@binnacle/adapters';
import { forgeRemote, instructionSets, terminalText, type ImportWindow, type Language, type ProjectManifest, type TrackerProvider } from '@binnacle/core';
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
  readAutostart,
  readManifest,
  readTracker,
  readRuntime,
  resolveGitTimeout,
  settingsPath,
} from '@binnacle/daemon';
import { autostart, autostartUnavailable } from './daemon-commands.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { daemonAddress, detected, exporters, NO_EXPORT, settingsText } from './export.ts';
import { isRecord, sessionHistory } from './history.ts';
import { agentSkillsBlock, agentsFile, AGENT_SKILLS_HEADING, conventionFiles, ticketHeaderSection } from './conventions.ts';
import { hasTicketHeaderSection, instructionFiles, ISSUE_TRACKER, mattPocockFiles, ROADMAP_SKELETON, roadmapGaps } from './layout.ts';
import { INIT_TEXT, type InitText, type Next, type NoClaude, type Outcome } from './init-text.ts';
import { LANGUAGE, parseLanguage, proposeLanguage } from './language.ts';
import { register } from './project-commands.ts';
import { say, TEXT } from './text.ts';
import { binnacleSkills, CONFIG_HOME, declaredCapabilities, INSTALLED_SKILLS, mcpSources, onPath, PACKAGE_DIR, registeredWith, SKILLS_COPY, tilde, TOOLS, VSCODE_USER_DIRECTORY, type Tool } from './tools.ts';

/** One write the plan proposes: shown in full before the one question, applied only after a yes. */
type PlanItem = {
  /** In English for `--plan --json` and the plan's id, in the person's language when shown. */
  heading(w: InitText): string;
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
  /** The language init speaks: the person's, or English for `--plan --json`, which the chat words. */
  speaks: Language;
  w: InitText;
  plan: PlanItem[];
  outcomes: { outcome: Outcome; what: string }[];
  /** The harnesses other than Claude Code that were detected: the Summary says how to continue in each. */
  otherHarnesses: Harness[];
  claudeCode: boolean;
  /** The command the Summary opens with, once a step has decided it; otherwise Binnacle's own skill. */
  next: Next | null;
  /** Once `skills add` ran: the harnesses it said it installed Binnacle's skills into, Claude Code apart, and the `--skip-harness` ids the removal named. */
  skills: { into: string[]; skipped: string[] } | null;
  /** Only the plan is worked out, for `--plan --json`: nothing is asked, and what is said is kept as notes. */
  planOnly: boolean;
  /** Each harness's sessions in this repository, and the local date of the oldest. */
  history: { harness: string; sessions: number; oldest: string | null }[];
  /** The import window the plan uses, whether the manifest already declares it, and whether it is the default. */
  window: { days: ImportWindow; declared: boolean; default: boolean };
  /** The repository language the plan uses, the one init proposes and where from, and whether the manifest already declares one. */
  language: { value: Language; proposal: Language; source: 'readme' | 'locale'; declared: boolean } | null;
  /** Whether the autostart question could be asked: autostart is off and can be turned on for this home. */
  autostart: { ask: boolean };
};

/**
 * `binn init [path]`: the one command that writes into a project's repository (ADR-0026).
 * It works out every write first, asking only the questions that are not about a write, shows
 * them together as one plan and asks once (ADR-0034): Enter or `y` accepts it at a terminal,
 * anything else declines it, and with stdin not a terminal nothing is written. It never commits.
 * `window` answers the window question unasked, `language` the language question, and `autostart` the autostart question. With `plan`, the plan is printed as JSON with
 * its id (ADR-0037), and nothing is asked, written or run after it, the tracker check included.
 * With `apply`, the plan is worked out again and written unasked only if its id is `apply`: the
 * human confirmed that plan in the chat (ADR-0037). Any other plan is refused, and nothing is written.
 */
export async function init(
  home: string,
  path?: string,
  options: {
    plan?: boolean;
    apply?: string | undefined;
    window?: ImportWindow | undefined;
    language?: Language | undefined;
    autostart?: boolean | undefined;
    skipHarness?: string[];
  } = {},
): Promise<ExitCode> {
  const planOnly = options.plan === true;
  const speaks = planOnly ? 'en' : LANGUAGE;
  const w = INIT_TEXT[speaks];
  const git = await readGitFacts(resolve(path ?? process.cwd()), resolveGitTimeout());
  if (!git.available) {
    console.error(`binn: ${w.notGit(say({ code: git.code, message: git.reason, params: git.params }, speaks))}`);
    return EXIT.failed;
  }

  const { apply } = options;
  // Only the interactive form asks: the window, the language, autostart, then the plan.
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
    // The plan quotes the manifest's values: no control or bidi character in them reaches the terminal. --plan's JSON keeps them as they are.
    say: planOnly ? (text) => void (text.trim() && notes.push(text.replace(/^\s*\n|\s+$/g, ''))) : (text) => console.log(terminalText(text)),
    speaks,
    w,
    plan: [],
    outcomes: [],
    otherHarnesses: [],
    claudeCode: false,
    next: null,
    skills: null,
    planOnly,
    history: [],
    window: { days: DEFAULT_WINDOW_DAYS, declared: false, default: true },
    language: null,
    autostart: { ask: false },
  };

  try {
    if (asks) session.say(w.setUp(session.root));
    const manifest = manifestStep(session);
    session.say('');
    // `--plan` and `--apply` ask nothing: without --window, the default, as Enter at the question gives it.
    const windowSection = await windowStep(session, manifest, options.window ?? (asks ? undefined : DEFAULT_WINDOW_DAYS));
    session.say('');
    // Each of its branches ends with its own blank line: an English answer for an existing manifest says nothing.
    const language = await languageStep(session, manifest, options.language, asks);
    const autostartWanted = await autostartStep(session, home, options.autostart, asks, process.stdin.isTTY === true);
    // Read before the manifest is proposed, which declares what is found or installed; planned after the other writes.
    const plugins = listClaudePlugins(session);
    const tools = detectTools(session, plugins);
    const toDeclare = tools.filter(({ state }) => state === 'found' || state === 'install').map(({ tool }) => tool.name);
    if (manifest === 'new') planFile(session, MANIFEST_RELATIVE, proposeManifest(session.root, git.remotes, toDeclare, language) + (windowSection ? `\n${windowSection}` : ''));
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
    conventionsStep(session, declaredManifest(session.root)?.tracker.provider ?? forgeRemote(git.remotes)?.provider ?? 'local', language);
    session.say('');
    if (manifest !== 'invalid') {
      layoutStep(session, manifest === 'new' ? { ...NEW_LAYOUT, issues: forgeRemote(git.remotes) ? null : NEW_LAYOUT.issues } : declaredLayout(declaredManifest(session.root)!), language);
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
    // Last: turning it on replaces a daemon this home runs by hand, which the plan's registration uses.
    if (autostartWanted) planAutostart(session, home);
    if (planOnly) {
      const { root, history, window, language, autostart } = session;
      const plan = english(session.plan);
      console.log(JSON.stringify({ root, id: planId(root, plan), plan, notes, history, window, language, autostart }, null, 2));
      return EXIT.ok;
    }
    // The same plan shown has the same id; a change to a file that leaves every item as shown is left to ADR-0026's guards.
    if (apply !== undefined && apply !== planId(session.root, english(session.plan))) {
      console.error(`binn: ${w.planChanged}`);
      return EXIT.failed;
    }
    if (session.plan.length === 0) session.say(w.nothingToWrite);
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

  // The command to run next first, then what was written, skipped, printed or declined.
  const next: Next =
    session.next ?? (session.claudeCode ? { kind: 'claudeCode' } : session.otherHarnesses[0] ? { kind: 'harness', name: session.otherHarnesses[0].name } : { kind: 'audit' });
  session.say(w.summary);
  // Run from elsewhere, as `binn init <path>` may be, a command that acts on the repository names it.
  const at = resolve(process.cwd()) === session.root ? '' : ` ${quoted(session.root)}`;
  const commands = NEXT_COMMANDS[next.kind].map((command) => (/^binn (init|project register)$/.test(command) ? `${command}${at}` : command));
  session.say(`${w.next(next, MANIFEST_RELATIVE)}\n\n${commands.map((command) => `  ${command}\n`).join('')}`);
  const width = Math.max(...Object.values(w.outcome).map((label) => label.length));
  for (const { outcome, what } of session.outcomes) session.say(`  ${w.outcome[outcome].padEnd(width)}  ${what}`);
  session.say(w.notCommitted);
  if (next.kind !== 'audit') session.say(w.audit);
  if (session.skills && session.skills.into.length > 0) {
    // The removal names skills CLI ids, the add's output display names: the skipped are named apart rather than matched.
    const { into, skipped } = session.skills;
    session.say(w.skillsInto(w.inSentence(into), skipped.length > 0 ? w.inSentence(skipped) : null));
  }
  for (const harness of session.otherHarnesses) nextSteps(session, harness);
  return EXIT.ok;
}

/** The command each kind of next step runs, which the Summary opens with. */
const NEXT_COMMANDS: Record<Next['kind'], string[]> = {
  init: ['binn init'],
  fixManifest: ['binn project register'],
  startDaemon: ['binn daemon start', 'binn project register'],
  register: ['binn project register'],
  claudeCode: ['/binnacle:product'],
  harness: ['binnacle-product'],
  audit: ['binn audit'],
};

/** The plan as `--plan --json` shows it and its id hashes it: English headings whatever the person's language, so that a plan shown in one locale is applied from another. */
const english = (plan: PlanItem[]): { heading: string; body: string }[] => plan.map(({ heading, body }) => ({ heading: heading(INIT_TEXT.en), body }));

/** A plan's id (ADR-0037): a hash of the repository root and every item's heading and body, in order, so that no state is kept between showing a plan and confirming it. */
const planId = (root: string, plan: { heading: string; body: string }[]): string =>
  createHash('sha256')
    .update(JSON.stringify([root, ...plan.map(({ heading, body }) => [heading, body])]))
    .digest('hex');

/** What to do next to work from a harness other than Claude Code, which has the plugin: the skills step gave it `binnacle-<action>` skills. */
function nextSteps(session: Session, harness: Harness): void {
  const { w } = session;
  const { note, open, offPath } = w.harness[harness.executable] ?? {};
  const steps = [note, open, offPath && !onPath(harness.executable) ? offPath : undefined, session.skills ? w.runProduct(harness.name) : w.onceSkills(harness.name)].filter(
    (step): step is string => step !== undefined,
  );
  session.say(w.toWorkFrom(harness.name));
  steps.forEach((step, index) => session.say(`  ${index + 1}. ${step}`));
}

/** Shows the plan whole and asks once. Without a terminal there is no one to confirm it, so nothing is written. */
async function confirmPlan(session: Session, terminal: boolean): Promise<void> {
  const { plan, w } = session;
  session.say(w.planIntro);
  plan.forEach(({ heading, body }, index) => session.say(`${index + 1}. ${heading(w)}:\n\n${body.trimEnd()}\n`));

  const declineAll = (why: string): void => {
    session.say(w.nothingWritten(why));
    for (const { declined } of plan) record(session, 'declined', declined);
    // Nothing was written: the next step is init again, at a terminal.
    session.next = { kind: 'init' };
  };
  if (!terminal) return declineAll(w.noTerminal);
  const reply = await session.answer(w.writePlan);
  // Enter or yes accepts; anything else, and the end of input, declines.
  if (reply === null || !/^\s*(y(es)?)?\s*$/i.test(reply)) return declineAll(w.planDeclined);
  await applyPlan(session);
}

/** Runs every item of a confirmed plan. */
async function applyPlan(session: Session): Promise<void> {
  for (const item of session.plan) {
    // One write that fails is reported, and the rest of the plan still runs.
    try {
      await item.apply();
    } catch (error) {
      const why = error instanceof Changed ? session.w.changedSince : session.w.foreign(error instanceof Error ? error.message : String(error));
      record(session, 'failed', `${item.declined}: ${why}`);
    }
  }
}

/** A file that changed since the plan showed it, which the Summary words in the person's language. */
class Changed extends Error {}

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

  const { w } = session;
  if (existing === null) {
    session.plan.push({
      heading: (words) => words.create(relative),
      body: text,
      declined: w.createWhat(relative),
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
    session.say(w.jsonExists(relative, text));
    return record(session, 'printed', w.entryFor(relative));
  }

  const addition = existing === '' || existing.endsWith('\n') ? text : `\n${text}`;
  session.plan.push({
    heading: (words) => words.append(relative),
    body: addition,
    declined: w.appendWhat(relative),
    apply() {
      // Only the section the human saw: a file that changed since it was read is not extended.
      if (readFileSync(path, 'utf8') !== existing) throw new Changed();
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
  const { w, speaks } = session;
  try {
    const { warnings } = readManifest(session.root);
    session.say(w.manifestValid(MANIFEST_RELATIVE));
    for (const warning of warnings) session.say(`  ${warning.path}: ${say(warning, speaks)}`);
    record(session, 'skipped', w.manifestExists(MANIFEST_RELATIVE));
    return 'valid';
  } catch (error) {
    if (!(error instanceof OperationError)) throw error;
    if (error.code === 'manifest.missing') {
      session.say(w.manifestMissing(MANIFEST_RELATIVE));
      return 'new';
    }
    session.say(w.manifestProblems(MANIFEST_RELATIVE));
    // `--plan --json`'s notes keep the code for the chat, which words it; a person reads the sentence.
    session.say(`  ${session.planOnly ? `${error.code}: ${error.message}` : say(error, speaks)}`);
    for (const detail of error.details ?? []) session.say(`  ${detail.path}: ${say(detail, speaks)}`);
    record(session, 'skipped', w.manifestWithProblems(MANIFEST_RELATIVE));
    return 'invalid';
  }
}

/** Only what is there, or what the plan creates: a path that does not exist, or a tracker nobody has, is never declared. */
function proposeManifest(root: string, remotes: GitRemote[], capabilities: string[], language: Language): string {
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
  sections.push(`knowledge:${knowledge.join('')}\n  language: ${language}`);

  // The plan writes the conventions Matt Pocock Skills read where they are missing (conventionsStep).
  sections.push('workflow:\n  provider: matt-pocock');

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
  const { w } = session;
  const what = w.window;
  const history = await sessionHistory(session.root);
  session.history = history.map(({ name, sessions, oldest }) => ({ harness: name, sessions, oldest: sessions === 0 ? null : localDate(oldest) }));
  // `--plan --json` carries the history as its own field, not as notes.
  if (!session.planOnly) {
    session.say(w.history);
    for (const { harness, sessions, oldest } of session.history) session.say(`  ${harness}: ${w.sessions(sessions, oldest)}`);
  }

  const declared = manifest === 'valid' ? (declaredManifest(session.root)?.telemetry.import.windowDays ?? null) : null;
  if (declared !== null) {
    session.window = { days: declared, declared: true, default: declared === DEFAULT_WINDOW_DAYS };
    session.say(w.windowDeclared(MANIFEST_RELATIVE, declared));
    record(session, 'skipped', `${what}: ${w.windowDeclaredWhat(MANIFEST_RELATIVE, declared)}`);
    return null;
  }

  let window = given ?? null;
  if (window === null) {
    session.say(w.windowAsk(DEFAULT_WINDOW_DAYS, MANIFEST_RELATIVE, manifest === 'new'));
    do {
      const answer = await session.answer(w.windowPrompt(DEFAULT_WINDOW_DAYS));
      if (answer === null) {
        session.say(w.windowNoAnswer(DEFAULT_WINDOW_DAYS));
        record(session, 'skipped', `${what}: ${w.windowNoAnswerWhat(DEFAULT_WINDOW_DAYS)}`);
        return null;
      }
      window = importWindow(answer);
      if (window === null) session.say(w.windowAgain(DEFAULT_WINDOW_DAYS));
    } while (window === null);
  }
  session.window = { days: window, declared: false, default: window === DEFAULT_WINDOW_DAYS };

  const section = `telemetry:\n  import:\n    window_days: ${window}\n`;
  if (manifest === 'new') return section;
  session.say(w.addYourself(MANIFEST_RELATIVE, section));
  record(session, 'printed', w.windowLine(MANIFEST_RELATIVE));
  return null;
}

/**
 * Step 2a: the repository's documentation language, `knowledge.language` (ADR-0045), asked after
 * the window with init's proposal as its default. The language is returned for a manifest the plan
 * creates, which states it whatever it is; for an existing one the line is printed, never written
 * (ADR-0026), and only when it is not English, which a manifest without one already reads. A
 * `given` language is taken as the answer, and the forms that ask nothing take the proposal.
 */
async function languageStep(session: Session, manifest: ManifestState, given: Language | undefined, asks: boolean): Promise<Language> {
  const { w } = session;
  const { language: proposal, source } = proposeLanguage(session.root);
  const declared = manifest === 'valid' ? declaredLanguage(session.root) : null;
  if (declared !== null) {
    session.language = { value: declared, proposal, source, declared: true };
    session.say(w.languageDeclared(MANIFEST_RELATIVE));
    record(session, 'skipped', w.languageDeclaredWhat(MANIFEST_RELATIVE));
    return declared;
  }

  let language = given ?? (asks ? null : proposal);
  if (language === null) {
    session.say(w.languageAsk(proposal, source === 'readme', MANIFEST_RELATIVE, manifest === 'new'));
    do {
      const answer = await session.answer(w.languagePrompt(proposal));
      // The end of input takes the proposal, as Enter does.
      language = answer === null || answer.trim() === '' ? proposal : parseLanguage(answer);
      if (language === null) session.say(w.languageAgain);
    } while (language === null);
    session.say('');
  }
  session.language = { value: language, proposal, source, declared: false };

  // A manifest without the field already reads as English, so only another answer is worth a line.
  if (manifest !== 'new' && language !== 'en') {
    session.say(w.languageAdd(MANIFEST_RELATIVE, language));
    record(session, 'printed', w.languageLine(MANIFEST_RELATIVE));
  }
  return language;
}

/** The manifest's language, English for one it names but this Binnacle does not know, or null when it states none. */
function declaredLanguage(root: string): Language | null {
  const { manifest, warnings } = readManifest(root);
  return manifest.knowledge.language ?? (warnings.some(({ path }) => path === 'knowledge.language') ? 'en' : null);
}

const AUTOSTART_ON = '`binn daemon autostart on`';

/**
 * Step 2b: whether the daemon starts at login (ADR-0043), asked after the window and before the
 * plan, and only while autostart is off for this home and can be turned on here. Enter means yes,
 * which `planAutostart` makes the plan's last item. A `given` answer, the chat's, is taken unasked
 * in every form. Without one, without a terminal and in the forms that ask nothing, it is not asked
 * and nothing is installed: the Summary names the command instead.
 */
async function autostartStep(session: Session, home: string, given: boolean | undefined, asks: boolean, terminal: boolean): Promise<boolean> {
  const { w } = session;
  const skip = (said: string, why: string): false => {
    session.say(said);
    record(session, 'skipped', `${w.autostart}: ${why}`);
    return false;
  };
  let reason: string | null;
  try {
    const current = readAutostart(home);
    if (current.state === 'on') return skip(w.autostartOn(home), w.autostartOnWhat(home));
    if (current.state === 'broken') return skip(w.autostartBroken(home, current.missing, AUTOSTART_ON), w.autostartBrokenWhat(AUTOSTART_ON));
    reason = autostartUnavailable(current, TEXT[session.speaks]);
  } catch (error) {
    reason = w.foreign((error as Error).message);
  }
  if (reason !== null) return skip(w.autostartUnavailable(reason), w.autostartUnavailableWhat(reason));
  session.autostart = { ask: true };
  let yes = given;
  if (yes === undefined) {
    if (!asks) return skip(w.asksNothing(AUTOSTART_ON), w.asksNothingWhat(AUTOSTART_ON));
    if (!terminal) return skip(w.noTerminalAutostart(AUTOSTART_ON), w.noTerminalAutostartWhat(AUTOSTART_ON));
    const reply = await session.answer(w.autostartPrompt);
    // Enter or yes accepts, as the plan's question does; anything else, and the end of input, declines.
    yes = reply !== null && /^\s*(y(es)?)?\s*$/i.test(reply);
  }
  if (!yes) return skip(w.autostartDeclined(AUTOSTART_ON), w.autostartDeclinedWhat(AUTOSTART_ON));
  session.say(w.autostartInPlan);
  return true;
}

/** Whether the service manager starts this home's daemon; a definition that cannot be read counts as not. */
function autostartIsOn(home: string): boolean {
  try {
    return readAutostart(home).state === 'on';
  } catch {
    return false;
  }
}

/** The plan's item for a yes to the autostart question: `binn daemon autostart on`, as the command runs it. */
function planAutostart(session: Session, home: string): void {
  session.plan.push({
    heading: (w) => w.autostartHeading(home),
    body: '  binn daemon autostart on',
    declined: session.w.autostartLater(AUTOSTART_ON),
    async apply() {
      // Its warnings, such as a tracker token the service will not see, go to the Summary.
      const warnings: string[] = [];
      const code = await autostart(home, 'on', { warn: (text) => warnings.push(text), root: session.root });
      record(session, code === EXIT.ok ? 'ran' : 'failed', 'binn daemon autostart on');
      // The service started the daemon that registration waited for: only the registration is left.
      if (code === EXIT.ok && session.next?.kind === 'startDaemon') session.next = { kind: 'register' };
      for (const warning of warnings) record(session, 'warned', warning);
    },
  });
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
  const { w } = session;
  const what = w.registration;
  if (!manifestUsable) {
    session.say(w.noUsableManifest(MANIFEST_RELATIVE, session.root));
    session.next = { kind: 'fixManifest' };
    return record(session, 'skipped', `${what}: ${w.noUsableManifestWhat}`);
  }

  const runtime = readRuntime(home);
  if (!runtime || !isAlive(runtime.pid)) {
    session.say(w.daemonNotRunning(session.root));
    session.next = { kind: 'startDaemon' };
    return record(session, 'skipped', `${what}: ${w.daemonNotRunningWhat}`);
  }

  session.plan.push({
    heading: (words) => words.registerHeading,
    body: `  binn project register ${quoted(session.root)}`,
    declined: what,
    async apply() {
      const code = await register(home, session.root);
      record(session, code === EXIT.ok ? 'ran' : 'failed', 'binn project register');
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
   * Absent where it has no CLI for adding a server. What is said of it, its note before the
   * entry and its next steps in the Summary, is `binn init`'s text, by its executable.
   */
  add?(name: string, command: string[], scope: 'user' | 'project'): string[] | null;
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
  },
  {
    name: 'opencode',
    executable: 'opencode',
    userDirectory: join(CONFIG_HOME, 'opencode'),
    files: ['opencode.json', 'opencode.jsonc'],
    entry: (name, command) => json({ $schema: 'https://opencode.ai/config.json', mcp: { [name]: { type: 'local', command } } }),
    // No `add`: its documented `opencode mcp add` is an interactive wizard.
  },
  {
    name: 'VS Code',
    executable: 'code',
    userDirectory: VSCODE_USER_DIRECTORY,
    files: ['.vscode/mcp.json'],
    entry: (name, command) => json({ servers: { [name]: stdio(command) } }),
    // `--add-mcp` adds to the user profile; its only per-project place is .vscode/mcp.json, in the repository.
    add: (name, [command, ...args], scope) => (scope === 'user' ? ['code', '--add-mcp', JSON.stringify({ name, command, args })] : null),
  },
];

/** Step 4: the MCP registration for each detected harness, then a generic snippet for any other. Returns the detected harnesses. */
function harnessStep(session: Session): Harness[] {
  const { w } = session;
  const found = HARNESSES.map((harness) => ({ harness, reason: detected(harness, w) })).filter(({ reason }) => reason !== null);
  if (found.length === 0) session.say(w.noHarness(HARNESSES.map(({ name }) => name).join(', ')));

  for (const { harness, reason } of found) {
    const file = harness.files.find((candidate) => existsSync(join(session.root, candidate))) ?? harness.files[0]!;
    if (harness.executable === 'claude') session.claudeCode = true;
    else session.otherHarnesses.push(harness);
    session.say(w.harnessInstalled(harness.name, reason!, file));
    const path = join(session.root, file);
    if (existsSync(path) && namesBinnacle(readFileSync(path, 'utf8'))) {
      session.say(w.namesBinnacle(file));
      record(session, 'skipped', w.namesBinnacleWhat(file));
    } else {
      const { note } = w.harness[harness.executable] ?? {};
      if (note) session.say(note);
      planFile(session, file, harness.entry('binnacle', BINNACLE));
    }
    session.say('');
  }

  session.say(w.generic(json({ mcpServers: { binnacle: stdio(BINNACLE) } }).trimEnd()));
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
  const { w } = session;
  const what = w.plugin;
  // A skills-directory plugin loads as `<directory>@skills-dir` (ADR-0023): a user-scope copy would show every skill twice.
  const own = join('.claude', 'skills', 'binnacle');
  if (existsSync(join(session.root, own, '.claude-plugin', 'plugin.json'))) {
    session.say(w.ownPlugin(own));
    return record(session, 'skipped', `${what}: ${w.ownPluginWhat(own)}`);
  }
  if ('reason' in plugins) {
    session.say(w.noPlugin(w.noClaude[plugins.reason]));
    return record(session, 'skipped', `${what}: ${w.noClaude[plugins.reason]}`);
  }
  const listed = listedAs(plugins.ids, 'binnacle@binnacle');
  if (listed) {
    session.say(w.pluginListed(listed));
    return record(session, 'skipped', `${what}: ${w.pluginListedWhat(listed)}`);
  }

  planClaude(session, (words) => words.pluginHeading, what, [
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
  const { w } = session;
  const sets: SkillSet[] = [
    { what: w.binnacleSkills, claudeCodeHas: w.binnaclePlugin, source: SKILLS_COPY, skills: readdirSync(SKILLS_COPY).sort() },
    ...tools.flatMap(({ tool: { title, plugin }, state }) =>
      plugin && state !== 'declared-false' ? [{ what: title, claudeCodeHas: w.itsPlugin, source: plugin.source, skills: null }] : [],
    ),
  ];
  if (harnesses.length === 0) {
    session.say(w.skillsNoHarness(w.inSentence(sets.map(({ what }) => what))));
    for (const { what } of sets) record(session, 'skipped', `${what}: ${w.noHarnessWhat}`);
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
  const { w } = session;
  const binnacle = skills !== null;
  const add = ['skills', 'add', source, '-g', '-y', '--json'];
  const fromClaudeCode = ['skills', 'remove', '-g', '-a', 'claude-code', ...skipHarness];
  const removal = (names: string[]): string[] => [...fromClaudeCode, '-s', ...names, '-y'];
  const shownRemoval = binnacle ? shownSkills(removal(skills)) : `${shownSkills(fromClaudeCode)} -s <each skill the add installed> -y`;
  const body = `  ${shownSkills(add)}\n  ${shownRemoval}`;
  // Binnacle's set alone is versioned by Binnacle (spec, *Freshness*): a current one is installed again all the same, for a harness installed since.
  const installed = binnacle ? binnacleSkills() : null;
  const where = tilde(INSTALLED_SKILLS);
  if (installed?.state === 'current') {
    session.say(w.skillsCurrent(what, where));
    record(session, 'found', `${what}: ${w.current}`);
  } else if (installed?.state === 'stale') session.say(w.skillsStale(what, where, installed));
  if (!onPath('npx')) {
    session.say(w.noNpx(what, body));
    return record(session, 'printed', `${what}: ${w.noNpxWhat}`);
  }
  // The heading's names are its words' own: a set named in English is named so in the heading the id hashes.
  const named = (words: InitText): { what: string; has: string } =>
    binnacle ? { what: words.binnacleSkills, has: words.binnaclePlugin } : { what, has: words.itsPlugin };
  session.plan.push({
    heading: (words) => words.skillsHeading(named(words).what, binnacle ? null : source, named(words).has, skipHarness.length > 0 ? words.inSentence(skipHarness) : null),
    body,
    declined: binnacle ? w.install(what) : w.installEverywhere(what),
    apply() {
      const added = addSkills(session, what, add);
      if (binnacle && added) session.skills = { into: added.into, skipped: skipHarness };
      const names = skills ?? added?.names ?? [];
      if (names.length === 0) {
        const why = added ? w.addNamedNone : w.addFailed;
        session.say(w.notRemoved(what, why));
        return record(session, 'skipped', w.notRemovedWhat(what, why));
      }
      runSkills(session, removal(names));
    },
  });
}

const shownSkills = (args: string[]): string => `npx ${args.map(quoted).join(' ')}`;

/** Runs one `skills` CLI call through `npx`, said before it runs; its status and output. */
function spawnSkills(session: Session, args: string[]): { status: number | null; stdout: string; stderr: string } {
  session.say(session.w.running(shownSkills(args)));
  // ponytail: no shell, so a --skip-harness id and the package's path pass as they are; Windows' `npx.cmd` would need one, as in the servers step.
  const run = spawnSync('npx', args, { cwd: session.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { status: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '' };
}

/** A failed `skills` call, reported with its output and recorded. */
function skillsFailed(session: Session, args: string[], { stdout, stderr }: { stdout: string; stderr: string }): void {
  // Its colours stripped, as installedInto strips them: `say` would show them as escapes.
  const output = `${stdout}${stderr}`.replace(/\x1b\[[0-9;]*m/g, '').trim();
  session.say(session.w.commandFailed(shownSkills(args), output));
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
  session.say(session.w.notEveryHarness(shownSkills(args), what, reasons));
  for (const reason of reasons) record(session, 'failed', session.w.forAHarness(what, reason));
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
type ClaudePlugins = { ids: string[] } | { reason: NoClaude };

const shownClaude = (args: string[]): string => `claude ${args.join(' ')}`;

/** The plugin listed under `id`'s name, from any marketplace: `name@marketplace`. */
const listedAs = (ids: string[], id: string): string | undefined => ids.find((listed) => listed.split('@')[0] === id.split('@')[0]);

/**
 * Asks Claude Code for its plugins, once, through `claude plugin list --json`: before the
 * manifest is proposed, which declares what is found. A failed listing is reported here.
 */
function listClaudePlugins(session: Session): ClaudePlugins {
  if (!detected(HARNESSES.find(({ executable }) => executable === 'claude')!)) return { reason: 'undetected' };
  const listing = ['plugin', 'list', '--json'];
  session.say(session.w.asking);
  const list = spawnSync('claude', listing, { cwd: session.root, encoding: 'utf8' });
  // Detected by its user directory alone, Claude Code may have no `claude` to run.
  if ((list.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') return { reason: 'offPath' };
  const ids = list.status === 0 ? pluginIds(list.stdout) : null;
  if (ids) return { ids };
  session.say(session.w.listingFailed(list.stderr?.trim() ?? ''));
  record(session, 'failed', shownClaude(listing));
  return { reason: 'failed' };
}

/** A plan item running Claude Code's plugin CLI, outside the repository: each command in turn, stopping at the first that fails. */
function planClaude(session: Session, heading: PlanItem['heading'], declined: string, commands: string[][]): void {
  session.plan.push({
    heading,
    body: commands.map((args) => `  ${shownClaude(args)}`).join('\n'),
    declined,
    apply() {
      for (const args of commands) {
        session.say(session.w.running(shownClaude(args)));
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
function layoutStep(session: Session, { issues, docs }: Layout, language: Language): void {
  const { w } = session;
  if (issues !== null && !existsSync(join(session.root, issues))) {
    session.say(w.noIssues(issues));
    planFile(session, posix.join(issues, '.gitkeep'), '');
  }
  if (docs === null) {
    session.say(w.noDocs(MANIFEST_RELATIVE));
    return record(session, 'skipped', w.noDocsWhat(MANIFEST_RELATIVE));
  }
  const path = posix.join(docs, 'roadmap.md');
  const existing = join(session.root, path);
  if (!existsSync(existing)) {
    session.say(w.noRoadmap(path));
    return planFile(session, path, ROADMAP_SKELETON[language]);
  }
  const gaps = roadmapGaps(readFileSync(existing, 'utf8'));
  if (gaps.length === 0) {
    session.say(w.roadmapInFormat(path));
    return record(session, 'skipped', w.roadmapExists(path));
  }
  session.say(w.roadmapNotInFormat(path, gaps.map((gap) => say(gap, session.speaks)).join(' ')));
  record(session, 'skipped', w.roadmapNotInFormatWhat(path));
}

/**
 * Step 6: the planning conventions Matt Pocock Skills read, in place of `/setup-matt-pocock-skills`
 * (ADR-0042): each convention file that is missing, the issue tracker's with its ticket header
 * (ADR-0024), and the *Agent skills* block that points to them, in `AGENTS.md`, in `CLAUDE.md`
 * when only it exists, or in a new `AGENTS.md`. A file that exists only gets the ticket-header
 * section it lacks, and a block in either instruction file is left as it is. `provider` is the
 * tracker the manifest declares, or the one it would propose.
 */
function conventionsStep(session: Session, provider: TrackerProvider, language: Language): void {
  const found = mattPocockFiles(session.root);
  const missing = Object.entries(conventionFiles(provider, language)).filter(([path]) => !found.includes(path));
  const { w } = session;
  if (missing.length > 0) session.say(w.conventions(missing.map(([path]) => path).join(', ')));
  for (const [path, text] of missing) planFile(session, path, text);
  if (found.includes(ISSUE_TRACKER)) {
    if (hasTicketHeaderSection(session.root)) record(session, 'skipped', w.ticketHeaderHas(ISSUE_TRACKER));
    else planFile(session, ISSUE_TRACKER, ticketHeaderSection(provider, language));
  }

  const files = instructionFiles(session.root);
  const holder = Object.keys(files).find((name) => AGENT_SKILLS_HEADING.test(files[name]!));
  if (holder) return record(session, 'skipped', w.agentSkillsHas(holder));
  const target = 'CLAUDE.md' in files && !('AGENTS.md' in files) ? 'CLAUDE.md' : 'AGENTS.md';
  planFile(session, target, target in files ? agentSkillsBlock(provider, language) : agentsFile(provider, language));
}

/** Step 7: the agent instruction files, reported as the sets an agent reads. */
function instructionsStep(session: Session): void {
  const files = instructionFiles(session.root);
  const sets = instructionSets(files);
  if (sets.length === 0) return session.say(session.w.noInstructions);
  session.say(session.w.instructions(sets));
}

/**
 * Step 13: one read of a remote tracker through its adapter, with the credentials lookup the
 * daemon uses. On a failure it says how to make a read-only token and where to put it; it
 * never asks for, stores or prints one. `manifest` is the readable manifest, if any.
 */
async function trackerStep(session: Session, home: string, manifest: ProjectManifest | null): Promise<void> {
  const { w } = session;
  if (!manifest) return session.say(w.noTrackerManifest);
  const { provider, repository, host } = manifest.tracker;
  if (provider !== 'github' && provider !== 'gitlab') return session.say(w.notRemote);
  const name = repository ?? w.trackerOf(provider);
  const variable = `BINNACLE_${provider.toUpperCase()}_TOKEN`;
  // The check reads binn init's own environment; the daemon reads the one it was started with.
  // A daemon the service manager starts has only the BINNACLE_HOME and PATH its definition carries.
  const fromShell = !process.env[variable]?.trim() ? '' : autostartIsOn(home) ? w.shellService(variable) : w.shell(variable);

  // A remote tracker is read from its host, never from the tree.
  session.say(w.reading(name));
  const reading = await readTracker(home, workingTree(session.root), manifest);
  if (reading.tasks !== null) {
    session.say(w.readable(name, reading.tasks.length, fromShell));
    return record(session, 'checked', w.readableWhat);
  }
  const failure = say(reading.diagnostics[0]!, session.speaks);
  record(session, 'failed', w.unreadableWhat(failure));
  session.say(w.unreadable(name, failure));
  // Without a repository the fix is in the manifest, not a token.
  if (repository === null) return;

  const how = provider === 'github' ? w.githubToken(repository) : w.gitlabToken;
  session.say(w.tokenWhere(how, variable, credentialsPath(home), JSON.stringify(credentialsKey(provider, host)), `${provider.toUpperCase()}_TOKEN`, fromShell));
}

/**
 * A tool of the Standard setup, and what init found about it on this machine: declared false in
 * the manifest, found (on PATH by its own executable, or listed by Claude Code), waiting on its
 * prerequisite, a plugin with no Claude Code to install it into, to install, or with nothing to
 * install, only a server to register. `why` says how it was found, or why it has no channel.
 */
type ToolState = { tool: Tool; state: 'declared-false' | 'found' | 'no-prerequisite' | 'no-channel' | 'install' | 'server-only'; why?: string };

/** ponytail: PATH and Claude Code's plugin list only, so a tool installed off PATH is proposed again; a per-tool probe if that bites. */
function detectTools({ root, w }: Session, plugins: ClaudePlugins): ToolState[] {
  const declared = declaredCapabilities(root);
  return TOOLS.map((tool): ToolState => {
    if (declared[tool.name] === false) return { tool, state: 'declared-false' };
    if (tool.executable && onPath(tool.executable)) return { tool, state: 'found', why: w.toolOnPath(tool.executable) };
    if (tool.plugin) {
      if ('reason' in plugins) return { tool, state: 'no-channel', why: w.toolNoChannel(w.noClaude[plugins.reason]) };
      const listed = listedAs(plugins.ids, tool.plugin.id);
      return listed ? { tool, state: 'found', why: w.toolListed(listed) } : { tool, state: 'install' };
    }
    if (tool.prerequisite && !onPath(tool.prerequisite.executable)) return { tool, state: 'no-prerequisite' };
    return { tool, state: tool.install ? 'install' : 'server-only' };
  });
}

/**
 * Step 8: the tools of the Standard setup (ADR-0035), installed outside the repository: the
 * executables through a package manager, the skill sets that ship as Claude Code plugins through
 * Claude Code's plugin CLI at user scope, as the binnacle plugin is (ADR-0027). A prerequisite is
 * named, never installed, and no installer script is ever run; a tool that needs it is left out,
 * its server included. Every other harness gets the skill sets from the skills step. One install
 * that fails leaves the others to run.
 */
function toolsStep(session: Session, tools: ToolState[]): void {
  const { w } = session;
  const named = new Set<string>();
  for (const { tool, state, why } of tools) {
    const { title, name, executable, install, prerequisite, plugin } = tool;
    if (state === 'declared-false') {
      session.say(w.declaredFalse(MANIFEST_RELATIVE, name, title));
      record(session, 'skipped', w.declaredFalseWhat(title, MANIFEST_RELATIVE));
    } else if (state === 'found') {
      session.say(w.toolFound(title, why!));
      record(session, 'found', w.toolWhy(title, why!));
    } else if (state === 'no-channel') {
      session.say(w.noChannel(title, why!));
      record(session, 'skipped', w.toolWhy(title, why!));
    } else if (state === 'install' && plugin) {
      session.say(w.notListed(title));
      planClaude(session, (words) => words.pluginInstallHeading(title), w.install(title), [
        ...(plugin.marketplace ? [['plugin', 'marketplace', 'add', plugin.marketplace, '--scope', 'user']] : []),
        ['plugin', 'install', plugin.id, '--scope', 'user'],
      ]);
    } else if (state === 'no-prerequisite') {
      const { executable: needed, how } = prerequisite!;
      if (!named.has(needed)) session.say(w.noPrerequisite(needed, w.how[needed] ?? how));
      named.add(needed);
      session.say(w.needs(title, needed));
      record(session, 'skipped', w.needsWhat(title, needed));
    } else if (state === 'install') {
      const shown = install!.join(' ');
      session.say(w.notInstalled(title, executable));
      session.plan.push({
        heading: (words) => words.installHeading(title),
        body: `  ${shown}`,
        declined: w.install(title),
        apply() {
          session.say(w.running(shown));
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
  const { w } = session;
  const served = tools
    .filter(({ tool, state }) => tool.server && state !== 'declared-false' && state !== 'no-prerequisite')
    .map(({ tool }) => tool)
    .filter(({ title, server }) => {
      // A tool found on PATH may still lack what its server runs through, such as Graphify installed without uv.
      const needed = server!.prerequisite?.executable;
      if (!needed || onPath(needed)) return true;
      session.say(w.serverNeeds(title, needed, w.how[needed] ?? server!.prerequisite!.how));
      record(session, 'skipped', w.serverNeedsWhat(title, needed));
      return false;
    });
  for (const harness of harnesses) {
    const commands: string[][] = [];
    for (const { name, title, server } of served) {
      const what = w.server(title);
      const registered = registeredWith(harness.executable, session.root, name);
      // Serena with Claude Code's context in Codex: corrected where `codex mcp add` writes, the user's file; the repository's is the owner's.
      const userFile = registered !== null && mcpSources().user.some(({ file }) => file === registered);
      const claudeContext = registered !== null && harness.executable === 'codex' && name === 'serena' && hasClaudeContext(readFileSync(userFile ? registered : join(session.root, registered), 'utf8'));
      const replace = claudeContext && userFile;
      if (registered && !replace) {
        const context = claudeContext ? w.claudeContext : '';
        session.say(w.registered(what, harness.name, registered, context));
        record(session, 'found', w.registeredWhat(what, harness.name, registered, context));
        continue;
      }
      if (replace) session.say(w.withClaudeContext(what, harness.name, registered));
      const command = server!.command(harness.executable, session.root);
      const scope = server!.project ? 'project' : 'user';
      const add = harness.add?.(name, command, scope);
      if (add && onPath(harness.executable)) {
        if (replace) session.say(w.registersAgain(harness.name));
        commands.push(add);
        continue;
      }
      const why = !harness.add ? w.noAddCommand(harness.name) : !add ? w.projectOnly(title, harness.name) : w.offPath(harness.executable);
      const where = scope === 'project' ? w.intoProject(harness.name) : w.intoUser(harness.name);
      session.say(w.notRegistered(why, what, where, harness.entry(name, command).trimEnd()));
      record(session, 'printed', w.printedFor(what, harness.name));
    }
    if (commands.length === 0) continue;
    const shown = commands.map((argv) => argv.map(quoted).join(' '));
    session.plan.push({
      heading: (words) => words.serversHeading(harness.name),
      body: shown.map((line) => `  ${line}`).join('\n'),
      declined: w.registerWith(harness.name),
      apply() {
        commands.forEach(([executable, ...args], index) => {
          session.say(w.running(shown[index]!));
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
  const { w } = session;
  const address = daemonAddress(home);
  for (const exporter of exporters()) {
    const why = detected(exporter, w);
    if (why === null) continue;
    const { name, file } = exporter;
    const what = w.export(name);
    const where = tilde(file);
    if (address === null) {
      session.say(w.noAddress(name, why));
      record(session, 'skipped', w.noAddressWhat(what));
      continue;
    }
    const text = settingsText(file);
    const state = exporter.read(text, address);
    if (state.state === 'binnacle') {
      session.say(w.exportsToBinnacle(name, address, where));
      record(session, 'skipped', w.exportsToBinnacleWhat(what));
      continue;
    }
    if (state.state === 'elsewhere') {
      session.say(w.exportsElsewhere(name, where, state.what));
      record(session, 'skipped', w.exportsElsewhereWhat(what, where, state.what));
      continue;
    }
    const change = exporter.change(address);
    if (state.state === 'unreadable') {
      session.say(w.settingsUnreadable(where, name, state.why, change.trimEnd()));
      record(session, 'printed', w.printedFor(what, where));
      continue;
    }
    session.say(w.noExport(name, why));
    const merges = exporter.how === 'merging into';
    session.plan.push({
      heading: (words) => words.exportHeading(name, address, merges, where),
      body: change,
      declined: w.configure(what),
      apply() {
        // Only the settings the human saw: a file that changed since it was read is not written.
        if (settingsText(file) !== text) throw new Changed();
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, exporter.next(text, address), { flag: text === null ? 'wx' : 'w' });
        record(session, text === null ? 'created' : 'updated', where);
      },
    });
  }
  for (const harness of NO_EXPORT) {
    if (detected(harness) === null) continue;
    const reason = w.noExportReason(harness);
    session.say(w.cannotExport(harness.name, reason));
    record(session, 'skipped', w.cannotExportWhat(harness.name, reason));
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
  if (await isGraphIgnored(session.root)) session.say(session.w.graphIgnored(GRAPH_DIRECTORY));
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
  const { w } = session;
  const what = w.vault;
  const file = settingsPath(home);
  const unreadable = (): void => {
    session.say(w.vaultUnreadable(file));
    record(session, 'skipped', `${what}: ${w.vaultUnreadableWhat(file)}`);
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
    session.say(w.vaultSet(file, typeof set === 'string' ? set : JSON.stringify(set), usable));
    return record(session, 'skipped', `${what}: ${w.vaultSetWhat(file)}`);
  }

  const vaults = obsidianVaults();
  if (vaults.length !== 1) {
    session.say(w.vaultHow(vaults, file, json({ obsidian: { vaultPath: '/absolute/path/to/vault' } }).trimEnd()));
    return record(session, 'skipped', `${what}: ${w.vaultHowWhat(vaults.length === 0, file)}`);
  }

  const next = json({ ...settings, obsidian: { ...obsidian, vaultPath: vaults[0] } });
  session.say(w.vaultOne(vaults[0]!, file));
  session.plan.push({
    heading: (words) => words.vaultHeading(file),
    body: next,
    declined: w.vaultDeclined,
    apply() {
      ensureHome(home);
      // Only the settings the human saw: a file that changed since it was read is not rewritten.
      if ((existsSync(file) ? readFileSync(file, 'utf8') : null) !== text) throw new Changed();
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
  const { w } = session;
  session.say(w.graphIntro);
  session.plan.push({
    heading: (words) => words.graphHeading(GRAPH_DIRECTORY),
    body: `  ${shown}\n  ${report}`,
    declined: w.graphDeclined,
    async apply() {
      // The `.gitignore` append of step 10 failed: Graphify would leave untracked files in the repository (ADR-0036).
      if ((await isGraphIgnored(session.root)) === false) return record(session, 'skipped', w.graphNotIgnored(GRAPH_DIRECTORY));
      // Its install in this plan failed, or put it in a directory that is not on PATH.
      if (!onPath('graphify')) return record(session, 'skipped', w.graphOffPath);
      const built = runGraphify(session, GRAPH_EXTRACT, w.graphLater);
      if (built) runGraphify(session, GRAPH_CLUSTER, w.reportLater);
    },
  });
}

/** Runs `graphify` with `args` in the repository root and records the outcome; `failed` follows a failure's reason. */
function runGraphify(session: Session, args: string[], failed: string): boolean {
  const shown = `graphify ${args.join(' ')}`;
  session.say(session.w.running(shown));
  // Its progress is shown as it comes; stderr is kept for a failure's reason, and shown after. The daemon's ceiling for one step.
  const run = spawnSync('graphify', args, { cwd: session.root, encoding: 'utf8', stdio: ['ignore', 'inherit', 'pipe'], timeout: GRAPH_RUN_TIMEOUT_MS });
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.status === 0) {
    record(session, 'ran', shown);
    return true;
  }
  const told = run.error?.message || run.stderr?.trim().split('\n').at(-1)?.trim();
  record(session, 'failed', session.w.graphFailed(shown, told ? session.w.foreign(told) : session.w.graphExited(run.status), failed));
  return false;
}
