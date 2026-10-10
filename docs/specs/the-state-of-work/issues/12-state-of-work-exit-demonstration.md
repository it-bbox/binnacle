# 12: The exit demonstration of epic 11

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11
Spec: `docs/specs/the-state-of-work/spec.md`

**What to build:** epic 11's exit criterion, demonstrated by the owner on this repository (spec, *Further Notes*). If no agent asked a real question during the run, the owner seeds one by committing a `### Question` to a Task branch by hand.

- [ ] The owner pushes `main`; the workflow runs green on GitHub, and the snapshot and the dashboard show `main`'s CI as passing.
- [ ] A branch pushed with a pull request shows in the snapshot and on its Task with its CI state.
- [ ] A question on a Task's branch shows in the snapshot, the daily, the dashboard and the vault under *Waiting for the owner*.
- [ ] `/binnacle:answer` writes the answer on the branch, and `/binnacle:autopilot` resumes that ticket and merges it.
- [ ] A ticket with `Roles: Developer, Reviewer, Security` has a Security section in its Review; `/binnacle:task` shows roles and Binnacle's suggestions.
- [ ] At the run's end autopilot reported `main`'s CI and proposed a Next action.
