# 12: The skills as the `binnacle` plugin

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`, `docs/adr/ADR-0023-skills-ship-as-a-plugin.md`

**What to build:** a session opened in this repository has `/binnacle:product`, `/binnacle:daily`, `/binnacle:checkpoint` and `/binnacle:autopilot`, and no bare `/product`, `/daily`, `/checkpoint` or `/autopilot`. Decided in ADR-0023.

- [x] `.claude/skills/binnacle/.claude-plugin/plugin.json` declares a plugin named `binnacle`, with a description.
- [x] The four skills move, unchanged in procedure, to `.claude/skills/binnacle/skills/<name>/SKILL.md`, keeping `disable-model-invocation: true`; nothing is left under `.claude/skills/<name>/` for them.
- [x] Every live reference uses the namespaced names: the skills' references to each other, `AGENTS.md`, `CLAUDE.md`, `docs/workflow/`, `docs/operations/`, `docs/roadmap.md`, and the Claude Code form in `docs/03-mcp-and-skills.md`. Tickets, specs and ADRs that record what was already built are not rewritten.
- [x] `docs/03-mcp-and-skills.md` keeps the logical action names and says that in Claude Code they are served by the `binnacle` plugin.
- [x] Typecheck and the full suite stay green.
- [x] Verified by hand once: a fresh session at the repository root, and one in a worktree, list the four `binnacle:` skills and no bare ones, and `/binnacle:product` runs.

## Comments

- **What exists.** `.claude/skills/binnacle/.claude-plugin/plugin.json`, holding only `name` and `description`, and the four skills under `.claude/skills/binnacle/skills/`, moved by `git mv`. Each skill's only edit is its one reference to another action, now namespaced. `claude plugin validate .claude/skills/binnacle` passes, warning only that `version` and `author` are absent; neither is asked for, and a skills-directory plugin is read in place. `claude plugin details binnacle`, run from a worktree, shows `binnacle@skills-dir` with the four skills.
- **What was renamed, and what was not.** Namespaced: `AGENTS.md`, `CLAUDE.md`, `docs/workflow/01-product-workflow.md` and `02-development-workflow.md`, `docs/operations/01-new-project.md` (which keeps the logical names and adds the Claude Code form), the roadmap's current focus, and a paragraph in `docs/03-mcp-and-skills.md`. Kept bare, as logical names or records: the action list in `docs/03-mcp-and-skills.md`, the README flow diagrams (beside `/task` and `/audit`, which are logical only; neither README is in the ticket's list, so `README.ru.md` needs no change), `docs/00-scope.md`, `docs/04-telemetry-dashboard.md`, `docs/05-mvp-plan.md`'s exit criterion, the roadmap's record of epic 2's close, and every spec, ticket and ADR.
- **For ticket 09.** The skills it edits are now `.claude/skills/binnacle/skills/autopilot/SKILL.md` and `.claude/skills/binnacle/skills/product/SKILL.md`.

### Review

Code review against `main`, both axes.

Standards: no hard violation.

1. `docs/03-mcp-and-skills.md` repeated ADR-0023's fact of where the plugin lives. **Fixed**: the paragraph now says only that the actions are served by the `binnacle` plugin, and names them.
2. `docs/workflow/01-product-workflow.md` uses only the Claude Code form, while `docs/operations/01-new-project.md` gives the logical name and the Claude Code form. **Kept**: the first describes this repository's Product workflow, which runs in Claude Code; the second describes any project in any harness.
3. The rename touched ten files, and `CLAUDE.md` names the Product actions twice. **Kept**: every doc that names an action changes with its name, and both mentions predate this ticket.

Spec: no scope creep, nothing implemented wrong.

1. The roadmap's next action still named a bare `/autopilot`. **Fixed** in the `DONE` commit, which also moves the current focus past this ticket.

### Hand check

The last criterion needs a human: only an interactive session lists its skills and runs one. With the daemon running and the workspace trusted:

1. After the merge, start a fresh Claude Code session at the root of the main checkout. Type `/binnacle:` and expect `product`, `daily`, `checkpoint` and `autopilot`. Type `/product`, `/daily`, `/checkpoint` and `/autopilot`, and expect none offered from this repository (a user-level skill or another plugin's skill with the same bare name is not this repository's).
2. Run `/binnacle:product`. Expect the Product Snapshot, presented as before the move.
3. Start a fresh session in a worktree under `.claude/worktrees/` (the desktop app's default) and repeat step 1.

**Hand check passed** on 2026-09-24: a fresh session in a worktree and one at the repository root each listed the four `binnacle:` skills and no bare ones, and `/binnacle:product` ran.
