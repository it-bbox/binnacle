# 12: Autopilot lets Binnacle read a ticket's worktree before removing it

Status: READY
Triage: needs-triage
Blocked by: None (can start immediately)
Spec: `docs/specs/telemetry/spec.md`

**What to build:** an autopilot run's ticket work stays attributed to its Task. Today the `autopilot` skill removes a ticket's worktree right after the merge and calls `project_snapshot` only afterwards, so the ingest never sees that worktree's reflog and ADR-0029 falls back to Claude Code's per-process `gitBranch`, which is usually `main` (ticket 10). Found during epic 4's own autopilot run on 2026-09-25.

- [ ] The `autopilot` skill calls `project_snapshot` (which runs the ingest) after the fast-forward merge and before `git worktree remove`.
- [ ] Ticket 10's measurements are re-checked on a new autopilot run: the ticket's subagent runs are attributed to it through the reflog.

## Comments

- **Open for the owner.** The run also honoured the manifest's `automation.maxParallelDevelopmentTasks: 2`, which the skill does not mention; whether the skill should say so is part of triage.
