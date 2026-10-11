# 01: Rework read from runs

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/lean-flow/spec.md`

**What to build:** Binnacle tells review from rework by the runs, not by the order of the commits (spec, *Roles from runs*; `CONTEXT.md`, *Review run*, *Rework run*). On a Task's branch a subagent run is a review run when it starts after the branch's first commit changing anything but its ticket; rework is the implementation work after the Task's first review run ends. A Task with no review run keeps the commit that first records its Review as the boundary; a review requesting changes on GitHub or GitLab stays the boundary there. Roles are computed when usage is read, so epic 11's Tasks read by the new rule with nothing to migrate.

- [ ] Through the daemon's `usage.get` and `task.get`, on a Git repository with session artifacts: a review subagent with fixes after it reads review and rework apart whether the Review was committed before the fixes, after them, or last.
- [ ] A Task with no review subagent reads rework after the commit that first records its Review; a subagent that starts before the branch's first commit changing anything but the ticket is implementation.
- [ ] A run that crosses the end of the first review run is split there.
- [ ] GitHub's and GitLab's review boundary is unchanged; the existing tests for it pass.
- [ ] `usage_get`'s description and `docs/04-telemetry-dashboard.md` state the new rule; the derived metrics keep their shape and their `calculated` label.
- [ ] On this repository, `usage_get` shows epic 11's Tasks with review and rework read by the new rule.
