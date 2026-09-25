# 10: Work in removed worktrees reads as Product work, or as the wrong Task's

Status: DONE
Triage: ready-for-agent
Blocked by: 12
Spec: `docs/specs/telemetry/spec.md`, `docs/adr/ADR-0030-branch-from-the-reflog-or-none.md`

**What to build:** found by ticket 09's run on the owner's artifacts. Where a worktree has been removed, a record's branch is the one Claude Code wrote (ADR-0029). In a linked worktree Claude Code mostly wrote `main`, so that work gets the `product` role. Where it wrote a ticket branch, it often wrote the same one in several worktrees at once, so one Task is credited with other Tasks' work. Both break the spec's rule that attribution is a fact or nothing (user story 22). ADR-0029 accepted that such history keeps "Claude Code's mix-ups". It did not measure what they do to the role and to one Task's total.

The owner chose option 3 under *Comments*: a run's branch comes from its checkout's reflog, or it has none (ADR-0030).

- [x] A record whose checkout's reflog has no answer has no branch, whatever its harness wrote, so its run is `unknown` and unassigned.
- [x] The rule applies when runs are read: a record already stored with a `harness` branch, under ADR-0028's order or ADR-0029's, attributes nothing.
- [x] The tests at the daemon seam show both, for a removed worktree whose records say `main` and for one whose records say a ticket's branch.
- [x] The code comments that cite ADR-0029's fallback, in `apps/daemon/src/usage.ts` and `packages/adapters/src/codex.ts`, say ADR-0030's rule.

## Comments

- **Measured on 2026-09-25**, through a daemon from ticket 09's branch with a fresh temporary Binnacle home, over the 90-day window: 4,096 records.
  - 1,859 records (45%) come from 28 removed `.claude/worktrees/agent-*` worktrees, with the branch Claude Code wrote, `main`. 1,831 of them are subagents'. All of them count as `product`: they are 72% of `byRole.product`, which is 2,600 records. The real Product sessions, in the registered checkout on `main` by its reflog, are 741 records.
  - Git does not let a linked worktree check out the branch the main checkout has, unless forced. So a record in a linked worktree that says the default branch is almost certainly wrong. In 12 of the 28 worktrees, Claude Code wrote nothing but `main`, so nothing in their records names their ticket.
  - `tracker-and-matt-pocock-integration/06` is the snapshot's largest Task, with 98 records in 9 runs. All 98 carry the harness branch `feat/task-brief`, but they come from four different worktrees: `agent-a0b1e7f1…`, `agent-a649013c…`, `agent-ad4b844b…` and `agent-ae0eaa1c…`, between 07:05 and 07:09 UTC. This is the four minutes of autopilot session `1e870ea0` that ADR-0029 describes. At most one of the four worktrees was ticket 06's. `feat/daily-delta` has three worktrees, `feat/binnacle-plugin` two and `feat/binn-init-harness-registration` two.
- **Options, for the owner.**
  1. **Keep ADR-0029 as it is.** Record in it what was measured above. The snapshot's top Tasks and `byRole` then carry these errors for history that was never read while its worktree existed. They do not grow from now on, because the daemon reads live work through the reflog.
  2. **Read the default branch in a missing linked worktree as no branch.** A record whose `cwd` is under a linked worktree's path that no longer exists, and that says the default branch, gets no branch, so its run is `unknown`. This is a small change in `withBranch` (`apps/daemon/src/usage.ts`). The difficulty: after its removal, a worktree path cannot be told apart from a subdirectory of the main checkout. The rule would need something to go on, such as Claude Code's `.claude/worktrees/` layout, or the fact that the path does not exist while the main checkout does.
  3. **Believe no harness branch in a checkout that no longer exists.** Every such run becomes `unknown`: an honest total, and no credit at all for most of epics 1 to 3.
  4. **Refuse a branch that several checkouts claim at the same time.** This covers the `feat/task-brief` case. It needs the records of other sessions at ingest, or else it must run at read, where runs are built.
- **Records already stored keep their branch.** A record is ingested once (ADR-0029, *Consequences*), so any option applies at read, or only to records ingested after it lands. That is part of the decision.
- **Decided by the owner on 2026-09-25, in a Product session.**
  - Option 3, in its simplest form: the branch a harness wrote attributes nothing, wherever the reflog has no answer. It stays in the store with source `harness`. ADR-0030 records this and supersedes ADR-0029's fallback.
  - It applies at read, so the history already stored follows it too. Of the 4,096 records measured, about 85% become unassigned, against 74%. Ticket 09's table explains every group.
  - Built after ticket 12, by autopilot, so that ticket 09's criterion 2 can read this ticket's own runs. It waits in `BACKLOG` while ticket 12's own autopilot run goes, so that run does not take it. A Product session sets it `READY` after ticket 12 merges.
