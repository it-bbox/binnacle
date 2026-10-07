# 08: ZCode's sessions read from its files

Status: READY
Triage: ready-for-agent
Blocked by: 06
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** a reader for ZCode's sessions, built from ticket 06's sample; the `Harness` union gains `zcode`, and its provider and model are kept apart (ADR-0004) (spec, *New artifact readers*). Its level follows from what the files carry.

- [ ] Reader tests over ticket 06's sample.
- [ ] Daemon process test: a project's ZCode sessions appear as runs, with provider and model apart, and its level.

## Comments
