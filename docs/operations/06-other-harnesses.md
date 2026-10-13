# Working from Another Harness

_Русская версия: [06-other-harnesses.ru.md](06-other-harnesses.ru.md)._

## Supporting any coding agent

Agents differ enormously in what they expose, so support is graded rather than binary:

| Level | Requirement | What you get |
| --- | --- | --- |
| 1 — Context | the agent can call an MCP server | project memory: snapshots, tasks, checkpoints, questions and answers |
| 2 — Attribution | it writes a session artifact with a working directory and session id | session-to-project attribution, timings, history |
| 3 — Usage | that artifact carries token counts | spend analytics, cost, rework metrics |
| 4 — Live | it exposes an observable stream | current activity |

**Level 1 is all it takes to be supported, and it needs no adapter.** An agent released tomorrow gets project memory on the day it can speak MCP. See [ADR-0014](../adr/ADR-0014-harness-support-levels.md).

## The harnesses and their levels

The harnesses Binnacle reads today, the highest level each reaches, and how:

| Harness | Level | How it is reached |
| --- | --- | --- |
| Claude Code (CLI and desktop) | 4 — Live | its session files under `~/.claude/projects`, and the OpenTelemetry export `binn init` enables in its settings |
| Codex (CLI and desktop) | 4 — Live | its rollouts under `~/.codex/sessions`, and the OpenTelemetry export `binn init` enables in `~/.codex/config.toml` |
| Gemini CLI | 4 — Live, not verified | its session files under `~/.gemini/tmp`, and the OpenTelemetry export `binn init` enables in `~/.gemini/settings.json` |
| opencode | 3 — Usage | its database in `~/.local/share/opencode`; it documents no OpenTelemetry export |
| ZCode | 3 — Usage | its database in `~/.zcode/cli/db`; it documents no OpenTelemetry export |
| pi | 3 — Usage | its session files under `~/.pi/agent/sessions`; it has no built-in OpenTelemetry export |
| Antigravity | 2 — Attribution, not verified | its window state, which names each conversation's workspace; its conversations are encrypted, so no model or tokens |
| any other | 1 — Context | MCP, or `binn call` in its shell |

Level 4 holds while a harness's events arrive; without the export, Claude Code, Codex and Gemini CLI are read at level 3 from their files, and a call seen both ways is counted once. Gemini CLI and Antigravity are built from their sources, as neither could run a session on the owner's machine, and are marked not verified. Each project's actual levels, with the reason a harness stays below the next one, are on the dashboard's usage page. Details: [MCP and skills](../03-mcp-and-skills.md#harnesses-and-their-levels), *Harnesses and their levels*.

## Binnacle's skills in another harness

One `binn init` sets up every harness on the machine. Its plan installs Binnacle's skills, at user scope, into every harness the `skills` CLI (skills.sh) detects, such as Codex, Antigravity, ZCode or Pi, through `npx skills`, and keeps them out of Claude Code, which has the `binnacle` plugin; `--skip-harness <id>` keeps them out of another one too. Outside Claude Code each skill is named `binnacle-<action>`: `binnacle-product`, `binnacle-daily`, `binnacle-task`, `binnacle-status`, `binnacle-checkpoint`, `binnacle-audit`, `binnacle-init`, `binnacle-daemon`, `binnacle-register`, `binnacle-dashboard`, `binnacle-autopilot`, `binnacle-answer`, `binnacle-roadmap` and `binnacle-help`, where Claude Code has `/binnacle:product` and the rest. The Summary names the harnesses the skills went into and says to run `binnacle-product` there. For a harness installed later, run `binn init` again: it installs them into every harness it detects, stale or current, and says which they were. `binn audit` reports skills at another version than the installed `binn`'s, and `binn init` then reinstalls them.

`binn init` also offers to register the `binnacle` MCP server with Claude Code, Codex, opencode and VS Code. In any other harness, or before the server is registered, the skills call the same tools through `binn call <tool> [json]` in the shell. `binnacle-autopilot` runs only where the harness can start a background agent in a worktree of its own; elsewhere it refuses at once, changes nothing, and the epic's tickets are run by hand.

- **Codex** reads a project's `.codex/config.toml` only in a trusted project. Trust the project in Codex, or the `binnacle` entry is not seen. The Codex desktop app ships its CLI outside `PATH`; on Linux it is `/usr/lib/chatgpt/resources/codex`.
- **opencode** reads `opencode.json` or `opencode.jsonc` in the project. Run `opencode` in the repository root.
- **GLM** is a model, not a harness. Reach it through a harness such as ZCode, Claude Code or opencode; there is no GLM adapter to look for.
