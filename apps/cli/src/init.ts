import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { readGitFacts, type GitRemote } from '@binnacle/adapters';
import { remoteLocation } from '@binnacle/core';
import { isAlive, MANIFEST_RELATIVE, OperationError, readManifest, readRuntime, resolveGitTimeout } from '@binnacle/daemon';
import { EXIT, type ExitCode } from './exit.ts';
import { register } from './project-commands.ts';

type Outcome = 'created' | 'extended' | 'printed' | 'ran' | 'failed' | 'declined' | 'skipped';

/** What one run of `binn init` knows and has done: where it works, how it asks, and what it will summarise. */
export type Session = {
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
export async function offerFile(session: Session, relative: string, text: string): Promise<boolean> {
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

  if (relative.endsWith('.json')) {
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

  if (existsSync(join(root, 'docs', 'agents', 'issue-tracker.md'))) sections.push('workflow:\n  provider: matt-pocock');

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
