import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readGitHubTasks, readGitLabTasks } from '@binnacle/adapters';
import { resolveDependencies, type TaskReading } from '@binnacle/core';

/**
 * `pnpm test:live`: the GitHub and GitLab adapters against the owner's test projects, which
 * hold the same fixed issues #1 to #16 (ticket 07 of the tracker epic lists them), read with
 * the read-only token in `BINNACLE_GITHUB_TOKEN` or `BINNACLE_GITLAB_TOKEN`. A forge whose
 * token is absent is skipped, never failed. `pnpm test` does not run this file.
 */

type Project = {
  forge: 'GitHub' | 'GitLab';
  tokenVariable: string;
  repository: string;
  read: (repository: string, host: string | null, token: string | null, perPage?: number) => Promise<TaskReading>;
  /** An issue's web address, up to its number. */
  issueUrl: RegExp;
  permalink: RegExp;
};

const PROJECTS: Project[] = [
  {
    forge: 'GitHub',
    tokenVariable: 'BINNACLE_GITHUB_TOKEN',
    repository: 'it-bbox/binnacle-tracker-fixture',
    read: readGitHubTasks,
    issueUrl: /^https:\/\/github\.com\/it-bbox\/binnacle-tracker-fixture\/issues\//,
    permalink: /^https:\/\/github\.com\/it-bbox\/binnacle-tracker-fixture\/blob\/[0-9a-f]{7,40}\/docs\/specs\/demo\/spec\.md/,
  },
  {
    forge: 'GitLab',
    tokenVariable: 'BINNACLE_GITLAB_TOKEN',
    repository: 'miker059/binnacle-tracker-fixture',
    read: readGitLabTasks,
    // GitLab.com answers with the work item address; `/-/issues/` is its older form.
    issueUrl: /^https:\/\/gitlab\.com\/miker059\/binnacle-tracker-fixture\/-\/(?:issues|work_items)\//,
    permalink: /^https:\/\/gitlab\.com\/miker059\/binnacle-tracker-fixture\/-\/blob\/[0-9a-f]{7,40}\/docs\/specs\/demo\/spec\.md/,
  },
];

/** The state each fixed issue implies, by number: #9 has no header, so no state. */
const STATES = [
  'BACKLOG', 'READY', 'ACTIVE', 'BLOCKED', 'READY_FOR_REVIEW', 'APPROVED', 'MERGE_READY', 'MERGED',
  null, 'DONE', 'DONE', 'CANCELLED', 'DONE', 'READY', 'READY', 'READY',
];

for (const project of PROJECTS) {
  const token = process.env[project.tokenVariable] || null;
  const skip = token === null && `${project.tokenVariable} is not set: the live ${project.forge} tests need a read-only token for ${project.repository}.`;

  describe(`${project.forge} live, ${project.repository}`, { skip }, () => {
    it('reads the fixed issues as the Tasks, states and diagnostics they imply', async () => {
      const { tasks, diagnostics } = await project.read(project.repository, null, token);
      assert.ok(tasks, `no Tasks: ${JSON.stringify(diagnostics)}`);

      // On GitHub, #17 is a pull request, which is not a Task.
      assert.deepEqual(tasks.map((task) => task.id), STATES.map((_, index) => `#${index + 1}`));
      assert.deepEqual(tasks.map((task) => task.state), STATES);
      for (const task of tasks) assert.equal(task.ticket.replace(project.issueUrl, '#'), task.id);

      const byId = new Map(tasks.map((task) => [task.id, task]));
      const two = byId.get('#2')!;
      assert.deepEqual([two.blockedBy, two.spec, two.specSlug, two.triage], [[], 'docs/specs/demo/spec.md', 'demo', 'ready-for-agent']);
      assert.equal(byId.get('#9')!.triage, 'needs-triage');
      assert.deepEqual(byId.get('#14')!.blockedBy, ['#11']);
      assert.deepEqual(byId.get('#15')!.blockedBy, ['#999']);
      const sixteen = byId.get('#16')!;
      assert.match(sixteen.spec ?? '', project.permalink);
      assert.equal(sixteen.specSlug, 'demo');

      const named = (id: string): string => `${id} (${byId.get(id)!.ticket})`;
      assert.deepEqual(diagnostics, [
        { code: 'task.unknown_state', message: `${named('#9')} has no Status: line.` },
        { code: 'tracker.state_mismatch', message: `${named('#10')} is open, but its Status: is DONE.` },
        { code: 'tracker.state_mismatch', message: `${named('#13')} is closed as DONE, but its Status: is ACTIVE.` },
      ]);

      // A dependency on a closed issue is met; one naming no issue is dangling, not unmet.
      const resolved = resolveDependencies(tasks);
      const unmet = new Map(resolved.tasks.map((task) => [task.id, task.unmetDependencies]));
      assert.deepEqual([unmet.get('#14'), unmet.get('#15')], [[], []]);
      assert.deepEqual(resolved.diagnostics.map((item) => item.code), ['task.dangling_dependency']);
      assert.match(resolved.diagnostics[0]!.message, /^#15 .* blocked by #999,/);
    });

    it('follows the real Link pagination to the same Tasks, five issues a page', async () => {
      const whole = await project.read(project.repository, null, token);
      const paged = await project.read(project.repository, null, token, 5);
      assert.equal(paged.tasks?.length, STATES.length);
      assert.deepEqual(paged.tasks, whole.tasks);
      assert.deepEqual(paged.diagnostics, whole.diagnostics);
    });

    // Each closed fixture's Status: agrees with how it was closed, so the Tasks alone cannot
    // show that the close reason was read: GitHub's own field is checked where it reports one.
    if (project.forge === 'GitHub') it('finds the close reasons the adapter reads where GitHub reports them', async () => {
      const response = await fetch(`https://api.github.com/repos/${project.repository}/issues?state=closed&per_page=100`, {
        headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 200);
      const closed = (await response.json()) as { number: number; state_reason: string | null }[];
      assert.deepEqual(
        closed.map((issue) => [issue.number, issue.state_reason]).sort(([a], [b]) => Number(a) - Number(b)),
        [[11, 'completed'], [12, 'not_planned'], [13, 'completed']],
      );
    });

    it('reports a bad token as tracker.unauthorized, naming no token', async () => {
      const bad = 'binnacle-live-test-not-a-token';
      const { tasks, diagnostics } = await project.read(project.repository, null, bad);
      assert.equal(tasks, null);
      assert.deepEqual(diagnostics.map((item) => item.code), ['tracker.unauthorized']);
      assert.match(diagnostics[0]!.message, /\(401\); a token was used\.$/);
      assert.ok(!diagnostics[0]!.message.includes(bad));
    });
  });
}
