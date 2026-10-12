# 09: The exit demonstration of epic 16

Status: DONE
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 10, 11, 12, 13, 16
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** epic 16's exit criterion, demonstrated by the owner on this repository (spec, the paragraph under its title). After it, a Product session reads epic 18's measurement against epic 11 with `usage_get` by epic (spec, *Further Notes*).

- [x] The owner goes through every page on their own screen at 100% zoom and reads it without strain, in both themes and both languages.
- [x] Every element of `docs/04-telemetry-dashboard.md` is reachable, in a widget's *Brief* or *Full*, and each widget's *Brief* is what the owner wants first.
- [x] A Parallel limit set on the Settings page is the one the snapshot gives and autopilot reads.
- [x] The commands in a Binnacle skill's output copy with the Claude desktop app's button.

## Comments

### Checked before the demonstration, 2026-10-12

By the implementation session, on branch `feat/dashboard-redesign-exit-demo` at `main`'s `482f28c`:

- Typecheck clean; the whole suite, 746 tests, passes.
- The owner's daemon serves this epic's dashboard: it started at 01:04 on 2026-10-12, after the dashboard's last build, and `parallel.get` answers with the informer, so ticket 07's restart is done. The installed `binnacle` plugin's skills are this repository's, file for file.
- A temporary daemon, its own home, with this repository registered, in a browser at 1440 × 900: Overview, Project, Usage, Projects, Attention, Settings and the Task page of `dashboard-redesign/05`. Body text is 16 px; no visible text on any page is below 13 px, in *Brief* or with every widget in *Full* and every fold opened; no page scrolls sideways. The Task page renders its ticket and its Review as Markdown, with no code block. Russian and English, light and dark.
- The Parallel limit set to 3 on that daemon's Settings page: its `settings.json` gained `parallelLimit: 3` and kept the vault's path, and the snapshot's `tasks.parallel` gave `limit: 3`, `mode: number`, `source: machine`. `auto` gave `limit: 4`; `0` and `"9999"` were refused with `parallel_limit.invalid` and their reason. Autopilot's skill reads `tasks.parallel` (its step 4). The owner's own daemon gives `2`, `number`, `default` in both `parallel.get` and the snapshot.

Two things for the owner to judge, neither made by this epic:

- **The current Epic reads as 12, not 16.** The sidebar, the Overview's epic progress and the board's default tab take the first epic that is not `done` (`currentEpic` in `apps/dashboard/app/composables/projects.ts`, and `board.ts` for `task.list`). Epic 12 comes before 16 in the roadmap and is `not started`, so the Overview's *Brief* shows "12 Audit, completed, no Tasks yet" while 16 is `in progress`. Picking the first `in progress` epic would be a small ticket of its own.
- **The informer's figures.** The most runs active at once is 28, on 2026-09-25 at 10:13, subagents counted as runs; and 2026-10-11 at 02:08 lists the same usage limit three times, with 4 runs active, likely once per agent's session that hit it. Both are what the rule gives; whether they read as the owner expects is the owner's call.

### Steps for the demonstration

1. Open the dashboard: `binn dashboard`, or `/binnacle:dashboard` in the chat. Browser zoom at 100%.
2. Go through every page: Overview, Project, Usage, Projects, Attention, Settings, and a Task page — `dashboard-redesign/05` has a Review to read as Markdown. On each, read every widget in *Brief* first, then in *Full*, against `docs/04-telemetry-dashboard.md`, *Main dashboard views for v1*.
3. Do it in both languages (Settings → Language) and both themes (the system's light and dark theme, which the page follows).
4. On Settings, set the Parallel limit to another value and save. In the chat, `project_snapshot` (or `/binnacle:status`) gives it in `tasks.parallel` with `source: machine`. Set it back to what you want autopilot to use. Under the limit, *What this machine has carried* is ticket 07's last criterion.
5. In the Claude desktop app, run a Binnacle skill that offers commands, such as `/binnacle:daily`: each command stands alone in a fenced block with the app's copy button, a shell command in a `bash` block with a Run button too.
6. Tick each criterion that held; for one that did not, one line on what went wrong, to become a ticket. Then a Product session reads epic 18's measurement: `usage_get` with `epic: 16` against `epic: 11`.

### The demonstration, 2026-10-12

The owner went through the dashboard: the design reads better and they like it, and most widgets are fine, but some places do not read yet, so the first criterion is not met. Filed as tickets, which this one now waits on:

- **10**: the current Epic shows as 12, "Audit, completed", with no Tasks, while 16 is in progress.
- **11**: the Overview's epic progress is folded to a line, and its stepper shows no names when opened; the owner wants the stepper in *Brief* and every epic with its name, status and Tasks done out of all in *Full*. "What's next" is far larger than its content.
- **12**: on the Project page the epics fill the width and the first screen with little in each row, and the board starts below; the owner's lead is the epics in a column beside the board.
- **13**: the Usage page's widgets sit in rows, so a short one leaves a large empty space under it and the page reads as a jumble.

The other criteria wait for the next demonstration, after 10 to 13 merge.

### After tickets 10 to 14, 2026-10-12

The owner, after autopilot merged 10 to 13: the epics belong on the left of the board, not on the right as their lead in 12 said, which ticket 14 did; otherwise every page now reads ("сейчас нормально, более-менее читаем"). The first criterion holds on that word. The other three wait for the owner to confirm them.

### Accepted, 2026-10-12

After ticket 16 made the daemon answer in about a second, the owner accepted the epic as it stands ("все принято"), which ticks the other three criteria on their word.

Epic 18's measurement, `usage_get` by epic, per DONE Task, labelled as Binnacle's calculation (13 Tasks with runs in each; 15 and 16 of this epic had no runs attributed when it was read):

| mean per Task | epic 11 | epic 16 |
| --- | --- | --- |
| output | 73 389 | 63 166 (−14%) |
| cached input | 20.0 M | 15.3 M (−24%) |
| cache creation | 363 289 | 299 647 (−18%) |
| records | 114 | 102 |
| runs | 4.6 | 4.7 |
| rework share | 0.41 | 0.19 |
| first-pass acceptance | 0% | 8% |

Epic 16 ran cheaper per Task and with half the rework share, after epic 18's lean flow. The two epics did different work, a dashboard's pages against the daemon's reading of forges, so it reads as a direction, not a proof.

