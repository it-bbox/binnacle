# 07: Antigravity's sessions read from its files

Status: READY
Triage: ready-for-agent
Blocked by: 06
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** a reader for Antigravity's sessions, built from ticket 06's sample, attributes them to the project and gives what they carry; the `Harness` union gains `antigravity` (spec, *New artifact readers*). Without per-call tokens it reaches level 2 and its reason says so.

- [ ] Reader tests over ticket 06's sample: records with what the sample carries, nulls for the rest.
- [ ] Daemon process test: a project's Antigravity sessions appear as runs, with its level and reason.

## Comments
