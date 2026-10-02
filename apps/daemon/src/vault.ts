import { accessSync, constants, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, posix, relative, sep } from 'node:path';
import { commitTree, type Tree } from '@binnacle/adapters';
import type { Diagnostic, ProjectManifest } from '@binnacle/core';
import { defaultCommit, manifestOf } from './graph.ts';
import { resolveGitTimeout, settingsPath } from './home.ts';
import { readRegistry } from './registry.ts';

/**
 * The vault projection (ADR-0036): a one-way rendering of each registered project's Project
 * Brain into the Obsidian vault named by `obsidian.vaultPath` in this machine's settings file
 * (decision 13), under `Projects/<Project>/`. Its source is the default branch as committed,
 * read through the Git adapter, so the working tree never reaches the vault. Once a poll, a
 * project whose default branch moved, or whose vault changed, is rendered again.
 *
 * Every note it writes starts with the generated marker, and it writes, rewrites and deletes
 * only files that do: a note the human wrote is never touched.
 */
export const VAULT_POLL_MS = 60_000;
const MARKER = '---\ngenerated-by: binnacle\n';
/** The folders this projection owns; a generated note in one whose source is gone is removed. */
const FOLDERS = ['Specs', 'Decisions', 'Research'];

/** The vault this machine names, `null` when it names none, or why it cannot be written. */
export function readVault(home: string): { path: string } | { reason: string } | null {
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

export function startVaultProjector(home: string, pollMs: number): { stop(): Promise<void> } {
  /** Per project, the vault and commit last projected in full. */
  const projected = new Map<string, string>();
  let stopped = false;
  let ticking: Promise<void> | null = null;

  async function consider(vault: string, path: string): Promise<void> {
    const manifest = manifestOf(path);
    const commit = await defaultCommit(path);
    if (manifest === null || commit === null || stopped) return;
    const key = `${vault}\0${commit}`;
    if (projected.get(path) === key) return;
    await project(vault, path, manifest, commit);
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
    })().finally(() => (ticking = null));
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

async function project(vault: string, path: string, manifest: ProjectManifest, commit: string): Promise<void> {
  const tree = commitTree(path, commit, resolveGitTimeout());
  const folder = join(vault, 'Projects', folderName(manifest));
  const notes = await sources(tree, manifest.knowledge);
  const targets = new Map([...notes].map(([source, note]) => [source, `Projects/${folderName(manifest)}/${note.replace(/\.md$/, '')}`]));

  for (const [source, note] of notes) {
    const text = await tree.read(source);
    if (text !== null) writeNote(join(folder, note), render(text, source, commit, targets));
  }

  const kept = new Set([...notes.values()].map((note) => join(folder, note)));
  for (const owned of FOLDERS) {
    for (const file of markdownUnder(join(folder, owned))) {
      if (kept.has(file) || !generated(file)) continue;
      rmSync(file);
      prune(dirname(file), folder);
    }
  }
}

/** Each projected source path, relative to the repository, and its note's path, relative to the project's folder. */
async function sources(tree: Tree, knowledge: ProjectManifest['knowledge']): Promise<Map<string, string>> {
  const notes = new Map<string, string>();
  const [docs, adr, specs] = [knowledge.docs, knowledge.adr, knowledge.specs].map((dir) => (dir === null ? null : posix.normalize(dir).replace(/\/+$/, '')));

  if (specs) {
    for (const slug of (await tree.list(specs)) ?? []) {
      if (!slug.directory) continue;
      const dir = `${specs}/${slug.name}`;
      if ((await tree.read(`${dir}/spec.md`)) !== null) notes.set(`${dir}/spec.md`, `Specs/${slug.name}/spec.md`);
      for (const ticket of (await tree.list(`${dir}/issues`)) ?? []) {
        if (!ticket.directory && ticket.name.endsWith('.md')) notes.set(`${dir}/issues/${ticket.name}`, `Specs/${slug.name}/${ticket.name}`);
      }
    }
  }
  if (adr) {
    for (const entry of (await tree.list(adr)) ?? []) {
      if (!entry.directory && entry.name.endsWith('.md')) notes.set(`${adr}/${entry.name}`, `Decisions/${entry.name}`);
    }
  }
  if (docs) {
    // Everything else under the docs: not the roadmap, which is Product's, nor the ADRs and specs, which have their own folders.
    const walk = async (dir: string): Promise<void> => {
      for (const entry of (await tree.list(dir)) ?? []) {
        const path = `${dir}/${entry.name}`;
        if (path === adr || path === specs || path === `${docs}/roadmap.md`) continue;
        if (entry.directory) await walk(path);
        else if (entry.name.endsWith('.md')) notes.set(path, `Research/${path.slice(docs.length + 1)}`);
      }
    };
    await walk(docs);
  }
  return notes;
}

const LINK = /(!?)\[([^\]\n]*)\]\(([^)\s]+)\)/g;

/**
 * The note for `text`: the generated marker, merged into the source's own frontmatter when it
 * has one, and each relative link to another projected file as an Obsidian link. Links inside
 * fenced code are left as written.
 *
 * ponytail: an anchor is kept as the Markdown slug it is; Obsidian matches a heading's text, so
 * a multi-word anchor lands on the note, not the heading. Map slugs to headings if that matters.
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
  const header = `${MARKER}source: ${source}\ncommit: ${commit}\n`;
  return body.startsWith('---\n') ? header + body.slice('---\n'.length) : `${header}---\n${body}`;
}

/** Writes a whole note through a temporary name, unless a file the projection did not generate is there, or it is unchanged. */
function writeNote(file: string, content: string): void {
  const existing = readIfPresent(file);
  if (existing === content || (existing !== null && !existing.startsWith(MARKER))) return;
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
  while (relative(root, dir) !== '' && !relative(root, dir).startsWith(`..${sep}`)) {
    try {
      rmdirSync(dir);
    } catch {
      return;
    }
    dir = dirname(dir);
  }
}

/** The project's folder name: its name, or its id, without what a path or an Obsidian link cannot hold. */
const folderName = (manifest: ProjectManifest): string =>
  (manifest.project.name ?? manifest.project.id).replace(/[\\/:*?"<>|#^[\]\x00-\x1f]/g, '-').replace(/^\.+/, '-');
