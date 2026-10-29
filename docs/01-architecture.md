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

It is started by `binn daemon start`, and at login by the user's own service manager once autostart is on: `binn init` asks for it, and `binn daemon autostart on|off` changes it later (ADR-0043, narrowing ADR-0016). It is never a system-wide service.

It is **not** the sole source of truth, and it never calls a language model (ADR-0012).

It computes most of an answer when it is asked, so that work is kept small: a Task list's branches are mapped to its Tasks once, not per run or record looked up, and every branch's tip is read with one `git` call. What it reads from a forge, CI and a GitHub or GitLab tracker's Tasks, it keeps for a minute, a failed read being read again on the next call: every poll of every page would otherwise wait on the network.

### `binn`
CLI for setup, diagnostics, scripting and recovery. Human-facing chat workflows should not require frequent CLI use after setup.

### MCP server
Primary agent-facing API. Exposes compact read operations and explicitly controlled write operations.

### Dashboard
Nuxt local UI. Displays project/task/run/usage/attention state. It does not replace conversation with Product.

The daemon serves it at its own address as static files, and `binn dashboard` opens it (ADR-0031). It is read-only: its only action is copying a command, which the human types.

It polls the daemon every 15 seconds while it is visible: the selected project's snapshot and the open page's own operations each time, the other registered projects' snapshots once a minute, or each time on the pages that list them all (`docs/04-telemetry-dashboard.md`).

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

That default stays `127.0.0.1`. The user may set `BINNACLE_HOST`, the address the daemon binds, `127.0.0.1` or `0.0.0.0` inside a container, and `BINNACLE_ALLOWED_HOSTS`, the `Host` values it accepts beyond its own address, such as a port published to the host; both are read when the daemon starts. The token and the routes that need it do not change; an `Origin`, when sent, must name an accepted address (ADR-0048).

The daemon receives OpenTelemetry at `/v1/logs`, `/v1/metrics` and `/v1/traces` without a token, as an exporter sends it, and from a loopback peer only, whatever the bind: OTLP JSON over HTTP, of which it keeps only the calls' metadata and token counts. It also serves the dashboard's generated files on every other path outside `/health` and `/ops/`, without a token. Those files hold no project data, the `Host` check covers them, and no path outside their directory is ever served. The page receives the token through the URL fragment that `binn dashboard` opens, keeps it in the browser's storage, and sends it like any other client (ADR-0031).

Tracker credentials are requested with read-only scope and never live in `.binnacle/project.yaml`. No secrets are committed to project manifests. Content telemetry is opt-in; metadata-only is the default target mode.
