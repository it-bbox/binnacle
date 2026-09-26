# 12: The Suggested step waits on a Task already done

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** a defect seen at the end of the autopilot run of 2026-09-26. With tickets 10 and 11 merged and `DONE`, and `tasks.inFlight` and `readyToStart` empty, the snapshot's Suggested step still said, by rule 1, that both "are being worked on: an implementation run is active. Wait for them". Rule 1 in `suggestedStep` (`packages/core/src/roadmap.ts`) takes every Task with an active implementation run, whatever its state; a run stays active for ten minutes after its last activity, and an orchestrator's checks in a ticket's worktree extend it. Rule 2, beside it, already reads the Task through `boardColumn` (ADR-0032).

- [ ] Rule 1 names only a Task the board places In progress (`boardColumn`), so a Task that is `DONE`, `MERGED` or `CANCELLED` is not waited on, whatever its runs; the step falls through to the next rule.
- [ ] A test covers a `DONE` Task with an active implementation run, beside one In progress.
