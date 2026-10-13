import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

// The daemon's `yaml` parser, borrowed as ci-workflow.test.ts does rather than adding a dependency.
const { parse: parseYaml } = createRequire(new URL('../../daemon/package.json', import.meta.url))('yaml') as { parse: (text: string) => unknown };
const ROOT = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), 'utf8');

type Update = {
  'package-ecosystem': string;
  directory: string;
  schedule: { interval: string };
  groups?: Record<string, { 'update-types'?: string[] }>;
};

/** Ticket 02 of release: npm for the workspace and GitHub Actions, weekly, minor and patch grouped. */
test('Dependabot updates npm at the workspace root and GitHub Actions weekly, grouping minor and patch', () => {
  const config = parseYaml(read('.github/dependabot.yml')) as { version: number; updates: Update[] };
  assert.equal(config.version, 2);
  assert.deepEqual(config.updates.map((update) => update['package-ecosystem']), ['npm', 'github-actions']);
  for (const update of config.updates) {
    assert.equal(update.directory, '/');
    assert.equal(update.schedule.interval, 'weekly');
    const groups = Object.values(update.groups ?? {});
    assert.equal(groups.length, 1, `${update['package-ecosystem']}: one group`);
    assert.deepEqual(groups[0]?.['update-types'], ['minor', 'patch']);
  }
});

/** Ticket 02 of release: the policy and its Russian twin, linking each other and the boundary rather than repeating it. */
test("SECURITY.md and SECURITY.ru.md link each other and the architecture's security boundary", () => {
  assert.match(read('docs/01-architecture.md'), /^## Security boundary$/m);
  for (const [page, twin] of [['SECURITY.md', 'SECURITY.ru.md'], ['SECURITY.ru.md', 'SECURITY.md']] as const) {
    const text = read(page);
    assert.ok(text.includes(`](${twin})`), `${page} links ${twin}`);
    assert.ok(text.includes('](docs/01-architecture.md#security-boundary)'), `${page} links the security boundary`);
    assert.match(text, /0\.1\.x/, `${page} names the supported version`);
    assert.ok(text.includes('/security/advisories/new'), `${page} links private vulnerability reporting`);
  }
});
