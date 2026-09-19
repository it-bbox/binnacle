# Open Questions for Implementation Grilling

These are intentionally unresolved implementation details. They should be discussed with `grill-with-docs` rather than silently invented by the coding agent.

1. Daemon API transport: HTTP only, HTTP + local socket, or another minimal option?
2. MCP transport for local clients: stdio process vs daemon-backed Streamable HTTP vs both?
3. Exact event-journal strategy alongside SQLite: JSONL per project, global append-only log, or SQLite event table plus export?
4. First tracker adapter: GitHub first, GitLab first, or build both behind a small shared contract from day one?
5. First telemetry adapter order based on easiest validation environment: Claude Code, Codex, then Gemini?
6. Exact policy for Matt Pocock remote tracker vs local `.scratch` when `to-spec` publishes specs as issues.
7. Where to keep `roadmap` and durable specs in projects using remote issues without duplicating source of truth?
8. Minimal Product Snapshot token/size budget and truncation strategy.
9. Checkpoint commit UX: which changes can be deterministic vs require model-generated proposal + human approval?
10. How to correlate a session started outside `binn` with a Task without fragile inference?
11. Whether Dashboard needs authentication even on loopback in v1.
12. Cross-platform daemon/service installation for macOS/Linux/Windows.
13. Obsidian path mapping: per-machine user setting, never committed absolute path.
14. How much Graphify automation belongs in v1 vs manual `graphify --update` hooks.
15. How to surface context/compaction warnings consistently when providers expose different signals.
