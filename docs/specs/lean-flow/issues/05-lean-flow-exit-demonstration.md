# 05: The exit demonstration of epic 18

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04
Spec: `docs/specs/lean-flow/spec.md`

**What to build:** epic 18's exit criterion, demonstrated by the owner on this repository (spec, *Further Notes*). Whether the flow got cheaper is read after epic 16's autopilot run by a Product session, not here.

- [ ] The usage page and `usage_get` show epic 11's Tasks with review and rework apart by the rule read from runs.
- [ ] A question with options, committed to a Task branch by hand if no agent asked one, shows in the snapshot; `/binnacle:answer` shows it in Russian with its options, explains them on request, and writes the owner's choice, which `task_get` reads without the date line.
- [ ] `pnpm test` passes several times in a row.
