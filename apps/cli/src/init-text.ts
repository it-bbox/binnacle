import type { Language } from '@binnacle/core';
import { counted, NO_EXPORT_RU, setsRu, staleRu } from './audit-text.ts';
import { describeSets } from './layout.ts';

/**
 * `binn init`'s own text (spec `human-output`, *`binn`'s own text*, *`binn init`'s Summary*): its
 * dialogue, questions, notes, plan headings, warnings and Summary, in English and in Russian, with
 * `CONTEXT.md`'s Russian words. The interactive form speaks the person's language; `--plan --json`
 * keeps its headings and notes English, so that the plan's id is the same under either locale and
 * the chat words the notes. Commands, paths, flags and names are never translated.
 */

export type Outcome = 'created' | 'extended' | 'updated' | 'printed' | 'ran' | 'found' | 'checked' | 'failed' | 'declined' | 'skipped' | 'warned';

/** Why Claude Code could not be asked for its plugins. */
export type NoClaude = 'undetected' | 'offPath' | 'failed';

/** What the Summary opens with: the command to run next. */
export type Next = { kind: 'init' | 'fixManifest' | 'startDaemon' | 'register' | 'claudeCode' | 'audit' } | { kind: 'harness'; name: string };

/** Names as a sentence lists them: `A`, `A and B`, `A, B and C`. */
const listed =
  (and: string) =>
  (names: string[]): string =>
    names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')}${and}${names.at(-1)}`;

const LISTING = 'claude plugin list --json';
const LATER = (on: string) => `${on} turns it on later`;
const LATER_RU = (on: string) => `${on} включит его позже`;

