# 01: The daemon receives Claude Code's OpenTelemetry

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** the daemon accepts OTLP JSON over HTTP at its local address (`POST /v1/logs`; `/v1/metrics` and `/v1/traces` accepted and not stored; another encoding refused with 415) and turns each `claude_code.api_request` event into a usage record, keeping session id, model, timestamp and token counts with their provenance and dropping every other attribute (spec, *OTLP receiver*, *Events to records*). A record stores its source. It takes its working directory from its session's artifact records, and stays in no project until one names it (*Attribution*). A call also read from its artifact counts once, the artifact record kept (*Counted once*). Claude Code shows as running from its first event, and reaches level 4 while its events arrive within the active window.

- [x] Daemon process tests: an event posted becomes a record in `usage.get`; no prompt, response or tool attribute is stored.
- [x] The same call posted and present in its artifact counts once; an unmatched event counts.
- [x] An event whose session has no artifact yet is in no project, and joins the project once the artifact arrives.
- [x] A session shows in the snapshot's running runs from its event, and Claude Code's level is 4; another encoding is refused with 415.

## Comments

- **Where it lives.** `readOtlpLogs` in `packages/adapters/src/opentelemetry.ts` maps an OTLP JSON logs export to records without a directory or branch (`TelemetryRecord`); ticket 02 adds Codex's and Gemini CLI's events beside `claudeCodeRequest`. The route is `receiveOtlp` in `apps/daemon/src/server.ts`; `receiveTelemetry` and `attributeSessions` in `apps/daemon/src/usage.ts` keep and attribute the records.
- **Event recognised** by its body `claude_code.api_request`, or its `event.name` (`claude_code.api_request`, or `api_request` under the scope `com.anthropic.claude_code…`). Taken: `session.id`, `request_id`, `model`, `event.timestamp` (else `timeUnixNano`), `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, all `provider_reported`; `reasoning` is null, since the event has no thinking tokens. A record's natural key is `otel:<request_id>`, else `otel:<client_request_id>`, else session, timestamp and `event.sequence`, so a batch sent again stores nothing twice.
- **Storage.** `ingested_record` gains `source` (`artifact`, the default for the rows already there, or `opentelemetry`) and `request_id`, by `alter table`, as the append-only tier's first migration. An event that no stored artifact record of its session can place waits in `unattributed_record`, in no project; when an artifact record of that session is stored, by an ingest or already, the event moves into that record's project with its directory (the session's latest main-session record at or before it, else its first) and, like every record, the branch its reflog gives it. `UsageRecord` gains `requestId`, which Claude Code's artifact reader takes from the assistant line's `requestId`; Codex's is null.
- **Counted once** is decided as the store reads a project's records (`store.usage`), so it holds in whichever order the event and the artifact arrive. Within one session, the same call is one with the same request id when both sides have one; otherwise the same model and every count the event reports equal, within `SAME_CALL_WITHIN_S` (5 s). The artifact record is kept.
- **Level 4** when an OpenTelemetry record of the harness arrived in the project within `ACTIVE_WITHIN_MS` (10 minutes), checked after an unreadable artifact's level 1. Running is unchanged: the event's record joins its session's run and makes it active.
- **No token on `/v1/*`.** A question that blocked nothing, answered the smallest way the spec allows: the export the spec has `binn init` write is an endpoint and no headers, so the receiver takes no token, as `/health` takes none; `Host` and `Origin` are checked as for every route. Recorded in ADR-0038's consequences, `docs/operations/04-security-resilience.md` and `docs/01-architecture.md`.
- **Encodings.** Anything but `application/json` (any charset) without `content-encoding`, or with `identity`, is 415 `request.unsupported_media_type`, gzip included; a body that is not JSON is 400. The body limit for OTLP is 16 MiB, beside 1 MiB for operations.
- **Not done here: the 415 in the harness's support reason** (spec, *OTLP receiver*; the ticket asks only for the 415). A refused body is never decoded, so it names no harness to count it against, and the 415's message tells the exporter to use `http/json`. Ticket 03 writes that protocol into each harness's settings.
- **For later tickets.** A session with no artifact record yet is in no project, so for Claude Code "running before its artifact is written" holds from the session's first stored artifact record on, not before. A subagent's call its artifact does not have yet counts in its parent session's run: the event names no subagent (`ponytail:` in the mapping).

### Review

`/code-review` against `main`, both axes.

- Standards: a new endpoint without a token, with no ADR — **fixed**: recorded in ADR-0038 (see above).
- Standards: the store's transaction block written three times — **fixed**: one `transaction` helper.
- Standards: `RecordSource` exported with no user outside the store — **fixed**: not exported. `Unattributed` is kept exported, since the `Store` type names it.
- Standards: `@binnacle/adapters` imported among the `node:` imports — **fixed**.
- Standards: `harness` and `sessionId` travelling together through three store methods — **kept**: two parameters, no type needed yet.
- Standards and Spec: without a request id the match is not one to one, so two identical calls within 5 s of which the artifact has one count once until it has the other — **kept**, marked `ponytail:` on `Store.usage`; with request ids on both sides, as Claude Code has them, it does not arise.
- Standards: `timeUnixNano` as a JSON number loses precision — **kept**: `event.timestamp` is read first, and a millisecond is all that is used.
- Spec: the 415 is not counted in the harness's support reason — **left**, for the reason above.
- Spec: a subagent's unmatched call counts in its parent's run — **kept**, marked `ponytail:`.
- Spec: no test of a request id on one side only, nor of an event beyond the few seconds — **fixed**: one test of each.
