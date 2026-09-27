# 10: A Settings page, with the language and the settings to read

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** asked by the owner in the exit demonstration (ticket 06, *Comments*): a Settings page. More languages will come, so the language choice leaves the main screen for this page. The page also shows the project's and the daemon's settings, read-only, each with where to change it, since the dashboard never writes (ADR-0020). Decided in the spec, under *Further Notes*, *Found in the exit demonstration*.

- [x] The sidebar gains Settings, and loses the language switch. The freshness line stays at its foot.
- [x] Settings shows the language as a choice among the dictionaries the dashboard has, English and Russian today. Adding a language is adding a dictionary: the choice lists every dictionary without further change. The choice is kept in local storage and still starts from the browser's language, as ticket 01 made it.
- [x] Settings shows the selected project's settings from `project.status`'s manifest, read-only: tracker, workflow, capabilities, automation (with `max_parallel_development_tasks`) and telemetry. It names `.binnacle/project.yaml` as the file to edit, and says the daemon reads a change on its next refresh.
- [x] A manifest with diagnostics shows them with their codes. A project without a manifest says so, with `binn init` to copy.
- [x] Settings shows the daemon's version and address, with `binn daemon stop` and `binn daemon start` to copy.
- [x] Nothing on the page writes anything: the only actions are the language choice, kept in the browser, and copying commands.
- [ ] The page reads well in English and Russian, in both themes and at 1024 px.
- [x] `docs/04-telemetry-dashboard.md` describes the Settings page, and the design brief's shell no longer puts the language switch in the sidebar.

## Comments

- **Where it lives.** `apps/dashboard/app/pages/settings.vue`, a new page, with its strings under *The Settings page* in `app/i18n/en.ts` and `ru.ts`. The sidebar (`components/ShellSidebar.vue`) lost the language switch and gained Settings under Projects; the freshness line stays at its foot. The page polls `project.status` for the selected project and `daemon.status`, both existing operations, so no daemon operation changed and the spec's seam 1 has no new test.
- **Adding a language is adding a dictionary.** `app/i18n/index.ts` derives `Language` from `DICTIONARIES`, and `LANGUAGES`, the Settings page's choice, lists every dictionary by its own `languageName`; `apps/dashboard/test/i18n.test.ts` checks the list. `startingLanguage` now starts in the browser's first language when there is a dictionary for it, and English otherwise, which for English and Russian is exactly ticket 01's rule, and its tests are unchanged. A new dictionary also needs Nuxt UI's own strings in `UI_LOCALES` (`composables/language.ts`); the typecheck fails until it has them, so the choice never lists a language whose buttons stay English.
- **Decided here, where the ticket and spec are silent:**
  - **The manifest's settings are shown under the keys `.binnacle/project.yaml` spells them with** (`max_parallel_development_tasks`, `import.window_days`, `local.issues`), since that file is where they are changed. An unwritten value says "not written".
  - **An unwritten `max_parallel_development_tasks` names the limit Binnacle uses**, the snapshot's `tasks.parallel.limit` (2 today), as "not written: 2 is used", so the owner sees the figure the Overview's parallel line counts from.
  - **A manifest that cannot be read** shows the daemon's reason, which says whether it is missing or has problems, and `binn init` to copy in both cases, with a note that `binn init` sets up a missing manifest and that one with problems is fixed by hand, as `binn init` itself says. The daemon gives no code for the difference, and the page does not parse its message.
  - **The diagnostics are `project.status`'s**, as the ticket names: today the tracker's remote mismatch. The manifest's own warnings (unknown keys) are not in `project.status`'s answer, so the page cannot show them; adding them is a daemon change the ticket did not ask for.
  - **The daemon's address** is `http://host:port` from `daemon.status`, and its note says the port is `BINNACLE_PORT`, read when the daemon starts, as `binn --help` says.
- **Verified in a browser.** The generated dashboard ran against a daemon on a temporary `BINNACLE_HOME` and port, with this worktree and a project whose directory no longer exists registered. Checked at 1024 px: the Settings page in English and dark, then Русский chosen and light, and the choice kept across a reload; this worktree's manifest shown by section with its unwritten values; the missing project's reason with `binn init`; the daemon's version and address with both commands; and the sidebar with Settings and no language switch. Not seen live: a diagnostic, and a manifest with no capabilities.
- **For the owner: the criterion left unticked.** "Reads well" is a judgement only a human makes. To check it on the running daemon:
  1. `pnpm dashboard:generate`, then `binn dashboard`.
  2. Open Settings from the sidebar. Read it in English, choose Русский, and read it again: nothing is cut or overlaps, and the manifest's keys and values, the file name and the commands stay as the repository writes them.
  3. Reload the page: it stays in the language chosen.
  4. Switch the system theme between light and dark and look at the page again.
  5. Narrow the window to 1024 px (the browser's device toolbar, responsive, width 1024): the page does not scroll sideways, and the manifest's sections stay in two columns.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violations.** Findings, all judgement calls:

1. **The cards' `ui` object is a third near-copy** of the Usage and Attention pages'. **Kept**: a constant of classes, as ticket 05's review kept it.
2. **An empty capabilities section rendered a row with an empty key** to say "not written". **Fixed**: an empty section says "not written" itself.
3. **The language choice casts the radio group's value to `Language`**, where the sidebar guarded it. **Kept**: the group's items are exactly `LANGUAGES`.
4. **Diagnostics print message and code on one monospace line**, where the Attention page puts the code below. **Kept**: as the Overview prints the roadmap's reasons.
5. **A doubled blank line in `ru.ts`.** **Fixed**.

**Spec: every criterion but the human one holds.** Findings:

6. **The manifest's own warnings cannot show**, since `project.status` does not return them. **Left**: see *Decided here*.
7. **An unwritten parallel limit shows the snapshot's figure.** **Kept**: see *Decided here*; `docs/04-telemetry-dashboard.md` says so.
8. **`startingLanguage` generalised beyond Russian**, while the spec's *Languages* still says "Russian when the browser's preferred language is Russian". **Kept**: the same behaviour for the two dictionaries there are, and what "adding a language is adding a dictionary" needs; `docs/04-telemetry-dashboard.md` describes it.
9. **A new dictionary also needs a Nuxt UI locale.** **Kept**: see *Adding a language* above; the choice itself needs nothing more.
10. **The diagnostics showed beside an error** from the previous answer. **Fixed**: they hide while `project.status` answers with an error.
