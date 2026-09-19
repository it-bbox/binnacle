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

It runs as a user process started by `binn daemon start`. Installing it as an auto-starting system service is out of v1 on all platforms (ADR-0016).

It is **not** the sole source of truth, and it never calls a language model (ADR-0012).

### `binn`
CLI for setup, diagnostics, scripting and recovery. Human-facing chat workflows should not require frequent CLI use after setup.

### MCP server
Primary agent-facing API. Exposes compact read operations and explicitly controlled write operations.

### Dashboard
Nuxt local UI. Displays project/task/run/usage/attention state. It does not replace conversation with Product.

### Local storage
`node:sqlite` from the Node standard library — no native modules. One database per machine under `~/.binnacle/`, overridable with `BINNACLE_HOME`; project directories hold `.binnacle/project.yaml` in Git and a disposable `.binnacle/cache/`.

Events live in a table in that same database; there is no second append-only file journal. Projections are rebuilt from durable project sources on schema change; ingested telemetry is migrated, never recreated (ADR-0015).

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

All tracker adapters are **read-only** (ADR-0013). Binnacle projects tracker state and never writes back to it.

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

Default daemon bind must be localhost only. Every API call carries a token read from a `0600` file under `~/.binnacle/`, and `Origin`/`Host` are validated — loopback alone is not an authentication boundary, because any browser tab can reach `127.0.0.1`.

Tracker credentials are requested with read-only scope and never live in `.binnacle/project.yaml`. No secrets are committed to project manifests. Content telemetry is opt-in; metadata-only is the default target mode.
