import { spawnSync } from 'node:child_process';
import { accessSync, appendFileSync, constants, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, delimiter, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { readGitFacts, workingTree, type GitRemote } from '@binnacle/adapters';
import { instructionSets, remoteLocation, TASK_STATES, type ProjectManifest, type TrackerProvider } from '@binnacle/core';
import {
  credentialsKey,
  credentialsPath,
  isAlive,
  MANIFEST_RELATIVE,
  OperationError,
  readManifest,
  readTracker,
  readRuntime,
  resolveGitTimeout,
} from '@binnacle/daemon';
import { EXIT, type ExitCode } from './exit.ts';
import { register } from './project-commands.ts';

type Outcome = 'created' | 'extended' | 'printed' | 'ran' | 'checked' | 'failed' | 'declined' | 'skipped';

/** What one run of `binn init` knows and has done: where it works, how it asks, and what it will summarise. */
type Session = {
  root: string;
  ask(question: string): Promise<boolean>;
  say(text: string): void;
  outcomes: { outcome: Outcome; what: string }[];
};

/**
 * `binn init [path]`: the one command that writes into a project's repository (ADR-0026).
 * Each step shows what it will do and asks, default no; the end of input is a no, so a
 * run without a terminal writes nothing. It never commits.
 */
export async function init(home: string, path?: string): Promise<ExitCode> {
  const git = await readGitFacts(resolve(path ?? process.cwd()), resolveGitTimeout());
  if (!git.available) {
    console.error(`binn: ${git.reason} binn init works at the root of a Git repository.`);
    return EXIT.failed;
  }

  const answers = createInterface({ input: process.stdin })[Symbol.asyncIterator]();
  const session: Session = {
    root: git.root,
    async ask(question) {
      process.stdout.write(`${question} [y/N] `);
      const answer = await answers.next();
      if (answer.done) process.stdout.write('\n');
      return !answer.done && /^\s*y(es)?\s*$/i.test(answer.value);
    },
    say: (text) => console.log(text),
    outcomes: [],
  };

  try {
    session.say(`Setting up Binnacle in ${session.root}. Nothing is written without a yes.\n`);
    const manifestUsable = await manifestStep(session, git.remotes);
    session.say('');
    await registrationStep(session, home, manifestUsable);
    session.say('');
    await harnessStep(session);
    session.say('');
    await pluginStep(session);
    session.say('');
    // The manifest as the steps above left it: the tracker it declares, or the one it would propose.
    const manifest = declaredManifest(session.root);
    await mattPocockStep(session, manifest?.tracker.provider ?? forgeRemote(git.remotes)?.provider ?? 'local');
    session.say('');
    instructionsStep(session);
    session.say('');
    await trackerStep(session, home, manifest);
    session.say('');
  } finally {
    answers.return?.();
  }

  session.say('Summary:');
  for (const { outcome, what } of session.outcomes) session.say(`  ${outcome.padEnd(8)}  ${what}`);
  session.say('Nothing was committed. Review what binn init wrote, and commit it yourself.');
  return EXIT.ok;
}

/**
 * The one place `binn init` writes into the repository, and the rules it writes by
 * (ADR-0026): a missing file is created; an existing file is only ever extended by a
 * pure append at its end; an existing JSON file is never rewritten, and the entry is
 * printed instead; nothing is overwritten. `text` is the whole new file, or the addition.
 * Answers whether it wrote.
 */
async function offerFile(session: Session, relative: string, text: string): Promise<boolean> {
  const path = join(session.root, relative);
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : null;

  if (existing === null) {
    session.say(`Create ${relative}:\n\n${text}`);
    if (!(await session.ask(`Create ${relative}?`))) {
      record(session, 'declined', `create ${relative}`);
      return false;
    }
    mkdirSync(dirname(path), { recursive: true });
    // `wx`: a file that appeared since it was read is still never overwritten.
    writeFileSync(path, text, { flag: 'wx' });
    record(session, 'created', relative);
    return true;
  }

  if (/\.jsonc?$/.test(relative)) {
    session.say(`${relative} exists, and binn init never rewrites a JSON file. Add this yourself:\n\n${text}`);
    record(session, 'printed', `the entry for ${relative}`);
    return false;
  }

  const addition = existing === '' || existing.endsWith('\n') ? text : `\n${text}`;
  session.say(`Append to the end of ${relative}:\n\n${addition}`);
  if (!(await session.ask(`Append to ${relative}?`))) {
    record(session, 'declined', `append to ${relative}`);
    return false;
  }
  appendFileSync(path, addition);
  record(session, 'extended', relative);
  return true;
}

function record(session: Session, outcome: Outcome, what: string): void {
  session.outcomes.push({ outcome, what });
}

/**
 * Step 1: an existing manifest is validated and left alone; otherwise one is proposed from
 * facts. Answers whether the repository now has a usable manifest, which registration needs.
 */
async function manifestStep(session: Session, remotes: GitRemote[]): Promise<boolean> {
  try {
    const { warnings } = readManifest(session.root);
    session.say(`${MANIFEST_RELATIVE} exists and is valid. It is left as it is.`);
    for (const warning of warnings) session.say(`  ${warning.path}: ${warning.message}`);
    record(session, 'skipped', `${MANIFEST_RELATIVE}: it exists`);
    return true;
  } catch (error) {
    if (!(error instanceof OperationError)) throw error;
    if (error.code === 'manifest.missing') {
      return await offerFile(session, MANIFEST_RELATIVE, proposeManifest(session.root, remotes));
    }
    session.say(`${MANIFEST_RELATIVE} exists and has problems. It is left as it is; fix it by hand.`);
    session.say(`  ${error.code}: ${error.message}`);
    for (const detail of error.details ?? []) session.say(`  ${detail.path}: ${detail.message}`);
    record(session, 'skipped', `${MANIFEST_RELATIVE}: it exists, with problems`);
    return false;
  }
}

/** Only what is there: a path that does not exist, or a tracker nobody has, is never declared. */
function proposeManifest(root: string, remotes: GitRemote[]): string {
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

  return `${sections.join('\n\n')}\n`;
}

/**
 * The first GitHub or GitLab remote, `origin` first.
 * ponytail: a forge is recognised by a `github` or `gitlab` label in the remote's host, so a
 * GitHub Enterprise or GitLab host named otherwise is proposed as `local`; the human sees the
 * proposal and can edit it. A probe of the host's API would recognise it, at a network call.
 */
function forgeRemote(remotes: GitRemote[]): { provider: 'github' | 'gitlab'; host: string; repository: string } | null {
  const ordered = [...remotes.filter((remote) => remote.name === 'origin'), ...remotes.filter((remote) => remote.name !== 'origin')];
  for (const remote of ordered) {
    const location = remoteLocation(remote.url);
    if (!location || location.path === '') continue;
    const labels = location.host.split('.');
    const provider = labels.includes('github') ? 'github' : labels.includes('gitlab') ? 'gitlab' : null;
    if (provider) return { provider, host: location.host, repository: location.path };
  }
  return null;
}

/** A YAML scalar: plain when that reads back as the same string, double-quoted (JSON is valid YAML) otherwise. */
const scalar = (value: string): string =>
  /^[A-Za-z_][\w./-]*$/.test(value) && !/^(true|false|null|yes|no|on|off|y|n)$/i.test(value) ? value : JSON.stringify(value);

/** Step 2: registration through `project.register`, which is a write outside the repository and asked for too. */
async function registrationStep(session: Session, home: string, manifestUsable: boolean): Promise<void> {
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

  session.say(`Register ${session.root} with the running Binnacle daemon, as \`binn project register\` does (project.register).`);
  if (!(await session.ask('Register the project?'))) return record(session, 'declined', what);
  const code = await register(home, session.root);
  record(session, code === EXIT.ok ? 'ran' : 'failed', 'project.register');
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
  /** The whole new file, which is also the addition for a format that allows a pure append. */
  entry: string;
  /** Said before the entry is offered. */
  note?: string;
};

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** The server every template declares: stdio, named `binnacle`, running `binn mcp`. */
const STDIO_SERVER = { type: 'stdio', command: 'binn', args: ['mcp'] };

/** Where opencode, and VS Code on Linux, keep their user configuration. */
const CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');

const HARNESSES: Harness[] = [
  {
    name: 'Claude Code',
    executable: 'claude',
    userDirectory: join(homedir(), '.claude'),
    files: ['.mcp.json'],
    entry: json({ mcpServers: { binnacle: STDIO_SERVER } }),
  },
  {
    name: 'Codex',
    executable: 'codex',
    userDirectory: join(homedir(), '.codex'),
    files: ['.codex/config.toml'],
    entry: '[mcp_servers.binnacle]\ncommand = "binn"\nargs = ["mcp"]\n',
    note: 'Codex reads .codex/config.toml only in a trusted project: trust this project in Codex for the entry to take effect.',
  },
  {
    name: 'opencode',
    executable: 'opencode',
    userDirectory: join(CONFIG_HOME, 'opencode'),
    files: ['opencode.json', 'opencode.jsonc'],
    entry: json({ $schema: 'https://opencode.ai/config.json', mcp: { binnacle: { type: 'local', command: ['binn', 'mcp'] } } }),
  },
  {
    name: 'VS Code',
    executable: 'code',
    userDirectory:
      process.platform === 'darwin'
        ? join(homedir(), 'Library', 'Application Support', 'Code')
        : process.platform === 'win32'
          ? join(homedir(), 'AppData', 'Roaming', 'Code')
          : join(CONFIG_HOME, 'Code'),
    files: ['.vscode/mcp.json'],
    entry: json({ servers: { binnacle: STDIO_SERVER } }),
  },
];

/** Step 3: the MCP registration for each detected harness, then a generic snippet for any other. */
async function harnessStep(session: Session): Promise<void> {
  const found = HARNESSES.map((harness) => ({ harness, reason: detect(harness) })).filter(({ reason }) => reason !== null);
  if (found.length === 0) session.say(`No known harness is installed (${HARNESSES.map(({ name }) => name).join(', ')}).\n`);

  for (const { harness, reason } of found) {
    const file = harness.files.find((candidate) => existsSync(join(session.root, candidate))) ?? harness.files[0]!;
    session.say(`${harness.name} is installed (${reason}). It reads this project's MCP servers from ${file}.`);
    const path = join(session.root, file);
    if (existsSync(path) && namesBinnacle(readFileSync(path, 'utf8'))) {
      session.say(`${file} already names binnacle. It is left as it is.`);
      record(session, 'skipped', `${file}: it already names binnacle`);
    } else {
      if (harness.note) session.say(harness.note);
      await offerFile(session, file, harness.entry);
    }
    session.say('');
  }

  session.say(
    `For any other harness that speaks MCP, register a stdio server named binnacle that runs \`binn mcp\`, for example:\n\n${json({ mcpServers: { binnacle: STDIO_SERVER } }).trimEnd()}`,
  );
}

function detect(harness: Harness): string | null {
  if (onPath(harness.executable)) return `${harness.executable} is on PATH`;
  if (existsSync(harness.userDirectory)) return `${harness.userDirectory} exists`;
  return null;
}

function onPath(name: string): boolean {
  const extensions = process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : [''];
  return (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .some((dir) =>
      extensions.some((extension) => {
        const path = join(dir, name + extension);
        try {
          accessSync(path, constants.X_OK);
          return statSync(path).isFile();
        } catch {
          return false;
        }
      }),
    );
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
 * Step 4: the `binnacle` plugin from this very package, so that the skills match the `binn`
 * that serves their tools (ADR-0027). Only through Claude Code's own CLI, at user scope:
 * binn init never edits Claude Code's settings files.
 */
async function pluginStep(session: Session): Promise<void> {
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
  const list = spawnSync('claude', ['plugin', 'list', '--json'], { cwd: session.root, encoding: 'utf8' });
  // Detected by its user directory alone, Claude Code may have no `claude` to run.
  if ((list.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
    session.say('Claude Code is detected, but `claude` is not on PATH, so the binnacle plugin is not installed.');
    return record(session, 'skipped', `${what}: \`claude\` is not on PATH`);
  }
  const ids = list.status === 0 ? pluginIds(list.stdout) : null;
  if (!ids) {
    session.say(`\`claude plugin list --json\` failed, so the binnacle plugin is not installed.${list.stderr ? `\n${list.stderr.trim()}` : ''}`);
    return record(session, 'failed', 'claude plugin list --json');
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
  const shown = (args: string[]): string => `claude ${args.join(' ')}`;
  session.say(`Install the binnacle plugin from this Binnacle package, at user scope, by running:\n\n${commands.map((args) => `  ${shown(args)}`).join('\n')}`);
  if (!(await session.ask('Install the binnacle plugin?'))) return record(session, 'declined', what);

  for (const args of commands) {
    // stdin stays with binn init's own questions; Claude Code's output is shown as it comes.
    const run = spawnSync('claude', args, { cwd: session.root, stdio: ['ignore', 'inherit', 'inherit'] });
    if (run.status !== 0) return record(session, 'failed', shown(args));
    record(session, 'ran', shown(args));
  }
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

const ISSUE_TRACKER = 'docs/agents/issue-tracker.md';

/** The convention files `/setup-matt-pocock-skills` writes. Any of them present is the layout. */
const mattPocockFiles = (root: string): string[] =>
  [ISSUE_TRACKER, 'docs/agents/triage-labels.md', 'docs/agents/domain.md'].filter((path) => existsSync(join(root, path)));

/** The section is recognised by its heading, at any level, so that it is never appended twice. */
const TICKET_HEADER_HEADING = /^#{1,6}\s+Ticket header\s*$/im;

/**
 * Step 5: `/to-tickets` learns the ticket header (ADR-0024) from the issue tracker file, so the
 * section is offered as an append to it. `provider` is the tracker the manifest declares, or
 * the one it would propose.
 */
async function mattPocockStep(session: Session, provider: TrackerProvider): Promise<void> {
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
  if (TICKET_HEADER_HEADING.test(readFileSync(join(session.root, ISSUE_TRACKER), 'utf8'))) {
    session.say(`${ISSUE_TRACKER} already has its ticket-header section.`);
    return record(session, 'skipped', `${what}: ${ISSUE_TRACKER} has it`);
  }
  await offerFile(session, ISSUE_TRACKER, ticketHeaderSection(provider));
}

const ISSUE_NUMBERS = 'the issue numbers of the issues it waits for, such as `#12, #15`';
const PATH_OR_LINK = 'its path, such as `docs/specs/<slug>/spec.md`, or a link to that file pinned to a commit';
const KEEP_CURRENT = 'Binnacle reports any disagreement between the two, so keep the line current when you close the issue.';

/** What the section says differently on each tracker (ADR-0024, and the spec's closed-issue states). */
const CONVENTIONS: Record<TrackerProvider, { ticket: string; blockedBy: string; example: string; spec: string; closing: string | null }> = {
  local: {
    ticket: 'ticket',
    blockedBy: 'the numbers of the tickets in the same spec it waits for, such as `01, 03`',
    example: '01, 03',
    spec: 'its path, such as `docs/specs/<slug>/spec.md`',
    closing: null,
  },
  github: {
    ticket: 'issue body',
    blockedBy: ISSUE_NUMBERS,
    example: '#12, #15',
    spec: PATH_OR_LINK,
    closing:
      'Closing an issue outranks its `Status:` line: an issue closed as completed is done, and one closed as not planned or as a duplicate is cancelled, whatever the line says. ' +
      `An issue closed with no reason is cancelled when its \`Status:\` says \`CANCELLED\`, and done otherwise. ${KEEP_CURRENT}`,
  },
  gitlab: {
    ticket: 'issue body',
    blockedBy: ISSUE_NUMBERS,
    example: '#12, #15',
    spec: PATH_OR_LINK,
    closing:
      'Closing an issue outranks its `Status:` line, and GitLab reports no reason for closing: a closed issue is done, unless its `Status:` says `CANCELLED`. ' +
      `Set \`Status: CANCELLED\` before closing work that was abandoned. ${KEEP_CURRENT}`,
  },
};

/** The convention `/to-tickets` writes by, for the tracker in use. It leads with a blank line, after the file's last section. */
function ticketHeaderSection(provider: TrackerProvider): string {
  const { ticket, blockedBy, example, spec, closing } = CONVENTIONS[provider];
  const states = TASK_STATES.map((state) => `\`${state}\``).join(', ');
  return `
## Ticket header

Binnacle reads a ticket's state, dependencies and spec from its header: these lines, one per line, at the top of every ${ticket}, before anything else. Write them in every ticket, and keep \`Status:\` current.

- \`Status:\` — the ticket's state, one of ${states}.
- \`Blocked by:\` — ${blockedBy}, or \`None\`.
- \`Spec:\` — the spec it implements, as ${spec}.
${closing === null ? '' : `\n${closing}\n`}
For example:

\`\`\`text
Status: READY
Blocked by: ${example}
Spec: \`docs/specs/<slug>/spec.md\`
\`\`\`
`;
}

/** Step 6: the agent instruction files, reported as the sets an agent reads. Nothing is written to either. */
function instructionsStep(session: Session): void {
  const files = Object.fromEntries(
    ['AGENTS.md', 'CLAUDE.md']
      .filter((name) => existsSync(join(session.root, name)))
      .map((name) => [name, readFileSync(join(session.root, name), 'utf8')]),
  );
  const sets = instructionSets(files);
  if (sets.length === 0) return session.say('There is no AGENTS.md or CLAUDE.md, so there are no agent instructions to report.');
  const described = sets.map(([entry, ...imported]) => (imported.length === 0 ? entry : `${entry}, which imports ${imported.join(' and ')}`));
  const count = sets.length === 1 ? 'one instruction set' : 'two instruction sets';
  session.say(`Agent instructions: ${count}: ${described.join('; ')}. binn init writes nothing to them.`);
}

/**
 * Step 7: one read of a remote tracker through its adapter, with the credentials lookup the
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
