# 07: The refresh after a merge, and the documentation

Status: READY
Triage: ready-for-agent
Blocked by: 02, 04
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** on this repository, after a merge that changed the plugin's skills, autopilot also reinstalls the package's `binnacle-<action>` copy through the `skills` CLI, right after the plugin refresh epic 9 introduced, with the same rules: reported, never stopping the run (spec, *Autopilot's refresh*). `docs/workflow/02-development-workflow.md` names the same step for a merge done by hand. `docs/03-mcp-and-skills.md` states both channels, the names outside Claude Code, and no longer says no skill format exists for another harness. `README.md` and `README.ru.md` say that one `binn init` sets up every harness, with the skills' names outside Claude Code.

- [ ] Autopilot's step and report carry the reinstall; the package's wording test holds it.
- [ ] The development workflow, `docs/03-mcp-and-skills.md`, `README.md` and `README.ru.md` say the above, the two READMEs alike.
