import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

// The daemon's `yaml` parser, borrowed as pack.test.ts does rather than adding a dependency.
const { parse: parseYaml } = createRequire(new URL('../../daemon/package.json', import.meta.url))('yaml') as { parse: (text: string) => unknown };
const WORKFLOW = new URL('../../../.github/workflows/ci.yml', import.meta.url);

type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
type Job = { 'runs-on': string; 'timeout-minutes'?: number; strategy?: { matrix: { os: string[] } }; steps: Step[] };
type Workflow = { on: { push: { branches: string[] } }; jobs: Record<string, Job> };

/** The spec's workflow (the-state-of-work, *The workflow*), checked on the file rather than assumed. */
test('the repository workflow runs the typecheck and the offline tests on push to main and on pull requests, with no secret', () => {
  const text = readFileSync(WORKFLOW, 'utf8');
  const workflow = parseYaml(text) as Workflow;

  assert.deepEqual(workflow.on.push.branches, ['main']);
  assert.ok('pull_request' in workflow.on);

  assert.deepEqual(Object.keys(workflow.jobs), ['check', 'autostart-live', 'tarball-live']);
  const job = workflow.jobs.check;
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

/** Ticket 07 of daemon-autostart: the live autostart test on each runner, with the real service manager, never in `pnpm test`. */
test('the workflow runs the live autostart test on Linux, macOS and Windows runners, with a timeout', () => {
  const workflow = parseYaml(readFileSync(WORKFLOW, 'utf8')) as Workflow;
  const job = workflow.jobs['autostart-live'];
  assert.ok(job);
  assert.deepEqual(job.strategy?.matrix.os, ['ubuntu-latest', 'macos-latest', 'windows-latest']);
  assert.equal(job['runs-on'], '${{ matrix.os }}');
  assert.ok(job['timeout-minutes'] && job['timeout-minutes'] <= 20, 'a timeout');
  const runs = job.steps.flatMap((step) => (step.run ? [step.run] : []));
  assert.ok(runs.includes('pnpm install --frozen-lockfile'));
  assert.equal(runs.at(-1), 'node --test apps/cli/test/autostart.live.ts');

  const scripts = (JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> }).scripts;
  assert.doesNotMatch(scripts.test ?? '', /live/, '`pnpm test` runs only *.test.ts');
});

/** Ticket 03 of release: the packed `@it-bbox/binnacle`, installed and driven on each runner, never in `pnpm test`. */
test('the workflow runs the tarball test on Linux, macOS and Windows runners, with a timeout', () => {
  const workflow = parseYaml(readFileSync(WORKFLOW, 'utf8')) as Workflow;
  const job = workflow.jobs['tarball-live'];
  assert.ok(job);
  assert.deepEqual(job.strategy?.matrix.os, ['ubuntu-latest', 'macos-latest', 'windows-latest']);
  assert.equal(job['runs-on'], '${{ matrix.os }}');
  assert.ok(job['timeout-minutes'] && job['timeout-minutes'] <= 20, 'a timeout');
  const node = job.steps.find((step) => step.uses?.startsWith('actions/setup-node@'));
  assert.equal(node?.with?.['node-version'], 24);
  const runs = job.steps.flatMap((step) => (step.run ? [step.run] : []));
  assert.ok(runs.includes('pnpm install --frozen-lockfile'));
  assert.equal(runs.at(-1), 'node --test apps/cli/test/tarball.live.ts');
});
