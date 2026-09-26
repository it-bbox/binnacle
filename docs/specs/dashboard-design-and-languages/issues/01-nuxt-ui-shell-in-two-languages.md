# 01: The Nuxt UI shell, in two languages

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** the dashboard gets the mockup's shell, built with Nuxt UI, in English and Russian. The rail and the sidebar work, and the language follows the browser and can be switched. The existing pages open inside the new shell until later tickets rebuild them. Decided in the spec, under *Languages*, *Look and build* and *The shell and pages*, and in ADR-0033.

- [x] `@nuxt/ui` 4 is the dashboard's dependency, with Tailwind through it, and no chart library is added.
- [x] The Lucide icons come from a locally installed collection, bundled at build time. Nuxt UI's font module fetches nothing, and the fonts are the system's sans and monospace stacks.
- [x] The daemon's Content-Security-Policy is unchanged. A generated dashboard loads in the browser with no CSP violation in the console and no request to any host but the daemon.
- [x] The rail shows one icon per registered project, with initials. It highlights the selected one and puts a dot on a project whose snapshot has running runs or attention items.
- [x] The rail's "+" opens a modal showing `binn project register`, to run in the project's folder, with a copy button. Nothing is registered from the page.
- [x] The sidebar shows the project's name and current epic, the menu (Overview, Project, Usage, Attention with a count badge, and Projects), the language switch and an "updated N s ago" line.
- [x] The selected project stays in the URL's `project` query, and without one the first registered project is shown.
- [x] The strings are our own dictionary. The Russian one is typed against the English one, so a missing key fails the typecheck. Plurals use `Intl.PluralRules`, and numbers and relative times use `Intl` in the current language. Nuxt UI's locale follows the language.
- [x] The starting language is Russian when the browser prefers Russian, and English otherwise. The switch's choice is kept in local storage, and the page's `lang` attribute follows it.
- [x] The domain terms (Task, Epic, Next action, Suggested step, Backlog, Ready, In progress, Done, Review, Unmet dependency) stay English in both dictionaries.
- [x] The theme follows the system, light or dark, and the shell holds down to 1024 px.
- [x] Loading shows skeletons. A daemon that stops answering after the page loaded shows the unreachable state with `binn daemon start` to copy, while polling goes on, and the page recovers by itself.
- [x] Polling stays at 15 seconds for a visible page. The existing pages still open and work inside the shell.

## Comments

- **Where it lives.** The shell is `apps/dashboard/app/app.vue`, with `components/ShellRail.vue` and `components/ShellSidebar.vue`. The dictionaries are `app/i18n/en.ts` and `ru.ts`, and `ru` is typed `Dictionary`, so a missing key fails both `pnpm typecheck` and the dashboard's `nuxt typecheck`. `app/i18n/index.ts` holds the starting language, `plural`, `formatNumber` and `secondsAgo`, tested in `apps/dashboard/test/i18n.test.ts`, which the root `pnpm test` runs. `composables/language.ts`, `useLanguage()`, gives a page `t`, `plural`, `number`, `secondsAgo` and Nuxt UI's locale in the current language. A page uses it for its own text.
- **The CSP, for the tickets after this one.** The daemon's policy is `default-src 'self'` with inline scripts allowed by hash only, so an inline `<style>` element is refused, whether it is in the HTML or created at runtime. Three parts of Nuxt UI write one, and each is turned off in `nuxt.config.ts`:
  - The colours plugin is dropped in `app:resolve`, and the build fails if it is no longer found. Its variables are declared in `app/assets/css/main.css`: primary is the mockup's accent, neutral is zinc, and success, warning and error are green, amber and red. `ui.theme.colors` limits the components to those four.
  - `@nuxt/icon` runs in `mode: 'svg'`, with `provider: 'none'` and no API fallback. Icons are bundled by `clientBundle.scan`, which reads literal `i-lucide-*` names in `.vue` files only. A name built at runtime, or written in a `.ts` file, is not bundled and does not render.
  - Colour mode runs with `disableTransition: false`.

  Vue's `:style` bindings are fine: they set properties through the CSSOM, which the policy allows. The Iconify API URL in the bundle is `@iconify/vue`'s default configuration, and the page never calls it.
