# 08: Derived metrics

Status: DONE
Triage: ready-for-agent
Blocked by: 07
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** the Usage page adds tokens per completed Task, runs per Task and a weekly trend, each labelled as Binnacle's calculation, and `usage_get` carries them too. Decided in the spec, under *Derived metrics in `usage.get`*.

- [x] `usage.get` without a Task gains `derived`, with each part `calculated`:
  - **Per completed Task**: each `DONE` Task's totals and run count, largest first, with the section limit and a remainder. Their mean, per field. The count of `DONE` Tasks without runs, which the mean leaves out.
  - **Runs per Task**: each Task's runs, how many of them were subagents', and the mean.
  - **Weekly**: totals per calendar week over the window, with weeks starting on Monday in the daemon's time zone.
- [x] Fields are never added to one another, and a mean follows the totals' rules for `null` and `partial`.
- [x] The Usage page shows the three, each labelled as Binnacle's calculation, with the weekly trend as CSS bars.
- [x] Tests through the daemon seam cover:
  - a mean over `DONE` Tasks, with one left out for having no runs;
  - subagent runs counted apart;
  - weeks split at Monday;
  - `null` and `partial` carried through.

## Comments

- **What exists.**
  - `usage.get` without a Task gains `derived`, built in `apps/daemon/src/usage.ts` from the same records and runs as `tasks` and `byRole`:
    - `perCompletedTask`: `{ provenance: 'calculated', items: { id, title, runs, totals }[], remainder, mean: Totals | null, withoutRuns }`. The items are the `DONE` Tasks with attributed runs, largest totals first, with the section limit. `mean` is over all of them, not only those listed, and null when there is none.
    - `runsPerTask`: `{ provenance: 'calculated', items: { id, title, runs, subagentRuns }[], remainder, mean: { runs, subagentRuns } | null }`, most runs first, then by id.
    - `weekly`: `{ provenance: 'calculated', items: { week, totals }[] }`, oldest first, `week` being the local date of its Monday.
  - With the tracker unreadable, `perCompletedTask` and `runsPerTask` are unavailable with its reason, like `tasks`, and `weekly` still answers.
  - `packages/telemetry` gains `mean(totals)`, beside `sum`.
  - The Usage page adds three sections after *By role*, each saying it is Binnacle's calculation: tokens per completed Task (a mean row, then the Tasks, and how many `DONE` Tasks have no runs), runs per Task, and the weekly trend. `app/components/WeeklyTrend.vue` draws a CSS bar per field, each scaled to that field's largest week. `app/composables/usage.ts` gains the `Derived` type and `taskLabel`.
  - The `usage_get` description names `derived`. `docs/03-mcp-and-skills.md` already said so after grilling.
- **Decided while building, within the spec.**
  - **A mean's field is over the Tasks that report it**, never counting a null as zero. It is partial when only some Tasks report it or one of their totals is partial. Its provenance is `calculated`, or `estimated` when a value averaged is: a mean is Binnacle's arithmetic, not a reported figure (ADR-0007). `records` in the mean is the mean number of records.
  - **Only `DONE` counts as completed.** `CANCELLED` does not.
  - **A run is a subagent's when its records come from a subagent's session.** A run never mixes sessions, so its first record decides.
  - **Runs per Task counts a Task of any state**, as the spec's "for each Task with runs" reads. It has the section limit and a remainder, as every list does, though the spec names them only for the completed Tasks.
  - **The weekly trend runs from the first stored record's week to this week, and includes the weeks without records**, so a gap shows as one. It covers every stored record, like `totals`, so the weeks add up to it. Weeks are counted by local calendar date, so a daylight-saving change does not move a Monday.
  - **The page rounds a token total to whole tokens**, which changes only a mean, and shows the runs means to one decimal. The daemon's answer is exact.
