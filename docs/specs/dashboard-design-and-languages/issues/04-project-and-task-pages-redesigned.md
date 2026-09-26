# 04: The Project and Task pages, to the mockup

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** the Project page with its board and the Task page are rebuilt to the mockup in both languages, keeping everything epic 5 showed. Binnacle's truth wins over the mockup's invented data. Decided in the spec, under *The shell and pages*, and in the brief, under *The mockup*.

- [x] The Project page lists the roadmap's epics with their status and spec link.
- [x] The Project page's mini kanban shows one epic, the current one by default, with a switcher, in four columns: Backlog, Ready, In progress, Done.
- [x] A card shows its id, title, Unmet dependencies, `BLOCKED`, and whether a `DONE` Task has a Review. It shows no invented review state.
- [x] An In progress card read from runs is marked "from runs" and names harness, model, role and latest activity, with a live dot while it runs.
- [x] Done is collapsed to its count and its latest cards.
- [x] The Task page shows id, title, state, triage, Blocked by, spec and ticket paths, and branch.
- [x] The Task page shows the start command with a copy button, labelled as resuming it for a Task In progress from runs, and none for `DONE` or `CANCELLED`.
- [x] The ticket's body and its Review are plain text with their line breaks kept, and "no Review yet" appears when there is none.
- [x] The runs appear as a timeline (harness, model, role, branch, checkout, start, latest activity, tokens), with the Task's implementation usage. Review usage, rework usage, and questions and answers show "Not available" with their reasons.
- [x] Pending decisions and CI show "Not available" with the daemon's reasons.
- [x] Both pages read well in English and Russian, in both themes and at 1024 px. The components they no longer use are removed.

## Comments

- **Where it lives.** `apps/dashboard/app/pages/project.vue` and `pages/task.vue`, with `components/TokenKinds.vue`, which shows totals kind by kind, one column per set of totals: the Task's implementation usage, and the Project page's usage by role. `marks` in `composables/usage.ts` says which of partial, calculated and estimated a total carries, and both the component and the run timeline use it. The strings are under *The Project page* and *The Task page* in `app/i18n/en.ts` and `ru.ts`. `useLanguage()` gains `since`, a relative time from a daemon timestamp, and `dateTime`. `secondsAgo` now counts days after a day, tested in `apps/dashboard/test/i18n.test.ts`. No daemon operation changed, so the spec's seam 1 has no new test. The pages themselves are not automated, as the spec decides.
- **Rebased onto ticket 02.** The board's types, `Section` and `count` are 02's, in `composables/projects.ts`. The Project page reads the selected project's snapshot from the shell through `SELECTED_VIEW`, as the Overview does, and polls only its board and its usage. It says so when the address names no registered project, when the project is unavailable, or when its snapshot failed. The dictionary shares 02's `noTasks`, `noTasksBody`, `more`, `noRecords`, `notReported` and `partial`. A run's own "running now" is `activeNow`, apart from 02's "Running now" heading. `RUNS_READING`, which no page used any more, is gone. The Project page was checked again in the browser after the rebase.
- **For ticket 05.** Both pages still render inside the shell's `.legacy` wrapper. They override its base styles with utilities (`m-0`, `list-none`), so the wrapper can go with ticket 05 without touching them. `RoleUsage`, `UsageTable`, `RunList` and `WeeklyTrend` are still used by the Usage and Attention pages, so none was removed here. The English constants in `composables/projects.ts` and `usage.ts` (`RUNNING_READING`, `IMPORTING`, `windowLabel`, `FIELDS`' labels, `tokens`) are no longer used by these two pages, and the dictionary now holds their translations (`runningReading`, `importing`, `sinceWindow`, `wholeWindow`, `input` … `reasoning`, `notReported`, `partial`, `calculated`, `estimated`). The ticket that moves the last page off them can delete them. `TokenKinds` can replace `UsageTable`.
- **Decided here, where the spec is silent:**
  - **In progress from runs, on the Task page,** is read as the board reads it: the ticket says `READY`, and `usage.get` attributes at least one run to the Task. That is `boardColumn`'s rule, over the same attribution `task.list` uses. `task.get` carries no board column, and making it wait on the telemetry import to carry one would slow the MCP `task_get`. The page's start command is then headed "Resume it", with a line that the same command resumes it in a fresh session. `DONE` and `CANCELLED` say they have none, and a project whose workflow gives no command says so.
  - **The switcher** has a tab per roadmap epic. An epic with no spec has no Tasks, so its tab is disabled, unless it is the current epic, whose board then says it has no spec yet. "Tasks without a spec" stays as a link beside it when there are any.
  - **The spec link** is `specs/<slug>/spec.md`, as the roadmap links it, and opens that epic's board. The page cannot open repository files.
  - **The mockup's per-epic Task counts** in the epics table are left out: they would take one `task.list` per epic.
  - **A card** shows its ticket state when the column does not already say it, for example `READY_FOR_REVIEW` or `MERGED` (epic 5 showed it on every card). `BLOCKED` is a badge. A `DONE` card shows "Review" when its ticket records one and "no Review yet" when it does not, and nothing on a remote tracker, whose comments are never read. Every card with an attributed run shows it, as epic 5 did. Only a card In progress from runs is marked "from runs", with what its ticket says.
  - **Done** shows its latest three cards, then "Show N more" for the rest the daemon listed, and "and N more" for those it did not.
  - **"no Review yet"** on the Task page is a warning for a `DONE` Task and muted otherwise, as in epic 5: a Task not yet done is not expected to have a Review.
  - **Epic 5's rest of the Project page** stays below the board: usage by role over the import window, the registered checkout, recent decisions, and pending decisions and CI with the daemon's reasons. The not-available reasons for the Task page's review usage, rework usage, and questions and answers are the page's own text, so they are translated. The daemon's reasons stay English.
  - **Roadmap statuses and ticket states** are the repository's words and stay untranslated.
