import { accessSync, constants, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, posix, relative, sep } from 'node:path';
import { commitTree, type Tree } from '@binnacle/adapters';
import type { Diagnostic, ProjectManifest } from '@binnacle/core';
import type { Daily } from './daily.ts';
import { defaultCommit, GRAPH_DIRECTORY, lastBuild, manifestOf } from './graph.ts';
import { resolveGitTimeout, settingsPath } from './home.ts';
import { readRegistry } from './registry.ts';
import type { PendingDecisions, Snapshot, Unavailable } from './snapshot.ts';
import type { Store } from './store.ts';

/**
 * The vault projection (ADR-0036): a one-way rendering of each registered project's Project
 * Brain into the Obsidian vault named by `obsidian.vaultPath` in this machine's settings file
 * (decision 13), under `Projects/<Project>/`. Its source is the default branch as committed,
 * read through the Git adapter, so the working tree never reaches the vault; the one exception
 * is Graphify's report, read from the git-ignored graph directory after a successful run. Once a poll, a
 * project whose default branch moved, whose vault changed, or whose graph was built again, is
 * rendered again. Product's snapshot and daily notes are written when one is served, from what
 * was served (`writeServed`).
 *
 * Every note it writes starts with the generated marker, and it writes, rewrites and deletes
 * only files that do: a note the human wrote is never touched.
 */
export const VAULT_POLL_MS = 60_000;
const MARKER = '---\ngenerated-by: binnacle\n';
/** The folders this projection owns; a generated note in one whose source is gone is removed, as is the roadmap's. */
const FOLDERS = ['Specs', 'Decisions', 'Research'];
const ROADMAP_NOTE = 'Product/roadmap.md';
/** Graphify's report, in the registered checkout, and its note. */
const GRAPH_REPORT = `${GRAPH_DIRECTORY}/GRAPH_REPORT.md`;
const REPORT_NOTE = '90-Graphify/GRAPH_REPORT.md';

/** The vault this machine names, `null` when it names none, or why it cannot be written. */
function readVault(home: string): { path: string } | { reason: string } | null {
  const file = settingsPath(home);
  let settings: unknown;
  try {
    settings = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return { reason: `${file} cannot be read as JSON, so no vault is projected.` };
  }
  const obsidian = typeof settings === 'object' && settings !== null ? (settings as { obsidian?: unknown }).obsidian : undefined;
  const path = typeof obsidian === 'object' && obsidian !== null ? (obsidian as { vaultPath?: unknown }).vaultPath : undefined;
  if (path === undefined || path === null) return null;
  if (typeof path !== 'string' || !isAbsolute(path)) return { reason: `obsidian.vaultPath in ${file} is not an absolute path, so no vault is projected.` };
  try {
    if (!statSync(path).isDirectory()) return { reason: `The vault ${path} is not a directory, so nothing is projected into it.` };
    accessSync(path, constants.W_OK);
  } catch (error) {
    return { reason: `The vault ${path} cannot be written (${(error as NodeJS.ErrnoException).code ?? 'error'}), so nothing is projected into it.` };
  }
  return { path };
}

/**
 * The snapshot's attention for the vault: `vault.unwritable` when one is named and cannot be
 * written; nothing when none is named.
 *
 * ponytail: read from the setting and the directory now, so a write that fails inside a
 * writable vault is only in the daemon's log; record the projection's outcome if that misleads.
 */
export function vaultAttention(home: string): Diagnostic[] {
  const vault = readVault(home);
  return vault !== null && 'reason' in vault ? [{ code: 'vault.unwritable', message: vault.reason }] : [];
}

/**
 * ponytail: a project is rendered again only when its branch or the vault moves, so a generated
 * note the human deletes or edits comes back at the next move or the daemon's next start;
 * compare the vault's files on every poll if that ever surprises.
 */
export function startVaultProjector(home: string, store: Store, pollMs: number): { stop(): Promise<void> } {
  /** Per project, the vault, commit and graph run last projected in full. */
  const projected = new Map<string, string>();
  let stopped = false;
  let ticking: Promise<void> | null = null;

  async function consider(vault: string, path: string): Promise<void> {
    const manifest = manifestOf(path);
    const commit = await defaultCommit(path);
    if (manifest === null || commit === null || stopped) return;
    const built = lastBuild(store, path);
    const key = `${vault}\0${commit}\0${built?.id ?? ''}`;
    if (projected.get(path) === key) return;
    await project(vault, path, manifest, commit, built);
    projected.set(path, key);
  }

  function tick(): void {
    if (ticking || stopped) return;
    const vault = readVault(home);
    if (vault === null || 'reason' in vault) return;
    ticking = (async () => {
      for (const entry of readRegistry(home)) {
        // One project failing is logged and tried again on the next poll; the rest go on.
        await consider(vault.path, entry.path).catch((error: unknown) => console.error(error));
      }
    })()
      // As the graph's poll: a registry that cannot be read is logged and read again on the next one.
      .catch((error: unknown) => console.error(error))
      .finally(() => (ticking = null));
  }

  tick();
  const timer = setInterval(tick, pollMs);
  timer.unref();
  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      await ticking;
    },
  };
}

