# 04: The board on the Project page

Status: DONE
Triage: ready-for-agent
Blocked by: 01, 02
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** the Project page shows the project's roadmap and a mini kanban of an epic's Tasks. In progress is read from runs, and each card names who works on it. Decided in the spec, under *The board: `task.list`*, and in ADR-0032.

- [x] `packages/core` gives a Task's column from its state and from whether AgentRuns are attributed to it:
  - **Backlog**: `BACKLOG`.
  - **Ready**: `READY` without runs.
  - **In progress**: the in-flight states, and `READY` with runs, whose source is `runs`.
  - **Done**: `MERGED` and `DONE`.

  `CANCELLED` is counted, not listed. A Task whose state is unknown is listed apart, with its diagnostic.
- [x] `task.list` takes the caller's path and an optional spec slug. Without a slug, it answers for the current epic.
- [x] For each Task, `task.list` gives:
  - its id, title and state;
  - its column and the column's source;
  - its Unmet dependencies;
  - its ticket;
  - its start command;
  - its latest run — harness, model, role, latest activity and whether it is active — or none.
- [x] Each column has the section limit and a remainder, and Done lists its latest Tasks by id. Remote Tasks without a spec form their own group.
- [x] The Project page shows the roadmap's epics with their statuses, and the board for the current epic, with a switch to any other epic.
- [x] A card shows its state and its Unmet dependencies. It carries the `runs` label when its column comes from runs, and says who works on it and whether that run is running now. A card links to its Task page.
- [x] Done shows its count and its latest cards.
- [x] The Project page also shows the registered checkout's Git state and the recent decisions. Pending decisions and CI appear as not available, with the snapshot's reason.
- [x] The Overview links each project to its Project page.
- [x] No ticket file changes: `task.list` joins the write guarantee's calls.
- [x] Tests through the daemon seam cover:
  - every column;
  - a `READY` Task with a run, In progress from runs;
  - `CANCELLED` counted but not listed;
  - an unknown state listed apart;
  - the limit and the remainder;
  - the current epic when no slug is given.

## Comments

- **What exists.**
  - `boardColumn(state, runs)` is in `packages/core/src/tracker.ts`, beside `startCommand`. It lists every state, so a new Task state fails the type check rather than landing in a column.
  - `task.list` is `taskList` in `apps/daemon/src/board.ts`. It reads the Tasks and the roadmap through `readState`, as the snapshot does, and each Task's latest run through `latestRuns` in `apps/daemon/src/usage.ts`, which groups every stored record into runs, as `usage.get` does.
  - The answer is `{ epic, spec, columns: { backlog, ready, inProgress, done }, unknown, cancelled, withoutSpec }`. Each card has `id`, `title`, `state`, `column`, `source`, `unmetDependencies`, `ticket`, `start` and `latestRun`, which is `{ harness, model, role, lastActivityAt, active }` or `null`. An unknown-state card also has the tracker's `diagnostic`.
  - The Project page is `apps/dashboard/app/pages/project.vue`, at `/project?project=<registered path>`, with `&spec=<slug>` for another epic and `&withoutSpec` for the Tasks without a spec. The Overview's and the Projects page's project names link to it. Like the Task page, it has no link in the navigation, because it needs a project.
  - `usePolling` returns `refresh`, and keeps only the latest load's answer. The Project page calls `refresh` when its query changes.
- **Decided while building, within the spec.**
  - **`spec` has three forms.** Absent means the current epic. A string names a spec. `null` means a remote tracker's Tasks that carry no spec: the group of their own the spec asks for. The answer's `withoutSpec` counts that group, so the page offers it only when it holds Tasks.
  - **The current epic** is the roadmap's first row that is not `done`, the rule the Suggested step uses. An epic without a spec lists no Tasks. With no current epic, because every epic is done or there is no roadmap to read, `epic` and `spec` are `null`, and the board is empty.
  - **A slug that names no roadmap epic** still lists its Tasks, with `epic: null`.
  - **Any attributed run stands a `READY` Task In progress**, whatever its role or age, as ADR-0032 words it. The latest run is the one with the latest activity.
  - **Done lists its latest Tasks by id, descending**, comparing numbers, so `#10` comes after `#9`. The other columns keep tracker order, as the snapshot's sections do.
  - **An unknown-state card keeps its start command.** Ticket 02 recorded this: every state but `DONE` and `CANCELLED` has one. The board does not show commands; the card links to the Task page.
  - **A card shows its latest run in every column**, a Done card included, so the board says who worked on a finished Task.
  - **Pending decisions and CI show the snapshot's reason alone**, which already says "Not available".
