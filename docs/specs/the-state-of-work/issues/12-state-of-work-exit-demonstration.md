# 12: The exit demonstration of epic 11

Status: DONE
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11
Spec: `docs/specs/the-state-of-work/spec.md`

**What to build:** epic 11's exit criterion, demonstrated by the owner on this repository (spec, *Further Notes*). If no agent asked a real question during the run, the owner seeds one by committing a `### Question` to a Task branch by hand.

- [x] The owner pushes `main`; the workflow runs green on GitHub, and the snapshot and the dashboard show `main`'s CI as passing.
- [x] A branch pushed with a pull request shows in the snapshot and on its Task with its CI state.
- [x] A question on a Task's branch shows in the snapshot, the daily, the dashboard and the vault under *Waiting for the owner*.
- [x] `/binnacle:answer` writes the answer on the branch, and `/binnacle:autopilot` resumes that ticket and merges it.
- [x] A ticket with `Roles: Developer, Reviewer, Security` has a Security section in its Review; `/binnacle:task` shows roles and Binnacle's suggestions.
- [x] At the run's end autopilot reported `main`'s CI and proposed a Next action.

## Comments

### Demonstration, 2026-10-11

Run with the owner in a Product session, on ticket 14 as the carrier. The owner looked at the dashboard the same day: its project page showed `main`'s CI and the question under *Waiting for the owner*, so every criterion holds.

1. `main` pushed; the workflow ran green on `d80ec9d`; the snapshot's `ci.defaultBranch` read `passing`, `provider_reported`, with its commit link, once ticket 13 was merged and the daemon restarted. The dashboard's project page is the owner's to see.
2. `feat/graph-that-shrinks` pushed with pull request #1: the snapshot's `ci.requests` and `task_get`'s `request` showed it, mapped to the-state-of-work/14, with its CI `running`, then `passing`.
3. A question committed to that branch by hand showed under *Waiting for the owner* in the snapshot, the daily and the vault's `Product/snapshot.md`. The dashboard is the owner's to see.
4. `/binnacle:answer` committed the owner's answer on the branch; `/binnacle:autopilot 11` resumed the ticket on its branch and merged it as `64a9a5d`.
5. Ticket 14's `Roles: Developer, Reviewer, Security` gave its Review a `#### Security` section; `task_get` showed the roles from the ticket.
6. Autopilot's report gave `main`'s CI (`running` on `64a9a5d`) and proposed a Next action.

Found on the way:

- A Product session's commit on a Task's branch counted as an implementation run of that Task, so the snapshot said 14 "is being worked on" until it went stale.
- The answer Binnacle reads includes the date line `/binnacle:answer` writes above it (`docs/product-inbox.md`).
- Autopilot's resumed agent rebased a branch that had an open pull request, so the pull request kept the older commits after the merge and was closed by hand; updating it would have needed a force push.
- After the merge, the graph was built from `64a9a5d`, `behind: false`; whether that merge shrank it is not known, so ticket 14's last criterion stays open.