async function project(vault: string, path: string, manifest: ProjectManifest, commit: string, built: ReturnType<typeof lastBuild>): Promise<void> {
  const tree = commitTree(path, commit, resolveGitTimeout());
  const folder = join(vault, 'Projects', folderName(manifest));
  const notes = await sources(tree, dirsOf(manifest.knowledge));
  const root = realpathSync(vault);
  const targets = new Map([...notes].map(([source, note]) => [source, `Projects/${folderName(manifest)}/${note.replace(/\.md$/, '')}`]));

  for (const [source, note] of notes) {
    const text = await tree.read(source);
    if (text !== null) writeNote(root, join(folder, note), render(text, source, commit, targets));
  }

  // The report of the last successful run, written only while no failed run came after it, since a
  // failed one may have left its own report behind, and only when the note is not already that
  // run's (a commit is built once). Without a successful run, there is no note.
  const report = join(folder, REPORT_NOTE);
  const reportText = built && manifest.capabilities.graphify !== false ? readIfPresent(join(path, GRAPH_REPORT)) : null;
  if (built && reportText !== null && !built.failedSince && !readIfPresent(report)?.startsWith(header(GRAPH_REPORT, built.commit))) {
    writeNote(root, report, render(reportText, GRAPH_REPORT, built.commit, targets));
  }

  const kept = new Set([...notes.values()].map((note) => join(folder, note)));
  if (reportText !== null) kept.add(report);
  const owned = [...FOLDERS.flatMap((name) => markdownUnder(join(folder, name))), join(folder, ROADMAP_NOTE), report];
  for (const file of owned) {
    if (kept.has(file) || !generated(file)) continue;
    rmSync(file);
    prune(dirname(file), folder);
  }
}

type Dirs = Record<'docs' | 'adr' | 'specs', string | null>;

const dirsOf = (knowledge: ProjectManifest['knowledge']): Dirs => {
  const dir = (path: string | null): string | null => (path === null ? null : posix.normalize(path).replace(/\/+$/, ''));
  return { docs: dir(knowledge.docs), adr: dir(knowledge.adr), specs: dir(knowledge.specs) };
};

/**
 * The note a projected source path, relative to the repository, has, relative to the project's
 * folder; null for a path that is not projected. Specs hold each spec and its tickets, Decisions
 * the ADRs, Product the roadmap, and Research everything else under the docs.
 */
function noteOf(path: string, { docs, adr, specs }: Dirs): string | null {
  const under = (dir: string | null): string | null => (dir !== null && path.startsWith(`${dir}/`) ? path.slice(dir.length + 1) : null);
  const spec = under(specs);
  if (spec !== null) {
    const match = /^([^/]+)\/(?:spec\.md|issues\/([^/]+\.md))$/.exec(spec);
    return match ? `Specs/${match[1]}/${match[2] ?? 'spec.md'}` : null;
  }
  const decision = under(adr);
  if (decision !== null) return /^[^/]+\.md$/.test(decision) ? `Decisions/${decision}` : null;
  const doc = under(docs);
  if (doc === 'roadmap.md') return ROADMAP_NOTE;
  return doc !== null && doc.endsWith('.md') ? `Research/${doc}` : null;
}

/** Each projected source path, relative to the repository, and its note's path (`noteOf`). */
async function sources(tree: Tree, dirs: Dirs): Promise<Map<string, string>> {
  const notes = new Map<string, string>();
  const walked = new Set<string>();
  const walk = async (dir: string): Promise<void> => {
    if (walked.has(dir)) return;
    walked.add(dir);
    for (const entry of (await tree.list(dir)) ?? []) {
      const path = `${dir}/${entry.name}`;
      const note = entry.directory ? null : noteOf(path, dirs);
      if (entry.directory) await walk(path);
      else if (note !== null) notes.set(path, note);
    }
  };
  // The specs and the ADRs first, so that the walk of the docs does not go through them again.
  for (const dir of [dirs.specs, dirs.adr, dirs.docs]) if (dir) await walk(dir);
  return notes;
}