- **For the next tickets.**
  - Ticket 05's Suggested step wants a Task's column, and whether it is In progress with no active run. `boardColumn` and `latestRuns` give both. `latestRuns` keeps only the latest run per Task, so rule 1 needs an active implementation run of any Task, read from the runs themselves.
  - Ticket 06 adds `review` to `task.list`'s cards, in `taskList`, and marks a Done card without one in `project.vue`.
  - `docs/04-telemetry-dashboard.md` lists "runs" and "active/blocking state" under the Project view. No ticket names them. The board's cards give each Task's latest run, its `BLOCKED` state and its Unmet dependencies. A Product session decides whether the Project page also needs the project's own run list.
- **Checked by hand on 2026-09-26.** A daemon ran on a temporary `BINNACLE_HOME` and an ephemeral port, reading this machine's Claude Code artifacts, with this worktree registered and the dashboard generated. In the built-in browser:
  - The Overview's project name opened the Project page, which listed epics 1 to 6 with their statuses.
  - The board opened on Epic 5. Ready had 05, 06, 08 and 09, each showing what it waits on. In progress had 04 (this session) and 07 (a parallel session). Both were `READY`, carried the `runs` label, and read `claude-code, claude-opus-5-5, implementation, last active just now: running now`. Done read `(3)`, latest first: 03, 02 and 01.
  - Clicking *Telemetry* switched the board to Epic 4: Done `(12)`, `telemetry/12` first, each card with its last run and `not running now`.
  - A card's id opened its Task page.
  - The registered checkout, the five latest ADRs with `and 27 more`, and pending decisions and CI with the snapshot's reason all showed. The console showed no CSP violation.
- **To see it yourself.**
  1. In the main checkout, once this branch is merged, run `pnpm dashboard:generate`, then `binn daemon stop` and `binn daemon start`.
  2. Run `binn dashboard`. On the Overview, click the project's name.
  3. The Project page lists the roadmap's epics, and the board shows the current epic.
  4. Start a `READY` ticket in a fresh session with its `/mattpocock-skills:implement …` command. Within one refresh (15 seconds), its card moves to In progress, with the `runs` label, the harness, the model and `running now`. The ticket file still says `READY`.
  5. Click another epic in the roadmap. The board switches to it.
  6. Click a card's id. The Task page opens.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground. Before the review, this branch was rebased onto `main` after ticket 03 merged. The one conflict was an import in `operations.ts`. The page then reused ticket 03's `ago` and `RUNNING_READING`.

**Standards: no hard violations.** Findings:

1. **A slow poll of the previous epic could overwrite the board after a switch**, because `usePolling` kept every answer. **Fixed**: it keeps only the latest load's answer.
2. **`boardColumn`'s `default` case put any other state In progress**, so a new Task state would land there silently. **Fixed**: every in-flight state is listed, and the switch is checked for exhaustiveness.
3. **An unknown state's diagnostic is found by its message's `<id> (` prefix.** **Kept**: both trackers write that prefix, and `Diagnostic` carries no Task id. A remote unknown state is now tested too, so a changed wording fails a test instead of giving `null`.
4. **`ingested` then `runs` appears three times in `usage.ts`.** **Left**: each caller needs a different part of the ingest's answer. Extract a helper when a fourth caller comes.
5. **The page reads `withoutSpec` from its own query to tell the Tasks without a spec from "no current epic".** **Kept**: the page shows what it asked for, which is formatting its own request.
6. **`Unavailable` was declared again on the page, and the board's group was typed `object`.** **Fixed**: the page reuses the dashboard's `Unavailable`, and the group is `{ spec?: string | null }`.
7. **The `board.ts` import is out of alphabetical order.** **Left**: the imports in `operations.ts` are not alphabetical to begin with.

**Spec: every criterion holds.** Findings:

1. **An epic without a spec cannot be switched to.** **Kept**: it has no Tasks, so it has no board.
2. **Cards do not show the start command.** **Kept**: the ticket does not ask for it, and each card links to the Task page, which shows the command with a copy button.
3. **"No epic is current on the roadmap" was also shown when there is no roadmap.** **Fixed**: the line gives both reasons.
4. **An unknown-state Task has a start command.** **Kept**, as ticket 02 decided.
5. **The Projects page also links to the Project page.** **Kept**: one line, and the Projects page is the list of projects.
6. **"runs" and "active/blocking state" in `docs/04-telemetry-dashboard.md`'s Project view have no ticket.** **Left** for a Product session, as recorded above.
