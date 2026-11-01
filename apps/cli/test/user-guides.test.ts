import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const twinOf = (page: string): string => page.replace(/\.md$/, '.ru.md');

/** The user guides AGENTS.md names, in English: each has a `*.ru.md` twin beside it. */
const englishGuides = (root: string): string[] => [
  ...['README.md', 'CONTRIBUTING.md', 'SECURITY.md'],
  ...readdirSync(join(root, 'docs/operations'))
    .filter((name) => name.endsWith('.md') && !name.endsWith('.ru.md'))
    .map((name) => `docs/operations/${name}`),
];

/** Relative link targets, outside code, without their fragment. */
const relativeLinks = (text: string): string[] =>
  [...text.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '').matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1]!)
    .filter((target) => !/^[a-z]+:/i.test(target) && !target.startsWith('#'))
    .map((target) => target.split('#')[0]!);

/** What breaks the rule in a checkout at `root`: a missing twin, a broken relative link, a Russian page linking an English guide, a page not linking its twin, an install name that does not exist. */
const guideProblems = (root: string): string[] => {
  const problems: string[] = [];
  const english = englishGuides(root);
  for (const page of english) {
    if (!existsSync(join(root, page))) problems.push(`${page}: missing`);
    if (!existsSync(join(root, twinOf(page)))) problems.push(`${page}: no Russian twin ${twinOf(page)}`);
  }
  for (const page of english.flatMap((page) => [page, twinOf(page)]).filter((page) => existsSync(join(root, page)))) {
    const text = readFileSync(join(root, page), 'utf8');
    const russian = page.endsWith('.ru.md');
    const twin = russian ? page.replace(/\.ru\.md$/, '.md') : twinOf(page);
    const targets = relativeLinks(text).map((target) => posix.normalize(posix.join(posix.dirname(page), target)));
    for (const target of targets) {
      if (!existsSync(join(root, target))) problems.push(`${page}: broken link ${target}`);
      else if (russian && target !== twin && english.includes(target)) problems.push(`${page}: links the English ${target}, not ${twinOf(target)}`);
    }
    if (!targets.includes(twin)) problems.push(`${page}: does not link its twin ${twin}`);
    if (/npx binn\b|(?:npm|pnpm) (?:i|install|add) (?:-g )?@binnacle\/cli/.test(text)) problems.push(`${page}: names an install that does not exist`);
  }
  return problems;
};

/** Ticket 04 of release: every user guide has its Russian twin, and their links resolve. */
test('every user guide has a Russian twin, each links the other, the Russian pages link the Russian pages, and every relative link resolves', () => {
  assert.deepEqual(guideProblems(ROOT), []);
});

/** Ticket 11 of showcase-and-launch: the README links the site's pages, not one address for everything. */
test('the README and its twin link the site home, the quick start and the guides', () => {
  for (const [page, site] of [
    ['README.md', 'https://it-bbox.github.io/binnacle/'],
    ['README.ru.md', 'https://it-bbox.github.io/binnacle/ru/'],
  ] as const) {
    const text = readFileSync(join(ROOT, page), 'utf8');
    for (const href of [site, `${site}quick-start`, `${site}operations/01-new-project`])
      assert.ok(text.includes(`href="${href}"`), `${page}: no link to ${href}`);
  }
});

/** Ticket 13 of showcase-and-launch: every page naming `BINNACLE_PORT` for `binn daemon start` says it holds with autostart off, since the autostart unit drops the variable. */
test('the README, the landing and the quick starts tie BINNACLE_PORT to autostart off', () => {
  for (const [page, condition] of [
    ['README.md', 'with autostart off'],
    ['README.ru.md', 'с выключенным автозапуском'],
    ['docs/index.md', 'with autostart off'],
    ['docs/index.ru.md', 'с выключенным автозапуском'],
    ['docs/quick-start.md', 'with autostart off'],
    ['docs/quick-start.ru.md', 'с выключенным автозапуском'],
  ] as const) {
    const lines = readFileSync(join(ROOT, page), 'utf8').split('\n').filter((line) => line.includes('BINNACLE_PORT'));
    assert.ok(lines.length > 0, `${page}: does not name BINNACLE_PORT`);
    for (const line of lines) assert.ok(line.includes(condition), `${page}: BINNACLE_PORT without "${condition}": ${line}`);
  }
});

test('the guide check fails on a missing twin, a broken link, a Russian page linking an English guide and an install that does not exist', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'binnacle-guides-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path: string, text: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const pages = {
    'README.md': '[ru](README.ru.md) [guide](docs/operations/01-a.md#step) [site](https://example.com) [top](#top) `[code](nowhere.md)`\n',
    'README.ru.md': '[en](README.md) [guide](docs/operations/01-a.ru.md)\n',
    'CONTRIBUTING.md': '[ru](CONTRIBUTING.ru.md)\n```text\n[fenced](nowhere.md)\n```\n',
    'CONTRIBUTING.ru.md': '[en](CONTRIBUTING.md)\n',
    'SECURITY.md': '[ru](SECURITY.ru.md)\n',
    'SECURITY.ru.md': '[en](SECURITY.md)\n',
    'docs/operations/01-a.md': '[ru](01-a.ru.md) [home](../../README.md)\n',
    'docs/operations/01-a.ru.md': '[en](01-a.md) [home](../../README.ru.md)\n',
  };
  for (const [path, text] of Object.entries(pages)) write(path, text);
  assert.deepEqual(guideProblems(root), []);

  rmSync(join(root, 'SECURITY.ru.md'));
  write('CONTRIBUTING.ru.md', 'no link\n');
  write('docs/operations/01-a.md', '[ru](01-a.ru.md) [gone](02-gone.md) `npm i -g @binnacle/cli`\n');
  write('docs/operations/01-a.ru.md', '[en](01-a.md) [home](../../README.md) npx binn init\n');
  assert.deepEqual(guideProblems(root), [
    'SECURITY.md: no Russian twin SECURITY.ru.md',
    'CONTRIBUTING.ru.md: does not link its twin CONTRIBUTING.md',
    'SECURITY.md: broken link SECURITY.ru.md',
    'docs/operations/01-a.md: broken link docs/operations/02-gone.md',
    'docs/operations/01-a.md: names an install that does not exist',
    'docs/operations/01-a.ru.md: links the English README.md, not README.ru.md',
    'docs/operations/01-a.ru.md: names an install that does not exist',
  ]);
});
