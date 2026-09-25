# 02: Observed runs and Task attribution

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/telemetry/spec.md`

**What to build:** records become observed AgentRuns, each attributed to a Task by its branch, with a role, and the snapshot shows usage by Task and unassigned. Decided in the spec, under *Observed runs and attribution* and *Snapshot `usage` section*, and in ADR-0028.

- [x] Records group by harness, session and subagent in time order; a new run starts where the checkout or the branch changes. A run's id derives from its first record's key and is stable across calls.
- [x] A record's branch is Claude Code's `gitBranch`, stored with source `harness`.
- [x] `packages/core` gains the inverse of the branch convention next to the forward one, with a test that the two agree: `feat/<slug>` to the one local ticket with that file slug, `feat/<number>-…` to issue `#<number>` when it exists. Zero or several matches is unassigned.
- [x] Role: `product` on the default branch (`origin/HEAD`'s target, otherwise `main`), `implementation` on a branch that maps to a Task, `unknown` otherwise.
- [x] The Task is resolved on read from the tracker's current contents; an unreadable tracker makes `tasks` and `unassigned` unavailable with its reason, and the totals still answer.
- [x] The snapshot's `tasks` lists the last seven days' Tasks, largest first, with id, title and total, the section limit and a remainder; `unassigned` is the last seven days' total.
- [x] A session outside the project's directory but in a linked worktree that still exists is attributed to the project.
- [x] `packages/core`'s domain gains the observed run as its own type, with no lifecycle state; `active` is calculated from the latest activity against a fixed constant and labelled so.
- [x] Tests through the daemon seam: a session split at a branch switch, a branch from a worktree that no longer exists, mapping on the local tracker and on the GitHub stand-in, no match and several, roles, and the tracker unreadable.

## Comments

- **Where it lives.** `packages/core/src/tracker.ts`: `branchTask`, beside `taskBranch`, with the agreement test in `packages/core/test/tracker.test.ts`. `packages/core/src/domain.ts`: `ObservedRun` and `RunRole`. `packages/telemetry/src/index.ts`: `observedRuns`, which groups, splits, ids and attributes runs, and `ACTIVE_WITHIN_MS`; its test is `packages/telemetry/test/runs.test.ts`. Telemetry now depends on core, as the spec says, and the daemon's dependency test allows exactly that. `packages/adapters/src/git.ts`: `readWorktrees` (`git worktree list`, added to the adapter's read-only list) and `readDefaultBranch`. `apps/daemon/src/usage.ts`: `projectCheckouts`, `runs` and the `tasks` and `unassigned` sections. The snapshot hands its own tracker reading to the usage section (`snapshot`'s `usage` callback, `State.unreadable`), so the tracker is read once per call and no traffic is added.
- **Decided here, within the spec.**
  - A run's id is `<harness>:<natural key of its first record>`.
  - A record's checkout is the deepest checkout of the repository that exists now and contains its `cwd`. It is computed on read, since the table has no column for it and none was worth a migration. A removed worktree's records therefore read as the registered checkout's. Git never has one branch checked out in two worktrees at once, so the branch still splits them at the same place. The only exception is a session that moves between checkouts on a detached HEAD, or with no branch recorded (a `ponytail:` comment in `usage.ts`).
  - A run's provider and model are its latest record's. `byModel` still counts every record under its own model.
  - `active` is true when the latest record is at most ten minutes old (`ACTIVE_WITHIN_MS`). It is shaped `{ value, provenance: 'calculated' }`.
  - On a remote tracker the number alone decides: `feat/7-renamed` is `#7`, and so is `feat/7`. On the local tracker a branch maps to the tickets whose `taskBranch` it is, which is by file slug. Two specs with the same file slug make that branch unassigned.
  - A branch equal to the default branch is `product`, even if it would also map to a Task.
  - `tasks` items are `{ id, title, totals }`. They are ordered by `magnitude`, largest first, and equal totals go by id. `unassigned` is a `Totals`. When the tracker cannot be read, both are `{ available: false, reason }`, where the reason is the tracker's own diagnostics, the same text as their attention items.
  - `projectPath` stands in for the data model's `project_id` on the observed run, as it does on the ingested record. `docs/06-data-model.md` now says so, and gives the provider and model rule and the ten minutes.
  - The `product` skill now names the week's largest Tasks and the unassigned total.
- **Rebased onto ticket 06.** Ticket 06 added the time budget, background imports and startup imports. `startIngest` now takes the project's directories in its linked worktrees. A call finds them with `projectCheckouts` before it starts or joins an import. On startup, the daemon asks Git for them first, and it starts nothing if the daemon was stopped meanwhile. A call that joins an import already running waits only for that import's files. So a worktree added after that import started is read by the next call. Two limits remain:
  - When a project is registered, ticket 06 forgets the cursors under that project's own directory prefix, but not under its linked worktrees' prefixes (`forgetRead`). Suppose a linked worktree outside the project shares a name prefix with another registered project, for example `/x/proj` and a worktree at `/x/proj-wt`. Then that project's earlier reads can have skipped the worktree's records. This is left, since re-reading after registration is ticket 06's rule and the case needs such a name clash.
  - The runs and the `tasks` section are built from the records stored when the call answers. An import still running past the budget fills them in on a later call, like the totals.
- **For later tickets.**
  - **Ticket 03.** Roles are not in the snapshot. So the roles test calls the daemon's own `runs` over its store (see Review, Standards 1). Once `usage.get` returns runs, move that assertion onto it. Build `usage.get`'s runs from the whole window, not the week: `runs` groups whatever records it is given, and a run that crosses the start of the records it was given gets a later id.
  - **Ticket 04.** `observedRuns` already groups by subagent (`subagentId` from the store) and leaves `parentRunId` null.
- **Run on the owner's own artifacts.** The branch's daemon ran in a temporary Binnacle home, with this repository's main checkout registered, and read `~/.claude/projects`. The first snapshot took 0.38 s. It counted 1,447 main-session records in the week, 787 of them unassigned (mostly Product sessions on `main`). Ten Tasks were listed with 9 more, led by epics 1 and 2's tickets. Subagent sessions are not read until ticket 04.
- **Not verified by a test: the `product` skill's wording.** Check it by hand as ticket 01 describes, from this branch's checkout, with `BINNACLE_HOME=$(mktemp -d) BINNACLE_PORT=0`. The usage lines should now name the week's largest Tasks and the unassigned total.

### Review

`/code-review` against `main`, both axes in foreground sub-agents.

**Standards**

1. The roles test calls `runs` and `projectCheckouts` directly, over a second store connection, not through HTTP; both are exported for it. **Kept.** No HTTP answer shows a role until `usage.get` (ticket 03), which will call `runs` itself. The test still goes through the daemon: the ingest, its store, the Git read of `origin/HEAD` and the checkouts, on a real repository. The pure role rule is also pinned in `packages/telemetry/test/runs.test.ts`. Handed to ticket 03 above.
2. `projectCheckouts` and `RunAttribution` had no doc comment. **Fixed.**
3. `StoredUsage` and `RunRecord` repeated the same shape. **Fixed**: `StoredUsage` is `Omit<RunRecord, 'checkout'>`.
4. `Pick<TrackerTask, 'id' | 'title' | 'ticket'>` repeats. **Kept**: it is the forward function's existing parameter type.
5. `'harness' | 'reflog'` is written out in core and in telemetry, and `ObservedRun.harness` is a `string`. **Kept**: core cannot import telemetry's `Harness`.
6. `byTask` has an inline tie-break beside telemetry's private `compare`. **Kept**: it is the same order as the snapshot's other sections, and exporting a comparator for one line is not worth it.
7. `containingEntry` was made generic, and worktree roots are wrapped as `{ path }`. **Kept**: it is the one containment rule, and its comment says any directory list may use it.
8. `ObservedRun` fields with no consumer yet (`projectPath`, `provider`, `parentRunId`, `active`). **Kept**: the ticket and the data model require them.

**Spec**

1. No criterion missing, no scope creep.
2. Roles not asserted over HTTP. **Kept**, as Standards 1.
3. Run ids depend on which records are grouped: the week's, in the snapshot, and the checkouts that exist now. **Left** for ticket 03, which shows ids (above). Ids do not appear in the snapshot.
4. Provider and model from the latest record, and the unavailable reason as the tracker's diagnostics. **Kept**, recorded above.

Typecheck is clean and the full suite passes: 275 of 275 before the rebase onto ticket 06, 285 of 285 after it.
