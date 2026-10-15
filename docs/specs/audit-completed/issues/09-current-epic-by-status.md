# 09: The current epic by its status

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** the current epic is the one furthest along (spec, *The current epic*). It is the first epic at the furthest-along status present, in the order `in progress`, `tickets`, `spec`, `not started`, the roadmap table's order deciding between equals; a `done` epic is never current. The one function that decides it changes; the snapshot, the board, the Suggested step and the dashboard read it from there.

- [x] Through the daemon's snapshot and Suggested step tests: with epic 12 `not started` before epic 17 `tickets`, epic 17 is current and the Suggested step speaks of it.
- [x] Between two epics at the same status the earlier row is current; with every epic `done` there is none.
- [x] `CONTEXT.md`, *Current Epic*, says the new rule.

## Comments

- Only `currentEpic` in `packages/core/src/roadmap.ts` changed: the snapshot's `roadmap.current`, the board's default epic and the Suggested step already called it, and the dashboard reads `roadmap.current`, so no dashboard code changed and no browser check was needed. The rule is also restated in `docs/03-mcp-and-skills.md`, `docs/04-telemetry-dashboard.md` and the `project_snapshot` tool's description, all updated.
- The old test in `apps/daemon/test/next.test.ts` (first `in progress`, else first not `done`) is replaced by one for the new rule: 12 `not started` before 17 `tickets`, every status level, ties at `tickets` and `not started`, and every epic `done`.
- For the Product session: the product-inbox entry *The current epic is read from the table's order* is closed by this ticket.

### Review

Against `main`, in a sub-agent, on the standards and the spec. Typecheck and the full suite pass (854 tests); the criteria are pinned in `apps/daemon/test/next.test.ts`. No other place derives the current epic, and nothing outside the ticket changed.

1. `currentEpic` repeated `roadmapAttention`'s `rank` closure. **Fixed**: one module-level `rank` in `packages/core/src/roadmap.ts`, used by both.
