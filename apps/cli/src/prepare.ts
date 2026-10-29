import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

/** A version drawn from every file under `dir`, by path and content: what Claude Code's `plugin update` compares. */
function digest(dir: string): string {
  const hash = createHash('sha256');
  const files = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();
  for (const file of files) hash.update(`${file}\0`).update(readFileSync(join(dir, file))).update('\0');
  return hash.digest('hex').slice(0, 12);
}

/**
 * Copies the binnacle plugin from `source` to `target` (ADR-0027) and gives the copy's manifest
 * a version drawn from every file of the source, which it returns. Claude Code's `plugin update`
 * refreshes its installed copy only when that version changes; a manifest with none installs as
 * `unknown`, and stays so whatever the skills become.
 */
export function preparePlugin(source: string, target: string): string {
  const version = digest(source);

  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  const manifest = join(target, '.claude-plugin', 'plugin.json');
  writeFileSync(manifest, `${JSON.stringify({ ...JSON.parse(readFileSync(manifest, 'utf8')), version }, null, 2)}\n`);
  return version;
}

/**
 * Writes to `target` the copy of the plugin's skills that the `skills` CLI installs into every other
 * harness (ADR-0039): `binnacle-<action>` for each skill, every `/binnacle:<action>` renamed so,
 * the plugin's `version` under `metadata`, each description quoted, and without the fields only Claude Code reads.
 */
export function prepareSkills(source: string, target: string, version: string): void {
  rmSync(target, { recursive: true, force: true });
  for (const action of readdirSync(join(source, 'skills'))) {
    // A Windows checkout's Git writes CRLF; the copy is the same as from LF.
    const text = readFileSync(join(source, 'skills', action, 'SKILL.md'), 'utf8').replaceAll('\r\n', '\n');
    const end = text.indexOf('\n---\n', 4);
    if (!text.startsWith('---\n') || end < 0) throw new Error(`${action}/SKILL.md: no frontmatter between two --- lines`);
    const frontmatter = text
      .slice(0, end)
      .split('\n')
      .filter((line) => !/^(disable-model-invocation|argument-hint):/.test(line))
      .map((line) => (line.startsWith('name: ') ? `name: binnacle-${action}` : line))
      // The `skills` CLI reads frontmatter as strict YAML and skips a skill whose plain description holds `: `; JSON's string is a YAML double-quoted scalar.
      .map((line) => {
        const [, value] = /^description:\s*(.*)$/.exec(line) ?? [];
        if (value === undefined || /^["']/.test(value)) return line;
        if (!value || /^[>|]/.test(value)) throw new Error(`${action}/SKILL.md: the description is not on one line`);
        return `description: ${JSON.stringify(value)}`;
      })
      .join('\n');
    const copy = `${frontmatter}\nmetadata:\n  version: "${version}"${text.slice(end)}`.replaceAll(/\/binnacle:([a-z-]+)/g, 'binnacle-$1');
    mkdirSync(join(target, `binnacle-${action}`), { recursive: true });
    writeFileSync(join(target, `binnacle-${action}`, 'SKILL.md'), copy);
  }
}

/**
 * Writes `binnacle-mod` to `target` (ADR-0047): its hooks module and the view, bundled with what they use of
 * `@binnacle/core` into one ES module with no `import()`, which Claude Code refuses, and its manifest, whose
 * version is drawn from the files written, as `preparePlugin` draws `binnacle`'s. Returns the version.
 */
export function prepareMod(target: string): string {
  rmSync(target, { recursive: true, force: true });
  buildSync({
    // The bundle's comments name each module by its path from here, whatever directory the build is run from, so the version does not move with it.
    absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
    entryPoints: [fileURLToPath(new URL('./mod/hooks.ts', import.meta.url))],
    outfile: join(target, 'hooks', 'hooks.js'),
    bundle: true,
    // No Node: the mod runs in Claude Code's own environment.
    platform: 'neutral',
    format: 'esm',
    target: 'es2023',
    logLevel: 'warning',
  });
  writeFileSync(join(target, 'hooks', 'hooks.json'), `${JSON.stringify({ modules: ['./hooks.js'] }, null, 2)}\n`);
  const manifest = join(target, '.claude-plugin', 'plugin.json');
  const fields = {
    name: 'binnacle-mod',
    description:
      "Binnacle's state beside the chat in Claude Code, read from the binnacle MCP server: a status line with the session's Task, role, tokens, context and usage limits, a *Waiting for you* band, a pane by /binnacle-pane, toasts and session-start lines. It writes nothing to the project, and shows nothing without the daemon or in a project that is not registered.",
    author: { name: 'Binnacle' },
  };
  mkdirSync(join(target, '.claude-plugin'));
  writeFileSync(manifest, `${JSON.stringify(fields, null, 2)}\n`);
  const version = digest(target);
  writeFileSync(manifest, `${JSON.stringify({ ...fields, version }, null, 2)}\n`);
  return version;
}

// `pnpm --filter @binnacle/cli run prepare`: this repository's skills-directory plugin, its skills copy and the mod, into this package.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = fileURLToPath(new URL('../../../.claude/skills/binnacle', import.meta.url));
  prepareSkills(source, fileURLToPath(new URL('../skills', import.meta.url)), preparePlugin(source, fileURLToPath(new URL('../plugin', import.meta.url))));
  prepareMod(fileURLToPath(new URL('../mod', import.meta.url)));
}
