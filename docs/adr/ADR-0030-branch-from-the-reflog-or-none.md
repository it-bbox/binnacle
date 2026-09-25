# ADR-0030: A Run's Branch Comes From Its Checkout's Reflog, or It Has None

**Status:** Accepted

**Supersedes:** ADR-0029's fallback to the branch the harness wrote. The rest of ADR-0029 stands: a record's branch is the one the `HEAD` reflog of the checkout its `cwd` names was on at the record's timestamp, read when the record is ingested, with source `reflog`.

## Context

Epic 4's exit demonstration (ticket 09) measured ADR-0029 on this repository's artifacts on 2026-09-25, through a daemon with an empty store, over the 90-day window: 4,096 records. Ticket 10 holds the detail.

- 1,859 records (45%) came from 28 removed worktrees where Claude Code wrote `main`. 1,831 of them were subagents'. They read as Product work, and made up 72% of the `product` role.
- `tracker-and-matt-pocock-integration/06`, the snapshot's largest Task, got 98 records from four worktrees that all wrote `feat/task-brief` within the same four minutes. At most one of them was its own.
- Git does not let a linked worktree check out the branch the main checkout has, unless forced, so `main` written in one is almost always wrong. In 12 of the 28 worktrees, Claude Code wrote nothing but `main`.

ADR-0029 accepted "Claude Code's mix-ups" for history in removed worktrees without measuring them. Measured, they break the rule that attribution is a fact or nothing (the telemetry spec, user story 22). Once its checkout is gone, the branch a harness wrote is a guess.

## Decision

- A record's branch is the one its checkout's reflog gives. Where the reflog has no answer, the record has no branch, and its run is `unknown` and unassigned. The reflog has no answer when the checkout no longer exists, when the timestamp is older than the reflog, or when HEAD was detached then.
- The branch the harness wrote attributes nothing. It stays in the store as recorded, with source `harness`.
- The rule applies when runs are read, so records already stored under ADR-0028's order or ADR-0029's follow it too.
- This applies to every harness alike.

## Consequences

- Work in a worktree removed before Binnacle read it is unassigned. Most of epics 1 to 3 is in this case, and so is the work of epic 4's first autopilot run. Of the 4,096 records ticket 09 measured, about 85% are unassigned under this rule, against 74% under ADR-0029; every group of them is explained in ticket 09.
- Attributing such work depends on reading the worktree before it is removed. Autopilot does so from epic 4's ticket 12 on: it runs the ingest after the merge and before `git worktree remove`.
- A long-running store keeps reflog branches that a new store can no longer read, from worktrees it read before their removal. It is the store an exit demonstration reads.
