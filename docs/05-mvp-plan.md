# MVP Implementation Plan

## Guiding rule

Build only enough to validate the central claim:

> Externalized project state + fresh snapshots + task isolation + telemetry improves controllability and can reduce waste compared with long chat-centric workflows.

What a phase below lists is its floor. Planning an epic may add to it and never cuts it (the owner, 2026-09-26, while grilling epic 5).

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

- GitHub and GitLab adapters behind the Task-reading contract from phase 2, both read-only (ADR-0013). Each reads the ticket header from the issue body (ADR-0024), from a repository and host declared in the manifest, on every call;
- the daily delta's Task transitions on a remote tracker, from the Task states recorded with each `daily` and `checkpoint` event;
- the compact task brief, `task_get` and `/binnacle:task`, including the branch name that maps to the Task (ADR-0018);
- `binn init`, which writes only after confirmation (ADR-0026): manifest generation, harness detection, MCP registration from one config template per known harness and a generic snippet for any other, the `binnacle` plugin from the npm package (ADR-0027), detection of the Matt Pocock layout with an offer to add the ticket-header convention to `docs/agents/issue-tracker.md`, and reading a repository's agent instructions as one set (a `CLAUDE.md` that imports `AGENTS.md` is one, not two).

The roadmap stays in `docs/roadmap.md` on every tracker (ADR-0025). Parent and subtask relations are not part of the tracker contract. The former `.scratch` materialization item is dropped: the task brief arrives over MCP, and `.scratch` hygiene is checked by the audit in phase 6.

Tracker credentials use read-only scope: a fine-grained token with Issues read access on GitHub, `read_api` on GitLab. They are taken from the environment or from `~/.binnacle/credentials.json` with `0600` permissions, one per host. Tokens from `gh` or `glab` are not imported, because they can usually write.

Adapters are tested live, against GitHub and GitLab test projects holding fixed issues, by a separate `pnpm test:live` that needs read-only tokens. `pnpm test` stays offline.

Exit criterion: remote issue task can be represented as a Binnacle Task and compact task brief.

## Phase 4 — Telemetry

Implement:

- normalized usage schema;
- session-artifact readers, Claude Code first, then Codex (ADR-0011);
- historical import driven by a question `binn init` gains in this phase;
- run-to-task correlation from `cwd` and the branch — the checkout's `git reflog`, and no branch where it has no answer (ADR-0018, ADR-0029, ADR-0030);
- provenance tagging.

OpenTelemetry, the optional live path (ADR-0011), is deferred: see the roadmap's Later list.

Exit criterion: the Product Snapshot and MCP attribute usage to runs and Tasks for supported paths, and each harness reports the support level it actually reached (ADR-0014). The dashboard that draws this is phase 5. Specified in `specs/telemetry/spec.md`.

## Phase 5 — Minimal Dashboard

Nuxt pages, read-only, served by the daemon at its own address (ADR-0031):

- Overview — the main screen. It answers where each project stands and what to type next: its roadmap position, the Next action with its command, Binnacle's Suggested step beside it (ADR-0032), what is running now, the Tasks ready to start with the command that starts each, attention, and usage today and this week;
- Projects;
- Project detail, with a mini kanban of its Tasks: Backlog, Ready, In progress, Done. In progress includes a `READY` Task with AgentRuns attributed to it, and each card names who works on it: harness, model, role and latest activity;
- Task detail, with its Review, read from the ticket's `### Review` section;
- Usage, with derived metrics labelled as Binnacle's calculations: tokens per completed Task, runs per Task, weekly trend;
- Attention/current activity.

Every view element in `docs/04-telemetry-dashboard.md` appears. An element with no source yet says so, and why, as the snapshot does: questions and answers, and review and rework usage. A page's only action is copying a command; the human types it. A `DONE` ticket without a Review is an attention item. `/binnacle:task` ends with the command that starts its Task, the same one the dashboard shows.

No decorative enterprise functionality.

Exit criterion: on the owner's running daemon, the owner takes the next step from the dashboard alone, without asking an agent what to type. The Task it starts moves to In progress, naming who works on it, and then to Done. The Usage page's figures equal `usage_get`'s for the same window, and every element without a source says why.

## Phase 6 — Audit/adopt

The code ships in v1. Running it against a large third-party repository is post-v1 activity — see `docs/00-scope.md`.

Implement read-only audit covering:

- Git/tracker;
- docs/ADR/CONTEXT;
- Matt Pocock layout;
- `.scratch` risks: not ignored by Git, or holding the only copy of something durable;
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
