import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { after, describe, it } from 'node:test';
import type { ErrorEnvelope } from '../src/index.ts';
import { startTestDaemon, type TestDaemon } from '../src/testing.ts';

const POSIX = process.platform !== 'win32';

type Git =
  | {
      available: true;
      root: string;
      branch: string | null;
      detached: boolean;
      commit: string | null;
      dirty: boolean;
      remotes: { name: string; url: string }[];
    }
  | { available: false; code: string; reason: string };

type Status = {
  project: { id: string | null; name: string | null; path: string };
  manifest: { tracker: { provider: string | null } } | null;
  checkout: { root: string; registered: boolean };
  git: Git;
  diagnostics: { code: string; message: string }[];
};

const manifest = (provider?: string): string => `version: 1

project:
  id: example-project
  name: Example Project
${provider ? `\ntracker:\n  provider: ${provider}\n` : ''}`;

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function temporary(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  roots.push(root);
  return root;
}

function makeProject(text: string = manifest()): string {
  const root = temporary('binnacle-status-');
  mkdirSync(join(root, '.binnacle'));
  writeFileSync(join(root, '.binnacle', 'project.yaml'), text);
  return root;
}

/** Real Git, real commits: the fixtures are never mocked. */
function git(root: string, ...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Binnacle Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args],
    { cwd: root, encoding: 'utf8' },
  ).trim();
}

function makeRepository(options: { commit?: boolean; text?: string } = {}): string {
  const root = makeProject(options.text);
  git(root, 'init', '--quiet', '--initial-branch=main');
  if (options.commit !== false) {
    git(root, 'add', '.');
    git(root, 'commit', '--quiet', '-m', 'Add the project manifest');
  }
  return root;
}

async function withDaemon(body: (daemon: TestDaemon) => Promise<void>): Promise<void> {
  const daemon = await startTestDaemon();
  try {
    await body(daemon);
  } finally {
    await daemon.stop();
  }
}

async function status(daemon: TestDaemon, root: string, path: string = root): Promise<Status> {
  assert.equal((await daemon.call('project.register', { path: root })).status, 200);
  const result = await daemon.call<Status>('project.status', { path });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

/** Runs `body` with PATH pointing somewhere else, restoring it whatever happens. */
async function withPath<T>(path: string, body: () => Promise<T>): Promise<T> {
  const saved = process.env.PATH;
  process.env.PATH = path;
  try {
    return await body();
  } finally {
    process.env.PATH = saved;
  }
}

describe('project status on a normal repository', () => {
  it('returns manifest facts and Git facts together', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository({ text: manifest('github') });
      git(root, 'remote', 'add', 'origin', 'https://github.com/example/project.git');

      const body = await status(daemon, root);
      assert.equal(body.project.id, 'example-project');
      assert.equal(body.project.name, 'Example Project');
      assert.equal(body.manifest?.tracker.provider, 'github');

      assert.ok(body.git.available);
      assert.equal(body.git.root, root);
      assert.equal(body.git.branch, 'main');
      assert.equal(body.git.detached, false);
      assert.equal(body.git.commit, git(root, 'rev-parse', 'HEAD'));
      assert.equal(body.git.dirty, false);
      assert.deepEqual(body.git.remotes, [{ name: 'origin', url: 'https://github.com/example/project.git' }]);
      assert.deepEqual(body.diagnostics, []);
    });
  });

  it('reports a dirty working tree', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      writeFileSync(join(root, 'notes.md'), 'uncommitted\n');

      const body = await status(daemon, root);
      assert.ok(body.git.available);
      assert.equal(body.git.dirty, true);
    });
  });

  it('reports a detached HEAD as detached, with the commit it points at', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      const commit = git(root, 'rev-parse', 'HEAD');
      git(root, 'checkout', '--quiet', '--detach');

      const body = await status(daemon, root);
      assert.ok(body.git.available);
      assert.equal(body.git.detached, true);
      assert.equal(body.git.branch, null);
      assert.equal(body.git.commit, commit);
    });
  });

  it('treats a repository with no commits as a normal result', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository({ commit: false });

      const body = await status(daemon, root);
      assert.ok(body.git.available);
      assert.equal(body.git.branch, 'main');
      assert.equal(body.git.commit, null);
      assert.equal(body.git.detached, false);
    });
  });

  it('treats a repository with no remote as a normal result', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository({ text: manifest('github') });

      const body = await status(daemon, root);
      assert.ok(body.git.available);
      assert.deepEqual(body.git.remotes, []);
      assert.deepEqual(body.diagnostics, []);
    });
  });

  it('never echoes credentials embedded in a remote URL', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      git(root, 'remote', 'add', 'origin', 'https://someone:s3cret-token@github.com/example/project.git');
      git(root, 'remote', 'add', 'mirror', 'ssh://git:s3cret-token@git.example.com/example/project.git');

      const body = await status(daemon, root);
      assert.ok(body.git.available);
      assert.deepEqual(body.git.remotes, [
        { name: 'mirror', url: 'ssh://git@git.example.com/example/project.git' },
        { name: 'origin', url: 'https://github.com/example/project.git' },
      ]);
      assert.ok(!JSON.stringify(body).includes('s3cret-token'));
    });
  });

  it('reads Git live at call time rather than from the projection', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      const before = await status(daemon, root);

      git(root, 'commit', '--quiet', '--allow-empty', '-m', 'Move HEAD');
      git(root, 'checkout', '--quiet', '-b', 'feat/elsewhere');

      const now = await status(daemon, root);
      assert.ok(before.git.available && now.git.available);
      assert.notEqual(now.git.commit, before.git.commit);
      assert.equal(now.git.branch, 'feat/elsewhere');

      const listed = await daemon.call<{ projects: Record<string, unknown>[] }>('project.list');
      for (const key of ['git', 'branch', 'commit', 'dirty', 'remotes']) {
        assert.ok(!(key in listed.body.projects[0]!), `the projection must not carry "${key}"`);
      }
    });
  });
});