const LINK = /(!?)\[([^\]\n]*)\]\(([^)\s]+)\)/g;

/**
 * The note for `text`: the generated marker, merged into the source's own frontmatter when it
 * has one, and each relative link to another projected file as an Obsidian link. Links inside
 * fenced code are left as written.
 *
 * ponytail: an anchor is kept as the Markdown slug it is; Obsidian matches a heading's text, so
 * a multi-word anchor lands on the note, not the heading. Fences are not told apart by their
 * marker, and a source's frontmatter is merged only with `\n` line endings. Parse the Markdown if
 * any of these matters.
 */
function render(text: string, source: string, commit: string, targets: Map<string, string>): string {
  let fenced = false;
  const body = text
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      if (fenced) return line;
      // Inside a table row the alias's `|` would end the cell.
      const alias = line.trimStart().startsWith('|') ? '\\|' : '|';
      return line.replace(LINK, (whole, image: string, label: string, href: string) => {
        const [file = '', anchor] = href.split('#', 2);
        if (image || file === '' || /^[a-z][a-z0-9+.-]*:/i.test(file)) return whole;
        let decoded: string;
        try {
          decoded = decodeURIComponent(file);
        } catch {
          return whole;
        }
        const target = targets.get(posix.normalize(posix.join(posix.dirname(source), decoded)));
        return target === undefined ? whole : `[[${target}${anchor ? `#${anchor}` : ''}${alias}${label}]]`;
      });
    })
    .join('\n');
  return body.startsWith('---\n') ? header(source, commit) + body.slice('---\n'.length) : `${header(source, commit)}---\n${body}`;
}

const header = (source: string, commit: string): string => `${MARKER}source: ${source}\ncommit: ${commit}\n`;

/**
 * Writes a whole note through a temporary name, unless a file the projection did not generate is
 * there, it is unchanged, or its folder is a symbolic link out of the vault at `root`.
 */
function writeNote(root: string, file: string, content: string): void {
  const existing = readIfPresent(file);
  if (existing === content || (existing !== null && !existing.startsWith(MARKER))) return;
  // Checked before the folder is made, since making it would follow the link too.
  let nearest = dirname(file);
  while (!existsSync(nearest)) nearest = dirname(nearest);
  const resolved = realpathSync(nearest);
  if (resolved !== root && !within(root, resolved)) return;
  mkdirSync(dirname(file), { recursive: true });
  // A dotfile, which Obsidian does not index, renamed over the note in one step.
  const temporary = join(dirname(file), `.${basename(file)}.binnacle-tmp`);
  writeFileSync(temporary, content);
  renameSync(temporary, file);
}

const generated = (file: string): boolean => readIfPresent(file)?.startsWith(MARKER) ?? false;

function readIfPresent(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** The Markdown files under `dir`, without following a symbolic link. */
function markdownUnder(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? markdownUnder(path) : entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
  });
}

/** Removes `dir` and its parents while they are empty, up to and not including `root`. */
function prune(dir: string, root: string): void {
  while (within(root, dir)) {
    try {
      rmdirSync(dir);
    } catch {
      return;
    }
    dir = dirname(dir);
  }
}

/** Whether `path` is below `root`, and not `root` itself. */
function within(root: string, path: string): boolean {
  const rest = relative(root, path);
  return rest !== '' && rest !== '..' && !rest.startsWith(`..${sep}`) && !isAbsolute(rest);
}

