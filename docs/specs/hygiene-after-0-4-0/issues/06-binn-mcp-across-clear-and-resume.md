# 06: `binn mcp` across `/clear` and `--resume`

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`
Roles: Developer, Reviewer

**What to build:** it is known whether the session `binn mcp` sends is still the caller's after `/clear` and `--resume` in Claude Code, and the context-pressure item says "this" or "another" only where it is (spec, *`binn mcp` across `/clear` and `--resume`*; product inbox, *Left after epic 20's tickets*). `binn mcp` reads `CLAUDE_CODE_SESSION_ID` once, at start, and `binn call` on every call. The ticket checks `--resume` by running Claude Code non-interactively with a resumed session and an MCP server that echoes its environment, and `/clear` from Claude Code's documentation and its installed bundle, through MCP and through `binn call` in the shell; it writes what it saw, with the version of Claude Code, under `## Comments`. Where the id the server holds can differ from the session it serves, `callerSession` stops sending it on that route, with a comment saying why.

- [ ] `## Comments` records, for `/clear` and for `--resume`, whether the MCP server's and the shell's `CLAUDE_CODE_SESSION_ID` match the session's id afterwards, and how that was seen.
- [ ] Where an id can be stale, that route sends no `session`, so the item has no `own` there; `packages/mcp/test/smoke.test.ts` covers the rule. Where every id holds, nothing in the code changes.
- [ ] `docs/03-mcp-and-skills.md` says when the server sends `session`.
- [ ] What is left for the owner to see in an interactive session goes to the exit demonstration's ticket under `## Comments`.
