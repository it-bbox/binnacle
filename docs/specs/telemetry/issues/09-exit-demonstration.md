# 09: The exit demonstration

Status: READY
Triage: ready-for-agent
Blocked by: 03, 04, 05, 07, 08
Spec: `docs/specs/telemetry/spec.md`

**What to build:** epic 4's exit criterion, demonstrated on this repository against its own history. Decided in the spec, under *Further Notes*.

- [ ] In a fresh session, `/binnacle:product` shows the usage section: today's and the week's totals, by model, the top Tasks, unassigned, and each harness's level.
- [ ] `usage_get` for tickets of epic 3 returns their runs with the `implementation` role and their subagents linked.
- [ ] Product sessions on `main` carry the `product` role.
- [ ] The unassigned share is small enough to believe, and whatever is unassigned is explained.
- [ ] The daemon's store holds no message content.
- [ ] Defects are filed as tickets; the roadmap marks epic 4 done only when none is open.
