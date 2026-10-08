# 16: pi's sessions read from its files

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** a reader for pi's session files (`@mariozechner/pi-coding-agent`) gives a record per model call with its tokens; the `Harness` union gains `pi`, and the daemon ingests a project's pi sessions (spec, *New artifact readers*, user story 43). pi reaches level 3 if its records carry tokens; it has no built-in OpenTelemetry export, which its support reason and `binn init`'s Summary say, from 03's one place for a harness without export, as opencode's does.

The format is confirmed against pi installed on the owner's machine where it is, else against pi's source at its latest release, as 04 and 05 did, the source named in the ticket's comments.

- [ ] Reader tests over a sample file: records, nulls where a count is absent, the reason for an unreadable line.
- [ ] Daemon process test: a project's pi sessions appear in `usage.get` and its level is 3, or the level its records allow with the reason.

## Comments
