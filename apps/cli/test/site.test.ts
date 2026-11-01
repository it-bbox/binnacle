import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIST = join(ROOT, '.vitepress/dist');
/** Where GitHub Pages serves the site: every route the build writes sits under it. */
const BASE = '/binnacle/';

/** The guides under `docs/operations/`, built from there into the site. */
const GUIDES = [
  '01-new-project',
  '02-existing-project-adopt',
  '03-external-tools',
  '04-security-resilience',
  '05-installation-checklist',
  '06-other-harnesses',
  '07-containers',
];

const ENGLISH = [
  '/',
  '/quick-start',
  '/containers-and-mod',
  '/showcase/write-up',
  ...GUIDES.map((guide) => `/operations/${guide}`),
];
const PAGES = [...ENGLISH, ...ENGLISH.map((page) => (page === '/' ? '/ru/' : `/ru${page}`))];

/** The file a route is served from: `/` is the home page, `/ru/x` a twin under `ru/`. */
const fileOf = (route: string): string =>
  route.endsWith('/') ? join(DIST, route.slice(1), 'index.html') : join(DIST, `${route.slice(1)}.html`);

const routeOf = (file: string): string =>
  `/${relative(DIST, file).replace(/\\/g, '/').replace(/\.html$/, '')}`;

const walk = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const built = (): string[] => walk(DIST);

/** Every `href` and `src` a page carries. */
const targets = (html: string): string[] =>
  [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]!);

/** What a reader sees, tags and entities stripped: syntax highlighting splits a command into spans. */
const text = (html: string): string =>
  html.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ');

/** The site routes a page's internal links lead to, resolved as a browser resolves them. */
const routesOf = (html: string, route: string): string[] =>
  targets(html)
    .filter((target) => !/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.startsWith('#') && !target.startsWith('//'))
    .map((target) => decodeURIComponent(new URL(target, `https://site${BASE}${route.slice(1)}`).pathname));

/** The build is what the ticket checks: it runs once, before the tests read its output. */
before(() => {
  execFileSync(process.execPath, [join(ROOT, 'node_modules/vitepress/bin/vitepress.js'), 'build'], {
    cwd: ROOT,
    stdio: 'pipe',
    timeout: 180_000,
  });
});

/** Ticket 10 of showcase-and-launch: the site is built from the repository's markdown, in both languages. */
test('every page of both languages is built, from docs/', () => {
  for (const route of PAGES) assert.ok(existsSync(fileOf(route)), `missing page ${route}`);
  assert.ok(!existsSync(join(ROOT, 'site/index.html')), 'the one-page site is still there');
  // The guides and the write-up are built where they live, not copied into the site's own pages.
  const guide = readFileSync(fileOf('/operations/07-containers'), 'utf8');
  assert.ok(guide.includes('How to put Binnacle into each app container'), 'the container guide is not built from docs/');
  const writeUp = readFileSync(fileOf('/showcase/write-up'), 'utf8');
  assert.ok(writeUp.includes('28,470'), "the write-up's figures are not the repository's");
  assert.ok(readFileSync(fileOf('/ru/showcase/write-up'), 'utf8').includes('28 470'), "the Russian write-up's figures are not the repository's");
});

/** A page opened from the built output, and from the deployed site, finds all its links and images. */
test('every internal link and image target resolves', () => {
  for (const file of built().filter((path) => path.endsWith('.html'))) {
    const here = `https://site${BASE}${routeOf(file).replace(/^\//, '')}`;
    for (const target of targets(readFileSync(file, 'utf8'))) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) continue;
      const url = new URL(target, here);
      assert.ok(url.pathname.startsWith(BASE), `${relative(DIST, file)}: ${target} leaves the site`);
      let path = decodeURIComponent(url.pathname).slice(BASE.length);
      if (path === '' || path.endsWith('/')) path += 'index';
      path = path.replace(/\.html$/, '');
      const found = [join(DIST, `${path}.html`), join(DIST, path, 'index.html'), join(DIST, path)].find(existsSync);
      assert.ok(found, `${relative(DIST, file)}: ${target} does not resolve`);
      // A fragment is a heading's id on the page it lands on: the guides link each other's sections.
      if (url.hash.length > 1) {
        const id = decodeURIComponent(url.hash.slice(1));
        assert.ok(readFileSync(found, 'utf8').includes(`id="${id}"`), `${relative(DIST, file)}: no #${id} on ${path}`);
      }
    }
  }
});

