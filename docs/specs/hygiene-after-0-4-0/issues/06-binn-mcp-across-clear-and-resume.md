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

## Comments

### What was seen, Claude Code 2.1.308 (2026-10-28)

How: `--resume` and `--continue` by running `claude -p` non-interactively in a throwaway directory, with `--strict-mcp-config` and a stdio MCP server that writes the `CLAUDE_CODE_SESSION_ID` it was started with to a log, and comparing it with the `session_id` the run's JSON reports. The model call itself failed on authentication (this machine's own OAuth login has expired; the desktop app's sessions authenticate through the host), so the shell was not run in these probes: the server is started before the first model call, which is what was compared. `/clear` from Claude Code's documentation (`code.claude.com/docs/en/env-vars`, `CLAUDE_CODE_SESSION_ID`) and the installed bundle (`/usr/bin/claude`): the stdio MCP server's environment is built when it is spawned (`CLAUDE_CODE_SESSION_ID: <current id>`), each Bash command's from the current session id, and the `/clear` path sets a new conversation id, rewrites `process.env.CLAUDE_CODE_SESSION_ID`, and reconnects only the `ide` MCP client.

| Route | MCP server (`binn mcp`) | Shell (`binn call`) |
| --- | --- | --- |
| Fresh start | matches (probe: server and run both `7511c3c3-…`) | matches (docs; this session's shell gives its own id) |
| `--resume <id>` | matches (probe: a new server, started with the resumed `7511c3c3-…`) | matches (docs: Bash matches hooks' `session_id`) |
| `--resume <id> --fork-session` | matches (probe: server and run both the new `be08061b-…`) | matches (docs) |
| `--continue`, or `--resume` that picks its session | **stale** (probe: `--continue` resumed `be08061b-…`, server started with the startup id `9b19c857-…`; the docs say the same of a `--resume` without an id) | matches (docs) |
| `/clear` | **stale** (docs: "retains the ID it was spawned with"; bundle: the server is not restarted) | matches (docs: "updated on `/clear`"; bundle) |

Codex sets `CODEX_THREAD_ID` for its shell only, never for an MCP server (ticket hygiene-after-v1/04), so its route is unchanged.

### Decisions

1. The MCP route sends no `session` at all, rather than per harness: Claude Code's id can be stale there, Codex sends none to an MCP server, and no other harness is read. `serveStdio` loses its `session` argument; `callerSession` is unchanged and read by `binn call` alone. The cost the spec accepted: a skill calling the MCP tool gets a context-pressure item with no `own`, saying neither "this" nor "another"; `binn call` in the shell still says which.
2. Telling a fresh `--resume <id>` apart from a stale `--continue` inside the server was not tried: the server sees only its own environment, and the spec leaves any other way out of scope.

### For the next ticket

The exit demonstration's interactive check is under ticket 08's `## Comments`.

### Review

Reviewed in a sub-agent against `main`, on the project's standards and the spec; typecheck and the MCP smoke test pass.

1. A ticket commit's subject ran to 74 characters. **Fixed**: the ticket's commits were redone under a shorter subject.
2. `docs/03-mcp-and-skills.md` stated as fact that `--continue` or a picked `--resume` starts the server with the startup id, where Claude Code's docs say "may". **Fixed**: "can start it".
3. `docs/04-telemetry-dashboard.md` read as if `binn call` always names its session. **Fixed**: "where the harness names it".
4. The smoke test's comment said the server is kept across `--continue`; it is started anew with the startup id. **Fixed**: worded as `serveStdio`'s comment is.
5. The whole MCP route drops `session`, not Claude Code's alone. **Kept**: Codex names none to an MCP server and no other harness is read, so the behaviour is the same (decision 1).
6. A fresh `--resume <id>` loses `own` through MCP although its id holds. **Kept**: the spec's contested point accepts losing the word for the route; the server cannot tell the cases apart (decision 2).
7. The shell column for `--resume` and `--continue` rests on the docs, not a probe. **Kept**: the probe's model call could not authenticate; ticket 08's script checks it in an interactive session.
8. `toolRequest(name, args, cwd, undefined)` in `serveStdio` could drop the argument with an optional parameter. **Kept**: the explicit `undefined` sits beside the comment that says why.