describe('Git is only ever inspected', () => {
  /** Every path and byte under `.git`, so that a refreshed index or a new ref shows up. */
  function fingerprint(root: string): string {
    const hash = createHash('sha256');
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir).sort()) {
        const path = join(dir, name);
        hash.update(path);
        if (statSync(path).isDirectory()) walk(path);
        else hash.update(readFileSync(path));
      }
    };
    walk(join(root, '.git'));
    return hash.digest('hex');
  }

  it('leaves the index, refs and config untouched, even when a plain `git status` would refresh the index', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      git(root, 'remote', 'add', 'origin', 'https://github.com/example/project.git');
      // A tracked file whose mtime moved but whose content did not: exactly what makes an
      // ordinary `git status` rewrite the index to refresh its stat cache.
      const future = new Date(Date.now() + 60_000);
      utimesSync(join(root, '.binnacle', 'project.yaml'), future, future);
      await daemon.call('project.register', { path: root });

      const before = fingerprint(root);
      assert.equal((await daemon.call('project.status', { path: root })).status, 200);
      assert.equal(fingerprint(root), before);
    });
  });

  it('runs no command that the repository configuration names', { skip: !POSIX && 'needs a POSIX shell script' }, async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      const witness = join(temporary('binnacle-witness-'), 'ran');
      const hook = join(temporary('binnacle-hook-'), 'fsmonitor.sh');
      writeFileSync(hook, `#!/bin/sh\ntouch '${witness}'\n`);
      chmodSync(hook, 0o755);
      git(root, 'config', 'core.fsmonitor', hook);

      const body = await status(daemon, root);
      assert.ok(body.git.available);
      assert.ok(!existsSync(witness), 'status must not run the configured fsmonitor hook');
    });
  });

  it('counts untracked files as dirty whatever the user configured status to show', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      git(root, 'config', 'status.showUntrackedFiles', 'no');
      writeFileSync(join(root, 'notes.md'), 'untracked\n');

      const body = await status(daemon, root);
      assert.ok(body.git.available);
      assert.equal(body.git.dirty, true);
    });
  });
});

