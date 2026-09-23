# MVP Implementation Plan

## Guiding rule

Build only enough to validate the central claim:

> Externalized project state + fresh snapshots + task isolation + telemetry improves controllability and can reduce waste compared with long chat-centric workflows.

## Phase 1 — Core and persistence

Implement:

- monorepo skeleton;
- local daemon as a user process;
- `node:sqlite` store, one database per machine under `~/.binnacle/`;
- project registry;
- event model;
- `Project`, `Task`, `AgentRun`, `Review` entities;
- `.binnacle/project.yaml` parser;
- basic Git adapter.

Exit criterion: one local project can be registered and queried.

## Phase 2 — MCP + Product Snapshot

Implement:

- MCP server, stdio first, on the official SDK (ADR-0021);
- project detect/status, including linked worktrees;
- the Task-reading half of the tracker contract, and the local Markdown tracker as its first adapter;
- Product Snapshot generator;
- daily delta;
- checkpoint prepare/record workflow (ADR-0020);
- minimal client skill wrappers for the first supported harness.

The MCP server is registered by hand in this epic: this repository commits a project-scoped `.mcp.json`. `binn init` does it for other projects in phase 3.

Exit criterion: a brand-new Product chat can run `/product` + `/daily` and understand project state without old conversation history.

## Phase 3 — Tracker + Matt Pocock integration

Implement:

- the rest of the shared tracker contract, extending the Task-reading half phase 2 defined before its first adapter;
- GitHub and GitLab adapters behind it, both read-only (ADR-0013);
- `binn init`: manifest generation, harness detection, MCP registration, and reading a repository's agent instructions as one set (a `CLAUDE.md` that imports `AGENTS.md` is one, not two);
- detection of Matt Pocock config/layout;
- task/dependency mapping;
- `.scratch` materialization policy.

Tracker credentials use read-only scope, taken from the environment or `~/.binnacle/credentials.json` with `0600` permissions. Where `gh` or `glab` is already installed, `binn init` may offer to import a token from it once; neither becomes a dependency.

Exit criterion: remote issue task can be represented as a Binnacle Task and compact task brief.

## Phase 4 — Telemetry

Implement:

- normalized usage schema;
- session-artifact readers, Claude Code first, then Codex (ADR-0011);
- historical import driven by the question `binn init` asks;
- run-to-task correlation from `cwd` and `git reflog` (ADR-0018);
- provenance tagging;
- OpenTelemetry as an optional additional path.

Exit criterion: dashboard can attribute usage to runs/tasks for supported paths, and each harness reports the support level it actually reached (ADR-0014).

## Phase 5 — Minimal Dashboard

Nuxt pages:

- Overview;
- Projects;
- Project detail;
- Task detail;
- Usage;
- Attention/current activity.

No decorative enterprise functionality.

## Phase 6 — Audit/adopt

The code ships in v1. Running it against a large third-party repository is post-v1 activity — see `docs/00-scope.md`.

Implement read-only audit covering:

- Git/tracker;
- docs/ADR/CONTEXT;
- Matt Pocock layout;
- `.scratch` risks;
- Serena/Graphify/Context7 availability;
- agent instructions (`AGENTS.md`, `CLAUDE.md`), read as one set when one imports the other;
- basic test/CI/project structure;
- telemetry readiness.

Output migration recommendations, not automatic fixes.

## Phase 7 — Optional capabilities after measurement

Only after real data:

- Graphify deeper integration;
- Obsidian export automation;
- worktree parallelism recommendations;
- advanced optimization rules;
- additional providers/harness adapters.

## Explicit stop conditions

Do not add autonomous agent orchestration, Release/SRE platform, Kubernetes management, multi-user server mode or auto model routing during MVP implementation.
