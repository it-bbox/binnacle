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

/** One language's opening section, and its write-up, without their tags. */
const tagged = (html: string, tag: string, language: string): string => {
  const found = html.match(new RegExp(`<${tag}[^>]*lang="${language}"[^>]*>([\\s\\S]*?)</${tag}>`));
  assert.ok(found, `no ${language} ${tag}`);
  return found[1]!;
};
const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const section = (html: string, language: string): string => tagged(html, 'section', language);
const article = (html: string, language: string): string => tagged(html, 'article', language);

/** The digits of every number, in order, so that `28,470` and `28 470` read the same. */
const digitRuns = (content: string): string[] => text(content).match(/\d+/g) ?? [];

/** Relative image and link targets, and the absolute ones, which must be the two canonical URLs. */
const targets = (html: string): { relative: string[]; absolute: string[] } => {
  const all = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]!);
  return {
    relative: [...new Set(all.filter((target) => !/^[a-z]+:/i.test(target) && !target.startsWith('#')))],
    absolute: [...new Set(all.filter((target) => /^https?:/i.test(target)))],
  };
};

const ASSETS = ['assets/demo.gif', 'assets/overview.png', 'assets/tasks.png', 'assets/usage.png', 'assets/attention.png'];
const LINKS = ['https://github.com/it-bbox/binnacle', 'https://www.npmjs.com/package/@it-bbox/binnacle'];

/** Ticket 05 of showcase-and-launch: the site opens with the name, the demo and the install command. */
test('the page opens with the tool name, the demo and the install command, in both languages', () => {
  const html = page();
  assert.match(html, /<h1>Binnacle<\/h1>/);
  for (const language of ['en', 'ru']) {
    const opening = section(html, language);
    assert.ok(opening.includes('src="assets/demo.gif"'), `${language}: no demo GIF`);
    assert.ok(opening.includes('npm i -g @it-bbox/binnacle'), `${language}: no install command`);
    assert.ok(opening.includes('binn daemon start'), `${language}: no daemon start command`);
  }
});

/** The page carries both languages, each as a block of its own, and a switch between them. */
test('the page is in English and Russian, switched between them', () => {
  const html = page();
  assert.ok(text(article(html, 'en')).includes("What Binnacle's own work cost"), 'no English write-up');
  assert.ok(text(article(html, 'ru')).includes('Сколько стоила работа над самим Binnacle'), 'no Russian write-up');
  assert.deepEqual(
    [...html.matchAll(/data-language="([a-z]{2})"/g)].map((match) => match[1]),
    ['en', 'ru'],
    'no switch between the two languages',
  );
  assert.ok(html.includes('<article class="language-block" lang="ru" hidden>'), 'the Russian block is not hidden by default');
});

/** The spec repeats the requirements on the site: Node 24 LTS, the loopback port, and why not Docker. */
test('the page states the requirements and the Docker sentence, in both languages', () => {
  const html = page();
  for (const [language, heading] of [['en', 'Requirements'], ['ru', 'Требования']] as const) {
    const opening = text(section(html, language));
    assert.ok(opening.includes(heading), `${language}: no requirements`);
    assert.ok(opening.includes('Node.js 24 LTS'), `${language}: no Node version`);
    assert.ok(opening.includes('127.0.0.1:7717'), `${language}: no loopback port`);
    assert.ok(opening.includes('Docker'), `${language}: no Docker sentence`);
  }
});

/** The write-up appears whole and in order: its figures are the write-up's, never invented or dropped. */
test("the page carries each language's write-up figures in the write-up's own order", () => {
  const html = page();
  for (const [language, source] of [['en', 'docs/showcase/write-up.md'], ['ru', 'docs/showcase/write-up.ru.md']] as const) {
    assert.deepEqual(digitRuns(article(html, language)), digitRuns(readFileSync(join(ROOT, source), 'utf8')), language);
  }
  const rows = (language: string): { headings: number; rows: number } => ({
    headings: (article(html, language).match(/<h[23]>/g) ?? []).length,
    rows: (article(html, language).match(/<tr>/g) ?? []).length,
  });
  assert.deepEqual(rows('ru'), rows('en'), 'the Russian write-up has another shape than the English one');
});

/** Every image and link resolves in each language: assets in the repository, the two canonical URLs. */
test('every image and link resolves, in both languages', () => {
  const html = page();
  for (const language of ['en', 'ru']) {
    const { relative, absolute } = targets(section(html, language));
    assert.deepEqual(relative, ASSETS, `${language}: assets`);
    assert.deepEqual(absolute, LINKS, `${language}: links`);
    for (const target of relative) {
      // The Pages workflow copies the page to the artifact's root beside the repository's `assets/`.
      assert.ok(existsSync(join(ROOT, target)), `missing ${target}`);
    }
  }
  const workflow = readFileSync(join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  assert.ok(workflow.includes('site/index.html'), 'the Pages workflow does not stage the page');
  assert.ok(workflow.includes('cp -r assets'), 'the Pages workflow does not stage the assets');
});

/** The page is public: no local path, worktree, session or ticket. */
test('the page names no local path, worktree, session or ticket', () => {
  const html = page();
  const private_ = [
    /\/home\//,
    /\/Users\//,
    /[A-Za-z]:\\/,
    /mikhail/,
    /worktrees?\//,
    /\.claude\b/,
    /\.scratch\b/,
    /file:\/\//,
    /agent-[0-9a-f]{6,}/,
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    /showcase-and-launch/,
    /docs\/specs/,
  ];
  for (const pattern of private_) assert.doesNotMatch(html, pattern);
});