describe('project status without usable Git', () => {
  it('registers a directory outside Git and reports Git facts unavailable, with a reason', async () => {
    await withDaemon(async (daemon) => {
      const root = makeProject();

      const body = await status(daemon, root);
      assert.equal(body.project.id, 'example-project');
      assert.equal(body.git.available, false);
      assert.ok(!body.git.available);
      assert.equal(body.git.code, 'git.not_a_repository');
      assert.ok(body.git.reason.length > 0);
    });
  });

  it('degrades the same way when there is no git on PATH, and the daemon carries on', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      await daemon.call('project.register', { path: root });

      const result = await withPath(temporary('binnacle-empty-path-'), () =>
        daemon.call<Status>('project.status', { path: root }),
      );
      assert.equal(result.status, 200);
      assert.ok(!result.body.git.available);
      assert.equal(result.body.git.code, 'git.not_found');
      assert.equal(result.body.project.id, 'example-project');

      assert.equal((await daemon.call('daemon.status')).status, 200);
    });
  });

  it('gives up on a git that hangs rather than hanging the API', { skip: !POSIX && 'needs a POSIX shell script' }, async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      await daemon.call('project.register', { path: root });

      const bin = temporary('binnacle-hung-git-');
      writeFileSync(join(bin, 'git'), '#!/bin/sh\nexec sleep 30\n');
      chmodSync(join(bin, 'git'), 0o755);

      const saved = process.env.BINNACLE_GIT_TIMEOUT_MS;
      process.env.BINNACLE_GIT_TIMEOUT_MS = '200';
      try {
        const started = Date.now();
        // Ahead of the real PATH, so this git shadows the real one and `sleep` still resolves.
        const result = await withPath(`${bin}${delimiter}${process.env.PATH}`, () =>
          daemon.call<Status>('project.status', { path: root }),
        );
        assert.ok(Date.now() - started < 5_000, 'status must not wait for the hung git');
        assert.equal(result.status, 200);
        assert.ok(!result.body.git.available);
        assert.equal(result.body.git.code, 'git.timeout');
      } finally {
        if (saved === undefined) delete process.env.BINNACLE_GIT_TIMEOUT_MS;
        else process.env.BINNACLE_GIT_TIMEOUT_MS = saved;
      }
    });
  });
});

describe('a tracker that disagrees with the Git remote', () => {
  it('is reported as a diagnostic and not resolved', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository({ text: manifest('github') });
      git(root, 'remote', 'add', 'origin', 'git@gitlab.com:example/project.git');

      const body = await status(daemon, root);
      assert.equal(body.manifest?.tracker.provider, 'github');
      assert.ok(body.git.available);
      assert.equal(body.git.remotes[0]?.url, 'git@gitlab.com:example/project.git');
      assert.deepEqual(
        body.diagnostics.map((diagnostic) => diagnostic.code),
        ['tracker.remote_mismatch'],
      );
    });
  });

  it('is not raised against a tracker nobody declared, or a local one', async () => {
    await withDaemon(async (daemon) => {
      for (const text of [manifest(), manifest('local')]) {
        const root = makeRepository({ text });
        git(root, 'remote', 'add', 'origin', 'https://gitlab.com/example/project.git');
        assert.deepEqual((await status(daemon, root)).diagnostics, []);
      }
    });
  });
});

describe('detecting a project from a working directory', () => {
  it('maps the repository root and any nested subdirectory to the project', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      const nested = join(root, 'src', 'deep');
      mkdirSync(nested, { recursive: true });
      await daemon.call('project.register', { path: root });

      for (const path of [root, nested]) {
        const detected = await daemon.call<{ project: Status['project'] }>('project.detect', { path });
        assert.equal(detected.status, 200);
        assert.equal(detected.body.project.path, root);
        assert.equal(detected.body.project.id, 'example-project');
      }

      // Status takes the same working directory, so an agent needs no second lookup.
      const body = await status(daemon, root, nested);
      assert.equal(body.project.path, root);
    });
  });

  it('says so explicitly on a directory no registered project contains', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      await daemon.call('project.register', { path: root });
      const outside = temporary('binnacle-outside-');

      for (const operation of ['project.detect', 'project.status']) {
        const result = await daemon.call<ErrorEnvelope>(operation, { path: outside });
        assert.equal(result.status, 404);
        assert.equal(result.body.error.code, 'project.not_registered');
      }
    });
  });

  it('does not take a sibling whose name merely starts the same for a parent', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      await daemon.call('project.register', { path: root });
      const sibling = `${root}-sibling`;
      mkdirSync(sibling);
      roots.push(sibling);

      const result = await daemon.call<ErrorEnvelope>('project.detect', { path: sibling });
      assert.equal(result.status, 404);
    });
  });
});

