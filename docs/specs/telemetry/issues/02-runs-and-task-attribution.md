# 02: Observed runs and Task attribution

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/telemetry/spec.md`

**What to build:** records become observed AgentRuns, each attributed to a Task by its branch, with a role, and the snapshot shows usage by Task and unassigned. Decided in the spec, under *Observed runs and attribution* and *Snapshot `usage` section*, and in ADR-0028.

- [ ] Records group by harness, session and subagent in time order; a new run starts where the checkout or the branch changes. A run's id derives from its first record's key and is stable across calls.
- [ ] A record's branch is Claude Code's `gitBranch`, stored with source `harness`.
- [ ] `packages/core` gains the inverse of the branch convention next to the forward one, with a test that the two agree: `feat/<slug>` to the one local ticket with that file slug, `feat/<number>-…` to issue `#<number>` when it exists. Zero or several matches is unassigned.
- [ ] Role: `product` on the default branch (`origin/HEAD`'s target, otherwise `main`), `implementation` on a branch that maps to a Task, `unknown` otherwise.
- [ ] The Task is resolved on read from the tracker's current contents; an unreadable tracker makes `tasks` and `unassigned` unavailable with its reason, and the totals still answer.
- [ ] The snapshot's `tasks` lists the last seven days' Tasks, largest first, with id, title and total, the section limit and a remainder; `unassigned` is the last seven days' total.
- [ ] A session outside the project's directory but in a linked worktree that still exists is attributed to the project.
- [ ] `packages/core`'s domain gains the observed run as its own type, with no lifecycle state; `active` is calculated from the latest activity against a fixed constant and labelled so.
- [ ] Tests through the daemon seam: a session split at a branch switch, a branch from a worktree that no longer exists, mapping on the local tracker and on the GitHub stand-in, no match and several, roles, and the tracker unreadable.
