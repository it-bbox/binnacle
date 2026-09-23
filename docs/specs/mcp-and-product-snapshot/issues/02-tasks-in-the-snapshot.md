# 02: Tasks in the Product Snapshot

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

**What to build:** a `project.snapshot` operation that tells a fresh Product session which Tasks are in flight, which can start now and how many sit in every other state, read live from the project's tracker. It introduces the Task-reading half of the tracker contract and the local Markdown tracker as its first adapter; later tickets add the snapshot's other sections to the same operation. Decided in the spec, under *Task-reading contract*, *Local Markdown adapter* and *Product Snapshot*.

- [x] The Task-reading contract is defined in core, as types and pure functions with no dependencies, before the adapter that implements it: identity, title, state, declared dependencies, spec reference, triage role, ticket path.
- [x] The local Markdown adapter reads every ticket under the manifest's `tracker.local.issues`, with identity `<spec-slug>/<NN>` and the title taken from the first heading without its number.
- [x] `Status:`, `Triage:`, `Blocked by:` and `Spec:` are read from the header lines; `Blocked by: None`, with or without a parenthetical, means no dependencies; numbers refer to tickets in the same spec directory.
- [x] A `Status:` value that is not a Task state gives the Task a `null` state and an attention item. Nothing is guessed.
- [x] Unmet dependencies are computed by the contract, not the adapter: a declared dependency whose Task is not `DONE`. A dependency naming no known Task is an attention item, not an Unmet dependency.
- [x] The snapshot lists by name every Task in `ACTIVE`, `BLOCKED`, `READY_FOR_REVIEW`, `APPROVED` and `MERGE_READY`, and every `READY` Task with no Unmet dependencies; every other state, `null` included, appears as a count.
- [x] Each listed Task carries identity, title, state, Unmet dependencies and ticket path. Each section holds at most ten items and reports a remainder count.
- [x] `BLOCKED` and an Unmet dependency are reported separately.
- [x] Tickets are read on every call; an edit to a ticket file shows in the next snapshot. No Task table is created.
- [x] The response is deterministic: the same files give the same snapshot, in a stable order.
- [x] Tests through the daemon seam use a fixture with tickets in every Task state, including the limits, the remainder counts and both attention items.

## Comments

- **What exists.** `project.snapshot` returns `{ project, tasks, attention }`. `tasks` is `{ inFlight, readyToStart, counts }`: each section is `{ items, remainder }`, and each item is `{ id, title, state, unmetDependencies, ticket }`. `counts` holds every Task that is not listed by name, keyed by state: `READY` there means a `READY` Task with an Unmet dependency, and `unknown` means a Task whose state is `null`. Listed items, remainders and counts add up to every Task. The code is in `apps/daemon/src/snapshot.ts`.
- **The contract** is in `packages/core/src/tracker.ts`: `TrackerTask`, `TaskReading` (`{ tasks, diagnostics }`), and `resolveDependencies`, which computes Unmet dependencies and emits `task.dangling_dependency`. `isTaskState` is in `domain.ts`. The adapter is `readLocalTasks(root, issues)` in `packages/adapters/src/local-tracker.ts`. It emits `task.unknown_state` both for a `Status:` value that is not a Task state and for a missing `Status:` line. `packages/adapters` now depends on `@binnacle/core`, and `daemon.test.ts` pins that as its only dependency.
- **Diagnostic codes not named in the spec.** `tracker.unavailable`: `tasks` is `null` when the tracker is not `local`, has no `tracker.local.issues`, or the manifest is unreadable. `tracker.issues_missing`: the declared issues path is not a directory. Ticket 03 should put both beside the other attention items.
- **Header parsing.** Only the first run of non-blank lines under the first heading is read. A missing `Blocked by:` line means no declared dependencies. Ticket numbers are compared as numbers and written as two digits, so `2` and `02` are one ticket. Tickets are ordered by spec slug, then by number.
- **For ticket 03.** The fixtures in `apps/daemon/test/snapshot.test.ts` are plain directories without Git, because Tasks do not read Git. The Git section will need `git init`, as in `status.test.ts`. Since ticket 01, `project.snapshot` resolves its project like `project.detect`, so a sibling worktree finds it. Tickets are still read at the registered path, not at the caller's checkout. Ticket 03 should decide whether a snapshot taken in a worktree reads that worktree's tickets, next to the Git section it already reads from the caller's checkout.
- **For ticket 05.** The daily compares `Status:` at two revisions. The header parser, `parseTicket` in `local-tracker.ts`, takes text and not a path, so it can be exported for that without being rewritten.

### Review

`/code-review` ran against `main` on both axes. The findings below are unchanged by the rebase onto ticket 01.

**Standards: no hard violations.** Judgement calls:

1. `tasks.unavailable` was the only plural code namespace among `project.`, `manifest.`, `git.` and `tracker.`. **Fixed**: renamed to `tracker.unavailable`.
2. The keys of `TaskCounts` were a hand-written copy of `TaskState` minus the in-flight states, cast with `as`. **Fixed**: they are now derived from `TaskState` and `IN_FLIGHT`, without a cast.
3. `section()` repeats the field list of `SnapshotTask`. **Left**: it is five fields, and the `Pick` keeps them in step.
4. `local-tracker.ts` mixes arrow constants and `function` declarations. **Left**: cosmetic, and `git.ts` does the same.

**Spec: every acceptance criterion implemented.** Findings:

1. The every-state fixture did not include the limits and remainders; a separate test covered them. **Fixed**: it is now one fixture, and that fixture found tickets ordered by file name (`15-…` before `8-…`). They are now ordered by number.
2. The fixtures are plain directories, not `git init` repositories. **Left**: Tasks read no Git; see *For ticket 03* above.
3. `tracker.unavailable`, `tracker.issues_missing`, a missing `Status:` line reported as `task.unknown_state`, and number normalisation all go beyond the spec. **Kept**, as graceful degradation that guesses nothing; listed above for ticket 03.
4. A missing `Blocked by:` line means no dependencies, with no attention item. **Kept**: the absence of a declaration is not a declaration. It is one line to change if that turns out wrong.
5. Only the first block of header lines is read, so a blank line inside the header drops the lines after it. **Kept**: every ticket uses one contiguous block, and the spec reads nothing below the header.
6. A `null` state is counted under `unknown`, because JSON has no `null` key. **Kept**, and documented on `TaskCounts`.
