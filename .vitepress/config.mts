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
     * Keeps a twin link working on the site: the guides link their `name.ru.md` twin, which the
     * rewrite serves under `ru/`. On a Russian page the twin is a sibling; an English page points
     * into the `ru/` tree.
     */
    config(md) {
      const renderLink = md.renderer.rules.link_open!
      md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        renderLink(tokens, idx, options, env, self)
        const token = tokens[idx]!
        const href = token.attrGet('href')
        const twin = /^[a-z]+:/i.test(href ?? '') ? null : href?.match(/^([^?#]*)\.ru(?:\.html)?([?#].*)?$/)
        if (twin) {
          const [, path, suffix = ''] = twin
          if (env.relativePath.startsWith('ru/')) {
            token.attrSet('href', path + suffix)
          } else {
            const dir = posix.dirname(env.relativePath)
            const name = posix.basename(path)
            const routed = name === 'index' ? `${base}ru/` : `${base}ru/${[dir === '.' ? '' : dir, name].filter(Boolean).join('/')}`
            token.attrSet('href', routed + suffix)
          }
        }
        return self.renderToken(tokens, idx, options)
      }
    },
  },
  themeConfig: {
    // The switch between the languages is `LanguageSwitch.vue`; the theme's own cannot follow a twin.
    i18nRouting: false,
    nav: [
      { text: 'Quick start', link: '/quick-start' },
      { text: 'Guides', items: guides.map((guide) => ({ text: guide.en, link: `/operations/${guide.slug}` })) },
      { text: 'Write-up', link: '/showcase/write-up' },
      { text: 'GitHub', link: repository },
    ],
    sidebar,
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: repository }],
    editLink: { pattern: `${repository}/edit/main/docs/:path`, text: 'Edit this page' },
    footer: { message: 'Apache-2.0', copyright: 'Binnacle' },
    outline: { level: [2, 3], label: 'On this page' },
    docFooter: { prev: 'Previous', next: 'Next' },
  },
  locales: {
    root: { label: 'English', lang: 'en-US' },
    ru: {
      label: 'Русский',
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
        search: { provider: 'local', options: { translations: searchRu } },
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
