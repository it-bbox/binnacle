# ADR-0047: A Mod for Claude Code, as a Plugin of Its Own

**Status:** Accepted. A new surface beside the skills (ADR-0023, ADR-0027, ADR-0039) and the dashboard; it writes nothing.

## Context

Claude Code's mods, plugins of function hooks, can pin a status line, draw a band above the prompt and a pane, show toasts, add slash commands, put text in the prompt box, add context at a session's start, and call a connected MCP server's tools with the session's own connection. They also read the session's context fill and its rate-limit windows. Today a person sees Binnacle's state only when they ask for it, through `/binnacle:product`, `binn status` or the dashboard. The owner wants it in view while working, optional and off by default (`docs/specs/claude-code-mod/brief.md`). The mod API is early access and changes between Claude Code releases.

## Decision

- The mod is a plugin of its own, **`binnacle-mod`**, in the marketplace the npm package already ships, beside `binnacle`, at the same version. A person who has not installed it has no mod at all; uninstalling or disabling it is Claude Code's own command.
- `binn init`'s plan offers it as an optional step, "no" by default, only where it finds a Claude Code that loads mods; on a yes it runs `claude plugin install binnacle-mod`. It never edits Claude Code's settings files, as ADR-0027 says for `binnacle`.
- The mod reads Binnacle only through the `binnacle` MCP server's tools, `$.mcp.call`, and the session's own figures from Claude Code. It writes nothing: no file, no ticket, no setting. A button puts a command in the prompt box for the person to send, never sends it.
- Without the daemon, or in a project that is not registered, the mod shows nothing and says nothing.
- Its text follows the person's language like the rest of Binnacle (ADR-0045), worded from the daemon's codes.

## Considered Options

- **A hooks module inside the `binnacle` plugin, behind a `userConfig` switch.** Rejected: every user of the skills would load an early-access module they did not ask for, and a fault in it would sit beside the skills.
- **A settings hook and a `statusLine` command.** Rejected: they would mean editing the person's Claude Code settings, which `binn init` never does, and they draw no band, pane or toast.
- **The dashboard alone.** Kept as the full picture; it is a browser tab away from the chat, which is what the mod is for.

## Consequences

- Claude Code is the only harness with the mod; the skills stay the same in every harness.
- The mod's code moves with Claude Code's mod API: a Claude Code that does not load it simply has no mod, and the project is developed as before (`AGENTS.md`, principle 3).
- What the mod shows is what the snapshot already has, plus one new attention item, a Next action naming work already done, which `/binnacle:product` shows too.
