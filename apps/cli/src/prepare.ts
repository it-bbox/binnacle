import { createHash } from 'node:crypto';
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

// `pnpm --filter @binnacle/cli run prepare`: this repository's skills-directory plugin, into this package.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  preparePlugin(fileURLToPath(new URL('../../../.claude/skills/binnacle', import.meta.url)), fileURLToPath(new URL('../plugin', import.meta.url)));
}
