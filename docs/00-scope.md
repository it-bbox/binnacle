# Scope and Product Boundary

## Product statement

Binnacle is a local, provider-agnostic AI Engineering Control Plane that keeps project state outside chats, provides compact current context to fresh agents, measures AI development usage, and keeps humans in control of execution.

## Core principle

> **Project knowledge and task state belong to the project — not to a particular model, chat or coding harness.**

Claude Code, Codex, GLM, Gemini and future/local agents are replaceable executors.

## Problems in scope

Modern AI development hits a ceiling in context management, not only in model quality:

- long Product sessions grow and become expensive;
- compaction loses or distorts details;
- every new Claude/Codex/GLM/Gemini re-explores the project from scratch;
- different agents re-read the same files;
- it is hard to see where tokens, cache, tool calls and rework went;
- switching models means carrying context over by hand;
- parallel agents without dependency control cause merge conflicts and duplicated work.

The Control Plane moves project state into durable sources: Git, Markdown documentation, ADRs, the tracker, and a local reconstructable event/telemetry layer. A chat becomes temporary working context, not the project's memory.

### Context continuity
Fresh Product/Developer agents should understand current project state without inheriting a weeks-long conversation.

### Token/usage visibility
Usage should be attributable where possible to Project → Task → AgentRun → Role → Harness/Provider/Model.

### Project knowledge routing
Agents should know where to look instead of repeatedly scanning large repositories.

### Workflow observability
The user should always know what is running, what is waiting, what requires attention, and how much it consumed.

### Existing-project adoption
A project should be auditable and adoptable without destructive migration.

## The baseline

`docs/baseline.md` is the owner's baseline architecture and the floor for v1. Where this file or `docs/05-mvp-plan.md` says less, the baseline wins (the owner, 2026-10-02).

## In scope for v1

- local daemon `binnd`;
- CLI `binn`;
- local MCP server;
- small Nuxt web dashboard;
- project registry;
- Project / Task / AgentRun / Review entities;
- Product Snapshot and Daily Snapshot;
- checkpoint instead of conversation handoff;
- telemetry ingestion from coding agents, read from the session artifacts they already write to disk, and received from the OpenTelemetry of those that export it;
- read-only GitHub/GitLab tracker adapters plus a local markdown fallback;
- audit/adopt for an existing project;
- integration with Matt Pocock Skills;
- integration with Ponytail;
- Serena, Graphify, Context7 and ast-grep as context/coding capabilities;
- Obsidian as a human-facing projection of the Project Brain;
- manual-first execution: the system recommends, the human launches. Binnacle never calls a model itself.

## Explicit non-goals for v1

- autonomous project management;
- automatic hiring/spawning of role agents, except `/autopilot`: started by a human, for one already planned epic (ADR-0022);
- automatic model selection/routing;
- replacement of GitHub/GitLab Issues;
- replacement of Git, CI/CD, deployment platforms or observability backends;
- production SRE/incident platform;
- Kubernetes management;
- multi-user/team SaaS;
- central cloud service;
- universal equal-cost normalization across providers;
- Obsidian or Graphify as a dependency of Binnacle's core: both are part of the Standard setup and installed by `binn init`, but the core works without them (ADR-0035);
- building our own vector DB/RAG stack;
- a full Release Captain subsystem;
- LiteLLM as a mandatory gateway;
- a complex AI optimization advisor;
- a hard dependency of the project on Binnacle.

## Success criteria

V1 is successful if it can demonstrate on a real existing project that:

1. a fresh Product session can resume work from a compact generated snapshot;
2. tasks/runs/reviews are visible without reading old chats;
3. usage can be analyzed per project/task/run with source quality marked;
4. long Product-session context can be rotated safely;
5. existing Git/docs/issues remain sufficient to continue work if Binnacle is unavailable;
6. the system can compare baseline vs optimized workflow using real data.

## Validation

Binnacle is built by being used on itself. The `binnacle` repository is project number one from Phase 1 onward, and the workflow claims above are tested there first.

Adopting an existing large third-party repository as a baseline case is **post-v1 activity**. It is what the product is for, not what building it depends on. When it happens, historical sessions may be imported at project level even where exact task attribution cannot be established.
