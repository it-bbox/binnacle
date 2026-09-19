# MVP Implementation Plan

## Guiding rule

Build only enough to validate the central claim:

> Externalized project state + fresh snapshots + task isolation + telemetry improves controllability and can reduce waste compared with long chat-centric workflows.

## Phase 1 — Core and persistence

Implement:

- monorepo skeleton;
- local daemon;
- SQLite projection store;
- project registry;
- event model;
- `Project`, `Task`, `AgentRun`, `Review` entities;
- `.devcontrol/project.yaml` parser;
- basic Git adapter.

Exit criterion: one local project can be registered and queried.

## Phase 2 — MCP + Product Snapshot

Implement:

- MCP server;
- project detect/status;
- Product Snapshot generator;
- daily delta;
- checkpoint prepare/commit workflow;
- minimal client skill wrappers for the first supported harness.

Exit criterion: a brand-new Product chat can run `/product` + `/daily` and understand project state without old conversation history.

## Phase 3 — Tracker + Matt Pocock integration

Implement:

- GitHub tracker adapter first (or GitLab first if chosen as implementation target);
- local markdown fallback;
- detection of Matt Pocock config/layout;
- task/dependency mapping;
- `.scratch` materialization policy.

Exit criterion: remote issue task can be represented as a Binnacle Task and compact task brief.

## Phase 4 — Telemetry

Implement:

- normalized usage schema;
- first native OTel adapter(s);
- historical import adapter where practical;
- run-to-task correlation when launched through Binnacle;
- provenance tagging.

Exit criterion: dashboard can attribute usage to runs/tasks for supported paths.

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

Implement read-only audit covering:

- Git/tracker;
- docs/ADR/CONTEXT;
- Matt Pocock layout;
- `.scratch` risks;
- Serena/Graphify/Context7 availability;
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
