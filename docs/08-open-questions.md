# Resolved Implementation Questions

These were the implementation details deliberately left open for `grill-with-docs`. All of them are now decided. This file is kept as an index: it records where each answer lives, so a future reader does not reopen a settled question by accident.

| # | Question | Answer | Recorded in |
| --- | --- | --- | --- |
| 1 | Daemon API transport | HTTP on loopback only, plus a token file with `0600` permissions and strict `Origin`/`Host` checking. No unix socket. | `docs/01-architecture.md` |
| 2 | MCP transport for local clients | Both: stdio for harnesses that spawn processes, Streamable HTTP from the daemon for those that do not. One tool implementation behind two entry points. | `docs/03-mcp-and-skills.md` |
| 3 | Event journal strategy | An events table in SQLite and nothing else. Export to JSONL is a CLI command when someone needs it. | ADR-0015 |
| 4 | First tracker adapter | One shared contract, GitHub and GitLab built behind it from the start, local Markdown as the fallback. Read-only in every case. | ADR-0013, ADR-0017 |
| 5 | Telemetry adapter order | Claude Code first, Codex second, Gemini CLI when it is nearly free. Support is graded, not binary. | ADR-0011, ADR-0014 |
| 6 | Matt Pocock specs vs `.scratch` | A spec is a committed document, a ticket is a tracker issue. `.scratch/` keeps only disposable material. | ADR-0017 |
| 7 | Roadmap and durable specs without duplication | The roadmap has one home: `docs/roadmap.md`, whatever the tracker. | ADR-0025, superseding ADR-0017 |
| 8 | Product Snapshot budget and truncation | Fixed sections with per-section item limits and a remainder count; the agent pulls detail on demand. Limits are configuration. No model-side compression. | ADR-0012, `docs/workflow/01-product-workflow.md` |
| 9 | Checkpoint commit UX | The delta is computed deterministically and returned as facts plus typed promotion candidates. Prose comes from the calling session; writes happen only after human confirmation. | ADR-0012 |
| 10 | Correlating a session started outside `binn` | `cwd` gives the project; the branch is recovered from the repository's own `git reflog` by timestamp; the branch maps to a task by naming convention, otherwise `unassigned`. | ADR-0018 |
| 11 | Dashboard authentication on loopback | The token is required on every API call, including the dashboard, with `Origin`/`Host` validation. No accounts. The dashboard is read-only in v1. | ADR-0016, `docs/04-telemetry-dashboard.md` |
| 12 | Cross-platform daemon installation | Linux, macOS and Windows all run natively; `binn daemon start` starts the daemon. Autostart at login, through the user's own service manager, is v1: `binn init` asks for it, and `binn daemon autostart on\|off` changes it later. | ADR-0016, ADR-0043 |
| 13 | Obsidian path mapping | A per-machine user setting. An absolute vault path is never committed to shared project configuration. | `docs/operations/05-installation-checklist.md` |
| 14 | Graphify automation in v1 | Superseded by ADR-0035 and ADR-0036 (2026-10-02): Graphify is part of the Standard setup, and the daemon updates the graph itself. Originally: detection and a staleness signal only. | ADR-0035, ADR-0036, ADR-0006, `docs/operations/03-external-tools.md` |
| 15 | Context and compaction warnings across providers | One normalised `context pressure` signal derived from whatever each harness exposes, carrying provenance. Thresholds are configuration. | ADR-0007, ADR-0014, `docs/04-telemetry-dashboard.md` |

## Decisions taken in the same session that were not on this list

| Topic | Answer | Recorded in |
| --- | --- | --- |
| Licence | Apache-2.0 | ADR-0010 |
| Product category name | AI Engineering Control Plane | `CONTEXT.md` |
| Primary telemetry source | Local session artifacts, with OpenTelemetry as an optional addition | ADR-0011 |
| Model invocation | Binnacle never calls a model | ADR-0012 |
| Tracker writes | None, ever | ADR-0013 |
| Adding a new harness | Built-in adapters only, plus a documented `binn ingest` format as an escape hatch | ADR-0014 |
| Local storage and migrations | `node:sqlite`, one database per machine, projections rebuilt and raw ingest migrated | ADR-0015 |
| Platform and distribution | Three platforms natively, delivered through npm | ADR-0016 |
| Tracker credentials | Read-only scope, never in `.binnacle/project.yaml` | ADR-0013, `docs/operations/04-security-resilience.md` |
| Historical import | `binn init` reports what it found and asks before importing | `docs/operations/01-new-project.md` |

## Reopening one of these

Change the ADR, not this table. An ADR that no longer holds is superseded by a new one; this file is an index and carries no authority of its own.
