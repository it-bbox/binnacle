# 05: opencode's sessions read from its files

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** a reader for opencode's local message records gives a record per model call with its tokens; the `Harness` union gains `opencode`, and the daemon ingests a project's opencode sessions (spec, *New artifact readers*). opencode reaches level 3; it exports no OpenTelemetry, which its support reason and `binn init`'s Summary say.

- [ ] Reader tests over sample records: tokens mapped, nulls where absent, the reason for an unreadable record.
- [ ] Daemon process test: a project's opencode sessions appear in `usage.get` and its level is 3.

## Comments
