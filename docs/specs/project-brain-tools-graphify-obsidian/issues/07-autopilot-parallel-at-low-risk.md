# 07: Autopilot runs two Tasks together only at low risk

Status: READY
Triage: ready-for-agent
Blocked by: 06
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** the baseline's rule — only low-risk Tasks run in parallel worktrees — followed by the one process that starts agents in parallel. `/binnacle:autopilot` reads the conflict risk from the snapshot (ticket 06) before starting a second ticket beside one in flight, and starts it only when the pair is low. Otherwise it runs them one after the other and says why in its progress. With the analysis not available, it keeps today's behaviour, and says the risk was not assessed.

- [ ] The skill's instructions read the risk from the snapshot and start a second ticket only for a low pair.
- [ ] A medium, high or unknown pair runs one after the other, and the skill says which pair and why.
- [ ] With `impact` not available, autopilot keeps the parallel limit alone and says the risk was not assessed.
- [ ] The packaging test still names every skill; ADR-0022's description in `docs/03-mcp-and-skills.md` mentions the rule.

## Comments
