# 16: A daemon that answers in a second

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** found by the owner on 2026-10-12, after ticket 15: picking an epic left the board unchanged for seconds. Measured on the owner's daemon, five registered projects and three months of history: about 70% CPU with nobody using it; `project.snapshot` 5 to 11 s, `usage.get` 11 s, `task.list` 7 s, against 0.05 s for `project.status`. A temporary daemon with this repository alone and the same history answers `task.list` in 0.7 s and `project.snapshot` in 1.3 s. Two causes:

1. **Branch to Task, recomputed per lookup.** A CPU profile of one snapshot spends about 2.2 s of 5.3 s in `branchSlug` and its regular expressions (`packages/core/src/tracker.ts`): `tasksOnBranch` computes `taskBranch` for every Task on every lookup, and `runs` and `reviewPoints` (`apps/daemon/src/usage.ts`) look up a branch per record and run, so the cost is records × Tasks. `git` processes take about 1 s more.
2. **Every project's snapshot every 15 seconds.** The dashboard's shell (`loadProjects`, `apps/dashboard/app/composables/projects.ts`, from `app.vue`) asks for `project.list` and the full `project.snapshot` of every registered project on each poll, so with five projects the daemon never idles and a page's own request waits behind them.

Fix the first by mapping branches to Tasks once per Task list, with behaviour unchanged. Fix the second with the smallest change that stops the storm, the rail's dots, the Projects page and the Attention page still right: the selected project polled as now and the others less often or only where a page shows them, or the daemon handing a snapshot computed a few seconds ago to callers that ask again. Profile again after both and fix only what is still large, such as the `git` processes. Caching runs between calls, a background ingest, and caching CI are later steps, taken only if the numbers still ask for them.

- [x] A branch's Task is found without recomputing every Task's branch; the existing tests pass unchanged, and one pins the mapping.
- [x] The dashboard no longer computes every registered project's full snapshot every 15 seconds; the rail's dots, Projects and Attention stay right.
- [x] Before and after, on a temporary daemon with the owner's five projects registered: CPU while idle with the dashboard open, `project.snapshot`, `usage.get` and `task.list` for this repository, recorded here.
- [x] The docs say what changed where they describe it (`docs/04-telemetry-dashboard.md`, `docs/01-architecture.md`).
- [ ] The owner restarts the daemon and switches the Project page's board in about a second.

## Comments

**Branch to Task.** `tasksOnBranch` (`packages/core/src/tracker.ts`) indexes a Task list's local branches once, in a `WeakMap` keyed by the list, which is never changed once read; `branchTask` and `sharedBranch` look a branch up in it. A remote branch still maps by its number, which costs no slug. A test pins the mapping: a hundred rounds of lookups read each ticket once.

**The storm.** The shell (`app.vue`) reads the selected project's snapshot on every poll, every project's on Projects and Attention, and the others' every fourth poll, a minute; `loadProjects` keeps a project's previous view otherwise, and reads one it has none for. Picking another project, or opening Projects or Attention, reads at once.

**Profiled again.** After both, `reviewPoints` (`apps/daemon/src/usage.ts`) still spawned one `git rev-parse` per Task branch, Task after Task, about 3.4 s of a profile of nine calls: it now reads every branch tip with one `git for-each-ref` (`readBranches`, already in the adapters). What is left:

- `project.snapshot` spends 1.2 to 1.9 s of its 2 s waiting for GitHub, reading CI; it is wall time, not CPU. Caching CI is the later step the ticket names.
- the largest CPU item is `store.usage`, the query that leaves out OpenTelemetry records an artifact already holds: 0.5 s on this repository, 1.2 s on interviewtrainer, run by the snapshot, `usage.get` and `task.list` alike. Caching runs between calls is the later step.

### Measured, 2026-10-12

A temporary daemon (`BINNACLE_HOME` in a scratch directory, port 7720) with the owner's five projects registered and a copy of the owner's database. Each operation called three times for this repository, the first call cold. The dashboard's polling replayed by a script, since a hidden browser tab does not poll: every 15 s the shell's requests and the Project page's `task.list` and `usage.get` on this repository, CPU read from `/proc` over 120 s after 20 s.

| | before | after |
| --- | --- | --- |
| CPU, the dashboard open | 74% | 19% |
| `project.snapshot` | 8.3, 4.4, 4.1 s | 6.0, 2.6, 2.3 s |
| `usage.get` | 2.7, 2.8, 2.7 s | 0.80, 0.81, 0.80 s |
| `task.list` | 2.6, 2.7, 2.6 s | 0.65, 0.68, 0.66 s |
| `project.status` | 0.04, 0.02, 0.01 s | 0.04, 0.01, 0.01 s |

The daemon's fixes alone, under the old polling, take CPU from 74% to 34%. The board is `task.list`, 0.7 s.

### Review

Reviewed by the session itself over the diff: one index, one `git` call, one shell change and two doc paragraphs. Nothing to fix. Kept: another project's rail dot and the menu's Attention count can be a minute old, which `docs/04-telemetry-dashboard.md` says.


### After the owner's check, 2026-10-12

The owner found the daemon much quicker, but a page reload still took about seven seconds. The shell's first load waited for every project's snapshot, each of which waited on GitHub or GitLab. Profiled again on the same temporary daemon:

- **The dedupe of OpenTelemetry records** (`store.usage`): its `case` kept SQLite from any index, so each OpenTelemetry record scanned every artifact record of its session. Two `exists` lookups, the first by request id through a new index `(harness, session_id, request_id)` that replaces `(harness, session_id)`, return the same rows: 0.77 s to 0.04 s on this repository, 1.65 s to 0.10 s on interviewtrainer.
- **The first load** shows the selected project once its snapshot is read, and reads the others after it (`app.vue`).
- **The forge**: CI and a GitHub or GitLab tracker's Tasks are kept for a minute (`fromForge`, `apps/daemon/src/ci.ts`), the owner's choice over 15 s or none; a failed read is read again on the next call. `startDaemon`'s `forgeCacheMs` sets it, `0` in tests; a test pins it on GitHub issues. The Task page's own request, read with a filter, is not kept.
- **A run's checkout** (`runs`) is found once per directory rather than once per record: 1.4 s of a profile, on interviewtrainer's 30 000 records.

| this repository, warm | after the first fixes | now |
| --- | --- | --- |
| page shown after a reload | 6 to 7 s | 0.8 s |
| every project read after a reload | 6 to 9 s | 1.3 s |
| `project.snapshot` | 1.7 to 2.0 s | 0.43 to 0.54 s |
| `usage.get` | 0.8 s | 0.4 s |
| `task.list` | 0.65 s | 0.25 s |
| CPU, the dashboard open | 19% | 9% |

Left as they are: a reload still starts about a hundred `git` processes, eleven of them `symbolic-ref` for this repository's default branch; and the first call after the daemon starts takes about 5 s, reading each Task branch's own commits once (`readOwnChangeTimes`), which is then kept.
