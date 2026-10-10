import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

/**
 * A Task's roles, through the snapshot and the brief: the `Roles:` line of its ticket header, or
 * Developer and Reviewer without one, and beside them Binnacle's suggestions, read against a
 * fixed `graph.json` of nine modules, with a fake `graphify` on the daemon's search path so that
 * the graph is available.
 */
type Suggestion = { role: string; reason: string; provenance: string };
type Roles = { required: string[]; source: 'ticket' | 'default'; suggested: Suggestion[] };
type Item = { id: string; roles: Roles };
type Snapshot = { tasks: { inFlight: { items: Item[] }; readyToStart: { items: Item[] } }; attention: { code: string; message: string }[] };

/** Nine modules, `src/m1.ts` to `src/m8.ts` and `src/auth/login.ts`, each its own file of the graph. */
const MODULES = [...Array.from({ length: 8 }, (_, index) => `src/m${index + 1}.ts`), 'src/auth/login.ts'];
const GRAPH = {
  directed: true,
  nodes: MODULES.map((file) => ({ id: file, label: file, file_type: 'code', source_file: file })),
  links: [],
};

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function temporary(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  roots.push(root);
  return root;
}

function write(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'ignore' });
}

function makeProject(): string {
  const root = temporary('binnacle-roles-');
  write(root, '.binnacle/project.yaml', 'version: 1\n\nproject:\n  id: roles\n\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n');
  write(root, '.gitignore', 'graphify-out/\n');
  for (const file of MODULES) write(root, file, 'export {};\n');
  write(root, 'graphify-out/graph.json', JSON.stringify(GRAPH));
  git(root, 'init', '--quiet', '--initial-branch=main');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'Start');
  return root;
}

/** `docs/specs/first/issues/<file>`, READY, with `roles` as its `Roles:` line when given, and `text` as its body. */
function ticket(root: string, file: string, text: string, roles?: string): void {
  const header = ['Status: READY', ...(roles === undefined ? [] : [`Roles: ${roles}`])].join('\n');
  write(root, `docs/specs/first/issues/${file}`, `# ${file.slice(0, 2)}: ${file.slice(3, -3)}\n\n${header}\n\n**What to build:** ${text}\n`);
}

/** Commits the tickets, then a branch for `slug` that changes `files`, and comes back to `main`. */
function branch(root: string, slug: string, files: string[]): void {
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'Tickets', '--allow-empty');
  git(root, 'switch', '--quiet', '-c', `feat/${slug}`);
  for (const file of files) write(root, file, 'export const changed = 1;\n');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '-m', 'Work');
  git(root, 'switch', '--quiet', 'main');
}

