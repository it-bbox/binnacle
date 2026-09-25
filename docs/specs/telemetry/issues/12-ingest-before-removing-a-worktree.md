# 12: Autopilot lets Binnacle read a ticket's worktree before removing it

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/telemetry/spec.md`

**What to build:** an autopilot run's ticket work stays attributed to its Task. Today the `autopilot` skill removes a ticket's worktree right after the merge and calls `project_snapshot` only afterwards, so the ingest never sees that worktree's reflog and ADR-0029 falls back to Claude Code's per-process `gitBranch`, which is usually `main` (ticket 10). Found during epic 4's own autopilot run on 2026-09-25.

- [ ] The `autopilot` skill calls `project_snapshot` (which runs the ingest) after the fast-forward merge and before `git worktree remove`.
- [ ] The skill's step 5 starts no more agents at once than the manifest's `automation.max_parallel_development_tasks`.

## Comments

- **Open for the owner.** The run also honoured the manifest's `automation.maxParallelDevelopmentTasks: 2`, which the skill does not mention; whether the skill should say so is part of triage.
- **Decided by the owner on 2026-09-25, in a Product session.**
  - Part of epic 4, and built first, by an autopilot run of its own. An autopilot run keeps the skill text it started with, so a run that went on to tickets 10 and 11 after this one would still remove their worktrees before reading them. They wait in `BACKLOG` until this ticket merges, and a second run builds them.
  - The skill names the manifest's limit. Its key is `automation.max_parallel_development_tasks`.
  - The re-check on a new autopilot run moved to ticket 09's criterion 2, which reads tickets 10 and 11. So this ticket is done when it merges.
