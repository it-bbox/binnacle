import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { before, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
    const install = text(page.slice(page.indexOf('aria-labelledby="install"'), page.indexOf('aria-labelledby="see-the-work"')));
    for (const command of ['npm i -g @it-bbox/binnacle', 'binn daemon start', 'binn init', 'binn dashboard', 'BINNACLE_PORT', '127.0.0.1:7717'])
      assert.ok(install.includes(command), `${route}: installation lacks ${command}`);
    const hero = page.slice(page.indexOf('<section class="landing-hero"'), page.indexOf('</section>', page.indexOf('<section class="landing-hero"')));
    assert.ok(hero.includes('landing-badges'), `${route}: badges are outside the hero`);
    assert.ok(hero.indexOf('landing-platforms') < hero.indexOf('landing-badges'), `${route}: badges precede platform requirements`);
    assert.ok(!hero.includes('context-ribbon'), `${route}: unrelated wave remains`);
    assert.ok(hero.includes('class="hero-map"'), `${route}: explanatory graphic missing`);
    assert.ok(!hero.includes('overview-light') && !hero.includes('overview-dark'), `${route}: hero duplicates the gallery`);
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
    const dialog = page.slice(page.indexOf('<dialog'), page.indexOf('</dialog>'));
    assert.match(dialog, /^<dialog[^>]*aria-labelledby="lightbox-title"/, `${route}: no labelled lightbox`);
    assert.equal([...dialog.matchAll(/<button[^>]*type="button"/g)].length, 3, `${route}: the lightbox lacks close, previous or next`);
    const tour = page.slice(page.indexOf('id="tour-screen"'));
    assert.ok(!/<a[^>]*target="_blank"/.test(tour.split('</section>')[0]!), `${route}: screenshots open in a separate tab`);
  }
});

/** The route a page's twin is served at: `/x` and `/ru/x`. */
const twinOf = (route: string): string =>
  route === '/' ? '/ru/' : route === '/ru/' ? '/' : route.startsWith('/ru/') ? route.slice(3) : `/ru${route}`;

/** One switch, on every page of either language, that lands on that page's twin. */
test('the switch between the languages keeps the reader on the same page', () => {
  for (const route of PAGES) {
    const page = readFileSync(fileOf(route), 'utf8');
    const found = page.match(/<a class="language-switch" href="([^"]+)"/);
    assert.ok(found, `${route}: no language switch`);
    // The theme's own menu, shown from 1280 px, sends a reader to the other locale's home page.
    const controls = page.match(/language-switch|VPNavBarTranslations|VPNavScreenTranslations|trans-title/g);
    assert.equal(controls?.length, 1, `${route}: more than one language control`);
    assert.ok(page.indexOf('language-switch') > page.indexOf('class="VPNavBar'), `${route}: the switch is outside the navigation bar`);
    assert.equal(found[1], BASE + twinOf(route).slice(1), `${route}: the switch does not stay on the page`);
  }
});

/** A guide's link to its twin crosses into the other language; its other links stay in its own. */
test('a guide links its twin in the other language and its other pages in its own', () => {
  const twins = ['/showcase/write-up', ...GUIDES.map((guide) => `/operations/${guide}`)];
  for (const route of [...twins, ...twins.map((page) => `/ru${page}`)]) {
    const russian = route.startsWith('/ru/');
    const page = readFileSync(fileOf(route), 'utf8').replace(/<a class="language-switch"[^>]*>/, '');
    const marker = russian ? 'English version: ' : 'Русская версия: ';
    const twin = page.slice(page.indexOf(marker) + marker.length).match(/^<a href="[^"]+"/);
    assert.ok(page.includes(marker) && twin, `${route}: no link to its twin`);
    assert.deepEqual(routesOf(twin[0], route), [BASE + twinOf(route).slice(1)], `${route}: the twin link does not reach the twin`);
    const crossing = routesOf(page.replace(twin[0], ''), route).filter(
      (target) => PAGES.some((other) => target === BASE + other.slice(1)) && target.startsWith(`${BASE}ru/`) !== russian,
    );
    assert.deepEqual(crossing, [], `${route}: links into the other language`);
  }
  // An address on another site keeps its `.ru.md`: only the site's own twins are routed.
  const external = 'href="https://github.com/it-bbox/binnacle/blob/main/CONTRIBUTING.ru.md#';
  assert.ok(readFileSync(fileOf('/ru/operations/05-installation-checklist'), 'utf8').includes(external), 'an external .ru.md address was rewritten');
});

/** The site data every page carries, with the functions VitePress serializes by their source. */
const siteData = (): any => {
  const literal = readFileSync(fileOf('/'), 'utf8').match(/__VP_SITE_DATA__=deserializeFunctions\(JSON\.parse\(("(?:[^"\\]|\\.)*")\)\)/);
  assert.ok(literal, 'no site data');
  return JSON.parse(JSON.parse(literal[1]!), (_key, value) =>
    typeof value === 'string' && value.startsWith('_vp-fn_') ? new Function(`return ${value.slice(7)}`)() : value,
  );
};

/** Each locale's search as the search box runs it: the index it asks for by locale, through its filter. */
test('search on a page of either language finds the pages of that language', async () => {
  const box = built().find((file) => /VPLocalSearchBox\.[^/]+\.js$/.test(file));
  assert.ok(box, 'no search box');
  const indexes = new Map(
    [...readFileSync(box, 'utf8').matchAll(/(\w+):\(\)=>\w+\(\(\)=>import\("\.\/(@localSearchIndex[^"]+)"\)/g)].map((match) => [match[1]!, match[2]!]),
  );
  const site = siteData();
  // The landing has no section heading to index; every other page is found in its own language.
  const documents = ENGLISH.filter((page) => page !== '/');
  for (const [locale, routes] of [
    ['root', documents],
    ['ru', documents.map((page) => `/ru${page}`)],
  ] as const) {
    // A Russian page asks for its locale's index by key; a key the box lacks opens an empty window.
    assert.ok(locale in site.locales, `no ${locale} locale`);
    const file = indexes.get(locale);
    assert.ok(file, `the search box has no index for ${locale}`);
    const index = JSON.parse((await import(pathToFileURL(join(box, '..', file)).href)).default) as { documentIds: Record<string, string> };
    const search = (locale === 'root' ? site.themeConfig : { ...site.themeConfig, ...site.locales[locale].themeConfig }).search;
    const filter: (result: { id: string }) => boolean = search?.options?.miniSearch?.searchOptions?.filter ?? (() => true);
    const found = Object.values(index.documentIds).filter((id) => filter({ id }));
    for (const id of found) assert.equal(id.startsWith(`${BASE}ru/`), locale === 'ru', `${locale}: search finds ${id}`);
    const pages = new Set(found.map((id) => id.split('#')[0]));
    for (const route of routes) assert.ok(pages.has(BASE + route.slice(1)), `${route}: not in the ${locale} search`);
  }
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
