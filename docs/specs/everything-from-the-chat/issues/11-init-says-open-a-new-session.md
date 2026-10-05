# 11: /binnacle:init says when a new session is needed, and the skills name /binnacle:register

Status: READY
Triage: ready-for-agent
Blocked by: 10
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** two defects found in epic 9's exit demonstration (2026-10-05).

1. Claude Code reads `.mcp.json` only when a session starts. After `/binnacle:init` created it, the same session had no `binnacle` MCP server, and `/binnacle:product` there could not run. When the Summary shows that init created or changed `.mcp.json`, `/binnacle:init` ends by saying: open a new session in this repository, and approve the project's `binnacle` server when Claude Code asks.
2. After `/binnacle:daemon start`, and in `/binnacle:init` when the notes say the daemon was not running, the skills say to run `/binnacle:init` again to add the registration. `/binnacle:register` (ticket 04) does exactly that: name it instead.

Blocked by 10 so that, merged by autopilot, it is also the live check of epic 9's third exit criterion: a skill changed by a merge is the one the next session runs.

- [ ] `/binnacle:init` says to open a new session and approve the `binnacle` server when init created or changed `.mcp.json`, and says nothing of it otherwise.
- [ ] `/binnacle:daemon start` and `/binnacle:init` name `/binnacle:register` for a missing registration, not `/binnacle:init` again.
- [ ] A test in `apps/cli/test/pack.test.ts` holds both.

## Comments
