import { spawnSync } from 'node:child_process';
import type { Finding } from '@binnacle/core';
import { resolveGitTimeout } from '@binnacle/daemon';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, posix } from 'node:path';

/** The `.scratch`, the stranded documents, the tests, CI and structure checks and the container setup of `binn audit`: files only, nothing is run but `git check-ignore` and `git ls-files`. */

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
const DURABLE = /(^|[/\-_.])(specs?|tickets?|issues?|prd)([/\-_.]|$)/i;

export function scratch(root: string): Finding[] {
  const area = 'scratch';
  if (!existsSync(join(root, '.scratch'))) return [{ code: 'scratch.exists', area, status: 'ok', reason: 'No .scratch directory, so nothing to check.' }];
  const found: Finding[] = [{ code: 'scratch.exists', area, status: 'ok', reason: '.scratch exists.' }];

  // A path inside it, so that the answer holds whether the rule names the directory or its contents.
  const ignored = spawnSync('git', ['check-ignore', '-q', '--', '.scratch/probe'], { cwd: root, timeout: resolveGitTimeout() }).status === 0;
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

/** The files Git tracks, relative to the root, from `git ls-files`; null when it fails. Nothing untracked or ignored is ever in it. */
function tracked(root: string): string[] | null {
  const listed = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', timeout: resolveGitTimeout() });
  return listed.status === 0 ? listed.stdout.split('\0').filter(Boolean) : null;
}

/** A Markdown or text file, the only kind a stranded document is. */
const TEXT = /\.(md|markdown|mdx|txt)$/i;
/** A path segment that says a plan, a spec, a decision, a TODO, notes, a backlog, a design, an RFC, a PRD, a roadmap or an ADR. */
const STRANDED = /(^|[-_. ])(plans?|planning|specs?|specifications?|decisions?|todos?|notes?|backlogs?|designs?|rfcs?|prds?|roadmaps?|adrs?)([-_. ]|$)/i;
/** Binnacle's places outside knowledge.docs: the root's own files, an instruction file anywhere, and anything in a dot-directory, which holds a harness's settings and skills. */
const PLACES = /^((readme|licen[cs]e|changelog|contributing|security)(\.[^/]*)?|CONTEXT\.md)$|(^|\/)((AGENTS|CLAUDE|GEMINI)(\.local)?\.md$|\.[^/]*\/)/i;

/**
 * The tracked documents outside Binnacle's places whose name or directory says what a plan or a decision is kept in
 * (CONTEXT.md, *Stranded document*). `docs` is knowledge.docs, which holds the roadmap, vision, inbox, specs, ADRs and agent conventions.
 * A matching directory is listed once, as `dir/`. Untracked and ignored files are never read: the list is `git ls-files`.
 */
export function stranded(root: string, docs: string): Finding {
  const base = { code: 'docs.stranded', area: 'docs' } as const;
  const listed = tracked(root);
  if (!listed) {
    return { ...base, status: 'unknown', reason: 'git ls-files failed, so the tracked documents are not known.', recommendation: 'Run git ls-files in the repository to see why.' };
  }
  const files = new Set(['roadmap.md', 'vision.md', 'product-inbox.md'].map((name) => posix.join(docs, name)));
  const dirs = ['specs', 'adr', 'agents'].map((name) => `${posix.join(docs, name)}/`);
  const found = new Set<string>();
  for (const path of listed) {
    if (!TEXT.test(path) || PLACES.test(path) || files.has(path) || dirs.some((dir) => path.startsWith(dir))) continue;
    const segments = path.split('/');
    const at = segments.findIndex((segment) => STRANDED.test(segment));
    if (at !== -1) found.add(at === segments.length - 1 ? path : `${segments.slice(0, at + 1).join('/')}/`);
  }
  if (found.size === 0) return { ...base, status: 'ok', reason: "No tracked document outside Binnacle's places names a plan, a spec, a decision, notes or a roadmap." };
  return {
    ...base,
    status: 'unknown',
    reason: `Documents outside Binnacle's places, where each belongs is a judgement: ${[...found].join(', ')}.`,
    recommendation: 'Run /binnacle:roadmap, which proposes a place for each and moves nothing without your yes.',
  };
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

/** A container file, by its name: what `docker build` or `docker compose` reads from a build context. */
const CONTAINER = /^(Dockerfile(\.(?!dockerignore$).+)?|.+\.Dockerfile|Containerfile|compose\.ya?ml|docker-compose\.ya?ml)$/;

/**
 * The `docker` area: one finding per directory holding a tracked container file, on whether the `.dockerignore`
 * beside it keeps `.env` and `.git` out of the build context; one `ok` when no container file is tracked.
 * The directory stands for the build context. Only tracked files are read, and nothing is run but `git ls-files`.
 */
export function docker(root: string): Finding[] {
  const area = 'docker';
  const listed = tracked(root);
  if (!listed) {
    return [{ code: 'docker.setup', area, status: 'unknown', reason: 'git ls-files failed, so the tracked container files are not known.', recommendation: 'Run git ls-files in the repository to see why.' }];
  }
  const contexts = new Map<string, string[]>();
  for (const path of listed) {
    if (!CONTAINER.test(posix.basename(path))) continue;
    const dir = posix.dirname(path);
    const prefix = dir === '.' ? '' : `${dir}/`;
    contexts.set(prefix, [...(contexts.get(prefix) ?? []), path]);
  }
  if (contexts.size === 0) {
    return [{ code: 'docker.setup', area, status: 'ok', reason: 'No container file is tracked (a Dockerfile, a Containerfile or a compose file), so the project has no container setup to check.' }];
  }
  const files = new Set(listed);
  return [...contexts].map(([prefix, containers]): Finding => {
    const base = { code: 'docker.ignore', area } as const;
    const ignore = `${prefix}.dockerignore`;
    let text: string | undefined;
    try {
      if (files.has(ignore)) text = readFileSync(join(root, ignore), 'utf8');
    } catch {
      // A tracked file gone from the working tree is as good as missing.
    }
    if (text === undefined) {
      return {
        ...base,
        status: 'gap',
        reason: `${containers.join(', ')} with no ${ignore} beside ${containers.length === 1 ? 'it' : 'them'}, so docker build sends the whole directory, .env and .git included.`,
        recommendation: `Add ${ignore} with a line for .env and a line for .git.`,
      };
    }
    // The .git directory is out when what it holds is: its config can carry a remote's credentials.
    const missing = ['.env', '.git'].filter((name) => !dockerignored(text, name === '.git' ? '.git/config' : name));
    if (missing.length === 0) return { ...base, status: 'ok', reason: `${containers.join(', ')}: ${ignore} excludes .env and .git.` };
    return {
      ...base,
      status: 'gap',
      reason: `${ignore} does not exclude ${missing.join(' or ')}, so docker build sends ${missing.length === 1 ? 'it' : 'them'} with the context of ${containers.join(', ')}.`,
      recommendation: `Add a line for ${missing.join(' and a line for ')} to ${ignore}.`,
    };
  });
}

/**
 * Whether `.dockerignore` text excludes `path`, as Docker reads it: a line matches the path or a directory above it,
 * `!` makes an exception, and the last matching line decides.
 */
function dockerignored(text: string, path: string): boolean {
  const segments = path.split('/');
  const candidates = segments.map((_, at) => segments.slice(0, at + 1).join('/'));
  let excluded = false;
  for (const raw of text.split('\n')) {
    let line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const exception = line.startsWith('!');
    if (exception) line = line.slice(1).trim();
    line = posix.normalize(line).replace(/^\/+|\/+$/g, '');
    if (line === '' || line === '.') continue;
    const pattern = dockerPattern(line);
    if (candidates.some((candidate) => pattern.test(candidate))) excluded = !exception;
  }
  return excluded;
}

/** A `.dockerignore` pattern as a regular expression: `*` and `?` stay within a segment, `**` spans any number of them. */
function dockerPattern(pattern: string): RegExp {
  const literal = (char: string) => char.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  let out = '';
  for (let at = 0; at < pattern.length; at++) {
    const char = pattern[at]!;
    if (char === '*' && pattern[at + 1] === '*') {
      at++;
      if (pattern[at + 1] === '/') {
        at++;
        out += '(?:.*/)?';
      } else out += '.*';
    } else if (char === '*') out += '[^/]*';
    else if (char === '?') out += '[^/]';
    else if (char === '\\' && at + 1 < pattern.length) out += literal(pattern[++at]!);
    else if (char === '[' && pattern.indexOf(']', at + 2) !== -1) {
      const end = pattern.indexOf(']', at + 2);
      out += `[${pattern.slice(at + 1, end).replace(/^[!^]/, '^').replace(/\\/g, '\\\\')}]`;
      at = end;
    } else out += literal(char);
  }
  return new RegExp(`^${out}$`);
}
