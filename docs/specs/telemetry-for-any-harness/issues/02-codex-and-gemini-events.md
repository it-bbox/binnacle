# 02: Codex's and Gemini CLI's events

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** the receiver maps Codex's `codex.sse_event` events that carry token counts and Gemini CLI's `gemini_cli.api_response` events to usage records, as ticket 01 does for Claude Code (spec, *Events to records*, *Harnesses*). The `Harness` union gains `gemini-cli`. Each count keeps its harness's provenance, Codex's input less cached input being calculated as its reader computes it. Both harnesses show as running from their events and reach level 4; a Gemini CLI event names a project only once a working directory does.

- [x] Daemon process tests: each harness's event becomes a record with the right counts and provenance, nulls where a count is absent.
- [x] A Codex call read from its rollout and posted as an event counts once.
- [x] Both harnesses reach level 4 while their events arrive.

## Comments

- **Where it lives.** `codex` and `geminiCli` beside `claudeCode` in `packages/adapters/src/opentelemetry.ts`; `gemini-cli` in the `Harness` union and in the daemon's `HARNESSES` (`apps/daemon/src/usage.ts`), with no artifact root until 04 gives it one. Attribution, counting once and level 4 are 01's, unchanged and harness-generic.
- **Codex's event**, confirmed against the Codex binary installed here (0.160): `event.name` `codex.sse_event` with `event.kind` `response.completed`; `conversation.id` is the session, the rollout's session id; `model`, `event.timestamp`, `input_token_count`, `cached_token_count`, `output_token_count`, `reasoning_token_count`. As `readCodex` computes them: input is `input_token_count − cached_token_count`, null without the cached count; `cache_write_token_count` is not mapped, as the reader does not map `cache_write_input_tokens`; the record is `calculated`. No request id: the call is matched by model, counts and time.
- **A Codex call's time is its response's completion.** Codex writes a rollout's `token_count` only once the turn's pending tools resolve: on this machine's rollouts, up to 60 s after the response, in 16 % of the calls of the largest one, so the 5 s match of 01 would have counted those twice. Codex also writes a `token_usage_record` as the response completes, at the time its `codex.sse_event` has; `readCodex` now times a record by the usage record written since the token count before it, else by the token count, and a new turn forgets an aborted call's. Older rollouts, without usage records, keep the token count's time.
- **Gemini CLI's event**, from its source (`packages/core/src/telemetry/types.ts`, `ApiResponseEvent.toLogRecord`): `event.name` `gemini_cli.api_response`, `session.id`, `model`, `event.timestamp`, and Gemini's usage metadata: `input_token_count` (the prompt, cached content included), `cached_content_token_count`, `tool_token_count` (the tool-use prompt, beside the prompt), `output_token_count` (the candidates, thoughts not included), `thoughts_token_count`. So input is prompt − cached + tool-use prompt, output candidates + thoughts, reasoning the thoughts, cache creation null; each null where a count it needs is absent; the record is `calculated`. Ticket 04's reader should map Gemini's session files the same way, so that a call read from both is the same call.
- **Gemini CLI's level 4.** Gemini CLI's events carry no working directory (`getCommonAttributes`: `session.id`, `installation.id`, `interactive`, and the user's email), and until 04 nothing else names a Gemini CLI session's directory, so its events wait in no project (*Attribution*, user story 14) and add to no project's usage or runs. Its level is not a project's usage: *Harnesses* gives a harness "level 4 when the harness's OpenTelemetry records have arrived within the active window", so `usageCounts` counts as live the harness's records still in no project beside the project's own. A record in no project thus makes its harness live in every project's level (`ponytail:` on `Store.usageCounts`). Without any event, its level is null with that reason.
- **Provenance is per record**, as `UsageRecord` has it: a Codex or Gemini CLI record is `calculated` as a whole, though its cached input and reasoning are as reported.

### Review

`/code-review` against `main`, both axes.

- Standards: the harnesses read from files listed twice in `usage.ts`, once in `HARNESSES` and once in `startIngest`'s loop — **fixed**: the loop reads the harnesses whose files were found.
- Standards: the three-way choice of mapper by event name — **kept**: three readable branches; a table when a fourth harness exports.
- Standards: Codex's input formula written in the reader and in the mapping — **kept**: one subtraction each, with different failures (the reader's stops the file, the event's is a null).
- Standards: `Event` shadows the global type, `completed` names a time — **fixed**: `OtlpEvent`, `completedAt`. `Mapped` and `call` are kept.
- Standards: with more cached than input, Codex's input is null and its cached input kept — **kept**: the count Codex gave is reported, the one it contradicts is not.
- Spec: Gemini CLI does not reach level 4 here — **fixed** after verification: its records in no project make it live (above), with a process test.
- Spec: the Codex reader's change has no test of the reader as a function — **kept**: the readers are tested through the daemon, as before; the 40 s test fails without the change.
- Spec: a usage record without its token count would time a later call — **fixed**: a turn's context forgets it. Two responses before one token count, which no rollout here has, would be one record no event matches — **kept**.
- Spec: Gemini CLI's cached input and reasoning are reported, yet the record is `calculated` — **kept**: provenance is per record (above).