function fakeGraphify(): string {
  const dir = temporary('binnacle-roles-bin-');
  writeFileSync(join(dir, 'graphify'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(dir, 'graphify'), 0o755);
  return dir;
}

async function withDaemon(body: (daemon: TestDaemon) => Promise<void>, { graphify = true } = {}): Promise<void> {
  const artifacts = temporary('binnacle-roles-claude-');
  const daemon = await startTestDaemon({ artifacts: { claudeCode: artifacts, codex: join(artifacts, 'no-codex') }, ...(graphify ? { searchPath: fakeGraphify() } : {}) });
  try {
    await body(daemon);
  } finally {
    await daemon.stop();
  }
}

async function snapshot(daemon: TestDaemon, root: string): Promise<Snapshot> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
  const result = await daemon.call<Snapshot>('project.snapshot', { path: root });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

/** Each listed Task's roles, by id, after checking the brief gives the same. */
async function rolesOf(daemon: TestDaemon, root: string): Promise<Record<string, Roles>> {
  const body = await snapshot(daemon, root);
  const roles: Record<string, Roles> = {};
  for (const item of [...body.tasks.inFlight.items, ...body.tasks.readyToStart.items]) {
    const brief = await daemon.call<{ roles: Roles }>('task.get', { path: root, id: item.id });
    assert.equal(brief.status, 200, JSON.stringify(brief.body));
    assert.deepEqual(brief.body.roles, item.roles, item.id);
    roles[item.id] = item.roles;
  }
  return roles;
}

const suggested = (roles: Roles): string[] => roles.suggested.map((item) => item.role);

describe("a Task's roles", () => {
  it('reads the Roles: line in the baseline form, case-insensitively; without one, a Developer and a Reviewer; an unknown word is task.unknown_role and left out', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      ticket(root, '01-named.md', 'something.', 'developer, REVIEWER,  qa , devops, Analyst');
      ticket(root, '02-unnamed.md', 'something.');
      ticket(root, '03-typo.md', 'something.', 'Developer, Reviwer, Developer');

      const roles = await rolesOf(daemon, root);
      assert.deepEqual(roles['first/01'], { required: ['Developer', 'Reviewer', 'QA', 'DevOps', 'Analyst'], source: 'ticket', suggested: [] });
      assert.deepEqual(roles['first/02'], { required: ['Developer', 'Reviewer'], source: 'default', suggested: [] });
      assert.deepEqual(roles['first/03'], { required: ['Developer'], source: 'ticket', suggested: [] });

      const unknown = (await snapshot(daemon, root)).attention.filter((item) => item.code === 'task.unknown_role');
      assert.equal(unknown.length, 1, JSON.stringify(unknown));
      assert.match(unknown[0]!.message, /first\/03/);
      assert.match(unknown[0]!.message, /"Reviwer"/);
    });
  });

  it('suggests an Architect at 8 or more touched modules of the graph, naming how many, and not at 7', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      ticket(root, '01-wide.md', 'a wide change.');
      ticket(root, '02-narrow.md', `change ${MODULES.slice(0, 7).join(', ')}.`);
      ticket(root, '03-named.md', 'a wide change too.', 'Developer, Reviewer, Architect');
      branch(root, 'wide', MODULES.slice(0, 8));
      branch(root, 'named', MODULES.slice(0, 8));

      const roles = await rolesOf(daemon, root);
      assert.deepEqual(roles['first/01']!.suggested.map(({ role, provenance }) => ({ role, provenance })), [{ role: 'Architect', provenance: 'calculated' }]);
      assert.match(roles['first/01']!.suggested[0]!.reason, /\b8 modules\b/);
      assert.deepEqual(suggested(roles['first/02']!), []);
      // A role the line names is not suggested.
      assert.deepEqual(roles['first/03'], { required: ['Developer', 'Reviewer', 'Architect'], source: 'ticket', suggested: [] });
    });
  });

  it("suggests Security when a touched module's path or the ticket's text holds one of the words, naming what matched", async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();
      ticket(root, '01-path.md', 'a change.');
      ticket(root, '02-text.md', 'read the forge with the read-only token, never the `.env` file.');
      ticket(root, '03-named.md', 'store the password.', 'Developer, Reviewer, security');
      ticket(root, '04-clean.md', 'tokenise the authors, in src/m1.ts.');
      branch(root, 'path', ['src/auth/login.ts']);

      const roles = await rolesOf(daemon, root);
      const path = roles['first/01']!.suggested;
      assert.deepEqual(path.map((item) => [item.role, item.provenance]), [['Security', 'calculated']]);
      assert.match(path[0]!.reason, /src\/auth\/login\.ts/);
      assert.match(path[0]!.reason, /\bauth\b/);
      const text = roles['first/02']!.suggested;
      assert.deepEqual(text.map((item) => item.role), ['Security']);
      assert.match(text[0]!.reason, /\btoken\b/);
      assert.match(text[0]!.reason, /\.env\b/);
      assert.deepEqual(suggested(roles['first/03']!), []);
      // `tokenise` and `authors` hold the words, but not as words.
      assert.deepEqual(suggested(roles['first/04']!), []);
    });
  });

  it('suggests only Security, from the text, without a graph', async () => {
    await withDaemon(
      async (daemon) => {
        const root = makeProject();
        ticket(root, '01-wide.md', 'a wide change.');
        ticket(root, '02-text.md', 'rotate the secret.');
        branch(root, 'wide', MODULES);

        const roles = await rolesOf(daemon, root);
        assert.deepEqual(suggested(roles['first/01']!), [], 'neither an Architect nor Security from the branch');
        assert.deepEqual(suggested(roles['first/02']!), ['Security']);
        assert.match(roles['first/02']!.suggested[0]!.reason, /\bsecret\b/);
      },
      { graphify: false },
    );
  });
});
