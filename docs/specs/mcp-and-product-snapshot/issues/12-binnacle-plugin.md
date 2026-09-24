# 12: The skills as the `binnacle` plugin

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`, `docs/adr/ADR-0023-skills-ship-as-a-plugin.md`

**What to build:** a session opened in this repository has `/binnacle:product`, `/binnacle:daily`, `/binnacle:checkpoint` and `/binnacle:autopilot`, and no bare `/product`, `/daily`, `/checkpoint` or `/autopilot`. Decided in ADR-0023.

- [ ] `.claude/skills/binnacle/.claude-plugin/plugin.json` declares a plugin named `binnacle`, with a description.
- [ ] The four skills move, unchanged in procedure, to `.claude/skills/binnacle/skills/<name>/SKILL.md`, keeping `disable-model-invocation: true`; nothing is left under `.claude/skills/<name>/` for them.
- [ ] Every live reference uses the namespaced names: the skills' references to each other, `AGENTS.md`, `CLAUDE.md`, `docs/workflow/`, `docs/operations/`, `docs/roadmap.md`, and the Claude Code form in `docs/03-mcp-and-skills.md`. Tickets, specs and ADRs that record what was already built are not rewritten.
- [ ] `docs/03-mcp-and-skills.md` keeps the logical action names and says that in Claude Code they are served by the `binnacle` plugin.
- [ ] Typecheck and the full suite stay green.
- [ ] Verified by hand once: a fresh session at the repository root, and one in a worktree, list the four `binnacle:` skills and no bare ones, and `/binnacle:product` runs.

## Comments