- **Verified in a browser.** The generated dashboard ran against a daemon on a temporary `BINNACLE_HOME` and port, with this repository registered. The check covered the board of epic 6, with 02 and 04 In progress from runs and 04's run live; epic 5's twelve Done cards, opened and closed; a switch between epics; the disabled tab of epic 7; ticket 04's page with its resume command and live run; and ticket 01's page with its Review and no command. It was done in English and Russian, light and dark, at 1280 and 1024 px. The console showed no CSP violation, and every request went to the daemon. Not seen live: a project with no roadmap, a Task with no runs whose ticket state is `READY`, and a `CANCELLED` Task.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: one probable hard violation, fixed.** Findings:

1. **The run timeline dropped calculated and estimated marks** (AGENTS.md §5, ADR-0007). Epic 5's `fieldsLine` had them. **Fixed**: `marks` in `usage.ts` is shared by `TokenKinds` and the timeline, and a run with no records says so.
2. **The Task page derives In progress from runs, and the Project page mirrors the daemon's current epic**, where `daemon.ts` says the pages compute nothing beyond formatting. **Kept**: see *Decided here* above. The tab rule only chooses which tabs are disabled.
3. **The dictionary repeats `usage.ts`' and `projects.ts`' English constants, and `TokenKinds` repeats `UsageTable`.** **Left** for ticket 05, as the Comments above say.
4. **`tokensLine` and `TokenKinds` marked a total differently.** **Fixed** with 1.
5. **`LatestRun` retyped the run's fields.** **Fixed**: it picks them from `TaskRun`. `Section<T>` beside `usage.ts`' private `Limited<T>` is **kept**.
6. **`statusBadge` and `stateBadge` both map a string to a badge.** **Kept**: one maps roadmap statuses, the other ticket states.
7. **`COLUMNS` wrote "In progress" as a literal while the dictionary had it.** **Fixed**: it is a domain term, the same in both languages, so the key is gone and the Task page writes it too.
8. **Names.** **Fixed**: `run` is `runLabel`, and `NOT_AVAILABLE` is `notAvailableRows`. `group` (epic 5's) and `epicColumn` are **kept**.
9. **The no-command note is a nested ternary on the state.** **Kept**: three cases.

**Spec: every criterion holds after the fixes.** Findings:

10. **The Project page's usage lost epic 5's window.** **Fixed**: the heading says it.
11. **The ticket was not yet closed.** **Fixed** by the commit that marks it `DONE`.
12. **The run timeline's tokens lost their marks.** **Fixed**, as 1.
13. **"no Review yet" is muted for a Task not `DONE`.** **Kept**, as *Decided here* above says.
