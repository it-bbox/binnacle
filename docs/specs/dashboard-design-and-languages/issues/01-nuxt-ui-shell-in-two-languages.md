# 01: The Nuxt UI shell, in two languages

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** the dashboard gets the mockup's shell, built with Nuxt UI, in English and Russian. The rail and the sidebar work, and the language follows the browser and can be switched. The existing pages open inside the new shell until later tickets rebuild them. Decided in the spec, under *Languages*, *Look and build* and *The shell and pages*, and in ADR-0033.

- [ ] `@nuxt/ui` 4 is the dashboard's dependency, with Tailwind through it, and no chart library is added.
- [ ] The Lucide icons come from a locally installed collection, bundled at build time. Nuxt UI's font module fetches nothing, and the fonts are the system's sans and monospace stacks.
- [ ] The daemon's Content-Security-Policy is unchanged. A generated dashboard loads in the browser with no CSP violation in the console and no request to any host but the daemon.
- [ ] The rail shows one icon per registered project, with initials. It highlights the selected one and puts a dot on a project whose snapshot has running runs or attention items.
- [ ] The rail's "+" opens a modal showing `binn project register`, to run in the project's folder, with a copy button. Nothing is registered from the page.
- [ ] The sidebar shows the project's name and current epic, the menu (Overview, Project, Usage, Attention with a count badge, and Projects), the language switch and an "updated N s ago" line.
- [ ] The selected project stays in the URL's `project` query, and without one the first registered project is shown.
- [ ] The strings are our own dictionary. The Russian one is typed against the English one, so a missing key fails the typecheck. Plurals use `Intl.PluralRules`, and numbers and relative times use `Intl` in the current language. Nuxt UI's locale follows the language.
- [ ] The starting language is Russian when the browser prefers Russian, and English otherwise. The switch's choice is kept in local storage, and the page's `lang` attribute follows it.
- [ ] The domain terms (Task, Epic, Next action, Suggested step, Backlog, Ready, In progress, Done, Review, Unmet dependency) stay English in both dictionaries.
- [ ] The theme follows the system, light or dark, and the shell holds down to 1024 px.
- [ ] Loading shows skeletons. A daemon that stops answering after the page loaded shows the unreachable state with `binn daemon start` to copy, while polling goes on, and the page recovers by itself.
- [ ] Polling stays at 15 seconds for a visible page. The existing pages still open and work inside the shell.
