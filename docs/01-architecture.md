# Architecture

## High-level view

```text
                 CANONICAL PROJECT SOURCES
          Git / docs / ADR / specs / tracker
                         │
                         ▼
                ┌──────────────────┐
                │ DEV CONTROL CORE │
                │                  │
                │ Project          │
                │ Task             │
                │ AgentRun         │
                │ Review           │
                │ Events           │
                │ Snapshots        │
                │ Telemetry        │
                └───────┬──────────┘
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
         MCP           Web UI          CLI
          │
  Claude / Codex / Gemini / GLM / future agents
```

## Runtime components

### `binnd`
Single local daemon. Owns orchestration of local state projections, adapters, telemetry ingestion/query, snapshot generation and the local API.

It is **not** the sole source of truth.

### `binn`
CLI for setup, diagnostics, scripting and recovery. Human-facing chat workflows should not require frequent CLI use after setup.

### MCP server
Primary agent-facing API. Exposes compact read operations and explicitly controlled write operations.

### Dashboard
Nuxt local UI. Displays project/task/run/usage/attention state. It does not replace conversation with Product.

### Local storage
SQLite for local projection/query convenience plus append-only event journal where useful. It must be possible to rebuild useful state from durable project sources and telemetry/event history.

## Core vs adapters

### Kernel

- Project
- Task
- AgentRun
- Review
- Event
- Snapshot
- Telemetry record
- Human approval/policy

### Adapters

- GitHub tracker
- GitLab tracker
- Local Markdown tracker
- Claude telemetry
- Codex telemetry
- Gemini telemetry
- generic log/usage adapter
- Matt Pocock layout
- Graphify
- Git

## Failure model

If Binnacle stops:

- source code remains in Git;
- project docs/ADR/specs remain readable;
- tracker state remains in GitHub/GitLab (or local markdown fallback);
- normal Claude Code/Codex workflow remains usable;
- no production application depends on Binnacle.

This is a hard architectural requirement.

## Security boundary

Default daemon bind must be localhost only. No secrets are committed to project manifests. Content telemetry is opt-in; metadata-only is the default target mode.
