# 09: A current set still reaches a harness installed since

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** `binn init`'s skills step plans the add of Binnacle's `binnacle-<action>` copy, and its removal from Claude Code and each `--skip-harness`, whether the set in `~/.agents/skills` is stale or current (spec, *Freshness*, as amended on 2026-10-07; story 8; ADR-0039). Freshness still tells which: the step says the set was current or names the stale skills, and `binn audit` keeps its `capabilities.binnacle_skills` finding. The printed commands that replaced the add for a current set go, with the `ponytail:` comment that explained them. The README, `README.ru.md` and `docs/03-mcp-and-skills.md` stop saying that a current set only prints the two commands: running `binn init` again gives a harness installed later the skills.

- [ ] Init tests with the fake `npx`: a current set plans and runs the same add and removal as a stale one, and the step says it was current; no commands are printed in its place.
- [ ] The README, `README.ru.md` (alike) and `docs/03-mcp-and-skills.md` say that running `binn init` again gives a harness installed later the skills, with no case for a current set.

## Comments
