# 05: The Usage, Projects and Attention pages, to the mockup

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** the remaining pages are rebuilt to the mockup in both languages, keeping everything epic 5 showed, and the old plain CSS is gone. Decided in the spec, under *The shell and pages*.

- [x] The Usage page shows today's and the last seven days' tokens by kind: input, cached input, cache creation, output, and reasoning as the part of output it is. A `null` is "not reported", and a partial total is marked partial.
- [x] The Usage page shows usage by model, by provider (with a provider no artifact states as "not reported"), by Task (the largest, with the unassigned total) and by role.
- [x] The derived metrics are labelled as Binnacle's calculation: tokens per completed Task, runs per Task, and a weekly trend drawn as CSS bars.
- [x] Each harness shows its support level named as in `CONTEXT.md` (Context, Attribution, Usage, Live), or the daemon's reason for none. Cost shows "Not available" with its reason.
- [x] The Projects page lists every registered project: name, path, current epic and status, the Next action in short, runs running now, and attention count. A project whose path is unavailable shows its reason.
- [x] The Attention page lists every attention item of every project, grouped by project, with codes, beside the running and recent runs.
- [ ] The three pages read well in English and Russian, in both themes and at 1024 px.
- [x] No page uses epic 5's plain CSS or its unused components any more, and they are removed.
- [x] `docs/04-telemetry-dashboard.md` describes the views as rebuilt and the two languages.

## Comments