- **What changed.**
  - `observedRuns` (`packages/telemetry`) reads a record's branch through `reflogBranch`: the branch the reflog gave it, or none. A branch with source `harness` credits no Task, gives neither the `product` nor the `implementation` role, and starts no run of its own. Every read of runs goes through it: the snapshot's usage section, and `usage.get` with and without a Task.
  - The ingest is unchanged. Where the reflog has no answer, a record keeps the branch its harness wrote, stored with source `harness`, as ADR-0030 says.
  - `ObservedRun.branchSource` (`packages/core`) is now `'reflog' | null`, as `docs/06-data-model.md` already had it.
  - The comments of `ingestFile` and `withBranch`, and the ponytail note in `runs()` (`apps/daemon/src/usage.ts`), and of `readCodex` (`packages/adapters/src/codex.ts`), say ADR-0030's rule.
  - The telemetry spec's list of daemon-seam tests, under *Testing Decisions*, had "a branch from a worktree that no longer exists, attributed through the harness", which ADR-0030 made false. It now names what the tests show.
- **Test-first.** The tests came first, and each failed against the code on `main`.
  - At the daemon seam (criteria 1 to 3): two real worktrees under `.claude/worktrees/`, removed with their branches before the daemon read them, whose records say `main` and `feat/first`. There is no Task, both are `unknown`, and both rows are stored with source `harness`. A stored row in ADR-0028's shape, a harness `main` in a checkout whose reflog says `feat/first`, credits nothing. Neither does a record older than the reflog in a checkout that exists, nor a Codex session that started on a Task's branch outside any repository.
  - At the telemetry seam: harness branches among records with none make one run, with no branch.
  - The tests that took their attribution from Claude Code's `gitBranch` now take their branches from dated reflogs, through `repository(root, since, ...switches)`. They passed before the change and after it.
- **Checked on this repository on 2026-09-26**, through an in-process daemon from this branch on a temporary home, over the 90-day window. Of 4,747 records, 3,950 (83.2%) are unassigned, and `byRole` gives 919 `product`, 797 `implementation` and 3,031 `unknown`. `tracker-and-matt-pocock-integration/06` has no records left. This ticket's own work, read through its worktree's reflog, is `telemetry/10`: 181 records in 3 runs, all `implementation`. Tickets 11 and 12 have none in a new store: their worktrees are gone, and only the running daemon read them before removal (ADR-0030, *Consequences*).
- **For ticket 09.**
  - The daemon reads runs this way once it runs `main`'s code after the merge. The change is in `packages/telemetry`, which the daemon runs.
  - A branch only the harness wrote no longer splits a session. So, in history already stored, some runs join the run before them, which keeps its id, and their own ids go. Runs are derived on every read and never stored, so nothing stored changes.
- **Answered here, as questions that block nothing.**
  - The rule is in `observedRuns`, with the rest of attribution, rather than in the daemon's `runs()`: the spec puts attribution in `packages/telemetry`, so every reader of runs follows it.
  - A harness branch starts no run: ADR-0030 says such a record has no branch, and a run is one stretch on one branch.
  - A run keeps `branchSource`, though it is `reflog` whenever there is a branch: `usage.get` gives each run's "branch and its source".

### Review

`/code-review` ran against `main` on both axes, with its two sub-agents in the foreground, after this branch was rebased onto ticket 11's merge.

**Standards: no hard violation; six judgement calls.**

1. Possible Mysterious Name: `branchOf` read like `record.branch?.name` where it is called. **Fixed**: it is `reflogBranch`.
2. Possible Speculative Generality: a run's `branchSource` now follows from its `branch`. **Kept**, and suppressed by the reviewer too: the spec and `docs/06-data-model.md` keep a run's branch source.
3. Possible Duplicated Code: the Codex reflog test repeated the dated `init`, `add` and `commit` that `repository` now does. **Fixed**: it calls `repository`.
4. Setup no test reads any more: three tests outside any repository still wrote a branch through `onBranch`. **Fixed**: dropped.
5. The removed worktrees of the new test had never existed, where *Testing Decisions* wants "real branches, worktrees and commits". **Fixed**: they are added, written in, and removed with their branches before the daemon reads them.
6. The pure test put ADR-0030's rule inside the test of a run's bounds, whose title did not say it. **Fixed**: it has a test of its own.

**Spec: all four criteria met, and no scope creep of substance; four notes.**

1. Criterion 2's "under ADR-0028's order" was shown only at the telemetry seam, since the daemon-seam rows had ADR-0029's shape. **Fixed**: a daemon-seam test turns a stored row into ADR-0028's shape, a harness branch in a checkout whose reflog would answer, and it credits nothing.
2. The removed worktrees were not real. **Fixed**, as Standards 5.
3. The ponytail note in `runs()` said a removed worktree's records have no branch. That is false for those read before its removal, which keep the reflog's. **Fixed**: it says both.
4. A Git that cannot say, on `git.timeout` or `git.not_found`, reads as a reflog with no answer: `readHeadHistory` returns null for both. A record is ingested once, so one timeout in a checkout that exists leaves its records unassigned for good, where ADR-0029 fell back to the harness's branch. **Left**: ADR-0030 names three cases of no answer and this is none of them. Whether the ingest should read such a file again later, or report it, is the owner's call, for a ticket of its own.

The Spec reviewer also found the spec's Seam 1 line, the narrowed `branchSource` and the one-time joining of runs (see *For ticket 09*) warranted by ADR-0030.

Typecheck is clean, and the full suite passes: 312 of 312.
