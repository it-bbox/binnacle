# 01: The daemon receives Claude Code's OpenTelemetry

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** the daemon accepts OTLP JSON over HTTP at its local address (`POST /v1/logs`; `/v1/metrics` and `/v1/traces` accepted and not stored; another encoding refused with 415) and turns each `claude_code.api_request` event into a usage record, keeping session id, model, timestamp and token counts with their provenance and dropping every other attribute (spec, *OTLP receiver*, *Events to records*). A record stores its source. It takes its working directory from its session's artifact records, and stays in no project until one names it (*Attribution*). A call also read from its artifact counts once, the artifact record kept (*Counted once*). Claude Code shows as running from its first event, and reaches level 4 while its events arrive within the active window.

- [ ] Daemon process tests: an event posted becomes a record in `usage.get`; no prompt, response or tool attribute is stored.
- [ ] The same call posted and present in its artifact counts once; an unmatched event counts.
- [ ] An event whose session has no artifact yet is in no project, and joins the project once the artifact arrives.
- [ ] A session shows in the snapshot's running runs from its event, and Claude Code's level is 4; another encoding is refused with 415.

## Comments
