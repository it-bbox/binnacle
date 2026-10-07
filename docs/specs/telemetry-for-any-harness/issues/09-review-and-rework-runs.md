# 09: Implementation, review and rework told apart

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** a run on a Task's branch is `implementation`, `review` or `rework`, read from Git: a review run is a subagent run that starts after the branch's last commit changing anything but the ticket and ends by the commit that first adds `### Review` to the ticket; a rework run is implementation work after that commit (spec, *Roles*). A run crossing that point is split there. The snapshot's `byRole`, `task_get`, `usage.get` and the dashboard's Task page show the three apart, replacing the two "not available" lines, in both languages.

- [ ] Daemon process tests on a repository with a Task branch, a Review commit and a fix after it: implementation, review and rework runs, a crossing run split.
- [ ] `task_get` and `usage.get` give a Task's totals by role; the snapshot's `byRole` lists the new roles.
- [ ] The dashboard's Task page shows review and rework usage in both languages.

## Comments
