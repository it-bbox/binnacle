# 10: Autopilot picks a sliced epic, and regenerates the dashboard it merges

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** two gaps the first autopilot run of epic 5 hit on 2026-09-26. Its step 3 chooses only the single epic `in progress`, but `/to-tickets` leaves an epic at `tickets`, so a run started right after slicing has no epic to choose; step 4 already accepts `tickets`. And after a merge that changes the dashboard, the daemon keeps serving the dashboard generated before it.

- [ ] `.claude/skills/binnacle/skills/autopilot/SKILL.md`, step 3: without an argument, the epic is the single one `in progress`, or else the single one at `tickets`. None or several still stop and ask.
- [ ] Step 7: when the merge changed `apps/dashboard` and this project is Binnacle itself, the session runs `pnpm dashboard:generate` in the main checkout, after any frozen install, and says so in the report.
- [ ] `docs/specs/mcp-and-product-snapshot/issues/08-autopilot.md`'s record of the skill is left as history; `docs/workflow/02-development-workflow.md` changes only if it states the epic choice.
