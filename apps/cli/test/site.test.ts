import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PAGE = join(ROOT, 'site/index.html');

/** The page without its style and script: what a reader sees, and the images and links it names. */
const page = (): string =>
  readFileSync(PAGE, 'utf8')
    .replace(/<style>[\s\S]*?<\/style>/g, '')
    .replace(/<script>[\s\S]*?<\/script>/g, '');

/** One language's write-up on the page, without its tags. */
const article = (html: string, language: string): string => {
  const found = html.match(new RegExp(`<article[^>]*lang="${language}"[^>]*>([\\s\\S]*?)</article>`));
  assert.ok(found, `no ${language} article`);
  return found[1]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
};

/** The digits of every number, so that `28,470` and `28 470` read the same. */
const digitRuns = (text: string): string[] => text.match(/\d+/g) ?? [];

const targets = (html: string): { relative: string[]; absolute: string[] } => {
  const all = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]!);
  return {
    relative: [...new Set(all.filter((target) => !/^[a-z]+:/i.test(target) && !target.startsWith('#')))],
    absolute: [...new Set(all.filter((target) => /^https?:/i.test(target)))],
  };
};

/** Ticket 05 of showcase-and-launch: the site opens with the name, the demo and the install command. */
test('the page opens with the tool name, the demo and the install command', () => {
  const html = page();
  assert.match(html, /<h1>Binnacle<\/h1>/);
  assert.ok(html.includes('src="assets/demo.gif"'), 'no demo GIF');
  assert.ok(html.includes('npm i -g @it-bbox/binnacle'), 'no install command');
  assert.ok(html.includes('binn daemon start'), 'no daemon start command');
});

/** The page carries both languages, each as a block of its own, and a switch between them. */
test('the page is in English and Russian, switched between them', () => {
  const html = page();
  assert.ok(article(html, 'en').includes("What Binnacle's own work cost"), 'no English write-up');
  assert.ok(article(html, 'ru').includes('Сколько стоила работа над самим Binnacle'), 'no Russian write-up');
  assert.deepEqual(
    [...html.matchAll(/data-language="([a-z]{2})"/g)].map((match) => match[1]),
    ['en', 'ru'],
    'no switch between the two languages',
  );
  assert.ok(html.includes('<article class="language-block" lang="ru" hidden>'), 'the Russian block is not hidden by default');
});

/** The write-up, its numbers read from the write-up itself and never invented. */
test('every number on the page comes from the write-up in the same language', () => {
  const html = page();
  for (const [language, source] of [['en', 'docs/showcase/write-up.md'], ['ru', 'docs/showcase/write-up.ru.md']] as const) {
    const allowed = new Set(digitRuns(readFileSync(join(ROOT, source), 'utf8')));
    const invented = digitRuns(article(html, language)).filter((run) => !allowed.has(run));
    assert.deepEqual(invented, [], `${language}: numbers that are not in ${source}`);
  }
});

/** Every image and link resolves: the relative ones in the repository, the absolute ones to the two canonical pages. */
test('every image and link resolves, in both languages', () => {
  const { relative, absolute } = targets(page());
  assert.deepEqual(relative, [
    'assets/demo.gif',
    'assets/overview.png',
    'assets/tasks.png',
    'assets/usage.png',
    'assets/attention.png',
  ]);
  for (const target of relative) {
    // The Pages workflow copies the page to the artifact's root beside the repository's `assets/`.
    assert.ok(existsSync(join(ROOT, target)), `missing ${target}`);
  }
  assert.deepEqual(absolute, [
    'https://github.com/it-bbox/binnacle',
    'https://www.npmjs.com/package/@it-bbox/binnacle',
  ]);
  const workflow = readFileSync(join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  assert.ok(workflow.includes('site/index.html'), 'the Pages workflow does not stage the page');
  assert.ok(workflow.includes('cp -r assets'), 'the Pages workflow does not stage the assets');
});

/** The page is public: no local path, worktree, session or ticket. */
test('the page names no local path, worktree, session or ticket', () => {
  const html = page();
  for (const private_ of [/\/home\//, /mikhail/, /worktrees?\//, /agent-[0-9a-f]{6,}/, /showcase-and-launch/, /docs\/specs/]) {
    assert.doesNotMatch(html, private_);
  }
});
