# 13: Implementation sessions leave the Next action to the owner

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** the rule the owner set on 2026-10-02, now in `docs/workflow/02-development-workflow.md` (*On this repository*, step 3), followed where an implementation session reads its instructions. An implementation session's last commit updates the roadmap's current focus — what is done and what can start — and never its `Next action:` paragraph, which is the owner's, set by a Product session. A session that finds the Next action stale says so in its report instead. Ticket 08 of this epic changed it without being asked, which is how the rule came about.

- [ ] The implementation brief in the `autopilot` skill says to update the current focus without touching the `Next action:` paragraph, and to report a stale one.
- [ ] `CLAUDE.md`'s line on an implementation session's last commit says the same.
- [ ] A test in `apps/cli/test/pack.test.ts` holds the skill to the rule by its wording, as it does for ticket 07's.
- [ ] Autopilot's own end-of-run report names a stale Next action for the owner rather than changing it.

## Comments