- **Ticket 06 ran at the same time and merged first.** This branch was rebased onto it. The one conflict was the roadmap's current focus. Nothing of 06 needed changing here:
  - its `review` in `task.get` and `task.list`, and `review.missing`, are beside `usage.get`, which it did not touch;
  - its edits to the Task and Project pages, `docs/03-mcp-and-skills.md` and `usage_get`'s neighbours in `packages/mcp/src/index.ts` do not overlap this ticket's.

  With 08 done, every agent ticket of epic 5 is done. The focus had grown past the snapshot's 2000-character limit, which cut it inside the `Next action:` line, so this ticket's last commit rewrites it:
  - the epic 5 paragraph no longer lists what each ticket delivered, and the whole focus is 1,608 characters;
  - its Next action is the owner's exit demonstration, ticket 09, with `binn dashboard` as the command.

  A temporary daemon registered on this worktree read `next.action` with that description and command, `truncated: false`, and no `next_action.*` attention item.
- **For the next tickets.**
  - Ticket 09's check of the Usage page against `usage_get` now covers `derived` too.
- **Checked by hand on 2026-09-26.** A daemon ran on a temporary `BINNACLE_HOME` and an ephemeral port. The dashboard was generated, the main checkout was registered read-only, and the page was opened in the built-in browser. The Usage page showed:
  - Tokens per completed Task: a mean row (61.6 records), ten `DONE` Tasks with their run counts, and "40 DONE Tasks have no runs, and the mean leaves them out".
  - Runs per Task: a mean of 3.3 runs, 1.8 of them subagents', and twelve Tasks, ten of them listed with "and 2 more".
  - The weekly trend: the weeks of 2026-09-14 and 2026-09-21, each field with its own bar, and the second week's reasoning total marked partial.

  The console showed no errors. To check it again, run the same steps from this worktree, with its dependencies installed:

  ```sh
  export BINNACLE_HOME="$(mktemp -d)" BINNACLE_PORT=0
  pnpm dashboard:generate
  node apps/daemon/src/bin.ts &          # prints the port it listens on
  node apps/cli/src/bin.ts project register "$PWD"
  node apps/cli/src/bin.ts dashboard     # then open Usage for the project
  ```

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violation. The judgement calls:**

1. **A mean kept its inputs' provenance**, so a mean of reported totals read as reported (ADR-0007). **Fixed**: it is `calculated`, or `estimated` when a value averaged is. The Spec axis raised the same point.
2. **The page counted the Tasks behind a mean** (`items.length + remainder`), and the spec says pages compute nothing beyond formatting. **Fixed**: the row reads "Mean per Task".
3. **`perTask` repeats `byTask`'s titles map and id order.** **Left**: each is a line. Its grouping pushes onto a list rather than copying it, since a Task can have many runs.
4. **`mean` repeats `sum`'s shape.** **Left**: sharing it would need a helper for two short functions.
5. **`WeeklyTrend.vue`'s styles repeat `UsageTable.vue`'s, and the runs table is written out in the page.** **Left**: `UsageTable` renders token totals, and neither a run count nor a bar is one.
6. **A Task's label was written out three times.** **Fixed**: `taskLabel` in the composable.
7. **Long chains to `data.overWindow.derived…` in the page.** **Left**: it reads the same way as the page's other sections.
8. **The names `mean` (the page's formatter) and `counted`.** **Fixed**: `oneDecimal` and `runCounts`.
9. **The weekly test's `monday()` uses the same formula as the code.** **Fixed**: the test checks that its Monday is a Monday, and this week's.
10. **The `Derived` type is written in the daemon, the test and the dashboard.** **Kept**: the dashboard imports nothing from the daemon, as the reviews of tickets 03 and 07 kept.

**Spec: every criterion holds**, and the tests pass. Findings:

1. **The mean's provenance.** **Fixed**, as Standards 1.
2. **The page counting Tasks.** **Fixed**, as Standards 2.
3. **The weekly trend lists empty weeks and has no limit.** **Kept**: the import window bounds it, and a trend shows its gaps.
4. **`runsPerTask` has the section limit.** **Kept**, recorded above.
5. **`tokens()` rounds every total.** **Kept**: only a mean has a fraction.
