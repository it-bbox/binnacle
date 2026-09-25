# ADR-0029: A Run's Branch Comes From the Reflog While Its Checkout Exists, From the Harness Otherwise

**Status:** Accepted

**Supersedes:** the order of sources in ADR-0028, which put the branch the harness wrote first and the reflog second. The rest of ADR-0028 stands: both sources carry `measured` provenance, neither is a guess, and a record neither answers for is `unassigned`. ADR-0018's other decisions stand as ADR-0028 left them.

## Context

ADR-0028 rested on one claim: that Claude Code "writes the branch the session was on into every record of its session artifact, subagents' included, at the moment the record is written." Reading the subagents' artifacts (epic 4, ticket 04) showed that this is not so. Measured on this repository's own artifacts on 2026-09-25:

- Claude Code's `gitBranch` behaves as one value per Claude Code process, not per checkout. It is refreshed at irregular times from whichever checkout last changed.
- The subagent that built ticket 03 of epic 4 worked in its own worktree on `feat/usage-get`. Its records say `main`, its parent's branch, 189 times, then `feat/usage-get` twice, then `main` 76 times.
- The autopilot session `1e870ea0` stayed on `main` throughout. For four minutes it wrote `feat/task-brief`, while six of its subagents on different ticket branches wrote the same value.
- A rebase in any checkout of the process shows up as `HEAD`.
- Read through the harness's branch, the ticket built wholly by a subagent had no runs at all. Of 3,765 records in the 90-day window, 2,640 were unassigned.

Codex, which ADR-0028 describes as writing no branch, writes the branch its session started on into `session_meta.git.branch`: in 19 of the 31 rollouts on this machine. Ticket 05 found it in 17 rollouts, and for each of them the reflog gave the same branch at the session's start. It is one branch per session, so it is wrong after a switch in the middle of one.

The reflog of a checkout is Git's own record of that checkout, so it cannot mix up two checkouts. A linked worktree has its own. It exists for as long as the checkout does, up to Git's expiry. The daemon reads new artifacts on every call and on startup, so work still going on is read while its checkout exists.

## Decision

- A record's branch is the one the `HEAD` reflog of the checkout its `cwd` names was on at the record's timestamp, read when the record is ingested, with source `reflog`.
- Where that reflog has no answer, the branch is the one the harness wrote, with source `harness`. The reflog has no answer when the checkout no longer exists, when the timestamp is older than the reflog, or when HEAD was detached then. For Claude Code, the harness's branch is `gitBranch`. For Codex, it is `session_meta.git.branch`, the branch the session started on.
- Where neither answers, the record has no branch and its run is `unassigned`.
- This applies to every harness alike, including one nobody has written yet.

## Consequences

- Live work, a subagent's in its own worktree included, is attributed by Git's record of that checkout, whatever the harness wrote.
- History in a worktree removed before its records were first read keeps the branch the harness wrote, with Claude Code's mix-ups. So does history older than a checkout's reflog. The removed worktrees of epics 1 to 3 are in this case.
- A record is ingested once, so a record stored under ADR-0028's order keeps the branch it was stored with.
- The daemon reads each checkout's reflog once per ingest, for every harness, not only for those that write no branch.
