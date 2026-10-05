# 15: /binnacle:product shows the graph's freshness and the conflict risk

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** a defect found in epic 8's exit demonstration (2026-10-05). The snapshot carries `graph` (built from which commit, `behind`, the last run) and `tasks.parallel.impact` (each pair's risk and reason), and the dashboard shows both, but `/binnacle:product`'s steps never mention them, so a Product session saw the risk only by chance and the graph's freshness not at all. Add both to the skill's presentation: the graph in one line (current or behind, built from which commit, the last run's outcome), or its reason when `available: false`; each pair's risk with its reason beside the Tasks ready to start, marked as Binnacle's calculation, or why it was not assessed.

- [ ] `/binnacle:product` presents the graph and the conflict risk as above.
- [ ] A test in `apps/cli/test/pack.test.ts` holds the wording.

## Comments