/** The first screen explains the product; installation comes before the product walkthrough. */
test('the landing explains the product and keeps installation immediately after the hero', () => {
  for (const [route, tagline] of [
    ['/', 'Your control panel for AI development.'],
    ['/ru/', 'Панель управления ИИ-разработкой.'],
  ] as const) {
    const page = readFileSync(fileOf(route), 'utf8');
    const prefix = route === '/ru/' ? 'ru/' : '';
    const visible = text(page);
    assert.ok(visible.includes('Binnacle Dev'), `${route}: no wordmark`);
    assert.ok(visible.includes(tagline), `${route}: no tagline`);
    // The mark is small enough that Vite inlines it; a file URL is accepted too, if that changes.
    assert.match(page, /<img [^>]*src="(?:data:image\/svg\+xml|[^"]*favicon[^"]*\.svg)/, `${route}: no logo`);
    assert.ok(visible.includes('npm i -g @it-bbox/binnacle') && visible.includes('binn daemon start'), `${route}: no install command`);
    const hero = page.slice(page.indexOf('<section class="landing-hero"'), page.indexOf('</section>', page.indexOf('<section class="landing-hero"')));
    assert.ok(hero.includes('landing-badges'), `${route}: badges are outside the hero`);
    assert.ok(hero.indexOf('landing-platforms') < hero.indexOf('landing-badges'), `${route}: badges precede platform requirements`);
    assert.ok(!hero.includes('context-ribbon'), `${route}: unrelated wave remains`);
    for (const theme of ['light', 'dark']) assert.match(hero, new RegExp(`src="[^"]*overview-${theme}\\.`), `${route}: hero has no ${theme} product preview`);
    assert.ok(!hero.includes('npm i -g'), `${route}: redundant command in the hero`);
    const sections = [...page.matchAll(/<section[^>]*aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(sections.slice(0, 3), ['landing-title', 'install', 'see-the-work'], `${route}: installation is not the second section`);
    assert.match(page, /button[^>]*class="copy"/, `${route}: installation commands cannot be copied`);
    for (const badge of ['actions/workflows/ci.yml/badge.svg', 'img.shields.io/npm/v/@it-bbox/binnacle', 'img.shields.io/badge/license-', 'img.shields.io/badge/node-'])
      assert.ok(page.includes(badge), `${route}: no ${badge} badge`);
    for (const target of ['https://github.com/it-bbox/binnacle', 'https://www.npmjs.com/package/@it-bbox/binnacle'])
      assert.ok(page.includes(`href="${target}"`), `${route}: no link to ${target}`);
    const routes = routesOf(page, route);
    for (const target of ['quick-start', 'operations/01-new-project', 'containers-and-mod', 'showcase/write-up'])
      assert.ok(routes.includes(`${BASE}${prefix}${target}`), `${route}: no link to ${target}`);
  }
});

/** Four different dashboard pages and their full-size links follow the selected theme. */
test('the dashboard views provide four distinct pages in both themes', () => {
  const assets = built();
  for (const shot of ['overview', 'board', 'usage', 'attention']) {
    for (const theme of ['light', 'dark'])
      assert.ok(assets.some((file) => new RegExp(`${shot}-${theme}\\.[^/]+\\.jpg$`).test(file)), `missing ${shot} ${theme} capture`);
  }
  for (const route of ['/', '/ru/']) {
    const page = readFileSync(fileOf(route), 'utf8');
    assert.ok(!page.includes('class="VPHero'), `${route}: oversized hero logo remains`);
    assert.ok(!page.includes('.gif'), `${route}: the old slideshow remains`);
    const steps = [...page.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*aria-controls="tour-screen"/g)];
    assert.equal(steps.length, 4, `${route}: no four accessible dashboard views`);
    assert.deepEqual(steps.map((step) => step[1]), ['true', 'false', 'false', 'false']);
    for (const theme of ['light', 'dark'])
      assert.match(page, new RegExp(`class="tour-${theme}"[^>]*href="[^"]*overview-${theme}\\.`), `${route}: theme-matched full-size link missing`);
    assert.ok(page.includes('id="tour-screen"'), `${route}: step controls target no content`);
  }
});

/** One switch, on every page of either language, that lands on that page's twin. */
test('the switch between the languages keeps the reader on the same page', () => {
  for (const route of PAGES) {
    const page = readFileSync(fileOf(route), 'utf8');
    const found = page.match(/<a class="language-switch" href="([^"]+)"/);
    assert.ok(found, `${route}: no language switch`);
    const twin = route === '/' ? '/ru/' : route === '/ru/' ? '/' : route.startsWith('/ru/') ? route.slice(3) : `/ru${route}`;
    assert.equal(found[1], BASE + twin.slice(1), `${route}: the switch does not stay on the page`);
  }
});

/** Local search indexes every page, in both languages. */
test('search covers every page of both languages', () => {
  const index = built()
    .filter((file) => file.includes('@localSearchIndex'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
  assert.ok(index.length > 0, 'no local search index');
  for (const route of PAGES) assert.ok(index.includes(`${BASE}${route.slice(1)}`), `${route}: not in search`);
});

/** Dark by default, in the dashboard's palette, and readable on either theme. */
test('the site opens dark in the dashboard palette', () => {
  for (const route of PAGES)
    assert.match(readFileSync(fileOf(route), 'utf8'), /vitepress-theme-appearance"\)\|\|"dark"/, `${route}: not dark by default`);
  const style = built()
    .filter((file) => file.endsWith('.css'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
  assert.ok(style.includes('#111215'), "the dashboard's dark background is not the site's");
  assert.ok(style.includes('oklch'), "the dashboard's accent is not the site's");
});

/** The project is in the workspace, and the workflow publishes its build output. */
test('the site is a VitePress project in the workspace, built and deployed by pages.yml', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { devDependencies?: Record<string, string> };
  assert.ok(pkg.devDependencies?.vitepress, 'vitepress is not a workspace dependency');
  assert.ok(existsSync(join(ROOT, '.vitepress/config.mts')), 'no VitePress config');
  const workflow = readFileSync(join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /pnpm site:build/, 'pages.yml does not build the site');
  assert.match(workflow, /path: \.vitepress\/dist/, 'pages.yml does not publish the build output');
  assert.match(workflow, /actions\/deploy-pages@/, 'pages.yml does not deploy');
});

/** The output is public: no local path, worktree, session or ticket id is in it. */
test('no local path, worktree, session or ticket id appears', () => {
  const private_ = [
    /\/home\/mikhail/,
    /\/Users\//,
    /[A-Za-z]:\\\\/,
    /\.claude\/worktrees/,
    /agent-[0-9a-f]{6,}/,
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    /showcase-and-launch/,
    /issues\/\d{2}-/,
  ];
  for (const file of built().filter((path) => /\.(html|js)$/.test(path))) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of private_) assert.doesNotMatch(text, pattern, `${relative(DIST, file)} names a private path or id`);
  }
});
