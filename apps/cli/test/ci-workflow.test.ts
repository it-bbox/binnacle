import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

// The daemon's `yaml` parser, borrowed as pack.test.ts does rather than adding a dependency.
const { parse: parseYaml } = createRequire(new URL('../../daemon/package.json', import.meta.url))('yaml') as { parse: (text: string) => unknown };
const WORKFLOW = new URL('../../../.github/workflows/ci.yml', import.meta.url);

type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
type Workflow = { on: { push: { branches: string[] } }; jobs: Record<string, { 'runs-on': string; steps: Step[] }> };

/** The spec's workflow (the-state-of-work, *The workflow*), checked on the file rather than assumed. */
test('the repository workflow runs the typecheck and the offline tests on push to main and on pull requests, with no secret', () => {
  const text = readFileSync(WORKFLOW, 'utf8');
  const workflow = parseYaml(text) as Workflow;

  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.ok('pull_request' in workflow.on);

  const jobs = Object.values(workflow.jobs);
  assert.equal(jobs.length, 1);
  const [job] = jobs;
  assert.ok(job);
  assert.equal(job['runs-on'], 'ubuntu-latest');

  const pnpm = job.steps.find((step) => step.uses?.startsWith('pnpm/action-setup@'));
  assert.ok(pnpm, 'pnpm/action-setup');
  assert.equal(pnpm.with?.version, undefined, 'pnpm takes its version from packageManager');
  const node = job.steps.find((step) => step.uses?.startsWith('actions/setup-node@'));
  assert.equal(node?.with?.['node-version'], 24);

  assert.deepEqual(
    job.steps.flatMap((step) => (step.run ? [step.run] : [])),
    ['pnpm install --frozen-lockfile', 'pnpm typecheck', 'pnpm test'],
  );
  assert.doesNotMatch(text, /secrets\./);
});
