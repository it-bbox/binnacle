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
