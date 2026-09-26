# 02: The Overview's state, and what can run in parallel

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** the Overview is rebuilt to the mockup, everything but the "What's next" block. It shows the epic's progress, what is running, attention and a line of usage. Ready to start reads as a set in any order and says how many Tasks can run in parallel, which the snapshot now computes. Decided in the spec, under *Parallel capacity* and *The shell and pages*.

- [x] The snapshot's `tasks` gains `parallel`, labelled `calculated`:
  - `limit`: the manifest's `automation.max_parallel_development_tasks`, or 2 where it writes none;
  - `inProgress`: the Tasks in flight;
  - `free`: `limit` less `inProgress`, never below zero.
- [x] Tests through the daemon seam cover `parallel` with the manifest's limit, with the default, and with `free` at zero.
- [x] The Overview shows the roadmap's epics as a compact stepper, and the current epic's Tasks done out of all, leaving out `CANCELLED`, from `task.list`.
- [x] Running now lists each run with its Task's id and title, or its role, plus harness, model, branch and latest activity. It says that "running" is Binnacle's reading of recent activity, and shows "nothing" when nothing runs.
- [x] Ready to start is labelled "in any order". Each Task has its start command with a copy button.
- [x] Ready to start says "up to {free} can run in parallel" when `free` is at least one and either two or more Tasks are ready or a Task is in progress.
- [x] The current epic's `READY` Tasks that wait on an Unmet dependency appear dimmed, with "waits on NN", from `task.list`'s Ready column.
- [x] Attention lists each item's message in the daemon's English and its code. A line shows today's and the last seven days' output tokens, linking to the Usage page.
- [x] A project whose roadmap cannot be read and a project with no Tasks each show their state, with the snapshot's reason.
- [ ] The Overview reads well in English and Russian, in both themes and at 1024 px.
- [x] `docs/03-mcp-and-skills.md` describes `tasks.parallel`.

## Comments

- **Where it lives.** `tasks.parallel` is computed in `apps/daemon/src/snapshot.ts` (`withStartAndParallel`, default `PARALLEL_LIMIT`), tested in `apps/daemon/test/snapshot.test.ts`. The Overview is `apps/dashboard/app/pages/index.vue`, with its strings in `app/i18n/en.ts` and `ru.ts`.
- **For ticket 03.** The "What's next" card still shows epic 5's Next action and Suggested step, restyled and with its labels translated; ticket 03 replaces its inside. Two things there to keep: when the roadmap cannot be read, the card is where the reason shows, each attention item's message and code (`roadmapReasons`); and the Overview no longer uses `SUGGESTED_READING`, which is removed.
- **For tickets 04 and 05.** The shell now provides the selected project's view (`SELECTED_VIEW` in `composables/projects.ts`), so a page reads the snapshot the shell already polls instead of polling it again; the Overview polls only `task.list`. `Board`, `Card`, `LatestRun`, `Section` and `count` moved to `composables/projects.ts`. The shell's `.legacy` wrapper now applies to every page but the Overview (`app.vue`), so a rebuilt page drops out of it there.
- **Decided here, where the ticket and spec are silent:**
  - The Overview is the selected project's, as the mockup draws it; every project is on the Projects page.
  - The stepper is CSS, as the spec allows: done, the current epic (the roadmap's first row not `done`) and those after it, each titled with its number, title and roadmap status.
  - Progress counts the epic's `unknown` Tasks among all, since only `CANCELLED` is to be left out.
  - "waits on NN" gives a dependency's number when it is in the Task's own spec, and its whole id otherwise (a remote tracker's `#12`, or another spec's Task).
  - The parallel line sits under Ready to start's heading, labelled by its tooltip as Binnacle's calculation, not as the mockup's badge on each Task: the spec's line says it once for the set. It follows the spec's rule as written, so it shows with one Task in progress even when nothing is ready.
  - "No Tasks" is a project with no Task at all or a current epic with none; it shows the tracker's attention items when there are any, such as `tracker.issues_missing`. A tracker that cannot be read shows "Not available" with the tracker's items. A roadmap that cannot be read shows its `roadmap.*` items, or the tracker's when the manifest cannot be read and there are none.
  - The usage line shows "no records" when nothing was recorded, "not reported" when no record reports output, and marks a partial total.
- **Verified in a browser.** The generated dashboard ran against a daemon on a temporary `BINNACLE_HOME` and port, reading this worktree (with its live runs), a project without a roadmap and a project whose epic had first no Tasks and then four. English and Russian, light and dark, and 1024 px were looked at; the parallel line showed with two Tasks ready and nothing in flight, and stayed hidden with `free` at zero; the waiting Tasks showed dimmed with "waits on 01" and "waits on 02, 03, 04, 05". The console showed no CSP violation, and every request went to the daemon.
- **For the owner: the criterion left unticked.** "Reads well" is a judgement only a human makes. To check it on the running daemon:
  1. `pnpm dashboard:generate`, then `binn dashboard`.
  2. On the Overview, read each block in English, switch to Русский in the sidebar, and read it again: nothing is cut or overlaps, and the domain terms, ids, commands and repository text stay English.
  3. Switch the system theme between light and dark and read it again.
  4. Narrow the window to 1024 px (the browser's device toolbar, responsive, width 1024) and check that the stepper, Ready to start, Running now and the usage line still read well.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violations.** Judgement calls:

1. **`Section` was declared again beside the Project page's own copy.** **Fixed**: it is exported from `composables/projects.ts`, and the page's copy is gone.
2. **Counting a section was written three times** (the Overview, the Project page, the rail). **Fixed**: `count` is shared from `composables/projects.ts`.
3. **The attention-reason list appears three times in the Overview**, with slightly different classes. **Kept**: three short loops over different items; one of them goes with ticket 03's rebuild of the card.
4. **The stepper switches on the step three times** (bar, icon, title). **Kept**: three classes on one element, as the shell's review kept `CopyCommand`'s.
5. **`withStart` also computed the parallel capacity.** **Fixed**: it is `withStartAndParallel`.
6. **`output` and `since` did not say what they give.** **Fixed**: `outputTokens` and `lastActivity`.
7. **`roadmapReasons` filtered twice, and the shell kept the legacy `warn` class beside `text-warning`.** **Fixed** both.
8. **The default of 2 lives in the daemon and in the autopilot skill's prose.** **Kept**: there is no shared constant to reuse, and the skill is text.

**Spec: every criterion but the human one holds.** Findings:

9. **The parallel line required a ready Task**, which the spec's rule does not. **Fixed**: it follows the spec's rule as written, as `docs/04-telemetry-dashboard.md` already said.
10. **Waiting Tasks past the Ready column's limit of ten are not listed**, with no remainder. **Left**: the board's own section limit; an epic with more than ten `READY` Tasks has not happened, and the Project page's board shows the count.
11. **"No registered project is at this address"** was not asked for. **Kept**: an address naming an unregistered project otherwise shows an empty page.
12. **`docs/04-telemetry-dashboard.md`'s Overview** is updated though the ticket does not list it. **Kept**: the spec's *Documents this epic changes* names it, and it described the old Overview.
13. **The roadmap's reason shows only in the What's next card.** **Left** for ticket 03, as the Comments above say.
