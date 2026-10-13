import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { preparePlugin, prepareSkills } from './prepare.ts';

/**
 * `pnpm --filter @binnacle/cli build`: the publishable package `@it-bbox/binnacle` (ADR-0044), written
 * to this package's `dist/`, which `npm pack` and `npm publish` run in. It holds `binn` and `binnd`
 * bundled with every dependency, the generated dashboard (ADR-0031), the plugin and its marketplace
 * (ADR-0027), the skills copy (ADR-0039), the licence, the README and a manifest written here.
 * The bundles sit one level below the package, as the sources do below theirs, so that the version
 * and the plugin resolve from either; the daemon's entry and the dashboard tell the layouts apart.
 */

const at = (path: string): string => fileURLToPath(new URL(path, import.meta.url));
const ROOT = at('../../../');
const OUT = at('../dist/');
const PLUGIN_SOURCE = join(ROOT, '.claude', 'skills', 'binnacle');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// pnpm is a `.cmd` shim on Windows, which only a shell runs.
const generate = spawnSync('pnpm', ['--filter', '@binnacle/dashboard', 'generate'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
if (generate.status !== 0) throw new Error(`nuxt generate failed with ${generate.status ?? generate.signal}`);
cpSync(join(ROOT, 'apps', 'dashboard', '.output', 'public'), join(OUT, 'dashboard'), { recursive: true, dereference: true });

await build({
  entryPoints: { binn: at('./bin.ts'), binnd: at('../../daemon/src/bin.ts') },
  outdir: join(OUT, 'bin'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  // A bundled CommonJS dependency requires Node's built-ins, and an ES module has no `require` of its own.
  banner: { js: "import { createRequire as __binnacleRequire } from 'node:module'; const require = __binnacleRequire(import.meta.url);" },
  logLevel: 'warning',
});

prepareSkills(PLUGIN_SOURCE, join(OUT, 'skills'), preparePlugin(PLUGIN_SOURCE, join(OUT, 'plugin')));
cpSync(at('../.claude-plugin'), join(OUT, '.claude-plugin'), { recursive: true });
for (const file of ['LICENSE', 'README.md']) cpSync(join(ROOT, file), join(OUT, file));

const cli = JSON.parse(readFileSync(at('../package.json'), 'utf8')) as { version: string; engines: unknown };
const { repository } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { repository: unknown };
const manifest = {
  name: '@it-bbox/binnacle',
  version: cli.version,
  description: 'Binnacle, a local AI engineering control plane: the binn CLI, its daemon, the dashboard and the binnacle plugin.',
  license: 'Apache-2.0',
  type: 'module',
  bin: { binn: 'bin/binn.js', binnd: 'bin/binnd.js' },
  files: ['bin', 'dashboard', 'plugin', 'skills', '.claude-plugin'],
  engines: cli.engines,
  repository,
  homepage: 'https://github.com/it-bbox/binnacle#readme',
  bugs: { url: 'https://github.com/it-bbox/binnacle/issues' },
  publishConfig: { access: 'public' },
};
writeFileSync(join(OUT, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`@it-bbox/binnacle ${cli.version} written to ${OUT}`);
