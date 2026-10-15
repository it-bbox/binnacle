import { spawnSync } from 'node:child_process';
import type { Finding } from '@binnacle/core';
import { resolveGitTimeout } from '@binnacle/daemon';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, posix } from 'node:path';

/** The `.scratch`, the stranded documents, the tests, CI and structure checks, the container setup, the secrets and the security basics of `binn audit`: files only, nothing is run but `git check-ignore` and `git ls-files`. */

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
function packageJson(root: string): { scripts?: { test?: string }; workspaces?: unknown; renovate?: unknown } {
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
const CONTAINER = /^(?!.*\.dockerignore$)(Dockerfile(\..+)?|.+\.Dockerfile|Containerfile|compose\.ya?ml|docker-compose\.ya?ml)$/;

/**
 * The `docker` area: one finding per directory holding a tracked container file, on whether the `.dockerignore`
 * beside it keeps `.env` and `.git` out of the build context; one `ok` when no container file is tracked.
 * A `<Dockerfile>.dockerignore` beside a Dockerfile is read for it instead, as BuildKit does.
 * Only tracked files are read, and nothing is run but `git ls-files`.
 * ponytail: the directory stands for the build context; a `docker build -f` from elsewhere or a compose `build.context`
 * is not followed, read the compose file when a project needs it.
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
    const ignores = [...new Set(containers.map((path) => (files.has(`${path}.dockerignore`) ? `${path}.dockerignore` : `${prefix}.dockerignore`)))];
    const reasons: string[] = [];
    const advice: string[] = [];
    for (const ignore of ignores) {
      let text: string | undefined;
      try {
        if (files.has(ignore)) text = readFileSync(join(root, ignore), 'utf8');
      } catch {
        // A tracked file gone from the working tree is as good as missing.
      }
      if (text === undefined) {
        reasons.push(`no tracked ${ignore}, so docker build sends the whole directory, .env and .git included`);
        advice.push(`add ${ignore} with a line for .env and a line for .git`);
        continue;
      }
      // The .git directory is out when what it holds is: its config can carry a remote's credentials.
      const missing = ['.env', '.git'].filter((name) => !dockerignored(text, name === '.git' ? '.git/config' : name));
      if (missing.length === 0) continue;
      reasons.push(`${ignore} does not exclude ${missing.join(' or ')}, so docker build sends ${missing.length === 1 ? 'it' : 'them'}`);
      advice.push(`add a line for ${missing.join(' and a line for ')} to ${ignore}`);
    }
    const base = { code: 'docker.ignore', area } as const;
    if (reasons.length === 0) return { ...base, status: 'ok', reason: `${containers.join(', ')}: ${ignores.join(' and ')} exclude${ignores.length === 1 ? 's' : ''} .env and .git.` };
    const recommendation = advice.join('; ');
    return { ...base, status: 'gap', reason: `${containers.join(', ')}: ${reasons.join('; ')}.`, recommendation: `${recommendation[0]!.toUpperCase()}${recommendation.slice(1)}.` };
  });
}

/**
 * The token formats the `secrets` area knows: a kind, the token as a regular expression, and the characters it is made of,
 * which may not stand right before or after it, so that a longer string that only looks like a token is none.
 * Each was checked against the provider's documentation and gitleaks' rules; the ticket audit-completed/02 lists the sources.
 */
const TOKEN_FORMATS: { kind: string; token: string; chars?: string }[] = [
  { kind: 'GitHub personal access token (classic)', token: 'ghp_[A-Za-z0-9]{36}', chars: '[A-Za-z0-9_]' },
  { kind: 'GitHub OAuth access token', token: 'gho_[A-Za-z0-9]{36}', chars: '[A-Za-z0-9_]' },
  { kind: 'GitHub App user access token', token: 'ghu_[A-Za-z0-9]{36}', chars: '[A-Za-z0-9_]' },
  { kind: 'GitHub App installation access token', token: 'ghs_[A-Za-z0-9]{36}', chars: '[A-Za-z0-9_]' },
  // The stateless installation token, ghs_<app id>_<JWT>, rolled out from April 2026; a JWT's shortest signature, HS256, is 43 characters.
  { kind: 'GitHub App installation access token', token: 'ghs_[0-9]+_eyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]{43,}', chars: '[A-Za-z0-9_.-]' },
  { kind: 'GitHub App refresh token', token: 'ghr_[A-Za-z0-9]{36}', chars: '[A-Za-z0-9_]' },
  { kind: 'GitHub fine-grained personal access token', token: 'github_pat_[A-Za-z0-9_]{82}', chars: '[A-Za-z0-9_]' },
  { kind: 'GitLab personal access token', token: 'glpat-[A-Za-z0-9_-]{20}', chars: '[A-Za-z0-9_-]' },
  // The routable token of GitLab 17.10 and later: a longer payload, then a dot, a two-character version and a seven-character CRC.
  { kind: 'GitLab personal access token', token: 'glpat-[A-Za-z0-9_-]{27,300}\\.[0-9a-z]{2}[0-9a-z]{7}', chars: '[A-Za-z0-9_.-]' },
  { kind: 'AWS access key id', token: 'AKIA[A-Z0-9]{16}', chars: '[A-Za-z0-9]' },
  { kind: 'AWS temporary access key id', token: 'ASIA[A-Z0-9]{16}', chars: '[A-Za-z0-9]' },
  { kind: 'npm access token', token: 'npm_[A-Za-z0-9]{36}', chars: '[A-Za-z0-9_]' },
  { kind: 'Slack bot token', token: 'xoxb-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24}', chars: '[A-Za-z0-9-]' },
  { kind: 'Slack user token', token: 'xoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[a-f0-9]{32}', chars: '[A-Za-z0-9-]' },
  { kind: 'Slack workspace access token', token: 'xoxa-(?:[0-9]-)?[A-Za-z0-9]{8,48}', chars: '[A-Za-z0-9]' },
  { kind: 'Slack refresh token', token: 'xoxr-(?:[0-9]-)?[A-Za-z0-9]{8,48}', chars: '[A-Za-z0-9]' },
  { kind: 'Slack session token', token: 'xoxs-[0-9]+-[0-9]+-[0-9]+-[a-fA-F0-9]{10,}', chars: '[A-Za-z0-9-]' },
  { kind: 'Anthropic API key', token: 'sk-ant-api03-[A-Za-z0-9_-]{93}AA', chars: '[A-Za-z0-9_-]' },
  { kind: 'Anthropic Admin API key', token: 'sk-ant-admin01-[A-Za-z0-9_-]{93}AA', chars: '[A-Za-z0-9_-]' },
  // T3BlbkFJ is "OpenAI" in base64, in the middle of every OpenAI key.
  { kind: 'OpenAI API key', token: 'sk-(?:proj|svcacct|admin)-(?:[A-Za-z0-9_-]{74}|[A-Za-z0-9_-]{58})T3BlbkFJ(?:[A-Za-z0-9_-]{74}|[A-Za-z0-9_-]{58})', chars: '[A-Za-z0-9_-]' },
  { kind: 'OpenAI API key', token: 'sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}', chars: '[A-Za-z0-9_-]' },
  { kind: 'Google API key', token: 'AIza[A-Za-z0-9_-]{35}', chars: '[A-Za-z0-9_-]' },
  // RFC 7468's PRIVATE KEY and ENCRYPTED PRIVATE KEY, OpenSSL's traditional RSA, DSA and EC, OpenSSH's, and OpenPGP's PRIVATE KEY BLOCK.
  { kind: 'PEM private key', token: '-----BEGIN (?:(?:RSA|DSA|EC|OPENSSH|ENCRYPTED|PGP) )?PRIVATE KEY(?: BLOCK)?-----' },
].map(({ kind, token, chars }) => ({ kind, token: chars ? `(?<!${chars})${token}(?!${chars})` : token }));
const TOKENS = TOKEN_FORMATS.map(({ kind, token }) => ({ kind, pattern: new RegExp(token) }));
/** Every format's start, so that a file with none of them is read once and no further. */
const TOKEN_START = /gh[pousr]_|github_pat_|glpat-|AKIA|ASIA|npm_|xox[bpars]-|sk-|AIza|-----BEGIN /;
/** A file over this size is not read: what is that large is generated, vendored or data. */
const SECRET_SCAN_LIMIT = 1024 * 1024;
/** A tracked `.env` or `.env.<suffix>`, in any directory, but for the documented examples. */
const ENV_FILE = /(^|\/)\.env(\.(?!(example|sample|template)$)[^/]+)?$/;

/** A path as one POSIX shell word, single-quoted when it holds anything but plain characters, so that a pasted command runs nothing a file name planted. */
const shellQuote = (path: string): string => (/^[A-Za-z0-9._/-]+$/.test(path) ? path : `'${path.replaceAll("'", "'\\''")}'`);

/**
 * The `secrets` area: each match of a known token format in a tracked text file, by its path, its line and its kind,
 * each tracked `.env` file, and one `ok` with the number of files read when there is neither. A value is never put
 * in a finding, not even in part. Untracked and ignored files are never read: the list is `git ls-files`. A binary file,
 * one over the size limit and anything that is not a regular file, such as a link pointing out of the repository, is skipped.
 * There is no allowlist: a real key could hide behind one.
 */
export function secrets(root: string): Finding[] {
  const area = 'secrets';
  const listed = tracked(root);
  if (!listed) {
    return [{ code: 'secrets.scan', area, status: 'unknown', reason: 'git ls-files failed, so the tracked files are not known.', recommendation: 'Run git ls-files in the repository to see why.' }];
  }
  const history = "If the commit was ever pushed, the value is in Git's history, and rewriting that history is your decision. The audit reads only the tracked files as they are now; gitleaks scans the history.";
  const found: Finding[] = [];
  let read = 0;
  let skipped = 0;
  for (const path of listed) {
    if (ENV_FILE.test(path)) {
      found.push({
        code: 'secrets.env',
        area,
        status: 'gap',
        reason: `${path} is tracked: an environment file holds secrets whatever it holds today, and every clone gets it.`,
        recommendation: `Stop tracking it with git rm --cached -- ${shellQuote(path)}, add it to .gitignore, rotate every key it held, and commit a .env.example without values instead. ${history}`,
      });
    }
    let bytes: Buffer;
    try {
      const stat = lstatSync(join(root, path));
      if (!stat.isFile() || stat.size > SECRET_SCAN_LIMIT) {
        skipped++;
        continue;
      }
      bytes = readFileSync(join(root, path));
    } catch {
      continue; // A tracked file gone from the working tree has nothing to read.
    }
    // Git's own test for a binary file: a NUL byte in its first 8000 bytes.
    if (bytes.subarray(0, 8000).includes(0)) {
      skipped++;
      continue;
    }
    read++;
    const text = bytes.toString('utf8');
    if (!TOKEN_START.test(text)) continue;
    text.split('\n').forEach((line, at) => {
      if (!TOKEN_START.test(line)) return;
      for (const { kind, pattern } of TOKENS) {
        if (!pattern.test(line)) continue;
        found.push({
          code: 'secrets.token',
          area,
          status: 'gap',
          reason: `${path}:${at + 1}: a token in the format of the ${kind}; the value is not shown.`,
          recommendation: `Remove it from ${path}, and rotate the key at its provider: deleting the line does not revoke it. ${history}`,
        });
      }
    });
  }
  if (found.length > 0) return found;
  return [{ code: 'secrets.scan', area, status: 'ok', reason: `No known token format and no .env file in the ${read} tracked text files read (${skipped} skipped: binary, over ${SECRET_SCAN_LIMIT / 1024 / 1024} MiB or not a regular file).` }];
}

/** Each package manifest with the lockfiles of its ecosystem: npm, pnpm, Yarn and Bun; Cargo; Go; Poetry and uv; Pipenv; Bundler; Composer. */
const LOCKFILES: Record<string, string[]> = {
  'package.json': ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'],
  'Cargo.toml': ['Cargo.lock'],
  'go.mod': ['go.sum'],
  'pyproject.toml': ['poetry.lock', 'uv.lock'],
  Pipfile: ['Pipfile.lock'],
  Gemfile: ['Gemfile.lock'],
  'composer.json': ['composer.lock'],
};
/** Dependabot's configuration, then every place Renovate reads its own (docs.renovatebot.com, *Configuration options*) but `package.json`'s `renovate` key, which is read apart. */
const UPDATES = [
  '.github/dependabot.yml',
  '.github/dependabot.yaml',
  ...['', '.github/', '.gitlab/'].flatMap((dir) => ['json', 'jsonc', 'json5'].map((ext) => `${dir}renovate.${ext}`)),
  '.renovaterc',
  '.renovaterc.json',
  '.renovaterc.jsonc',
  '.renovaterc.json5',
];
/** A security policy where GitHub reads one. */
const POLICY = /^(\.github\/|docs\/)?security\.md$/i;

/**
 * The `security` area: whether each tracked package manifest has a tracked lockfile of its ecosystem in its directory or one
 * above it, as a workspace member has at the root, with no finding when there is no manifest; whether Dependabot or Renovate
 * is configured; and whether a SECURITY.md is where GitHub reads it. Only tracked files count: another clone gets nothing else.
 * ponytail: a go.mod with no dependency needs no go.sum and still reads as a gap; read its require lines if that is ever reported.
 */
export function security(root: string): Finding[] {
  const area = 'security';
  const listed = tracked(root);
  if (!listed) {
    return [{ code: 'security.files', area, status: 'unknown', reason: 'git ls-files failed, so the tracked files are not known.', recommendation: 'Run git ls-files in the repository to see why.' }];
  }
  const files = new Set(listed);
  const found: Finding[] = [];

  const manifests = listed.filter((path) => Object.hasOwn(LOCKFILES, posix.basename(path)));
  if (manifests.length > 0) {
    const used = new Set<string>();
    const bare = manifests.filter((manifest) => {
      const names = LOCKFILES[posix.basename(manifest)]!;
      for (let dir = posix.dirname(manifest); ; dir = posix.dirname(dir)) {
        const lockfile = names.map((name) => (dir === '.' ? name : `${dir}/${name}`)).find((path) => files.has(path));
        if (lockfile) {
          used.add(lockfile);
          return false;
        }
        if (dir === '.') return true;
      }
    });
    const base = { code: 'security.lockfile', area } as const;
    found.push(
      bare.length === 0
        ? { ...base, status: 'ok', reason: `${manifests.length} package manifest${manifests.length === 1 ? '' : 's'}, each with a tracked lockfile in its directory or above it: ${[...used].join(', ')}.` }
        : {
            ...base,
            status: 'gap',
            reason: `No tracked lockfile for ${bare.join(', ')}, so every install resolves the dependencies afresh, and two installs of the same commit can differ.`,
            recommendation: `Install with the project's package manager and commit the lockfile it writes, beside the manifest or at the workspace's root: ${[...new Set(bare.map((path) => LOCKFILES[posix.basename(path)]!.join(' or ')))].join('; ')}.`,
          },
    );
  }

  const updates = UPDATES.find((path) => files.has(path)) ?? (files.has('package.json') && packageJson(root).renovate !== undefined ? 'package.json, its renovate key' : undefined);
  found.push(
    updates
      ? { code: 'security.updates', area, status: 'ok', reason: `Dependency updates are configured: ${updates}.` }
      : {
          code: 'security.updates',
          area,
          status: 'gap',
          reason: 'No Dependabot or Renovate configuration is tracked, so a dependency, and the fix for a vulnerability in it, is updated only when someone thinks of it.',
          recommendation: 'Add .github/dependabot.yml for Dependabot on GitHub, or a renovate.json for Renovate, which also runs on GitLab and other forges.',
        },
  );

  const policy = listed.find((path) => POLICY.test(path));
  found.push(
    policy
      ? { code: 'security.policy', area, status: 'ok', reason: `A security policy: ${policy}.` }
      : {
          code: 'security.policy',
          area,
          status: 'gap',
          reason: 'No SECURITY.md at the root, in .github/ or in docs/. It tells whoever finds a vulnerability how to report it privately instead of in a public issue, which matters once the repository is public.',
          recommendation: "Add SECURITY.md saying how to report a vulnerability privately, by an address or through the forge's private reporting, and which versions get fixes.",
        },
  );
  return found;
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

/**
 * A `.dockerignore` pattern as a regular expression: `*` and `?` stay within a segment, `**` spans any number of them.
 * ponytail: a `[...]` class is read as literal text, so a pattern built on one can give a false gap, never a crash.
 */
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
    else out += literal(char);
  }
  return new RegExp(`^${out}$`);
}
