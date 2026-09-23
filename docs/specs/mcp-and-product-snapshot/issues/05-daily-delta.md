# 05: Daily delta

Status: DONE
Triage: ready-for-agent
Blocked by: 03, 04
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

**What to build:** a Product session asks what changed since the previous daily and gets only that: commits, Task state transitions, new tickets, roadmap status changes and ADRs, ending with what can start next and what needs attention. Each daily becomes the baseline for the next one without anybody remembering when they last looked. Decided in the spec, under *Daily delta* and *Events*.

- [x] `daily.get` returns the delta from a baseline commit to the caller's HEAD, over committed state only, with the dirty flag.
- [x] Contents: commits (count and subjects, limited, with a remainder count); Task state transitions from each ticket's `Status:` at the baseline and at HEAD; tickets that did not exist at the baseline; roadmap status changes; ADRs added or changed; ready-to-start Tasks; attention items.
- [x] The baseline is the head commit of the most recent `daily` or `checkpoint` event for this project on this machine.
- [x] Each call records a `daily` event carrying the caller's HEAD; a second call in a row returns an empty delta.
- [x] An explicit `since` commit overrides the baseline and records nothing.
- [x] With no prior event, or a baseline commit that is no longer reachable, the delta falls back to the last seven days of commits, and the response states which fallback applied and why.
- [x] The Git adapter gains `log` and `show` at a revision, and stays read-only by construction.
- [x] `daily_get` is exposed over MCP, mapped one-to-one like the others.
- [x] The `daily` event is tier 2 and survives a schema rebuild.
- [x] Tests through the daemon seam cover the first call's fallback, two calls in a row, an explicit `since`, a baseline removed by rewriting history, a dirty tree, a `READY` → `DONE` transition, a new ticket, a roadmap status change and a new ADR.

## Comments

- **What exists.** `daily.get` takes `{ path, since? }` and returns `{ project, checkout, head, dirty, from, fallback, commits, transitions, newTickets, readyToStart, roadmap, decisions, attention }`. `from` is `{ commit, source }`, where `source` is `daily`, `checkpoint`, `since` or `fallback`, and `commit` is null when the fallback window reaches past the first commit, in which case everything is new. `fallback` is null or `{ reason, message }` with `reason` one of `no_baseline`, `baseline_missing`, `baseline_diverged`. `commits` is `{ count, items: [{ commit, subject }], remainder }`, newest first. Every list is cut at the snapshot's `SECTION_LIMIT` of ten with a remainder, except `roadmap` and `attention`, as in ticket 03. `roadmap` lists epics whose status changed, and new epics with `from: null`. The code is in `apps/daemon/src/daily.ts`.
- **Reachable means an ancestor of HEAD.** A rewritten baseline still exists in the object store until it is garbage-collected, so "not reachable" is tested as `merge-base --is-ancestor`: `baseline_diverged` when the commit is there but HEAD does not descend from it, `baseline_missing` when it is gone. The fallback's start is the last commit before the seven-day window (`git log -1 --before`), so the rest of the delta is computed exactly as for a baseline.
- **An explicit `since` is refused, not replaced.** A `since` that is not 4 to 64 hex digits, names no commit, or is not an ancestor of HEAD is `request.invalid` (400), and nothing is recorded. The spec defines the fallback only for a recorded baseline, and a window nobody asked for would hide a typo. `daily_get` exposes `since` as its one argument; it is the only tool with an input schema, because the SDK rejects a call with no `arguments` against any schema, and the other three keep accepting one.
- **Committed state through `Tree`.** `packages/adapters/src/tree.ts` defines `Tree` (`list`, `read`), with `workingTree(root)` for the snapshot, `commitTree(cwd, commit)` in `git.ts` for the daily, and `EMPTY_TREE`. `readLocalTasks` now takes a `Tree` and is async. `snapshot.ts` exports `readState(tree, projected, diagnostics)`, which reads Tasks, the roadmap and the ADR list with their attention items; the snapshot and both ends of the daily use it, so the daily's attention is the snapshot's, computed at HEAD. This replaced the plan in ticket 02's comments to export `parseTicket`: listing a commit's directories needed the walk as well as the parser.
- **Git commands.** Beyond `log` and `show`, the adapter now runs `ls-tree` to list a commit's directory, `merge-base --is-ancestor`, and `rev-parse --verify` to resolve a hash. All only read. `readCommit` refuses anything but hexadecimal before asking Git, and every other new function takes only commits it or the Git facts returned, so no caller text reaches Git as an option.
- **For ticket 06.** The baseline is the `head` in the payload of the latest `daily` or `checkpoint` event for the project (`store.latestEvent`, by insertion order), so a `checkpoint` event must carry `{ head, … }` under that key. `BASELINE_EVENTS` in `daily.ts` already lists it. `checkpoint.prepare` can call `daily(projected, caller, diagnostics, baseline)` with a baseline read from `checkpoint` events alone.
- **Known limits, kept.** The baseline is per project, not per checkout: a daily in a worktree on another branch moves it, and the next daily in the main checkout then falls back as `baseline_diverged` and says so. Both ends are read with the manifest as it is now, so moving `tracker.local.issues` or `knowledge.adr` makes every ticket or ADR look new once.

### Review

`/code-review` ran against `main` on both axes.

**Standards: no hard violations.** Judgement calls:

1. The Git adapter's read-only promise rested on the daemon's hex check for `since`. **Fixed**: `readCommit` refuses anything but hexadecimal itself.
2. `isUnavailable` was renamed at the re-export to `isGitUnavailable`. **Fixed**: renamed at its source.
3. `commitHash(body)` read as if it computed a hash. **Fixed**: `sinceCommit`.
4. `CallDaemon`'s body and the tool callback hard-coded `since`. **Fixed**: the body is `{ path } & Record<string, unknown>`.
5. `snapshot.ts` now also exports the shared state reading that `daily.ts` uses. **Left**: moving `readState` out is one file for a few functions, and it still shapes what the snapshot reads.
6. `roadmap` in the daily has no item limit. **Kept**, as in ticket 03: a human writes the table.
7. The module comment in `daily.ts` sits on `FALLBACK_DAYS`; `rebuild.test.ts` repeats the Git wrapper; `(cwd, …, timeoutMs)` travels through every Git function. **Left**: each follows the existing files.
8. A listed ticket that cannot then be read parses as an empty one. **Left**: only a file deleted between list and read can do that.

**Spec: every acceptance criterion implemented.** Findings:

1. An explicit `since` that named no commit fell back to seven days. **Fixed**: refused; see above.
2. `baseline_missing` was tested only through `since`. **Fixed**: a recorded baseline is rewritten away and garbage-collected in the test.
3. `Tree`, the async tracker and `readState` go beyond ticket 02's plan to export `parseTicket`. **Kept**: see *Committed state through `Tree`*.
4. `ls-tree`, `merge-base` and `rev-parse` go beyond "`log` and `show`". **Kept**: inspecting only, listed in the adapter's header.
5. `baseline_diverged`, `git.no_commits` (409) and the hex form of `since` go beyond the spec. **Kept**, as graceful degradation that guesses nothing.
6. The baseline is per project, and both ends use today's manifest. **Kept**; see *Known limits*.