- **The existing pages** render inside a `.legacy` wrapper. `app/assets/css/legacy.css` keeps epic 5's plain CSS for them in Tailwind's base layer, so utilities and Nuxt UI win over it. Ticket 05 removes the file and the wrapper, the last of the pages to be rebuilt. The pages' own "Loading…" lines are now skeletons, and their text is still English.
- **The selected project.** The shell writes the first registered project into the address when it has no `project`, and a page mounts only once it has one. A page is keyed by path, `project` and `id`, so switching projects in the rail rebuilds it.
- **Double polling.** The shell polls `project.list` and every snapshot every 15 seconds, and the Overview, Projects and Attention pages still poll the same. Their tickets can read the shell's data instead.
- **Decided here, where the spec is silent:**
  - Nuxt UI's colours are the mockup's accent over zinc, and the body is 13 px, as in the mockup.
  - "Updated N s ago" uses `Intl.RelativeTimeFormat` in its short style ("updated 5 sec. ago", "обновлено 5 сек. назад"), since the narrow Russian form reads "-5 с".
  - While the daemon is unreachable, the freshness line says when it last replied.
  - The rail's tooltip counts running runs and attention items, with Russian plurals.
  - The Attention badge counts the selected project's items, as in the mockup.
  - The mockup's breadcrumb bar is left to the page tickets. None of them asks for it.
- **Verified in a browser.** The generated dashboard ran against a daemon on a temporary `BINNACLE_HOME` and port, with two projects registered, one of them without a roadmap. The check covered English and Russian, light and dark, and 1024 px. The "+" modal opened, the language switch was used and survived a reload, the theme changed while the page was open, and the rail switched projects. Stopping the daemon showed the unreachable state; starting it again brought the page back by itself. The console showed no CSP violation, and every request went to the daemon.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violations.** Judgement calls:

1. **Two functions were named `ago`**: the dictionary's relative time and `composables/projects.ts`'s English one. **Fixed**: the new one is `secondsAgo`.
2. **"Every 15 seconds" in the dictionaries restated the polling constant.** **Fixed**: `REFRESH_MS` is exported, and the line is a plural form of it, so the Russian reads right for any interval.
3. **The rail computed each project's counts several times.** **Fixed**: each is read once.
4. **Number formatting was written twice.** **Fixed**: `formatNumber` is shared.
5. **The language switch's values were untyped.** **Fixed**: they are typed `Language`. The narrowing in `@update:model-value` stays, because `UTabs` emits a string or a number.
6. **The colours plugin is removed by matching its path**, so a Nuxt UI upgrade that moves it would silently bring the inline `<style>` back. **Fixed**: the build fails if nothing is removed.
7. **`CopyCommand` switches on `primary` three times.** **Kept**: three props on one button.
8. **The same `USkeleton` appears in each page.** **Kept**: the pages are rebuilt by tickets 02 to 05.
9. **`ShellRail` and `ShellSidebar` are auto-imported,** while some pages import their components explicitly. **Kept**: `CopyCommand` was already auto-imported, and the convention was mixed before this change.

**Spec: every criterion holds.** Findings:

10. **The ticket was not yet closed.** **Fixed** by the commit that marks it `DONE`.
11. **The modal and the language switch were not said to be checked for CSP.** **Fixed**: both were exercised in the browser, as the Comments above say, with no violation.
12. **The shell prints a daemon error above the page**, which a legacy page may print again. **Kept**: a rebuilt page may not show the shell's `project.list` failure, and the duplicate goes with the legacy pages.
13. **The shell and three legacy pages poll the same operations.** **Left** for tickets 02 and 05, as the Comments above say.
14. **The unreachable freshness line and the rail's pluralised tooltip** were not asked for. **Kept**: both are small and follow the mockup's intent.
