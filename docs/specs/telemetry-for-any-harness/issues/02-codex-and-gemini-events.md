# 02: Codex's and Gemini CLI's events

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** the receiver maps Codex's `codex.sse_event` events that carry token counts and Gemini CLI's `gemini_cli.api_response` events to usage records, as ticket 01 does for Claude Code (spec, *Events to records*, *Harnesses*). The `Harness` union gains `gemini-cli`. Each count keeps its harness's provenance, Codex's input less cached input being calculated as its reader computes it. Both harnesses show as running from their events and reach level 4; a Gemini CLI event names a project only once a working directory does.

- [ ] Daemon process tests: each harness's event becomes a record with the right counts and provenance, nulls where a count is absent.
- [ ] A Codex call read from its rollout and posted as an event counts once.
- [ ] Both harnesses reach level 4 while their events arrive.

## Comments
