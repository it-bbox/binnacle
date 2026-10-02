# ADR-0023: Binnacle's Skills Ship as a Claude Code Plugin Named `binnacle`

**Status:** Accepted. Amended on 2026-10-02: once `binn init` has installed `binnacle@binnacle` from the npm package (ADR-0027), that copy takes the name `binnacle`, and Claude Code does not load the skills-directory plugin at `.claude/skills/binnacle/`. An edited `SKILL.md` then reaches a session only after the plugin is refreshed: `pnpm --filter @binnacle/cli run prepare`, `claude plugin marketplace update binnacle`, `claude plugin update binnacle@binnacle`, and a new session (`specs/everything-from-the-chat/spec.md`, ticket 07).

## Context

Epic 2 committed `/product`, `/daily`, `/checkpoint` and `/autopilot` as plain skills in this repository's `.claude/skills/`. Claude Code names plain skills bare, so Binnacle's actions sit in one flat namespace with every other skill a user has, with nothing saying they are Binnacle's. They also exist only in this repository: a project Binnacle is registered for gets its MCP tools through `.mcp.json` but none of the skills that drive them.

Claude Code namespaces a skill only when it belongs to a plugin: `/<plugin>:<skill>`, as the Matt Pocock skills appear as `/mattpocock-skills:implement`. A plugin placed in a project's `.claude/skills/<name>/` with a `.claude-plugin/plugin.json` manifest loads automatically as `<name>@skills-dir` once the workspace is trusted — no marketplace, no install — and is read in place, so an edited `SKILL.md` takes effect at once.

## Decision

Binnacle's skills ship as one Claude Code plugin named **`binnacle`**. Its actions are `/binnacle:product`, `/binnacle:daily`, `/binnacle:checkpoint` and `/binnacle:autopilot`.

On this repository the plugin lives at `.claude/skills/binnacle/`, a skills-directory plugin, so every session opened at the repository root — the main checkout or a worktree — has it with no setup. The skills' procedure text does not change.

## Rationale

- A namespace says whose action it is and cannot collide with a user's own `/daily`.
- The same plugin is the unit Binnacle can later deliver to other projects, alongside its MCP server; a flat skills folder can only be copied.
- The skills-directory form keeps this repository's loop as short as it is today: edit a `SKILL.md`, and the next call uses it.

## Consequences

- The four skills move under `.claude/skills/binnacle/skills/`, and live references to them in instruction files, workflow documents and the skills themselves use the namespaced names. Tickets, specs and ADRs that record what was built keep the names they had.
- A session must start at the repository root, and the workspace must be trusted, for the plugin to load.
- `docs/03-mcp-and-skills.md` keeps the logical action names and states the Claude Code form.
- Delivering the plugin to other projects, through a marketplace installed by `binn init`, belongs to epic 3 and is not decided here.
