import { spawnSync } from 'node:child_process';
import type { Finding } from '@binnacle/core';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/** The `.scratch` and the tests, CI and structure areas of `binn audit`: files only, nothing is run but `git check-ignore`. */

/** Every file under `dir` as a path relative to it; an unreadable or missing directory is empty. */
function files(dir: string, prefix = '', depth = 6): string[] {
  if (depth === 0) return [];
  try {
    return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? (entry.name === 'node_modules' ? [] : files(dir, `${prefix}${entry.name}/`, depth - 1)) : [`${prefix}${entry.name}`],
    );
  } catch {
    return [];
  }
}

/**
 * `.scratch` is durable when a Markdown file under it, on a path that says spec, ticket, issue or PRD,
 * has no namesake under `docs/specs/`: it is then the only copy of something that belongs in Git (ADR-0005, ADR-0017).
 * ponytail: a namesake counts as the copy, its content is not compared.
 */
const DURABLE = /(spec|ticket|issue|prd)/i;

export function scratch(root: string): Finding[] {
  const area = 'scratch';
  if (!existsSync(join(root, '.scratch'))) return [{ code: 'scratch.exists', area, status: 'ok', reason: 'No .scratch directory, so nothing to check.' }];
  const found: Finding[] = [{ code: 'scratch.exists', area, status: 'ok', reason: '.scratch exists.' }];

  // A path inside it, so that the answer holds whether the rule names the directory or its contents.
  const ignored = spawnSync('git', ['check-ignore', '-q', '--', '.scratch/probe'], { cwd: root }).status === 0;
  found.push(
    ignored
      ? { code: 'scratch.ignored', area, status: 'ok', reason: 'Git ignores .scratch.' }
      : {
          code: 'scratch.ignored',
          area,
          status: 'gap',
          reason: 'Git does not ignore .scratch, so its working files can be committed by mistake.',
          recommendation: 'Add .scratch/ to .gitignore.',
        },
  );

  const tracked = new Set(files(join(root, 'docs/specs')).map((path) => basename(path)));
  const only = files(join(root, '.scratch')).filter((path) => path.endsWith('.md') && DURABLE.test(path) && !tracked.has(basename(path)));
  found.push(
    only.length === 0
      ? { code: 'scratch.durable', area, status: 'ok', reason: '.scratch holds no spec or ticket that is not also under docs/specs/.' }
      : {
          code: 'scratch.durable',
          area,
          status: 'gap',
          reason: `.scratch holds what looks like the only copy of a spec or a ticket: ${only.map((path) => `.scratch/${path}`).join(', ')}.`,
          recommendation: 'Move each into Git, a spec under docs/specs/<slug>/ and its tickets under docs/specs/<slug>/issues/, before a worktree removal loses it.',
        },
  );
  return found;
}

const TEST_FILES = ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts', 'jest.config.js', 'jest.config.ts', 'jest.config.cjs', 'playwright.config.ts', 'pytest.ini', 'tox.ini', 'phpunit.xml', 'karma.conf.js'];
const TEST_DIRS = ['test', 'tests', '__tests__', 'spec'];
const CI_FILES = ['.gitlab-ci.yml', '.circleci/config.yml', 'Jenkinsfile', 'azure-pipelines.yml', '.travis.yml', 'bitbucket-pipelines.yml'];
const WORKSPACE_FILES = ['pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json'];
const MANIFESTS = ['package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle', 'Gemfile', 'composer.json'];

/** The root's package.json as an object; `{}` when it is missing or not JSON. */
function packageJson(root: string): { scripts?: { test?: string }; workspaces?: unknown } {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  } catch {
    return {};
  }
}

export function structure(root: string): Finding[] {
  const area = 'structure';
  const has = (path: string) => existsSync(join(root, path));
  const pkg = packageJson(root);

  const testScript = typeof pkg.scripts?.test === 'string' && !/no test specified/.test(pkg.scripts.test);
  const tests = [...(testScript ? ['a test script in package.json'] : []), ...[...TEST_FILES, ...TEST_DIRS.map((dir) => `${dir}/`)].filter(has)];
  const ci = [...files(join(root, '.github/workflows')).filter((path) => /\.ya?ml$/.test(path)).map((path) => `.github/workflows/${path}`), ...CI_FILES.filter(has)];

  const workspace = WORKSPACE_FILES.find(has) ?? (pkg.workspaces ? 'workspaces in package.json' : undefined);
  const manifest = MANIFESTS.find(has);

  return [
    tests.length > 0
      ? { code: 'structure.tests', area, status: 'ok', reason: `A test setup: ${tests.join(', ')}. It was not run.` }
      : { code: 'structure.tests', area, status: 'gap', reason: 'No test setup found: no test script, test configuration or test directory.', recommendation: 'Add tests and a command that runs them, so a change can be checked.' },
    ci.length > 0
      ? { code: 'structure.ci', area, status: 'ok', reason: `A CI configuration: ${ci.join(', ')}. It was not run.` }
      : { code: 'structure.ci', area, status: 'gap', reason: 'No CI configuration found.', recommendation: 'Add a CI pipeline that runs the tests on every push.' },
    workspace
      ? { code: 'structure.shape', area, status: 'ok', reason: `A workspace of packages (${workspace}).` }
      : manifest
        ? { code: 'structure.shape', area, status: 'ok', reason: `A single package (${manifest}).` }
        : { code: 'structure.shape', area, status: 'unknown', reason: 'No package manifest or workspace file at the root, so the shape of the project is not known from files.', recommendation: 'If the project is a monorepo, say so in AGENTS.md.' },
  ];
}
