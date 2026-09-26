# 07: The Usage page, and a Task's runs

Status: READY
Triage: ready-for-agent
Blocked by: 02, 03
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** the Usage page shows a project's tokens by model, provider, Task and role, and each harness's level. The main screen gains a usage line, and the Task page shows the Task's runs and usage. Decided in the spec, under *The snapshot* and *The pages*.

- [ ] The snapshot's `usage` gains `byProvider`: the last seven days per provider, with the runs whose artifacts state no provider in a row of their own.
- [ ] The Usage page shows, field by field:
  - today and the last seven days;
  - by model and by provider, over the last seven days;
  - by Task, unassigned and by role, over the window;
  - each harness's level, or the reason it has none;
  - cost, as not available.
- [ ] The Overview shows each project's usage today and this week in one line, linking to its Usage page.
- [ ] The Project page shows the project's usage by role, and unassigned.
- [ ] The Task page shows its runs — harness, model, role, branch, checkout, start, latest activity and tokens — and its implementation usage.
- [ ] On the Task page, review usage, rework usage, and questions and answers are shown as not available, with the reason.
- [ ] Fields are never added to one another. `null` is shown as not reported, and a `partial` total as partial.
- [ ] The Usage page's figures equal those of `usage_get` and the snapshot for the same window.
- [ ] Tests through the daemon seam cover `byProvider`, including the row for no stated provider.
