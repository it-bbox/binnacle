# 10: Work in removed worktrees reads as Product work, or as the wrong Task's

Status: READY
Triage: ready-for-agent
Blocked by: 12
Spec: `docs/specs/telemetry/spec.md`, `docs/adr/ADR-0030-branch-from-the-reflog-or-none.md`

**What to build:** found by ticket 09's run on the owner's artifacts. Where a worktree has been removed, a record's branch is the one Claude Code wrote (ADR-0029). In a linked worktree Claude Code mostly wrote `main`, so that work gets the `product` role. Where it wrote a ticket branch, it often wrote the same one in several worktrees at once, so one Task is credited with other Tasks' work. Both break the spec's rule that attribution is a fact or nothing (user story 22). ADR-0029 accepted that such history keeps "Claude Code's mix-ups". It did not measure what they do to the role and to one Task's total.

The owner chose option 3 under *Comments*: a run's branch comes from its checkout's reflog, or it has none (ADR-0030).

- [ ] A record whose checkout's reflog has no answer has no branch, whatever its harness wrote, so its run is `unknown` and unassigned.
- [ ] The rule applies when runs are read: a record already stored with a `harness` branch, under ADR-0028's order or ADR-0029's, attributes nothing.
- [ ] The tests at the daemon seam show both, for a removed worktree whose records say `main` and for one whose records say a ticket's branch.
- [ ] The code comments that cite ADR-0029's fallback, in `apps/daemon/src/usage.ts` and `packages/adapters/src/codex.ts`, say ADR-0030's rule.

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
  - Built after ticket 12, by autopilot, so that ticket 09's criterion 2 can read this ticket's own runs.
