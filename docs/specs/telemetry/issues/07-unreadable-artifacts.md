# 07: Unreadable artifacts are loud

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/telemetry/spec.md`

**What to build:** a harness format change shows up as an attention item and a lower support level, never as wrong numbers. Decided in the spec, under *Ingest* and *Snapshot `usage` section*.

- [ ] A line missing a field the reader needs stops that file at that line: the cursor stays before it and earlier records stay. An unknown extra field is ignored.
- [ ] `telemetry.unreadable` names the harness, file and line, and is cleared by a later successful read of that file.
- [ ] The harness's level drops to 1 in `harnesses` while any of its files is unreadable.
- [ ] Tests through the daemon seam for a Claude Code line with no usage where one is required, and, once ticket 05 has landed, a decreasing Codex total.