- **Where it lives.** `apps/dashboard/app/pages/usage.vue`, `projects.vue` and `attention.vue`, with two new components: `BarList.vue`, rows of a label, a bar (Nuxt UI's `UProgress`) and a figure, and `RunRow.vue`, a run on the Attention page. The strings are under *The Usage page* and *The Projects and Attention pages* in `app/i18n/en.ts` and `ru.ts`. `compactNumber` in `app/i18n/index.ts`, the figure under a weekly bar, is tested in `apps/dashboard/test/i18n.test.ts`. `initials`, `currentEpic`, `gitLine` and `statusBadge` moved into `composables/projects.ts`, shared with the rail and the Project page. The shell now also provides every project's view (`PROJECT_VIEWS`), which the Projects and Attention pages read instead of polling again; the Usage page polls only `usage.get`. No daemon operation changed, so the spec's seam 1 has no new test.
- **Removed.** `assets/css/legacy.css` and the shell's `.legacy` wrapper; `UsageTable`, `RoleUsage`, `RunList` and `WeeklyTrend`; and the English helpers only they used (`position`, `checkout`, `RUNNING_READING`, `runSubject`, `ago`, `latestActivity`, `tokens`, `fieldsLine`, `taskLabel`, `windowLabel`, `IMPORTING`). `FIELDS` keeps only the kinds' names; their labels are the dictionary's. No durable rule lived only in them: "not reported, never zero", the marks and the ten-minute reading of "running" are in the dictionary, `marks` and `docs/04-telemetry-dashboard.md`.
- **Rebased onto ticket 03.** Two conflicts, both additions side by side: `formatList` beside `compactNumber` in `app/i18n/index.ts`, and `list` beside `compact` in `useLanguage()`. The Projects page reads the Next action ticket 03 left in place, `next.action`, and nothing of `next.alternatives`. Typecheck and tests were rerun after the rebase, and the pages were checked again in the browser.
- **Decided here, where the ticket and spec are silent:**
  - **One kind at a time.** Epic 5 showed every kind in every breakdown; the mockup draws one bar per row, of output. The Usage page keeps both: a switch, "Bars show", picks the kind every bar, the derived means and the weekly trend show, output by default. Kinds are never added together. Tokens by kind still shows every kind at once, today, over the last seven days and over the import window.
  - **Each row says how many records it counts**, as epic 5's Records column did.
  - **By Task is "the largest Tasks"**, as the daemon orders them over every kind, not by the picked kind. The unassigned total is set apart after them.
  - **The support levels' names** stay English in both languages, as `CONTEXT.md` names them, with a legend that says what each means in the page's language. A harness at level 1 shows the daemon's reason (`telemetry.unreadable`), and one with none says "no support level" with its reason.
  - **The Projects page** links a project's name to its Overview, as the mockup does, where epic 5 linked the Project page. It keeps epic 5's registered checkout and latest activity under the path and the running count.
  - **The Attention page** lists the runs of every project together, the recent ones newest first, each naming its project; a project whose runs cannot be read says so there, with the reason. The two columns stay side by side down to 1024 px.
- **Verified in a browser.** The generated dashboard ran against a daemon on a temporary `BINNACLE_HOME` and port, with this worktree, a project whose directory no longer exists, and a scratch project with no roadmap, no ADR directory and no tickets registered. The check covered output and reasoning on the switch, the derived metrics and the weekly bar, the harness levels, the unavailable and roadmap-less projects on the Projects page, and the attention items and runs of all three projects. It was done in English and Russian, light and dark, at 1280 and 1024 px, with no horizontal scroll at 1024. The console showed no CSP violation, and every request the page made went to the daemon. The scratch project's first manifest named a GitHub repository, so the daemon read its issues from GitHub once, as it does for any such project, before it was switched to local tickets. Not seen live: a week with a partial total, more than one week in the trend, a provider the artifacts state, and a remainder under the Tasks.
- **For the owner: the criterion left unticked.** "Reads well" is a judgement only a human makes. To check it on the running daemon:
  1. `pnpm dashboard:generate`, then `binn dashboard`.
  2. Open Usage, Projects and Attention from the sidebar. Read each in English, switch to Русский in the sidebar, and read it again: nothing is cut or overlaps, and the domain terms, ids, commands, model names and repository text stay English.
  3. On Usage, click through the kinds on "Bars show": every bar, the derived means and the weekly trend follow, and a kind no record reports says "not reported".
  4. Switch the system theme between light and dark and look at the three pages again.
  5. Narrow the window to 1024 px (the browser's device toolbar, responsive, width 1024): no page scrolls sideways, and on Attention the runs stay beside the attention items.

### Review

`/code-review` ran against `main` on both axes, after the rebase onto ticket 03, with its sub-agents in the foreground.

**Standards: no hard violations; two convention breaches, fixed.** Findings:

1. **A bar's note was marked English whole**, though half of it was the dictionary's. **Fixed**: a row has a `title`, the repository's text marked `lang="en"`, and a `note`, the page's own.
2. **The weekly bars showed only `partial`**, dropping calculated and estimated (AGENTS.md §5, ADR-0007). **Fixed**: they use `marks`.
3. **The cards' `ui` object is written in the Usage and Attention pages** (and the Overview's `panel`). **Kept**: a constant of classes, one line each.
4. **The import window's label was worked out twice.** **Fixed**: `windowColumn`, and `windowLabel` from it.
5. **"Is the activity readable, and how many run" is checked in the rail, the Projects page and the Attention page.** **Kept**: each needs a different part of it.
6. **The unavailable/failed/snapshot cascade repeats across pages.** **Kept**: it was there before this ticket, and each page words its states.
7. **Two `since`s**, the dictionary's date and `useLanguage`'s relative time. **Fixed**: the dictionary's is `sinceDate`.
8. **The mean per completed Task is built as a bar row with an empty label.** **Kept**: it reuses the row's figure and marks, which is what the mean needs.
9. **`composables/projects.ts` gained presentation helpers** (`statusBadge`, `initials`, `gitLine`). **Kept**: two pages and the rail share them.
10. **The level names are written in `usage.vue` and in the legends.** **Kept**: `CONTEXT.md`'s terms, like the domain terms in ticket 04.
11. **A `usage.get` failure's message is not marked `lang="en"`.** **Kept**: as on the Project page.

**Spec: every criterion but the human one holds after the fixes.** Findings:

12. **Record counts were lost from the breakdowns**, and "No DONE Task has runs" lost how many are `DONE`. **Fixed**: each row says its records, and the line its count.
13. **The kind switch is not in the mockup.** **Kept**: see *Decided here* above.
14. **Helpers moved into `composables/projects.ts`, and `compactNumber` was added.** **Kept**: small and shared.
15. **A project's name links to its Overview, not the Project page.** **Kept**: as the mockup; the Project page is one click away in the sidebar.
16. **"largest first" was wrong for any kind but the daemon's order.** **Fixed**: "the largest Tasks".
17. **The Tasks' remainder showed under Unassigned.** **Fixed**: `BarList`'s `last` row sits after the remainder.
18. **At 1024 px the Attention page stacked the runs under the items.** **Fixed**: two columns always, and a long Task id truncates.
19. **The Usage page is one column at 1024 px, and many weeks squeeze the trend's labels.** **Left** for the owner's check above: the cards read in one column, and a week's figure is in its tooltip.
