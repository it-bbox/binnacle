# 01: Claude Code usage in the snapshot

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/telemetry/spec.md`

**What to build:** the tracer bullet. The daemon reads the main Claude Code sessions of a registered project, keeps their token counts in a new append-only table, and the Product Snapshot's `usage` section shows real totals instead of "Not available". `/binnacle:product` presents it. Decided in the spec, under *Workspace*, *Where the artifacts are*, *Normalised record*, *Ingest*, *Totals* and *Snapshot `usage` section*.

- [ ] `packages/telemetry` holds the normalised record and totals types, provenance, and the pure summing; `packages/adapters` holds a pure Claude Code reader from lines and a start position to records, the position it stopped at, and any failure.
- [ ] The daemon's runtime carries the Claude Code artifact root: `$CLAUDE_CONFIG_DIR/projects`, otherwise `~/.claude/projects`.
- [ ] Candidate directories are those whose name starts with the one derived from a registered project's path; each record's own `cwd` decides, and a record in no registered project is never stored.
- [ ] One message is one record, keyed by its message id: the repeats Claude Code writes per content block are counted once.
- [ ] Token fields map as the spec lists, each `provider_reported`, `null` when not reported; reasoning is a subset of output and is never added to it. Provider is `null`.
- [ ] No content, tool input or output is read into a record; a fixture carries a content field and the test proves it never reaches the store.
- [ ] The ingested-record table is tier 2 (ADR-0015): created if missing, never dropped, unique on harness and natural key, so re-inserting is a no-op. A cursor per file commits in the same transaction as its records, and a call reads only what is new.
- [ ] Records older than the window are skipped; the window is `telemetry.import.window_days`, 90 when unwritten. (`all` and widening are ticket 06.)
- [ ] Every `project.snapshot` call runs the ingest for its project before answering.
- [ ] The `usage` section carries `importing` with the window's start date, `today` and `last7Days` totals in the daemon's local time zone, `byModel` with the section limit and remainder, and `harnesses` with Claude Code's level: 3, 2, 1, or absent with a reason. `tasks` and `unassigned` are unavailable until ticket 02.
- [ ] A total's field is `null` when no record reports it, and `partial` when some do.
- [ ] The write-guarantee test runs with artifacts present and also checks the artifact directories are unchanged.
- [ ] The `product` skill presents the usage section in a few lines.
- [ ] Fixtures are cut from a real session, and the ticket's comments say which.
