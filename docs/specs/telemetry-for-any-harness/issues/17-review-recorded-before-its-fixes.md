# 17: Autopilot records a Review before its fixes

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** `/binnacle:autopilot` follows the per-ticket order the owner set on 2026-10-08 (spec, *Further Notes*; `docs/workflow/02-development-workflow.md`, *Per ticket*): the review's findings are committed under `### Review`, each marked to fix or kept with its reason, before any fix, and the last commit marks each fixed, kept or left with `Status: DONE`. Its brief to each agent says so instead of recording the findings with the fixes, in the plugin's skill and in the package's `binnacle-autopilot` copy alike. Its step 8 checks the order: when the review fixed anything, the commit that first adds `### Review` comes before the fixes, and a ticket that records its Review only in its last commit goes back to its agent once, as any failed check.

- [ ] The brief in `.claude/skills/binnacle/skills/autopilot/SKILL.md` and in `apps/cli/skills/binnacle-autopilot/SKILL.md` asks for the Review's commit before the fixes, and the two say the same.
- [ ] Step 8 checks that order, and names the failure it sends back.

## Comments

- Found in epic 10's exit demonstration (15) on 2026-10-08: across tickets 07 to 16, `usage.get` showed no review run and almost no rework, since every agent committed its fixes before the Review.
- This ticket's own branch follows the new order by hand, so that 15 can show its implementation, review and rework apart.