const en = {
  outcome: {
    created: 'created',
    extended: 'extended',
    updated: 'updated',
    printed: 'printed',
    ran: 'ran',
    found: 'found',
    checked: 'checked',
    failed: 'failed',
    declined: 'declined',
    skipped: 'skipped',
    warned: 'warned',
  } as Record<Outcome, string>,
  inSentence: listed(' and '),
  /** Text a library or the system wrote, marked when it is not in this language. */
  foreign: (text: string) => text,

  notGit: (reason: string) => `${reason} binn init works at the root of a Git repository.`,
  setUp: (root: string) => `Setting up Binnacle in ${root}. Nothing is written until you have seen the whole plan and confirmed it.\n`,
  planChanged: 'the plan is not the one confirmed, so nothing is written. Run binn init --plan --json to see it, and confirm it again.',
  nothingToWrite: 'There is nothing to write.',

  summary: 'Summary:',
  next: (next: Next, manifest: string): string =>
    next.kind === 'harness'
      ? `Next, in ${next.name}:`
      : {
          init: 'Next, to write the plan, at a terminal:',
          fixManifest: `Next, once ${manifest} is fixed:`,
          startDaemon: 'Next, start the daemon and register the project:',
          register: 'Next, register the project with the daemon autostart started:',
          claudeCode: 'Next, in a new Claude Code session:',
          audit: 'Next, to see how far this repository is from the way Binnacle works:',
        }[next.kind],
  notCommitted: 'Nothing was committed. Review what binn init wrote, and commit it yourself.',
  audit: 'To see how far this repository is from the way Binnacle works, run `binn audit`. It reads and writes nothing.',
  skillsInto: (into: string, skipped: string | null) => `Binnacle's skills are installed into ${into}${skipped ? `, then removed from ${skipped}` : ''}: run \`binnacle-product\` there.`,
  toWorkFrom: (name: string) => `\nTo work from ${name}, once its configuration names binnacle:`,
  runProduct: (name: string) => `Run \`binnacle-product\` in ${name}.`,
  onceSkills: (name: string) => `Once binn init has installed Binnacle's skills, run \`binnacle-product\` in ${name}.`,
  /** Each harness's own steps, by its executable. */
  harness: {
    claude: {
      note: "Claude Code reads .mcp.json only when a session starts: once it is written, open a new session in the repository and approve the project's binnacle server when Claude Code offers it.",
    },
    codex: {
      note: 'Codex reads .codex/config.toml only in a trusted project: trust this project in Codex for the entry to take effect.',
      open: 'Run `codex` in the repository root, or open the repository in the Codex desktop app.',
      offPath: '`codex` is not on PATH. The Codex desktop app ships its CLI outside it; on Linux it is /usr/lib/chatgpt/resources/codex.',
    },
    opencode: { open: 'Run `opencode` in the repository root.' },
    code: { open: 'Open the repository in VS Code, start the binnacle server listed in .vscode/mcp.json and chat in agent mode.' },
  } as Record<string, { note?: string; open?: string; offPath?: string }>,

  planIntro: 'The plan. Nothing is written until you confirm it:\n',
  nothingWritten: (why: string) => `${why} Nothing is written.`,
  noTerminal: 'stdin is not a terminal, so there is no one to confirm the plan.',
  planDeclined: 'The plan was declined.',
  writePlan: 'Write this plan? [Y/n] ',
  changedSince: 'the file changed since the plan was shown',
  running: (command: string) => `Running ${command}...`,

  create: (path: string) => `Create ${path}`,
  createWhat: (path: string) => `create ${path}`,
  append: (path: string) => `Append to the end of ${path}`,
  appendWhat: (path: string) => `append to ${path}`,
  jsonExists: (path: string, text: string) => `${path} exists, and binn init never rewrites a JSON file. Add this yourself:\n\n${text}`,
  entryFor: (path: string) => `the entry for ${path}`,

  manifestValid: (manifest: string) => `${manifest} exists and is valid. It is left as it is.`,
  manifestExists: (manifest: string) => `${manifest}: it exists`,
  manifestMissing: (manifest: string) => `There is no ${manifest}. A new one is proposed in the plan.`,
  manifestProblems: (manifest: string) => `${manifest} exists and has problems. It is left as it is; fix it by hand.`,
  manifestWithProblems: (manifest: string) => `${manifest}: it exists, with problems`,

  window: 'import window',
  history: 'Session history in this repository, which Binnacle imports for its usage figures:',
  sessions: (count: number, oldest: string | null) => (count === 0 ? 'no sessions' : `${count} session${count === 1 ? '' : 's'}, the oldest from ${oldest}`),
  windowDeclared: (manifest: string, days: number | 'all') => `${manifest} declares telemetry.import.window_days: ${days}. It is left as it is.`,
  windowDeclaredWhat: (manifest: string, days: number | 'all') => `${manifest} declares ${days}`,
  windowAsk: (days: number, manifest: string, isNew: boolean) =>
    `How much of it should Binnacle import? ${days} days (the default), another number of days, or all. ` +
    (isNew ? `The answer goes into the new ${manifest} in the plan, as telemetry.import.window_days.` : `${manifest} exists, so the line to add is printed and nothing is written.`),
  windowPrompt: (days: number) => `Import window [${days}]: `,
  windowNoAnswer: (days: number) => `No answer: Binnacle imports the default of ${days} days, and the manifest declares none.`,
  windowNoAnswerWhat: (days: number) => `no answer, so the default of ${days} days applies`,
  windowAgain: (days: number) => `Answer ${days}, a number of days, or all.`,
  addYourself: (manifest: string, section: string) => `Add this to ${manifest} yourself:\n\n${section}`,
  windowLine: (manifest: string) => `the telemetry.import.window_days line for ${manifest}`,

  languageDeclared: (manifest: string) => `${manifest} declares knowledge.language. It is left as it is.\n`,
  languageDeclaredWhat: (manifest: string) => `documentation language: ${manifest} declares it`,
  languageAsk: (proposal: Language, readme: boolean, manifest: string, isNew: boolean) =>
    `Binnacle proposes ${proposal} as this repository's documentation language, from ${readme ? 'README.md' : 'your locale, as there is no README.md'}. Answer en or ru. ` +
    (isNew
      ? `The answer goes into the new ${manifest} in the plan, as knowledge.language.`
      : `${manifest} exists, so the line to add is printed when the answer is not en, and nothing is written.`),
  languagePrompt: (proposal: Language) => `Documentation language [${proposal}]: `,
  languageAgain: 'Answer en or ru.',
  languageAdd: (manifest: string, language: Language) => `Add this to ${manifest} yourself, in its knowledge section:\n\nknowledge:\n  language: ${language}\n`,
  languageLine: (manifest: string) => `the knowledge.language line for ${manifest}`,

  autostart: 'autostart',
  autostartOn: (home: string) => `The daemon already starts at login for ${home}.`,
  autostartOnWhat: (home: string) => `it is on for ${home}`,
  autostartBroken: (home: string, missing: string[], on: string) => `Autostart is broken for ${home}: ${missing.join(' and ')} no longer exists. Repair it with ${on}.`,
  autostartBrokenWhat: (on: string) => `broken, ${on} repairs it`,
  autostartUnavailable: (reason: string) => `Autostart is not available here: ${reason}.`,
  autostartUnavailableWhat: (reason: string) => `not available here, ${reason}`,
  asksNothing: (on: string) => `This form of binn init asks nothing, so the daemon is not set to start at login: ${LATER(on)}.`,
  asksNothingWhat: (on: string) => `not asked, ${LATER(on)}`,
  noTerminalAutostart: (on: string) => `With no terminal to ask, the daemon is not set to start at login: ${LATER(on)}.`,
  noTerminalAutostartWhat: (on: string) => `no terminal to ask, ${LATER(on)}`,
  autostartPrompt: 'Start the daemon at login? [Y/n] ',
  autostartDeclined: (on: string) => `The daemon is not set to start at login: ${LATER(on)}.`,
  autostartDeclinedWhat: (on: string) => `declined, ${LATER(on)}`,
  autostartInPlan: 'Turning autostart on is in the plan, as its last item.',
  autostartHeading: (home: string) => `Start the Binnacle daemon at login, and again when it fails, through this user's service manager, for ${home}, outside the repository, by running`,
  autostartLater: (on: string) => `autostart: ${LATER(on)}`,

  registration: 'project registration',
  noUsableManifest: (manifest: string, root: string) => `There is no usable ${manifest}, so the project is not registered. Once there is, run \`binn project register\` from ${root}.`,
  noUsableManifestWhat: 'no usable manifest',
  daemonNotRunning: (root: string) => `The Binnacle daemon is not running, so the project is not registered. From ${root}, run:\n\n  binn daemon start\n  binn project register`,
  daemonNotRunningWhat: 'the daemon is not running',
  registerHeading: 'Register the project with the running Binnacle daemon, outside the repository',

  noHarness: (names: string) => `No known harness is installed (${names}).\n`,
  harnessInstalled: (name: string, why: string, file: string) => `${name} is installed (${why}). It reads this project's MCP servers from ${file}.`,
  namesBinnacle: (file: string) => `${file} already names binnacle. It is left as it is.`,
  namesBinnacleWhat: (file: string) => `${file}: it already names binnacle`,
  generic: (snippet: string) => `For any other harness that speaks MCP, register a stdio server named binnacle that runs \`binn mcp\`, for example:\n\n${snippet}`,

  plugin: 'the binnacle plugin',
  ownPlugin: (own: string) => `The project provides its own binnacle plugin, at ${own}, so no copy is installed.`,
  ownPluginWhat: (own: string) => `the project provides its own, at ${own}`,
  noClaude: { undetected: 'Claude Code is not detected', offPath: '`claude` is not on PATH', failed: `\`${LISTING}\` failed` } as Record<NoClaude, string>,
  noPlugin: (reason: string) => `${reason}, so the binnacle plugin is not installed.`,
  pluginListed: (id: string) => `Claude Code already lists ${id}. It is left as it is.`,
  pluginListedWhat: (id: string) => `Claude Code already lists ${id}`,
  pluginHeading: 'Install the binnacle plugin from this Binnacle package, at user scope, outside the repository, by running',
  asking: `Asking Claude Code for its plugins (${LISTING})...`,
  listingFailed: (stderr: string) => `\`${LISTING}\` failed, so no Claude Code plugin is installed.${stderr ? `\n${stderr}` : ''}`,

  binnacleSkills: "Binnacle's skills",
  binnaclePlugin: 'the binnacle plugin',
  itsPlugin: 'its plugin',
  skillsNoHarness: (sets: string) =>
    `No harness is detected, so ${sets} are not installed: the skills CLI would install into every harness it knows. Install a harness, then run binn init again.`,
  noHarnessWhat: 'no harness is detected',
  skillsCurrent: (what: string, where: string) => `${what} in ${where} are current. The plan installs them again, so that a harness installed since they were gets them.`,
  current: 'current',
  skillsStale: (what: string, where: string, stale: { reason: string; differ: { skill: string; version: string | null }[]; missing: string[]; version: string | null }) =>
    `${what} in ${where} are stale: ${stale.reason}. The plan installs them again.`,
  noNpx: (what: string, body: string) => `\`npx\` is not on PATH, so binn init does not install ${what}. Once it is, run:\n\n${body}\n`,
  noNpxWhat: '`npx` is not on PATH',
  skillsHeading: (what: string, source: string | null, has: string, skipped: string | null) =>
    `Install ${what}${source ? ` from ${source}` : ''} into every harness the skills CLI detects, at user scope, outside the repository, then remove them from Claude Code, which has ${has}` +
    `${skipped ? `, and from ${skipped}` : ''}, by running`,
  install: (what: string) => `install ${what}`,
  installEverywhere: (what: string) => `install ${what} into every harness`,
  addNamedNone: 'its add named no skills it installed',
  addFailed: 'its add failed',
  notRemoved: (what: string, why: string) => `${what} are not removed from Claude Code: ${why}.`,
  notRemovedWhat: (what: string, why: string) => `removing ${what} from Claude Code: ${why}`,
  commandFailed: (command: string, output: string) => `${command} failed${output ? `:\n${output}` : '.'}`,
  notEveryHarness: (command: string, what: string, reasons: string[]) => `${command} installed ${what}, but not into every harness:\n${reasons.join('\n')}`,
  forAHarness: (what: string, reason: string) => `${what} for a harness: ${reason}`,

  noIssues: (issues: string) => `The tracker reads tickets from ${issues}/, which does not exist. The plan creates it.`,
  noDocs: (manifest: string) => `${manifest} declares no knowledge.docs, so Binnacle reads no roadmap. Declare it to have one.`,
  noDocsWhat: (manifest: string) => `the roadmap: ${manifest} declares no knowledge.docs`,
  noRoadmap: (path: string) => `There is no roadmap at ${path}. The plan creates a skeleton in Binnacle's format.`,
  roadmapInFormat: (path: string) => `${path} is in Binnacle's format. It is left as it is.`,
  roadmapExists: (path: string) => `${path}: it exists`,
  roadmapNotInFormat: (path: string, gaps: string) => `${path} is not in Binnacle's format, and binn init never rewrites it. ${gaps}`,
  roadmapNotInFormatWhat: (path: string) => `${path}: it exists, and is not in Binnacle's format; binn audit names what is missing`,

  conventions: (paths: string) => `The planning skills read their conventions from ${paths}, which the plan creates.`,
  ticketHeaderHas: (file: string) => `ticket-header section: ${file} has it`,
  agentSkillsHas: (file: string) => `the Agent skills block: ${file} has it`,
  noInstructions: 'There is no AGENTS.md or CLAUDE.md, so there are no agent instructions to report.',
  instructions: (sets: string[][]) => `Agent instructions: ${sets.length === 1 ? 'one instruction set' : 'two instruction sets'}: ${describeSets(sets)}.`,

  noTrackerManifest: 'There is no usable manifest, so no tracker is checked.',
  notRemote: 'The tracker is not a remote one, so there is nothing to check.',
  trackerOf: (provider: string) => `the ${provider} tracker`,
  shellService: (variable: string) =>
    `\nThis check used ${variable} from this shell. The daemon starts through the service manager, which does not carry it, so use the credentials file.`,
  shell: (variable: string) =>
    `\nThis check used ${variable} from this shell. The daemon reads it only from the environment it starts with, so start it from a shell that has it, or use the credentials file.`,
  reading: (name: string) => `Reading ${name}...`,
  readable: (name: string, count: number, shell: string) => `${name} is readable: ${count} issues read.${shell}`,
  readableWhat: 'tracker: readable',
  unreadable: (name: string, message: string) => `${name} could not be read. ${message}`,
  unreadableWhat: (message: string) => `tracker check: ${message}`,
  githubToken: (repository: string) =>
    `On GitHub, create a fine-grained personal access token with read-only access to the issues of ${repository} ` +
    '(Settings, Developer settings, Personal access tokens, Fine-grained tokens; Repository permissions, Issues: Read-only), ' +
    "and Actions, Commit statuses and Pull requests: Read-only for the snapshot's CI.",
  gitlabToken:
    "On GitLab, create a personal, group or project access token with the read_api scope and nothing else (User settings, or the project's Settings, then Access tokens).",
  tokenWhere: (how: string, variable: string, file: string, key: string, generic: string, shell: string) =>
    `\n${how} A public repository needs none.\n` +
    `Put it in ${variable} in the environment the daemon starts with, or in ${file} ` +
    `under the key ${key}, owner-only (chmod 600). ` +
    `Generic variables such as ${generic} are not read: they commonly hold tokens that can write. ` +
    `Binnacle's docs/operations/05-installation-checklist.md, under Tracker credentials, has the details.${shell}`,

  toolOnPath: (executable: string) => `${executable} is on PATH`,
  toolListed: (id: string) => `Claude Code lists ${id}`,
  toolNoChannel: (reason: string) => `a Claude Code plugin, and ${reason}`,
  declaredFalse: (manifest: string, name: string, title: string) => `${manifest} declares ${name}: false, so ${title} is not proposed.`,
  declaredFalseWhat: (title: string, manifest: string) => `${title}: ${manifest} declares it false`,
  toolFound: (title: string, why: string) => `${title} is installed (${why}). It is left as it is.`,
  toolWhy: (title: string, why: string) => `${title}: ${why}`,
  noChannel: (title: string, why: string) => `${title} is ${why}, so its Claude Code plugin is not installed.`,
  notListed: (title: string) => `Claude Code does not list ${title}. Its install is in the plan.`,
  pluginInstallHeading: (title: string) => `Install ${title}'s Claude Code plugin, at user scope, outside the repository, by running`,
  noPrerequisite: (needed: string, how: string) => `${needed} is not on PATH, and binn init does not install it. Install it with ${how}, then run binn init again.`,
  /** How a prerequisite is installed, by its executable, where the table's own words are not this language's. */
  how: {} as Record<string, string>,
  needs: (title: string, needed: string) => `${title} needs ${needed}, so it is not proposed.`,
  needsWhat: (title: string, needed: string) => `${title}: ${needed} is not on PATH`,
  notInstalled: (title: string, executable: string | undefined) => `${title} is not installed (no ${executable} on PATH). Its install is in the plan.`,
  installHeading: (title: string) => `Install ${title}, outside the repository, by running`,

  server: (title: string) => `${title}'s MCP server`,
  serverNeeds: (title: string, needed: string, how: string) => `${title}'s MCP server runs through ${needed}, which is not on PATH, so it is not registered. Install it with ${how}.`,
  serverNeedsWhat: (title: string, needed: string) => `${title}'s MCP server: ${needed} is not on PATH`,
  claudeContext: ", with Claude Code's context",
  registered: (what: string, harness: string, file: string, context: string) => `${what} is already registered with ${harness}, in ${file}${context}. It is left as it is.`,
  registeredWhat: (what: string, harness: string, file: string, context: string) => `${what}: registered with ${harness} in ${file}${context}`,
  withClaudeContext: (what: string, harness: string, file: string) => `${what} is registered with ${harness} in ${file} with Claude Code's context.`,
  registersAgain: (harness: string) => `The plan registers it again with ${harness}'s, which replaces it.`,
  noAddCommand: (harness: string) => `${harness} has no command for adding an MCP server`,
  projectOnly: (title: string, harness: string) =>
    `${title} serves this project only, and ${harness} keeps per-project servers only in the repository, which binn init does not write for it`,
  offPath: (executable: string) => `\`${executable}\` is not on PATH`,
  intoProject: (harness: string) => `this project's ${harness} configuration yourself, if you want it in the repository`,
  intoUser: (harness: string) => `${harness}'s user configuration yourself`,
  notRegistered: (why: string, what: string, where: string, entry: string) => `${why}, so binn init does not register ${what} with it. Add this to ${where}:\n\n${entry}\n`,
  printedFor: (what: string, where: string) => `${what} for ${where}`,
  serversHeading: (harness: string) => `Register MCP servers with ${harness}, outside the repository, by running`,
  registerWith: (harness: string) => `register MCP servers with ${harness}`,

  export: (name: string) => `${name}'s OpenTelemetry export`,
  noAddress: (name: string, why: string) =>
    `${name} is installed (${why}), but the Binnacle daemon is not running and BINNACLE_PORT is 0, so there is no address to export to. Start the daemon, then run binn init again.`,
  noAddressWhat: (what: string) => `${what}: the daemon's address is not known`,
  exportsToBinnacle: (name: string, address: string, where: string) => `${name} already exports OpenTelemetry to Binnacle at ${address}, in ${where}. It is left as it is.`,
  exportsToBinnacleWhat: (what: string) => `${what}: it already exports to Binnacle`,
  exportsElsewhere: (name: string, where: string, settings: string) => `${name} already has OpenTelemetry settings of its own in ${where}: ${settings}. They are left as they are.`,
  exportsElsewhereWhat: (what: string, where: string, settings: string) => `${what}: ${where} already has settings of its own (${settings})`,
  settingsUnreadable: (where: string, name: string, why: string, change: string) =>
    `${where} cannot be read as ${name}'s settings: ${why}. binn init does not rewrite it. To export to Binnacle, add this yourself:\n\n${change}\n`,
  noExport: (name: string, why: string) => `${name} is installed (${why}) and does not export OpenTelemetry. Pointing it at the Binnacle daemon is in the plan.`,
  exportHeading: (name: string, address: string, merges: boolean, where: string) =>
    `Export ${name}'s OpenTelemetry to the Binnacle daemon at ${address}, JSON over HTTP, prompts not logged, at user scope, outside the repository, ` +
    `by ${merges ? 'merging into' : 'appending to'} ${where}${merges ? ', keeping the rest of it' : ''}`,
  configure: (what: string) => `configure ${what}`,
  cannotExport: (name: string, reason: string) => `${name} is not configured to export OpenTelemetry: ${reason}.`,
  cannotExportWhat: (name: string, reason: string) => `${name}'s OpenTelemetry export: ${reason}`,
  noExportReason: ({ reason }: { code: string; reason: string }) => reason,

  graphIgnored: (directory: string) => `Git already ignores ${directory}/, Graphify's output directory, so .gitignore is left as it is.`,
  graphIntro: 'Graphify builds the first graph and its report in the plan, code-only: no API key, no model.',
  graphHeading: (directory: string) => `Build the first graph and its report into ${directory}/, code-only, with no API key and no model, by running in the repository root`,
  graphDeclined: 'build the first graph',
  graphNotIgnored: (directory: string) => `the first graph: Git does not ignore ${directory}/`,
  graphOffPath: 'the first graph: graphify is not on PATH. The Binnacle daemon builds the graph once it is.',
  graphLater: 'The Binnacle daemon builds the graph once graphify runs.',
  reportLater: 'The graph is kept, and the Binnacle daemon builds the report with its next graph run.',
  graphFailed: (shown: string, reason: string, later: string) => `${shown}: ${reason}. ${later}`,
  graphExited: (status: number | null) => `graphify exited with code ${status}`,

  vault: 'the Obsidian vault',
  vaultUnreadable: (file: string) => `${file} cannot be read as a JSON object of settings, so no vault path is proposed. Fix it by hand.`,
  vaultUnreadableWhat: (file: string) => `${file} cannot be read`,
  vaultSet: (file: string, set: string, usable: boolean) =>
    `${file} already names the Obsidian vault ${set}. It is left as it is` + (usable ? '.' : `, though it is not an absolute path, so the daemon projects nothing; fix it by hand.`),
  vaultSetWhat: (file: string) => `${file} names one`,
  vaultHow: (vaults: string[], file: string, snippet: string) =>
    `${vaults.length === 0 ? 'Obsidian lists no vault on this machine' : `Obsidian lists ${vaults.length} vaults on this machine: ${listed(' and ')(vaults)}`}, so no vault path is proposed. ` +
    `For the Binnacle daemon to project the Project Brain into a vault, put its absolute path in ${file}, owner-only (chmod 600):\n\n${snippet}`,
  vaultHowWhat: (none: boolean, file: string) => `${none ? 'Obsidian lists none' : 'Obsidian lists several'}; set obsidian.vaultPath in ${file}`,
  vaultOne: (vault: string, file: string) => `Obsidian lists one vault on this machine, ${vault}. Setting it is in the plan; for another, decline the plan and edit ${file}.`,
  vaultHeading: (file: string) => `Set the Obsidian vault in ${file}, owner-only, outside the repository, to`,
  vaultDeclined: 'set the Obsidian vault',
};

