import { posix } from 'node:path'
import { defineConfig } from 'vitepress'

const repository = 'https://github.com/it-bbox/binnacle'
const base = '/binnacle/'

/** The guides under `docs/operations/`, in reading order, with each language's own title. */
const guides = [
  { slug: '01-new-project', en: 'New project', ru: 'Запуск нового проекта' },
  { slug: '02-existing-project-adopt', en: 'Existing project', ru: 'Подключение существующего проекта' },
  { slug: '03-external-tools', en: 'External tools', ru: 'Внешние инструменты' },
  { slug: '04-security-resilience', en: 'Security and resilience', ru: 'Безопасность и устойчивость' },
  { slug: '05-installation-checklist', en: 'Installation checklist', ru: 'Чек-лист установки' },
  { slug: '06-other-harnesses', en: 'Another harness', ru: 'Работа из другого harness' },
  { slug: '07-containers', en: 'Binnacle in a container', ru: 'Binnacle в контейнере' },
]

const sidebar = [
  {
    text: 'Getting started',
    items: [
      { text: 'Quick start', link: '/quick-start' },
      { text: 'Containers and the mod', link: '/containers-and-mod' },
    ],
  },
  {
    text: 'Guides',
    items: guides.map((guide) => ({ text: guide.en, link: `/operations/${guide.slug}` })),
  },
  {
    text: 'Write-up',
    items: [{ text: "What Binnacle's own work cost", link: '/showcase/write-up' }],
  },
]

const sidebarRu = [
  {
    text: 'Начало работы',
    items: [
      { text: 'Быстрый старт', link: '/ru/quick-start' },
      { text: 'Контейнеры и мод', link: '/ru/containers-and-mod' },
    ],
  },
  {
    text: 'Руководства',
    items: guides.map((guide) => ({ text: guide.ru, link: `/ru/operations/${guide.slug}` })),
  },
  {
    text: 'Разбор расходов',
    items: [{ text: 'Сколько стоила работа над самим Binnacle', link: '/ru/showcase/write-up' }],
  },
]

/** The search box's words in Russian; the default is English. */
const searchRu = {
  button: { buttonText: 'Поиск', buttonAriaLabel: 'Поиск' },
  modal: {
    displayDetails: 'Показать подробный список',
    resetButtonTitle: 'Сбросить поиск',
    backButtonTitle: 'Назад',
    noResultsText: 'Ничего не найдено',
    footer: {
      selectText: 'выбрать',
      selectKeyAriaLabel: 'Enter',
      navigateText: 'перейти',
      navigateUpKeyAriaLabel: 'Стрелка вверх',
      navigateDownKeyAriaLabel: 'Стрелка вниз',
      closeText: 'закрыть',
      closeKeyAriaLabel: 'Esc',
    },
  },
}

