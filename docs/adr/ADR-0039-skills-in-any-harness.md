# ADR-0039: Binnacle's Skills Reach Any Harness Through the `skills` CLI

**Status:** Accepted

**Narrows:** ADR-0023 and ADR-0027, which stand for Claude Code alone.

## Context

`binn init` installs Binnacle's skills, Matt Pocock Skills and Ponytail into Claude Code alone, through `claude plugin`, while the baseline makes every harness equal. The owner works from Codex, Antigravity and ZCode on one machine, and the people expected to use Binnacle work from Pi, DeepSeek's harness and others. On 2026-10-06 the owner linked Binnacle's skills into `~/.codex/skills` by hand and Codex ran them.

`SKILL.md` is an open format (Agent Skills) that most harnesses read, each from its own directories. The `skills` CLI (`npx skills`, skills.sh) already installs a skill set from a repository or a local path into some 79 of them, ZCode, Pi, Antigravity, Codex, Gemini CLI and opencode among them, and detects which are installed. Matt Pocock Skills already point other harnesses at it.

Two things kept Binnacle's skills in Claude Code: the install channel, and text written for Claude Code — `/binnacle:` names, its agent tool, worktrees under `.claude/worktrees`, a push notification, `.mcp.json`. A third would surface once they left it: the skills drive Binnacle through its MCP tools, `binn init` registers the MCP server with four harnesses only, and Pi has no MCP at all.

## Decision

- **Claude Code keeps the `binnacle` plugin** from the installed package (ADR-0023, ADR-0027), named `/binnacle:<action>`.
- **Every other detected harness gets the same skills through the `skills` CLI**: `binn init`'s plan runs `npx skills add <the package's skills> -g` for every harness it detects except Claude Code, named in the plan one by one. Binnacle keeps no list of skill directories of its own.
- **Outside Claude Code a skill is named `binnacle-<action>`**: `binnacle-product`, `binnacle-daily`, `binnacle-init` and so on. A skill's name is flat there, and `init`, `help` and `status` are taken by built-in commands; vendors prefix with their product's name.
- **One neutral text per skill.** A skill says what to do, not with which harness's tool: ask the human, start a background agent in its own worktree, open a new session. What depends on the harness, such as which file it reads its MCP servers from, comes from `binn`'s own output. A skill names another skill by its action, not by one harness's syntax.
- **Matt Pocock Skills and Ponytail reach the same harnesses** through the same CLI in the same plan, and Claude Code through its plugins, as today.
- **`binn call <tool> [json]`** calls one of the daemon's MCP tools and prints its JSON. A skill uses the MCP tool where the harness has it, and `binn call` in the shell where it does not, so a harness with a shell and no MCP runs every skill.
- **Autopilot ships everywhere.** Where the harness cannot start a background agent in a worktree of its own, autopilot refuses at its first step, changing nothing, and says the tickets are run by hand. It sends a push notification only where the harness can.
- **Adding a harness is running `binn init` again**: its plan holds only what is missing. `--harness` leaves a detected harness out.
- **Refreshing is a human's step.** `binn audit` reports installed skills that differ from the package's, and `binn init`'s plan reinstalls them; the daemon never writes into a harness's directories (ADR-0026, ADR-0034).
- **Without `npx` or the network**, `binn init` prints the command instead of failing.

## Rationale

- The `skills` CLI is the external system that already does this for every harness; keeping our own directory list would duplicate it and always trail it (`AGENTS.md`, principle 2).
- The plugin stays in Claude Code because there it is the native channel, namespaces the skills and is refreshed by `claude plugin update`; the owner chose it over one channel for all.
- One text scales to any harness; a template per harness does not.
- `binn call` is one command beside tools that already exist, where an MCP template per harness would never reach Pi.

## Consequences

- The skills' text is rewritten to be neutral, and the package builds a copy whose names carry `binnacle-` for the `skills` CLI.
- `docs/03-mcp-and-skills.md` no longer says no skill format exists for another harness, and lists `binn call`.
- *Harness support level* 1 (ADR-0014, `CONTEXT.md`) is reached through MCP or through `binn` in a shell.
- The *Later* item "CLI commands mirroring the MCP tools" is taken up by `binn call`.
- MCP templates stay for Claude Code, Codex, opencode and VS Code; every other harness uses `binn call`.
- Epic 10 reuses the harnesses `binn init` detects through the `skills` CLI.
