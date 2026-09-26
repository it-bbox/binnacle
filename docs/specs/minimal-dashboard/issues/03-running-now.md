# 03: What is running now, and who runs it

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** the dashboard and the Product Snapshot show what is running now and who runs it, and what ran recently. Decided in the spec, under *The snapshot*.

- [x] The observed run carries its checkout: the root of the checkout its records' `cwd` lies in.
- [x] The snapshot gains `activity`, and each run in it is as `usage.get` gives it, with its Task's title and its checkout:
  - `running`: the project's runs active now, with the section limit and a remainder;
  - `recent`: its latest other runs, up to the section limit.
- [x] The Overview shows each project's runs running now: the Task, or the role when there is none, and the harness, model and latest activity.
- [x] The Attention/current activity page lists every project's attention items with their codes, and the runs running now and recently.
- [x] The Projects page shows each project's latest activity.
- [ ] The `product` skill shows `activity.running` beside the Tasks in flight.
- [x] Tests through the daemon seam cover:
  - running and recent, split at telemetry's recency;
  - a run in a linked worktree, with its checkout;
  - an unassigned run;
  - a Product session's run, with the `product` role.

## Comments

- **What exists.**
  - `ObservedRun.checkout` (`packages/core`) is the root of the checkout the run's records ran in, from `observedRuns` in `packages/telemetry`, which already split runs where the checkout changes. `usage.get`'s Task runs carry it too, which the Task page's timeline needs.
  - The snapshot's `activity` is built in `apps/daemon/src/usage.ts` (`usageAndActivity`, `activityOf`) from the same runs as `usage.tasks`. `running` is `{ items, remainder }`; `recent` is a plain list of up to ten, as the spec words it. Both are latest activity first. Each run is `usage.get`'s run (`RunUsage`, with `totals`) plus `taskTitle`.
  - The dashboard gains `app/components/RunList.vue`, `app/pages/attention.vue` (linked as *Attention*), a *Running now* section on the Overview and a *Latest activity* column on Projects. The panel styles all three pages share are in `app/app.vue`.
  - `/binnacle:product` shows *Running now* beside the Tasks in flight. `project_snapshot`'s description names the runs.
- **Decided while building, within the spec.**
  - **A run's checkout is `null` when Binnacle cannot say**: Git lists no worktrees, or the checkout is gone. A removed worktree's records are otherwise found inside the registered checkout that still contains their path, which is not where they ran, and autopilot removes every ticket's worktree. A record in the registered checkout counts as gone when its own directory is, so a session launched in a directory later deleted inside the registered checkout has no checkout either (a `ponytail:` comment in `runs()` names this; storing each record's checkout at ingest is the upgrade).
  - **`activity` is unavailable, with the tracker's reason, when the tracker cannot be read**, as `usage.tasks` and `usage.get`'s `byRole` are: without the Tasks a run's role and Task cannot be told.
  - **The snapshot groups every stored record into runs**, as `usage.get` does, so a run has the same id in both. `usage.tasks` still counts the last seven days' records. A `ponytail:` comment names the cost of grouping the whole window on every call.
  - **The field is `taskTitle`**, beside `taskId`; null for an unassigned run.
  - **The pages show a run's branch and checkout** besides what the criteria list, since the spec's run carries them and user story 14 asks who is busy with what. Running is labelled once per page as Binnacle's reading of the latest activity, within ten minutes.
  - **Latest activity** on Projects is the first running run, otherwise the latest recent one: its age and its Task or role.
- **For the next tickets.**
  - A board card's latest run (ticket 04) and the Task page's timeline can reuse `RunList.vue`, or `ago` and `runSubject` from `app/composables/projects.ts`.
  - The Suggested step's rule 1 (ticket 05) wants an active implementation run of a Task: `activity.running` has it, with `role` and `taskId`, but only the first ten. Read the runs themselves in the daemon, not the section.
  - The Usage page (ticket 07) gets `usage.get`'s runs with `checkout` already.
- **Checked by hand on 2026-09-26**, with a daemon on a temporary `BINNACLE_HOME` and an ephemeral port, this worktree registered and the dashboard generated, in the built-in browser. The Overview listed this session's run as `minimal-dashboard/03: What is running now, and who runs it · claude-code, claude-opus-5-5 · just now · feat/running-now in <this worktree>`, with ticket 02's parallel session and its subagents in their own worktree, and the owner's Product session as `No Task, product role · … · main in <the registered checkout>`. The Attention page listed each project's attention and its running and recent runs. Projects showed each project's latest activity. The console showed no errors.
- **To check `/binnacle:product` yourself** (the exit demonstration, ticket 09, covers the pages on your own daemon):
  1. Once this branch is merged, run `binn daemon stop`, then `binn daemon start`, in the main checkout.
  2. Start a session on a ticket's branch, or leave one running, and within ten minutes start a fresh session in the main checkout with `/binnacle:product`.
  3. Beside *Tasks in flight*, it shows *Running now*: that session's run, with its Task's id and title, harness, model, branch, checkout and latest activity, and your Product session's own run with the `product` role and no Task. It says once that running is Binnacle's reading.
  4. Tick the `product` criterion above if it does.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violations.** Rendering stays text-only, and provenance and unavailability pass through. Judgement calls:

1. **The checkout's existence test is on the record's `cwd`**, so a session launched in a directory later deleted inside the registered checkout loses its checkout, and a session that ran both there and elsewhere in that checkout splits into two runs. **Kept**, with the ceiling named in the `ponytail:` comment: a removed worktree is routine here (every autopilot ticket), a deleted launch directory is not, and the fix is storing the checkout at ingest.
2. **Mysterious name**: the snapshot's `usage` callback, and the daemon's `usage()`, now answer two sections. **Fixed**: both are `usageAndActivity`.
3. **Duplicated code**: the Overview's and the Attention page's panel styles. **Fixed**: they are in `app.vue`. The four-line attention list is on both pages. **Left**: extract it when a third page shows it.
4. **The daemon's run types are repeated in the dashboard's composable.** **Left**: the existing pattern for `GitFacts` and `Snapshot`; the dashboard imports nothing from the daemon.
5. **The nested ternary in `activityOf`'s sort.** **Left**: it is code-unit order, as the rest of the daemon's ordering is, which `localeCompare` is not.
6. **`unavailable()` beside `project.unavailable`.** **Fixed**: `isUnavailable`.
7. **`latestActivity` picks a run**, which is a little more than formatting. **Kept**: taking the first of two lists already in order.

**Spec: every criterion holds**, and the tests pass. Findings:

1. **The checkout test** (as Standards 1). **Kept**, as above. The reviewer also noted the answer now depends on whether a directory exists, beside Git and the tracker; the same state still gives the same answer.
2. **`activity` unavailable when the tracker cannot be read.** **Kept**, recorded above.
3. **Grouping the whole window on every snapshot.** **Kept**: run ids must match `usage.get`'s, and the `ponytail:` comment names the cost. `usage.tasks` is unchanged, because a record's Task follows from its own branch, however runs are cut.
4. **Branch and checkout shown beyond the criteria.** **Kept**, recorded above.
5. **"Ten minutes" written twice in the pages.** **Fixed**: one label, `RUNNING_READING`. The daemon does not expose its recency, so the label still states it; change it with `ACTIVE_WITHIN_MS`.