/** The project's folder name: its name, or its id, without what a path or an Obsidian link cannot hold. */
const folderName = (manifest: ProjectManifest): string =>
  (manifest.project.name ?? manifest.project.id).replace(/[\\/:*?"<>|#^[\]\x00-\x1f]/g, '-').replace(/^\.+/, '-');

/**
 * Writes Product's snapshot or daily note from what was just served, with no other read than
 * the setting's; nothing when no vault is set or the manifest cannot be read. A write that fails
 * is logged and never fails what was served.
 */
export function writeServed(home: string, manifest: ProjectManifest | null, served: { snapshot: Snapshot } | { daily: Daily }): void {
  const vault = readVault(home);
  if (vault === null || 'reason' in vault || manifest === null) return;
  try {
    const link = linker(manifest);
    const name = manifest.project.name ?? manifest.project.id;
    const [note, source, commit, body] =
      'snapshot' in served
        ? ['snapshot', 'project.snapshot', served.snapshot.git.available ? served.snapshot.git.commit : null, snapshotNote(name, served.snapshot, link)]
        : ['daily', 'daily.get', served.daily.head, dailyNote(name, served.daily, link)];
    const file = join(vault.path, 'Projects', folderName(manifest), 'Product', `${note}.md`);
    writeNote(realpathSync(vault.path), file, `${header(source, commit ?? 'none')}served: ${new Date().toISOString()}\n---\n${body}`);
  } catch (error) {
    console.error(error);
  }
}

type Link = (path: string, label: string) => string;

/** A ticket's or an ADR's path as a link to its note, a URL as a Markdown link, and anything else as written. */
function linker(manifest: ProjectManifest): Link {
  const dirs = dirsOf(manifest.knowledge);
  const prefix = `Projects/${folderName(manifest)}/`;
  return (path, label) => {
    const text = label.replace(/[[\]|]/g, ' ');
    const note = noteOf(posix.normalize(path), dirs);
    if (note !== null) return `[[${prefix}${note.replace(/\.md$/, '')}|${text}]]`;
    return /^https?:\/\//.test(path) ? `[${text}](${path})` : `${text} (\`${path}\`)`;
  };
}

const unavailable = (value: object): value is Unavailable => 'available' in value && value.available === false;
const short = (commit: string): string => commit.slice(0, 7);

function list<T>(items: T[], line: (item: T) => string, remainder = 0): string {
  if (items.length === 0) return 'None.';
  return [...items.map((item) => `- ${line(item)}`), ...(remainder > 0 ? [`- and ${remainder} more`] : [])].join('\n');
}

type TaskLine = { id: string; title: string | null; ticket: string; state: string | null };
const ticket = (link: Link, item: Pick<TaskLine, 'id' | 'title' | 'ticket'>): string => link(item.ticket, `${item.id}: ${item.title ?? 'untitled'}`);
const task =
  (link: Link) =>
  (item: TaskLine): string =>
    `${ticket(link, item)} — ${item.state ?? 'unknown'}`;
const attention = (items: { code: string; message: string }[]): string => list(items, (item) => `\`${item.code}\`: ${item.message}`);

/** *Waiting for the owner*, each question under its Task, with the branch it was read from, its later lines indented into the item. */
function waiting(pending: PendingDecisions | Unavailable, link: Link): string[] {
  if (unavailable(pending)) return ['## Waiting for the owner', `Not available: ${pending.reason}`];
  const { questions, approvals, owner } = pending;
  return [
    '## Waiting for the owner',
    '### Questions',
    unavailable(questions)
      ? `Not available: ${questions.reason}`
      : list(questions.items, (item) => `${ticket(link, item)}${item.branch ? ` on \`${item.branch}\`` : ''}: ${item.question.replace(/\n/g, '\n  ')}`, questions.remainder),
    '### Approvals',
    list(approvals.items, task(link), approvals.remainder),
    '### The owner’s to start',
    list(owner.items, task(link), owner.remainder),
  ];
}

/** CI as the forge reports it: the default branch's latest commit, then the open pull requests with their Tasks. */
function ciNote(ci: Snapshot['ci']): string[] {
  if (unavailable(ci)) return ['## CI', `Not available: ${ci.reason}`];
  const { forge, defaultBranch: head, requests } = ci;
  const at = (url: string): string => ` (provider reported). ${url}`;
  return [
    '## CI',
    `\`${head.branch}\` on ${forge.provider === 'github' ? 'GitHub' : 'GitLab'} (${forge.repository}): ${head.state.value} at \`${short(head.commit)}\`${head.at ? `, ${head.at}` : ''}${at(head.url)}`,
    '### Open pull requests',
    list(
      requests.items,
      (item) => `#${item.number} ${item.title}${item.draft ? ' (draft)' : ''}, \`${item.branch}\`${item.taskId ? `, ${item.taskId}` : ''}: ${item.state.value}${at(item.url)}`,
      requests.remainder,
    ),
  ];
}

/**
 * The snapshot as a note: where it was served from, the next step, what waits for the owner, the Tasks, the parallel limit
 * and its conflict risk, the ADRs, the graph, CI and the attention. Usage and activity are left to
 * the dashboard.
 */
function snapshotNote(name: string, snapshot: Snapshot, link: Link): string {
  const { git, next, tasks, decisions, graph } = snapshot;
  const parts = [
    `# Snapshot of ${name}`,
    git.available
      ? `Served from \`${git.branch ?? 'a detached HEAD'}\` at \`${git.commit ? short(git.commit) : 'no commit'}\`${git.dirty ? ', with uncommitted changes' : ''}.`
      : `Served without Git: ${git.reason}`,
    '## Next',
    next.action ? `Next action: ${next.action.description} \`${next.action.command}\`` : "The roadmap's focus names no Next action.",
    unavailable(next.alternatives)
      ? `Suggested step not available: ${next.alternatives.reason}`
      : list(next.alternatives, (item) => `${item.description}${item.command ? ` \`${item.command}\`` : ''}`),
    ...waiting(snapshot.pendingDecisions, link),
  ];
  if (tasks === null) parts.push('## Tasks', 'The tracker cannot be read; the attention says why.');
  else {
    const { limit, mode, source, inProgress, free, impact } = tasks.parallel;
    parts.push(
      '## In flight',
      list(tasks.inFlight.items, task(link), tasks.inFlight.remainder),
      '## Ready to start',
      list(tasks.readyToStart.items, task(link), tasks.readyToStart.remainder),
      '## Parallel',
      `Limit ${limit}${mode === 'auto' ? ' (auto)' : ''}, from the ${source}, in progress ${inProgress}, free ${free} (calculated).`,
      unavailable(impact)
        ? `Conflict risk not available: ${impact.reason}`
        : list(impact.pairs, (pair) => `${pair.tasks.join(' and ')}: ${pair.risk} — ${pair.reason} (calculated)`),
    );
  }
  parts.push(
    '## Decisions',
    decisions === null ? 'This project declares no ADR directory.' : list(decisions.items, (item) => link(item.path, item.title ?? item.path), decisions.remainder),
    '## Graph',
    [
      graph.available ? 'A graph is available.' : `No graph: ${graph.reason}`,
      graph.builtFrom ? ` Built from \`${short(graph.builtFrom.commit)}\` at ${graph.builtFrom.at}${graph.behind ? ', and the default branch has moved past it' : ''}.` : '',
      graph.lastRun
        ? ` The last run, of \`${short(graph.lastRun.commit)}\` at ${graph.lastRun.at}, ${graph.lastRun.outcome === 'built' ? 'built' : `failed: ${graph.lastRun.reason}`}.`
        : '',
    ].join(''),
    ...ciNote(snapshot.ci),
    '## Attention',
    attention(snapshot.attention),
  );
  return `${parts.join('\n\n')}\n`;
}

/** The daily delta as a note: its range, the commits, the Task changes, what waits for the owner, CI, the roadmap changes, the ADRs and the attention. */
function dailyNote(name: string, daily: Daily, link: Link): string {
  const tasks = <T>(value: { items: T[]; remainder: number } | Unavailable | null, line: (item: T) => string): string =>
    value === null ? 'The tracker cannot be read now; the attention says why.' : unavailable(value) ? `Not available: ${value.reason}` : list(value.items, line, value.remainder);
  const parts = [
    `# Daily of ${name}`,
    `From ${daily.from.commit ? `\`${short(daily.from.commit)}\`` : 'the first commit'} (${daily.from.source}) to \`${short(daily.head)}\`${daily.dirty ? ', with uncommitted changes left out' : ''}.${daily.fallback ? ` ${daily.fallback.message}` : ''}`,
    `## Commits (${daily.commits.count})`,
    list(daily.commits.items, (item) => `\`${short(item.commit)}\` ${item.subject}`, daily.commits.remainder),
    '## Status changes',
    tasks(daily.transitions, (item) => `${ticket(link, item)}: ${item.from ?? 'none'} → ${item.to ?? 'none'}`),
    '## New tickets',
    tasks(daily.newTickets, task(link)),
    '## Ready to start',
    tasks(daily.readyToStart, task(link)),
    ...waiting(daily.pendingDecisions, link),
    ...ciNote(daily.ci),
    '## Roadmap',
    daily.roadmap === null ? 'There is no roadmap.' : list(daily.roadmap, (epic) => `Epic ${epic.number}, ${epic.title}: ${epic.from ?? 'new'} → ${epic.to}`),
    '## Decisions',
    daily.decisions === null
      ? 'This project declares no ADR directory.'
      : list(daily.decisions.items, (item) => `${link(item.path, item.title ?? item.path)} (${item.change})`, daily.decisions.remainder),
    '## Attention',
    attention(daily.attention),
  ];
  return `${parts.join('\n\n')}\n`;
}
