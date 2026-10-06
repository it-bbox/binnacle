import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copies the binnacle plugin from `source` to `target` (ADR-0027) and gives the copy's manifest
 * a version drawn from every file of the source, which it returns. Claude Code's `plugin update`
 * refreshes its installed copy only when that version changes; a manifest with none installs as
 * `unknown`, and stays so whatever the skills become.
 */
export function preparePlugin(source: string, target: string): string {
  const hash = createHash('sha256');
  const files = readdirSync(source, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(source, join(entry.parentPath, entry.name)))
    .sort();
  for (const file of files) hash.update(`${file}\0`).update(readFileSync(join(source, file))).update('\0');
  const version = hash.digest('hex').slice(0, 12);

  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  const manifest = join(target, '.claude-plugin', 'plugin.json');
  writeFileSync(manifest, `${JSON.stringify({ ...JSON.parse(readFileSync(manifest, 'utf8')), version }, null, 2)}\n`);
  return version;
}

/**
 * Writes to `target` the copy of the plugin's skills that the `skills` CLI installs into every other
 * harness (ADR-0039): `binnacle-<action>` for each skill, every `/binnacle:<action>` renamed so,
 * the plugin's `version` under `metadata`, and without the fields only Claude Code reads.
 */
export function prepareSkills(source: string, target: string, version: string): void {
  rmSync(target, { recursive: true, force: true });
  for (const action of readdirSync(join(source, 'skills'))) {
    const text = readFileSync(join(source, 'skills', action, 'SKILL.md'), 'utf8');
    const end = text.indexOf('\n---\n', 4);
    if (!text.startsWith('---\n') || end < 0) throw new Error(`${action}/SKILL.md: no frontmatter between two --- lines`);
    const frontmatter = text
      .slice(0, end)
      .split('\n')
      .filter((line) => !/^(disable-model-invocation|argument-hint):/.test(line))
      .map((line) => (line.startsWith('name: ') ? `name: binnacle-${action}` : line))
      .join('\n');
    const copy = `${frontmatter}\nmetadata:\n  version: "${version}"${text.slice(end)}`.replaceAll(/\/binnacle:([a-z-]+)/g, 'binnacle-$1');
    mkdirSync(join(target, `binnacle-${action}`), { recursive: true });
    writeFileSync(join(target, `binnacle-${action}`, 'SKILL.md'), copy);
  }
}

// `pnpm --filter @binnacle/cli run prepare`: this repository's skills-directory plugin, and its skills copy, into this package.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = fileURLToPath(new URL('../../../.claude/skills/binnacle', import.meta.url));
  prepareSkills(source, fileURLToPath(new URL('../skills', import.meta.url)), preparePlugin(source, fileURLToPath(new URL('../plugin', import.meta.url))));
}