describe('a linked worktree', () => {
  type Detected = { project: Status['project'] };

  /** A real linked worktree of `root` at `at`, on its own new branch with its own commit. */
  function addWorktree(root: string, at: string, branch: string): string {
    git(root, 'worktree', 'add', '--quiet', '-b', branch, at);
    git(at, 'commit', '--quiet', '--allow-empty', '-m', `Work on ${branch}`);
    return realpathSync(at);
  }

  it('inside the repository reports its own Git facts and names its checkout', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      // As this repository does, so that the worktree does not make the main checkout dirty.
      writeFileSync(join(root, '.git', 'info', 'exclude'), '.claude/worktrees/\n');
      const worktree = addWorktree(root, join(root, '.claude', 'worktrees', 'probe'), 'feat/probe');
      writeFileSync(join(worktree, 'notes.md'), 'uncommitted\n');

      const nested = join(worktree, 'src');
      mkdirSync(nested);
      for (const path of [worktree, nested]) {
        const body = await status(daemon, root, path);
        assert.equal(body.project.path, root);
        assert.ok(body.git.available);
        assert.equal(body.git.branch, 'feat/probe');
        assert.equal(body.git.commit, git(worktree, 'rev-parse', 'HEAD'));
        assert.equal(body.git.dirty, true);
        assert.deepEqual(body.checkout, { root: worktree, registered: false });
      }

      const main = await status(daemon, root);
      assert.ok(main.git.available);
      assert.equal(main.git.branch, 'main');
      assert.equal(main.git.dirty, false);
      assert.deepEqual(main.checkout, { root, registered: true });
    });
  });

  it('outside the repository is detected through Git and reports its own Git facts', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      const worktree = addWorktree(root, `${root}-sibling`, 'feat/sibling');
      roots.push(worktree);
      await daemon.call('project.register', { path: root });

      const detected = await daemon.call<Detected>('project.detect', { path: worktree });
      assert.equal(detected.status, 200, JSON.stringify(detected.body));
      assert.equal(detected.body.project.path, root);
      assert.equal(detected.body.project.id, 'example-project');

      const body = await status(daemon, root, worktree);
      assert.ok(body.git.available);
      assert.equal(body.git.branch, 'feat/sibling');
      assert.deepEqual(body.checkout, { root: worktree, registered: false });
    });
  });

  it('is not confused with a separate repository nested inside the project', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      const vendored = join(root, 'vendor', 'other');
      mkdirSync(vendored, { recursive: true });
      git(vendored, 'init', '--quiet', '--initial-branch=vendored');
      git(vendored, 'commit', '--quiet', '--allow-empty', '-m', 'Vendored');

      const body = await status(daemon, root, vendored);
      assert.equal(body.project.path, root);
      assert.ok(body.git.available);
      assert.equal(body.git.root, root);
      assert.equal(body.git.branch, 'main');
      assert.deepEqual(body.checkout, { root, registered: true });
    });
  });

  it('a separate repository outside every project is still not registered', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      await daemon.call('project.register', { path: root });
      const other = makeRepository();

      const result = await daemon.call<ErrorEnvelope>('project.detect', { path: other });
      assert.equal(result.status, 404);
      assert.equal(result.body.error.code, 'project.not_registered');
    });
  });

  it('costs detect no Git call when a registered project contains the path', { skip: !POSIX && 'needs a POSIX shell script' }, async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      const worktree = addWorktree(root, join(root, '.claude', 'worktrees', 'probe'), 'feat/probe');
      await daemon.call('project.register', { path: root });

      const witness = join(temporary('binnacle-witness-'), 'ran');
      const bin = temporary('binnacle-watched-git-');
      writeFileSync(join(bin, 'git'), `#!/bin/sh\ntouch '${witness}'\nexit 1\n`);
      chmodSync(join(bin, 'git'), 0o755);

      const detected = await withPath(bin, () => daemon.call<Detected>('project.detect', { path: worktree }));
      assert.equal(detected.status, 200);
      assert.equal(detected.body.project.path, root);
      assert.ok(!existsSync(witness), 'detect by containment must not run git');
    });
  });

  it('degrades as before without git: containment still detects, and nothing else is found', async () => {
    await withDaemon(async (daemon) => {
      const root = makeRepository();
      const sibling = addWorktree(root, `${root}-sibling`, 'feat/sibling');
      roots.push(sibling);
      const outsideGit = makeProject();
      await daemon.call('project.register', { path: root });
      await daemon.call('project.register', { path: outsideGit });

      await withPath(temporary('binnacle-empty-path-'), async () => {
        for (const path of [root, outsideGit]) {
          const detected = await daemon.call<Detected>('project.detect', { path });
          assert.equal(detected.status, 200);
          assert.equal(detected.body.project.path, path);
        }
        const status = await daemon.call<Status>('project.status', { path: outsideGit });
        assert.equal(status.status, 200);
        assert.ok(!status.body.git.available);
        assert.deepEqual(status.body.checkout, { root: outsideGit, registered: true });

        const lost = await daemon.call<ErrorEnvelope>('project.detect', { path: sibling });
        assert.equal(lost.status, 404);
        assert.equal(lost.body.error.code, 'project.not_registered');
      });
    });
  });
});
