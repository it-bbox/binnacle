# 03: `usage.get` and `usage_get`

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/telemetry/spec.md`

**What to build:** a session asks for a project's usage, or one Task's usage with its runs, over MCP. Decided in the spec, under *`usage.get` and `usage_get`*.

- [x] `usage.get` takes the caller's path and an optional Task id in the forms `task.get` takes, and runs the ingest first as the snapshot does.
- [x] Without a Task: the project's totals over the whole ingested window, per Task and unassigned, with a limit and remainder.
- [x] With a Task: its totals and its runs newest first, with a limit and remainder; each run carries id, harness, provider, model, role, branch and its source, Task, parent run, start, latest activity, `active` and totals.
- [x] An unknown Task id is `task.not_found`; a Task with no runs is an empty list.
- [x] `usage_get` takes one optional argument, `task`, and maps one-to-one onto `usage.get`. The MCP smoke test lists it and calls it once.
- [x] `docs/03-mcp-and-skills.md` lists `usage_get`.
- [x] The write-guarantee test's input table includes `usage.get`.

## Comments

- **Where it lives.** The operation is `usage.get` in `apps/daemon/src/operations.ts`. Its body is `usageGet` in `apps/daemon/src/usage.ts`. The ingest wait the snapshot already had is now `ingested` there, shared by both. `task.get`'s tracker read and id lookup is now `findTask` in `apps/daemon/src/task.ts`, so a Task id is taken in exactly `task.get`'s forms and fails with its codes. `trackerUnavailable` in `apps/daemon/src/snapshot.ts` gives the one unavailable reason. The tool is `usage_get` in `packages/mcp/src/index.ts`. The tests are the `usage.get` suite in `apps/daemon/test/usage.test.ts`, the smoke test and the write guarantee.
- **The answer's shape.**
  - Without a Task: `{ importing, totals, tasks, unassigned }`. `tasks` and `unassigned` are shaped as in the snapshot, over everything stored rather than the week.
  - With a Task: `{ importing, task: { id, title }, totals, runs: { items, remainder } }`. A run is the `ObservedRun` less `projectPath`, plus its `totals`.
  - `importing` is the snapshot's own field, so the answer says when the import is incomplete (spec, *Ingest*).
- **Decided here, within the spec.**
  - "The whole ingested window" is every stored record of the project, whatever the window is now. Runs are grouped over all of them at once, so a run's id does not change as the week moves on (ticket 02's hand-over). A window narrowed after an import leaves the older records counted, while `importing.windowStart` gives the new start. Records are never removed (ADR-0015, user story 41), and a window-bounded query would give a long run a new id as its start fell out.
  - "Newest first" is by start, `startedAt`, then id. The limit is the snapshot's section limit, ten.
  - With a Task, the tracker must be readable and hold the Task: an unknown id is `task.not_found` (404), and an unreadable tracker is `task.get`'s error with its code (503). Without a Task, an unreadable tracker makes `tasks` and `unassigned` unavailable, and `totals` still answers, as in the snapshot.
  - The ingest runs before the Task is looked up, so every call reads what is new, even one that fails.
  - `docs/03-mcp-and-skills.md` listed a planned `usage.summary`. It now lists `usage.get` with its tool `usage_get`. No rule was attached to the old name.
- **Roles over HTTP (ticket 02's hand-over), in part.** `usage.get` returns runs only for a Task. A run with no Task is either `unknown`, or `product` on a default branch that is no Task's branch, and neither appears in any answer. The new HTTP test shows `implementation`, and shows `product` taking precedence on a default branch that is a Task's branch. The full role table, `unknown` and the `main` fallback included, stays in the direct test of `runs` over the daemon's store. Its comment now says why.
- **For later tickets.**
  - **Ticket 09, and a question for the owner.** The spec's exit demonstration checks "that Product sessions on `main` carry the `product` role". Product sessions on `main` are unassigned, and no answer lists unassigned runs, by role or otherwise. The spec gives unassigned usage as one total. So the demonstration cannot see that role through `usage_get` as specified. Either the demonstration checks it another way, or unassigned runs (or a total by role) get a place in an answer. That is a product decision, and this ticket does not make it.
  - **Ticket 04.** `usageGet` passes `ObservedRun.parentRunId` through unchanged, so linking subagents in `observedRuns` shows up here with no further change.
- **Run on the owner's own artifacts.** An in-process daemon ran with a temporary Binnacle home and read `~/.claude/projects`. It registered this worktree, whose linked checkouts include the main one. After the import, `usage.get` took 42 ms for the project and 36 ms for one Task. It counted 1,481 main-session records in the 90-day window, 821 of them unassigned. Nineteen Tasks had usage: ten were listed, with a remainder of 9. `telemetry/02` had no runs: its work ran in subagent sessions, which are not read until ticket 04.

### Review

`/code-review` against `main`, both axes in foreground sub-agents.

**Standards** (no hard violations)

1. `usageGet` chose between the Task's tracker reading and the plain one through chained nullables. **Fixed**: now a plain `if`.
2. `runs(…, manifest?.tracker.provider !== 'local', …)` appears in both `usage` and `usageGet`. **Kept**: `runs` takes the flag as a fact, and the direct roles test passes it without a manifest.
3. `store.usage(projectPath, 'claude-code', '')` uses the empty string to mean "since the start". **Kept**, with a comment: the parameter is a lower bound on a timestamp, and a second way to say "all" is not worth it.
4. `ProjectUsage`, `RunUsage` and `TaskUsage` are exported with no importer. **Kept**: they are the exported function's return type, as `Usage` is.
5. `trackerUnavailable` lives in `snapshot.ts`, beside `readTracker`. **Kept**: that is where the tracker is read.
6. The `docs/03-mcp-and-skills.md` entry has a parenthetical. **Kept**: `daily.get`'s entry has one too.

**Spec**

1. Roles are only partly asserted over HTTP. **Kept**, as above: `unknown` cannot appear in any answer the spec defines. Raised for ticket 09 and the owner.
2. No scope creep.
3. An unknown Task or an unreadable tracker answered before the ingest ran. **Fixed**: the ingest now runs first.
4. Records older than a narrowed window are still counted. **Kept**, recorded above.

Typecheck is clean and the full suite passes: 291 of 291 before the rebase onto ticket 08, 295 of 295 after it. Ticket 08 changed `usage.ts` only where the session files are found, which this ticket does not touch.