export default defineConfig({
  title: 'Binnacle Dev',
  description:
    'A local, provider-agnostic AI Engineering Control Plane: project memory, workflow and observability across coding agents.',
  base,
  // The site is built from the repository's own markdown: the guides and the write-up stay there.
  srcDir: 'docs',
  srcExclude: [
    'adr/**',
    'agents/**',
    'specs/**',
    'workflow/**',
    '0*.md',
    'baseline.md',
    'product-inbox.md',
    'roadmap.md',
    'showcase/identity.md',
    'showcase/launch-checklist.md',
    'showcase/listings.md',
  ],
  // A twin, `name.ru.md`, is served under `ru/`; the English page keeps its own path.
  rewrites: (id) => id.replace(/^(.*)\.ru\.md$/, 'ru/$1.md'),
  cleanUrls: true,
  appearance: 'dark',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }]],
  // The built output is checked for dead links by `apps/cli/test/site.test.ts`; the build's own
  // check cannot follow a twin, whose source path and served path differ.
  ignoreDeadLinks: true,
  markdown: {
    /**
     * GitHub's heading slugs, so a fragment written for the repository (`#2-set-it-up-with-binn-init`,
     * `#учётные-данные-tracker`) also lands on the site instead of only on GitHub.
     */
    anchor: {
      slugify: (text) =>
        text
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
          .trim()
          .replace(/\s+/g, '-'),
    },
    /**
     * Keeps a guide link in its language on the site: a source page links a Russian page as
     * `name.ru.md` and an English one as `name.md`, while the rewrite serves every Russian page under
     * `ru/`. A link into `ru/`, or out of it, is routed from the source page's own folder; one that
     * climbs out of `docs/` is left to VitePress, and the site test reports it if it does not resolve.
     */
    config(md) {
      const renderLink = md.renderer.rules.link_open!
      md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        const token = tokens[idx]!
        const source = token.attrGet('href') ?? ''
        renderLink(tokens, idx, options, env, self)
        const link = /^(?:[a-z][a-z0-9+.-]*:|[#/])/i.test(source) ? null : source.match(/^([^?#]*?)(\.ru)?\.md([?#].*)?$/)
        const russian = env.relativePath.startsWith('ru/')
        if (link && (link[2] || russian)) {
          const [, file, twin, suffix = ''] = link
          const page = posix.join(posix.dirname(russian ? env.relativePath.slice(3) : env.relativePath), file!)
          if (!page.startsWith('..'))
            token.attrSet('href', `${base}${twin ? 'ru/' : ''}${page.replace(/(^|\/)index$/, '$1')}${suffix}`)
        }
        return self.renderToken(tokens, idx, options)
      }
    },
  },
  vite: {
    plugins: [
      {
        /**
         * VitePress 1.6 files a page's search entries by its source path, so a `*.ru.md` twin lands in
         * the `root` index while a Russian page asks for `ru`. Both locales read that one index, and
         * each locale's search `filter` keeps its own pages; an index VitePress builds for `ru` wins.
         */
        name: 'binnacle:search-locales',
        transform(code, id) {
          if (id === '/@localSearchIndex')
            return code.replace('export default {', `export default {"ru": () => import('@localSearchIndexroot'),`)
        },
      },
    ],
  },
  themeConfig: {
    logo: '/favicon.svg',
    i18nRouting: false,
    nav: [
      { text: 'Quick start', link: '/quick-start' },
      { text: 'Guides', items: guides.map((guide) => ({ text: guide.en, link: `/operations/${guide.slug}` })) },
      { text: 'Write-up', link: '/showcase/write-up' },
      { text: 'GitHub', link: repository },
    ],
    sidebar,
    // Self-contained: VitePress serializes a function into the site data by its source text, so the
    // filters spell out `base`, here and in the Russian locale.
    search: {
      provider: 'local',
      options: { miniSearch: { searchOptions: { filter: (result) => !result.id.startsWith('/binnacle/ru/') } } },
    },
    socialLinks: [{ icon: 'github', link: repository }],
    editLink: { pattern: `${repository}/edit/main/docs/:path`, text: 'Edit this page' },
    footer: { message: 'Apache-2.0', copyright: 'Binnacle' },
    outline: { level: [2, 3], label: 'On this page' },
    docFooter: { prev: 'Previous', next: 'Next' },
  },
  // No label: the theme draws its own language menu only for a labelled locale, and that menu
  // cannot follow a twin. The one switch between the languages is `LanguageSwitch.vue`.
  locales: {
    root: { label: '', lang: 'en-US' },
    ru: {
      label: '',
      lang: 'ru-RU',
      themeConfig: {
        nav: [
          { text: 'Быстрый старт', link: '/ru/quick-start' },
          {
            text: 'Руководства',
            items: guides.map((guide) => ({ text: guide.ru, link: `/ru/operations/${guide.slug}` })),
          },
          { text: 'Разбор расходов', link: '/ru/showcase/write-up' },
          { text: 'GitHub', link: repository },
        ],
        sidebar: sidebarRu,
        search: {
          provider: 'local',
          options: {
            translations: searchRu,
            miniSearch: { searchOptions: { filter: (result) => result.id.startsWith('/binnacle/ru/') } },
          },
        },
        editLink: { pattern: `${repository}/edit/main/docs/:path`, text: 'Изменить эту страницу' },
        footer: { message: 'Apache-2.0', copyright: 'Binnacle' },
        outline: { level: [2, 3], label: 'На этой странице' },
        docFooter: { prev: 'Назад', next: 'Дальше' },
        darkModeSwitchLabel: 'Оформление',
        sidebarMenuLabel: 'Меню',
        returnToTopLabel: 'Наверх',
        langMenuLabel: 'Язык',
      },
    },
  },
})
