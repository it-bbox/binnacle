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

### Review

`/code-review` against `main` on both axes, after the implementation's commit and before any fix.

- **Spec: step 8 can be passed with the Review after its fixes** — to fix. Implementation, fixes, a Review commit that changes only the ticket, then `DONE`: the Review is not the last commit, so the check passed while the daemon would again see no rework, the very failure of 15. Step 8 must ask for a commit after the Review's, before the last, that changes more than the ticket.
- **Spec: with nothing to fix, may the Review's commit be the `DONE` one?** — to fix. The brief leaves it open; a `DONE` commit that moves the roadmap's focus would then fail "changes only the ticket". Say the Review's commit stays its own and `DONE` follows it.
- **Standards: the brief names "the development workflow … under *Per ticket*"**, a section another project may not have, in a skill every project runs — to fix. State the rule on its own, with its reason, as step 8 does wherever a path holds only for Binnacle itself.
- **Spec: the Review's commit must change only the ticket**, which the ticket did not ask — kept: the daemon's implementation window ends at the last commit changing anything but the ticket before the Review (`readLastChangeBefore`), so code in the Review's commit would count as review.
- **Spec and Standards: step 8 reads `main..<branch>`, the daemon every branch**, so a reopened ticket whose `main` already holds a `### Review` would be read differently — kept: a ticket runs once, and `main..<branch>` is the agent's own work.
- **Standards: the brief repeats the workflow's five steps** (Duplicated Code) — kept: the ticket asks the brief to say so, and the new test holds the brief and the workflow to the same rule.
- **Standards: `"to fix"` quoted, the workflow unquoted** — kept: the owner's wording for this order, and a marking the agent can write as it reads.
- **Standards: step 8's new item is one long sentence** — kept: it holds one check and the failure it sends back, as the ticket's second criterion asks.
