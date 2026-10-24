# 04: A session named by its times, as this one or another

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-v1/spec.md`
Roles: Developer, Reviewer

**What to build:** the context-pressure warning tells the owner which session it means (spec, *The caller's session*, *The context-pressure item*; product inbox, *A session named so a person knows it*). The MCP server and `binn call` read `CLAUDE_CODE_SESSION_ID` from their environment and send it with every daemon call as `session`, beside `path`. The `context.pressure` item gains `params.startedAt`, `params.lastActivityAt` and `params.own` (`true` when the request's session is the item's, `false` when it is another, absent when the request carries none). Its message names the session as this Product session, or another one, started at a time with its latest activity, in the daemon's local time; the UUID stays in `params.session` only. The Russian wording names the threshold in words, with no manifest key.

- [ ] Through `toolRequest` and `binn call`: with `CLAUDE_CODE_SESSION_ID` set, the body carries `session`; unset, it carries none.
- [ ] Through `project.snapshot`: the item's message and `params` carry the session's start and latest activity, and no UUID in the message; `own` is `true`, `false` or absent as above, and the message says "this" or "another" only when `own` is set.
- [ ] Through `wordMessage`: the Russian line names the threshold with no `telemetry.context_pressure.tokens`, and says "эта" or "другая" only when `own` is set.
- [ ] Which other harnesses tell a child process their session is checked and written under `## Comments`; each one found is read the same way, none guessed.
- [ ] `docs/03-mcp-and-skills.md` describes the `session` the server sends.

## Comments

- Which harnesses tell a child process their session, checked on 2026-10-25 against the installed harnesses and their sources:
  - **Claude Code**: `CLAUDE_CODE_SESSION_ID`, for the MCP server and its shell (the spec).
  - **Codex**: `CODEX_THREAD_ID`, set for its shell's commands (`codex-rs/protocol/src/shell_environment.rs`, `create_env`), not for MCP servers, whose environment is an allowlist (`codex-rs/rmcp-client/src/utils.rs`, `DEFAULT_ENV_VARS`). It is the rollout's `session_meta.id`, the session id Binnacle's Codex reader records (a local rollout carries the same value in `id` and `session_id`). **Read the same way**, after `CLAUDE_CODE_SESSION_ID`, so `binn call` in Codex's shell says this session or another. `CODEX_SESSION_ID`, the root session shared by its subagents, is not read: it is not the id a subagent's own records carry.
  - **Gemini CLI**: `GEMINI_SESSION_ID` is set for its hooks only; its MCP servers get its own environment and `GEMINI_CLI=1`. Not read.
  - **Antigravity**: its language server holds `ANTIGRAVITY_CONVERSATION_ID=%s` beside its `hooks.json` handling; nothing confirms it reaches a terminal command or an MCP server. Not read.
  - **opencode** and **pi**: no session variable among the ones their bundles name. **ZCode**: its AppImage was not unpacked; its exec directory and logs name none. Not read.
- Decisions where the ticket is silent:
  - `callerSession(env)` in `packages/mcp` is the one place that names the variables; `binn mcp` reads it once at start, `binn call` on every call, and `toolRequest` takes the result beside `cwd`. Only `project.snapshot` reads `session`; every other operation ignores it, as the daemon ignores any field it does not read.
  - Times are `HH:MM` in the local time of the process that words them (the daemon for English, whoever calls `wordMessage` for Russian), the start dated `YYYY-MM-DD HH:MM` when it is not on the latest activity's local day. `sessionTimes` in `packages/core/src/wording.ts` does it for both. `params.startedAt` and `params.lastActivityAt` stay ISO, the run's.
  - `Params` admits a boolean, for `own`; the wording reads it through `flag`, and refuses (falls back to English) a non-boolean.
  - The English line keeps `telemetry.context_pressure.tokens`: the ticket asks only the Russian to drop the key, and English names configuration as written.
  - The vault's snapshot note is the snapshot served, so it carries the `own` of the session that asked for it.
- For the next ticket: `context.pressure`'s Russian is now «Эта/Другая продуктовая сессия в <harness>, начатая в HH:MM, последняя активность в HH:MM, …»; ticket 05's wording work leaves it as is.

### Review

Against `main`, in a sub-agent, on the standards and the spec. Typecheck and the full suite (900 tests) pass; criteria 1 to 3 are pinned through `toolRequest`, `binn call` and `binn mcp` against a daemon that echoes the body, `project.snapshot` and `wordMessage`; the Codex and Gemini CLI findings were re-checked against their sources.

1. **The wording test failed in some time zones**: its session's times, 09:30Z and 10:45Z, fall on two local days under `TZ=Pacific/Honolulu` or `Pacific/Kiritimati`, so the start was dated and the expected line was not. **Fixed**: 12:00Z and 12:15Z in `packages/core/test/wording.test.ts`, the same local day in every zone; checked under five zones, the daemon's test too.
2. The vault's snapshot note says "This"/"Эта" for the session that asked. **Kept**: the note is the snapshot as served, with its `served:` time, and the spec changes nothing else in it.
3. Nested harnesses, such as `codex exec` run from Claude Code, whose shell inherits `CLAUDE_CODE_SESSION_ID`, give the outer session. **Kept**: no order of the two variables fixes both nestings, and a Product session is not run nested.
4. `binn mcp` reads the session once, at start, as the spec says; whether Claude Code keeps one id across `/clear` or `--resume` is not known here. **Left** to the exit demonstration (ticket 09), which reads the warning from a second session.
5. The `binn call` test is in `packages/mcp/test/smoke.test.ts`, not `apps/cli/test/locale.test.ts`. **Kept**: the same `binn` process seam, beside the MCP server's.
6. No other finding: one author, no attribution, no dependency; `callerSession` and `sessionTimes` are the only new surface; the `Params` widening typechecks everywhere, the dashboard too.
