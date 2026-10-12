# 16: A daemon that answers in a second

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** found by the owner on 2026-10-12, after ticket 15: picking an epic left the board unchanged for seconds. Measured on the owner's daemon, five registered projects and three months of history: about 70% CPU with nobody using it; `project.snapshot` 5 to 11 s, `usage.get` 11 s, `task.list` 7 s, against 0.05 s for `project.status`. A temporary daemon with this repository alone and the same history answers `task.list` in 0.7 s and `project.snapshot` in 1.3 s. Two causes:

1. **Branch to Task, recomputed per lookup.** A CPU profile of one snapshot spends about 2.2 s of 5.3 s in `branchSlug` and its regular expressions (`packages/core/src/tracker.ts`): `tasksOnBranch` computes `taskBranch` for every Task on every lookup, and `runs` and `reviewPoints` (`apps/daemon/src/usage.ts`) look up a branch per record and run, so the cost is records × Tasks. `git` processes take about 1 s more.
2. **Every project's snapshot every 15 seconds.** The dashboard's shell (`loadProjects`, `apps/dashboard/app/composables/projects.ts`, from `app.vue`) asks for `project.list` and the full `project.snapshot` of every registered project on each poll, so with five projects the daemon never idles and a page's own request waits behind them.

Fix the first by mapping branches to Tasks once per Task list, with behaviour unchanged. Fix the second with the smallest change that stops the storm, the rail's dots, the Projects page and the Attention page still right: the selected project polled as now and the others less often or only where a page shows them, or the daemon handing a snapshot computed a few seconds ago to callers that ask again. Profile again after both and fix only what is still large, such as the `git` processes. Caching runs between calls, a background ingest, and caching CI are later steps, taken only if the numbers still ask for them.

- [ ] A branch's Task is found without recomputing every Task's branch; the existing tests pass unchanged, and one pins the mapping.
- [ ] The dashboard no longer computes every registered project's full snapshot every 15 seconds; the rail's dots, Projects and Attention stay right.
- [ ] Before and after, on a temporary daemon with the owner's five projects registered: CPU while idle with the dashboard open, `project.snapshot`, `usage.get` and `task.list` for this repository, recorded here.
- [ ] The docs say what changed where they describe it (`docs/04-telemetry-dashboard.md`, `docs/01-architecture.md`).
- [ ] The owner restarts the daemon and switches the Project page's board in about a second.
