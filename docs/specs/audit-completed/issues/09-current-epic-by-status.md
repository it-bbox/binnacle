# 09: The current epic by its status

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** the current epic is the one furthest along (spec, *The current epic*). It is the first epic at the furthest-along status present, in the order `in progress`, `tickets`, `spec`, `not started`, the roadmap table's order deciding between equals; a `done` epic is never current. The one function that decides it changes; the snapshot, the board, the Suggested step and the dashboard read it from there.

- [ ] Through the daemon's snapshot and Suggested step tests: with epic 12 `not started` before epic 17 `tickets`, epic 17 is current and the Suggested step speaks of it.
- [ ] Between two epics at the same status the earlier row is current; with every epic `done` there is none.
- [ ] `CONTEXT.md`, *Current Epic*, says the new rule.