export type InitText = typeof en;

const ru: InitText = {
  outcome: {
    created: 'создан',
    extended: 'дополнен',
    updated: 'обновлён',
    printed: 'напечатано',
    ran: 'выполнено',
    found: 'найдено',
    checked: 'проверено',
    failed: 'ошибка',
    declined: 'отклонено',
    skipped: 'пропущено',
    warned: 'внимание',
  },
  inSentence: listed(' и '),
  foreign: (text) => `${text} (англ.)`,

  notGit: (reason) => `${reason} binn init работает в корне Git-репозитория.`,
  setUp: (root) => `Настраиваем Binnacle в ${root}. Ничего не записывается, пока вы не увидите весь план и не подтвердите его.\n`,
  planChanged: 'план уже не тот, что был подтверждён, поэтому ничего не записано. Запустите binn init --plan --json, чтобы увидеть его, и подтвердите заново.',
  nothingToWrite: 'Записывать нечего.',

  summary: 'Итог:',
  next: (next, manifest) =>
    next.kind === 'harness'
      ? `Дальше, в ${next.name}:`
      : {
          init: 'Дальше, чтобы записать план, в терминале:',
          fixManifest: `Дальше, когда ${manifest} будет исправлен:`,
          startDaemon: 'Дальше запустите демон и зарегистрируйте проект:',
          register: 'Дальше зарегистрируйте проект в демоне, который запустил автозапуск:',
          claudeCode: 'Дальше, в новой сессии Claude Code:',
          audit: 'Дальше, чтобы увидеть, насколько этот репозиторий далёк от того, как работает Binnacle:',
        }[next.kind],
  notCommitted: 'Ничего не закоммичено. Просмотрите, что записал binn init, и закоммитьте сами.',
  audit: 'Чтобы увидеть, насколько этот репозиторий далёк от того, как работает Binnacle, запустите `binn audit`. Он ничего не записывает.',
  skillsInto: (into, skipped) => `Скиллы Binnacle поставлены в ${into}${skipped ? `, затем удалены из ${skipped}` : ''}: запускайте там \`binnacle-product\`.`,
  toWorkFrom: (name) => `\nЧтобы работать из ${name}, когда его конфигурация назовёт binnacle:`,
  runProduct: (name) => `Запустите \`binnacle-product\` в ${name}.`,
  onceSkills: (name) => `Когда binn init поставит скиллы Binnacle, запустите \`binnacle-product\` в ${name}.`,
  harness: {
    claude: {
      note: 'Claude Code читает .mcp.json только при старте сессии: когда файл будет записан, откройте в репозитории новую сессию и одобрите сервер binnacle проекта, когда Claude Code его предложит.',
    },
    codex: {
      note: 'Codex читает .codex/config.toml только в доверенном проекте: чтобы запись заработала, отметьте этот проект в Codex как доверенный.',
      open: 'Запустите `codex` в корне репозитория или откройте репозиторий в приложении Codex.',
      offPath: '`codex` нет в PATH. Приложение Codex держит свой CLI вне PATH; на Linux это /usr/lib/chatgpt/resources/codex.',
    },
    opencode: { open: 'Запустите `opencode` в корне репозитория.' },
    code: { open: 'Откройте репозиторий в VS Code, запустите сервер binnacle из .vscode/mcp.json и пишите в чат в режиме агента.' },
  },

  planIntro: 'План. Ничего не записывается, пока вы его не подтвердите:\n',
  nothingWritten: (why) => `${why} Ничего не записано.`,
  noTerminal: 'stdin — не терминал, поэтому подтвердить план некому.',
  planDeclined: 'План отклонён.',
  writePlan: 'Записать этот план? [Y/n] ',
  changedSince: 'файл изменился после того, как был показан план',
  running: (command) => `Выполняется ${command}...`,

  create: (path) => `Создать ${path}`,
  createWhat: (path) => `создать ${path}`,
  append: (path) => `Дописать в конец ${path}`,
  appendWhat: (path) => `дописать в ${path}`,
  jsonExists: (path, text) => `${path} уже есть, а JSON-файлы binn init не переписывает. Добавьте сами:\n\n${text}`,
  entryFor: (path) => `запись для ${path}`,

  manifestValid: (manifest) => `${manifest} на месте и корректен. Он остаётся как есть.`,
  manifestExists: (manifest) => `${manifest}: уже есть`,
  manifestMissing: (manifest) => `${manifest} нет. Новый предложен в плане.`,
  manifestProblems: (manifest) => `${manifest} на месте, но с ошибками. Он остаётся как есть; исправьте его вручную.`,
  manifestWithProblems: (manifest) => `${manifest}: уже есть, с ошибками`,

  window: 'окно импорта',
  history: 'История сессий в этом репозитории, которую Binnacle импортирует для расхода токенов:',
  sessions: (count, oldest) => (count === 0 ? 'сессий нет' : `${counted(count, ['сессия', 'сессии', 'сессий'])}, самая старая — от ${oldest}`),
  windowDeclared: (manifest, days) => `${manifest} задаёт telemetry.import.window_days: ${days}. Он остаётся как есть.`,
  windowDeclaredWhat: (manifest, days) => `${manifest} задаёт ${days}`,
  windowAsk: (days, manifest, isNew) =>
    `Сколько истории импортировать? ${days} дней (по умолчанию), другое число дней или all. ` +
    (isNew ? `Ответ попадёт в новый ${manifest} в плане, как telemetry.import.window_days.` : `${manifest} уже есть, поэтому строка для него будет напечатана, а не записана.`),
  windowPrompt: (days) => `Окно импорта [${days}]: `,
  windowNoAnswer: (days) => `Ответа нет: Binnacle импортирует ${days} дней по умолчанию, а манифест окна не задаёт.`,
  windowNoAnswerWhat: (days) => `ответа нет, действует окно по умолчанию — ${days} дней`,
  windowAgain: (days) => `Ответьте ${days}, числом дней или all.`,
  addYourself: (manifest, section) => `Добавьте в ${manifest} сами:\n\n${section}`,
  windowLine: (manifest) => `строка telemetry.import.window_days для ${manifest}`,

  languageDeclared: (manifest) => `${manifest} задаёт knowledge.language. Он остаётся как есть.\n`,
  languageDeclaredWhat: (manifest) => `язык документации: его задаёт ${manifest}`,
  languageAsk: (proposal, readme, manifest, isNew) =>
    `Binnacle предлагает ${proposal} как язык документации этого репозитория, ${readme ? 'по README.md' : 'по вашей локали, так как README.md нет'}. Ответьте en или ru. ` +
    (isNew
      ? `Ответ попадёт в новый ${manifest} в плане, как knowledge.language.`
      : `${manifest} уже есть, поэтому строка для него будет напечатана, если ответ не en, и ничего не запишется.`),
  languagePrompt: (proposal) => `Язык документации [${proposal}]: `,
  languageAgain: 'Ответьте en или ru.',
  languageAdd: (manifest, language) => `Добавьте в ${manifest} сами, в раздел knowledge:\n\nknowledge:\n  language: ${language}\n`,
  languageLine: (manifest) => `строка knowledge.language для ${manifest}`,

  autostart: 'автозапуск',
  autostartOn: (home) => `Демон для ${home} уже запускается при входе в систему.`,
  autostartOnWhat: (home) => `уже включён для ${home}`,
  autostartBroken: (home, missing, on) => `Автозапуск для ${home} сломан: ${missing.join(' и ')} больше нет. Почините автозапуск командой ${on}.`,
  autostartBrokenWhat: (on) => `сломан, ${on} его починит`,
  autostartUnavailable: (reason) => `Автозапуск здесь недоступен: ${reason}.`,
  autostartUnavailableWhat: (reason) => `недоступен здесь, ${reason}`,
  asksNothing: (on) => `Эта форма binn init ничего не спрашивает, поэтому демон не будет запускаться при входе в систему: ${LATER_RU(on)}.`,
  asksNothingWhat: (on) => `не спрошен, ${LATER_RU(on)}`,
  noTerminalAutostart: (on) => `Без терминала спросить некого, поэтому демон не будет запускаться при входе в систему: ${LATER_RU(on)}.`,
  noTerminalAutostartWhat: (on) => `спросить без терминала нельзя, ${LATER_RU(on)}`,
  autostartPrompt: 'Запускать демон при входе в систему? [Y/n] ',
  autostartDeclined: (on) => `Демон не будет запускаться при входе в систему: ${LATER_RU(on)}.`,
  autostartDeclinedWhat: (on) => `отклонён, ${LATER_RU(on)}`,
  autostartInPlan: 'Включение автозапуска — последний пункт плана.',
  autostartHeading: (home) => `Запускать демон Binnacle при входе в систему и снова, если он упадёт, через менеджер служб этого пользователя, для ${home}, вне репозитория, командой`,
  autostartLater: (on) => `автозапуск: ${LATER_RU(on)}`,

  registration: 'регистрация проекта',
  noUsableManifest: (manifest, root) => `Годного ${manifest} нет, поэтому проект не зарегистрирован. Когда он появится, запустите \`binn project register\` в ${root}.`,
  noUsableManifestWhat: 'годного манифеста нет',
  daemonNotRunning: (root) => `Демон Binnacle не запущен, поэтому проект не зарегистрирован. В ${root} запустите:\n\n  binn daemon start\n  binn project register`,
  daemonNotRunningWhat: 'демон не запущен',
  registerHeading: 'Зарегистрировать проект в запущенном демоне Binnacle, вне репозитория',

  noHarness: (names) => `Ни один известный клиент агента не установлен (${names}).\n`,
  harnessInstalled: (name, why, file) => `${name} установлен (${why}). MCP-серверы проекта он читает из ${file}.`,
  namesBinnacle: (file) => `${file} уже называет binnacle. Он остаётся как есть.`,
  namesBinnacleWhat: (file) => `${file}: уже называет binnacle`,
  generic: (snippet) => `Для любого другого клиента агента с MCP зарегистрируйте stdio-сервер binnacle, запускающий \`binn mcp\`, например:\n\n${snippet}`,

  plugin: 'плагин binnacle',
  ownPlugin: (own) => `У проекта свой плагин binnacle, в ${own}, поэтому копия не ставится.`,
  ownPluginWhat: (own) => `у проекта свой, в ${own}`,
  noClaude: { undetected: 'Claude Code не обнаружен', offPath: '`claude` нет в PATH', failed: `\`${LISTING}\` не удался` },
  noPlugin: (reason) => `${reason}, поэтому плагин binnacle не ставится.`,
  pluginListed: (id) => `Claude Code уже показывает ${id}. Он остаётся как есть.`,
  pluginListedWhat: (id) => `Claude Code уже показывает ${id}`,
  pluginHeading: 'Поставить плагин binnacle из этого пакета Binnacle, на уровне пользователя, вне репозитория, командами',
  asking: `Спрашиваем у Claude Code его плагины (${LISTING})...`,
  listingFailed: (stderr) => `\`${LISTING}\` не удался, поэтому плагины Claude Code не ставятся.${stderr ? `\n${stderr} (англ.)` : ''}`,

  binnacleSkills: 'скиллы Binnacle',
  binnaclePlugin: 'плагин binnacle',
  itsPlugin: 'их плагин',
  skillsNoHarness: (sets) =>
    `Клиент агента не обнаружен, поэтому ${sets} не ставятся: skills CLI поставил бы их во все клиенты, какие знает. Установите клиент агента и запустите binn init снова.`,
  noHarnessWhat: 'клиент агента не обнаружен',
  skillsCurrent: (what, where) => `В ${where} ${what} актуальны. План ставит их снова, чтобы их получил и клиент агента, установленный позже.`,
  current: 'актуальны',
  skillsStale: (what, where, stale) => `В ${where} ${what} устарели: ${staleRu(stale)}. План ставит их снова.`,
  noNpx: (what, body) => `\`npx\` нет в PATH, поэтому binn init не ставит ${what}. Когда он появится, запустите:\n\n${body}\n`,
  noNpxWhat: '`npx` нет в PATH',
  skillsHeading: (what, source, has, skipped) =>
    `Поставить ${what}${source ? ` из ${source}` : ''} во все клиенты агента, которые находит skills CLI, на уровне пользователя, вне репозитория, затем удалить их из Claude Code, где есть ${has}` +
    `${skipped ? `, и из ${skipped}` : ''}, командами`,
  install: (what) => `поставить ${what}`,
  installEverywhere: (what) => `поставить ${what} во все клиенты агента`,
  addNamedNone: 'установка не назвала ни одного поставленного скилла',
  addFailed: 'установка не удалась',
  notRemoved: (what, why) => `${what} не удалены из Claude Code: ${why}.`,
  notRemovedWhat: (what, why) => `удаление ${what} из Claude Code: ${why}`,
  commandFailed: (command, output) => `${command} не удалась${output ? `:\n${output}` : '.'}`,
  notEveryHarness: (command, what, reasons) => `${command} поставила ${what}, но не во все клиенты агента:\n${reasons.map((reason) => `${reason} (англ.)`).join('\n')}`,
  forAHarness: (what, reason) => `${what} для клиента агента: ${reason} (англ.)`,

  noIssues: (issues) => `Трекер читает тикеты из ${issues}/, а такого каталога нет. План его создаёт.`,
  noDocs: (manifest) => `${manifest} не задаёт knowledge.docs, поэтому Binnacle не читает роадмап. Задайте его, чтобы роадмап был.`,
  noDocsWhat: (manifest) => `роадмап: ${manifest} не задаёт knowledge.docs`,
  noRoadmap: (path) => `Роадмапа в ${path} нет. План создаёт заготовку в формате Binnacle.`,
  roadmapInFormat: (path) => `${path} в формате Binnacle. Он остаётся как есть.`,
  roadmapExists: (path) => `${path}: уже есть`,
  roadmapNotInFormat: (path, gaps) => `${path} не в формате Binnacle, а binn init его не переписывает. ${gaps}`,
  roadmapNotInFormatWhat: (path) => `${path}: уже есть, не в формате Binnacle; чего не хватает, скажет binn audit`,

  conventions: (paths) => `Скиллы планирования читают свои соглашения из ${paths}; план их создаёт.`,
  ticketHeaderHas: (file) => `раздел о заголовке тикета: он уже есть в ${file}`,
  agentSkillsHas: (file) => `блок Agent skills: он уже есть в ${file}`,
  noInstructions: 'Нет ни AGENTS.md, ни CLAUDE.md, поэтому об инструкциях агентов сказать нечего.',
  instructions: (sets) => `Инструкции агентов: ${sets.length === 1 ? 'один набор' : 'два набора'}: ${setsRu(sets)}.`,

  noTrackerManifest: 'Годного манифеста нет, поэтому трекер не проверяется.',
  notRemote: 'Трекер не удалённый, проверять нечего.',
  trackerOf: (provider) => `трекер ${provider}`,
  shellService: (variable) =>
    `\nЭта проверка взяла ${variable} из этой оболочки. Демон запускается через менеджер служб, который её не передаёт, поэтому используйте файл учётных данных.`,
  shell: (variable) =>
    `\nЭта проверка взяла ${variable} из этой оболочки. Демон читает её только из окружения, с которым запущен, поэтому запускайте его из оболочки, где она есть, или используйте файл учётных данных.`,
  reading: (name) => `Читаем ${name}...`,
  readable: (name, count, shell) => `${name} читается: прочитано задач — ${count}.${shell}`,
  readableWhat: 'трекер: читается',
  unreadable: (name, message) => `${name} не удалось прочитать. ${message}`,
  unreadableWhat: (message) => `проверка трекера: ${message}`,
  githubToken: (repository) =>
    `На GitHub создайте fine-grained personal access token с доступом только на чтение к issues ${repository} ` +
    '(Settings, Developer settings, Personal access tokens, Fine-grained tokens; Repository permissions, Issues: Read-only), ' +
    'а для CI в снимке проекта — Actions, Commit statuses и Pull requests: Read-only.',
  gitlabToken: 'На GitLab создайте personal, group или project access token со scope read_api и ничем больше (User settings или Settings проекта, затем Access tokens).',
  tokenWhere: (how, variable, file, key, generic, shell) =>
    `\n${how} Публичному репозиторию токен не нужен.\n` +
    `Положите его в ${variable} в окружении, с которым запускается демон, или в ${file} ` +
    `под ключом ${key}, с доступом только для владельца (chmod 600). ` +
    `Общие переменные вроде ${generic} не читаются: в них часто лежат токены с правом записи. ` +
    `Подробности — в docs/operations/05-installation-checklist.ru.md Binnacle, раздел «Учётные данные tracker».${shell}`,

  toolOnPath: (executable) => `${executable} есть в PATH`,
  toolListed: (id) => `Claude Code показывает ${id}`,
  toolNoChannel: (reason) => `плагин Claude Code, а ${reason}`,
  declaredFalse: (manifest, name, title) => `${manifest} задаёт ${name}: false, поэтому ${title} не предлагается.`,
  declaredFalseWhat: (title, manifest) => `${title}: ${manifest} задаёт false`,
  toolFound: (title, why) => `${title} установлен (${why}). Он остаётся как есть.`,
  toolWhy: (title, why) => `${title}: ${why}`,
  noChannel: (title, why) => `${title} — ${why}, поэтому его плагин Claude Code не ставится.`,
  notListed: (title) => `Claude Code не показывает ${title}. Его установка — в плане.`,
  pluginInstallHeading: (title) => `Поставить плагин Claude Code для ${title}, на уровне пользователя, вне репозитория, командами`,
  noPrerequisite: (needed, how) => `${needed} нет в PATH, а binn init его не ставит. Поставьте его: ${how}, затем запустите binn init снова.`,
  how: {
    npm: 'установите Node.js, с которым приходит npm (https://nodejs.org)',
    uv: '`pipx install uv`, `brew install uv` или `winget install --id=astral-sh.uv -e` (https://docs.astral.sh/uv/getting-started/installation/)',
  },
  needs: (title, needed) => `${title} нужен ${needed}, поэтому он не предлагается.`,
  needsWhat: (title, needed) => `${title}: ${needed} нет в PATH`,
  notInstalled: (title, executable) => `${title} не установлен (${executable} нет в PATH). Его установка — в плане.`,
  installHeading: (title) => `Поставить ${title}, вне репозитория, командой`,

  server: (title) => `MCP-сервер ${title}`,
  serverNeeds: (title, needed, how) => `MCP-сервер ${title} запускается через ${needed}, которого нет в PATH, поэтому он не регистрируется. Поставьте его: ${how}.`,
  serverNeedsWhat: (title, needed) => `MCP-сервер ${title}: ${needed} нет в PATH`,
  claudeContext: ', с контекстом Claude Code',
  registered: (what, harness, file, context) => `${what} уже зарегистрирован в ${harness}, в ${file}${context}. Он остаётся как есть.`,
  registeredWhat: (what, harness, file, context) => `${what}: зарегистрирован в ${harness}, в ${file}${context}`,
  withClaudeContext: (what, harness, file) => `${what} зарегистрирован в ${harness}, в ${file}, с контекстом Claude Code.`,
  registersAgain: (harness) => `План регистрирует его заново, с контекстом ${harness}, и это его заменит.`,
  noAddCommand: (harness) => `У ${harness} нет команды для добавления MCP-сервера`,
  projectOnly: (title, harness) => `${title} служит только этому проекту, а ${harness} держит серверы проекта только в репозитории, куда binn init для него не пишет`,
  offPath: (executable) => `\`${executable}\` нет в PATH`,
  intoProject: (harness) => `конфигурацию ${harness} этого проекта, если хотите хранить его в репозитории`,
  intoUser: (harness) => `пользовательскую конфигурацию ${harness}`,
  notRegistered: (why, what, where, entry) => `${why}, поэтому binn init не регистрирует там ${what}. Добавьте сами в ${where}:\n\n${entry}\n`,
  printedFor: (what, where) => `${what} для ${where}`,
  serversHeading: (harness) => `Зарегистрировать MCP-серверы в ${harness}, вне репозитория, командами`,
  registerWith: (harness) => `зарегистрировать MCP-серверы в ${harness}`,

  export: (name) => `экспорт OpenTelemetry из ${name}`,
  noAddress: (name, why) =>
    `${name} установлен (${why}), но демон Binnacle не запущен, а BINNACLE_PORT равен 0, поэтому адреса для экспорта нет. Запустите демон, затем снова binn init.`,
  noAddressWhat: (what) => `${what}: адрес демона неизвестен`,
  exportsToBinnacle: (name, address, where) => `${name} уже экспортирует OpenTelemetry в Binnacle по адресу ${address}, в ${where}. Он остаётся как есть.`,
  exportsToBinnacleWhat: (what) => `${what}: уже идёт в Binnacle`,
  exportsElsewhere: (name, where, settings) => `У ${name} уже есть свои настройки OpenTelemetry в ${where}: ${settings} (англ.). Они остаются как есть.`,
  exportsElsewhereWhat: (what, where, settings) => `${what}: в ${where} уже свои настройки (${settings} (англ.))`,
  settingsUnreadable: (where, name, why, change) =>
    `${where} не читается как настройки ${name}: ${why} (англ.). binn init его не переписывает. Чтобы экспортировать в Binnacle, добавьте сами:\n\n${change}\n`,
  noExport: (name, why) => `${name} установлен (${why}) и не экспортирует OpenTelemetry. Направить его в демон Binnacle — в плане.`,
  exportHeading: (name, address, merges, where) =>
    `Экспортировать OpenTelemetry из ${name} в демон Binnacle по адресу ${address}, JSON по HTTP, без записи промптов, на уровне пользователя, вне репозитория, ` +
    `${merges ? `слив в ${where} с сохранением остального` : `дописав в ${where}`}`,
  configure: (what) => `настроить ${what}`,
  cannotExport: (name, reason) => `${name} не настроен на экспорт OpenTelemetry: ${reason}.`,
  cannotExportWhat: (name, reason) => `экспорт OpenTelemetry из ${name}: ${reason}`,
  noExportReason: ({ code, reason }) => NO_EXPORT_RU[code] ?? `${reason} (англ.)`,

  graphIgnored: (directory) => `Git уже игнорирует ${directory}/, каталог вывода Graphify, поэтому .gitignore остаётся как есть.`,
  graphIntro: 'Graphify строит первый граф и его отчёт в плане, только по коду: без API-ключа и без модели.',
  graphHeading: (directory) => `Построить первый граф и его отчёт в ${directory}/, только по коду, без API-ключа и без модели, командами в корне репозитория`,
  graphDeclined: 'построить первый граф',
  graphNotIgnored: (directory) => `первый граф: Git не игнорирует ${directory}/`,
  graphOffPath: 'первый граф: graphify нет в PATH. Демон Binnacle построит граф, когда он появится.',
  graphLater: 'Демон Binnacle построит граф, когда graphify заработает.',
  reportLater: 'Граф сохранён, а отчёт демон Binnacle построит при следующем запуске графа.',
  graphFailed: (shown, reason, later) => `${shown}: ${reason}. ${later}`,
  graphExited: (status) => `graphify завершился с кодом ${status}`,

  vault: 'хранилище Obsidian',
  vaultUnreadable: (file) => `${file} не читается как JSON-объект настроек, поэтому путь к хранилищу не предлагается. Исправьте его вручную.`,
  vaultUnreadableWhat: (file) => `${file} не читается`,
  vaultSet: (file, set, usable) =>
    `${file} уже называет хранилище Obsidian ${set}. Он остаётся как есть` + (usable ? '.' : ', хотя путь не абсолютный и демон ничего не проецирует; исправьте его вручную.'),
  vaultSetWhat: (file) => `${file} уже называет его`,
  vaultHow: (vaults, file, snippet) =>
    `${vaults.length === 0 ? 'Obsidian не знает на этой машине ни одного хранилища' : `Obsidian знает на этой машине несколько хранилищ (${vaults.length}): ${listed(' и ')(vaults)}`}, поэтому путь не предлагается. ` +
    `Чтобы демон Binnacle проецировал знания проекта в хранилище, укажите его абсолютный путь в ${file}, с доступом только для владельца (chmod 600):\n\n${snippet}`,
  vaultHowWhat: (none, file) => `${none ? 'Obsidian не знает ни одного' : 'Obsidian знает несколько'}; задайте obsidian.vaultPath в ${file}`,
  vaultOne: (vault, file) => `Obsidian знает на этой машине одно хранилище, ${vault}. Оно задаётся в плане; для другого отклоните план и отредактируйте ${file}.`,
  vaultHeading: (file) => `Записать хранилище Obsidian в ${file}, с доступом только для владельца, вне репозитория`,
  vaultDeclined: 'задать хранилище Obsidian',
};

/** `binn init`'s text in each language. */
export const INIT_TEXT: Record<Language, InitText> = { en, ru };
