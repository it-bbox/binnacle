# Baseline Architecture

The owner's baseline for v1, agreed with an architect before the project started and restored as the reference on 2026-10-02, after epics 1 to 7 were found to deliver only part of it. It is translated from the owner's Russian text without adding or removing scope.

**This is the floor for v1.** `docs/00-scope.md`, `docs/05-mvp-plan.md` and the roadmap implement it; where they say less, they are wrong and are corrected. No item here is moved to the roadmap's *Later* list without the owner's decision (the owner, 2026-10-02).

## What we build

A local AI Development Control Plane: a layer over the owner's existing projects and over Claude Code, Codex, GLM, Gemini and others.

It does not write code instead of agents, does not run an army of agents, and does not replace Git, GitHub or GitLab. Its jobs:

- keep and gather the current state of a project;
- give a new Product or Developer a fresh, compact context;
- account for tokens, cache, models, roles, tasks and spend;
- help use the Project Brain well;
- show all of it in a web UI;
- be reachable by agents through MCP plus skills and slash commands;
- not break a project when it is switched off or removed.

## The v1 core

```text
          ┌──────────────────────────┐
          │           CORE           │
          │ Projects                 │
          │ Tasks                    │
          │ AgentRuns                │
          │ Reviews                  │
          │ Events                   │
          │ Telemetry                │
          │ Product Snapshots        │
          │ Human approvals          │
          └────────────┬─────────────┘
         ┌─────────────┼──────────────┐
         ▼             ▼              ▼
        MCP          Web UI          CLI
         │
 ┌───────┼────────┐
 ▼       ▼        ▼
Claude  Codex   Gemini / GLM / ...
```

Installed once per machine: the local daemon (`binnd`), the CLI (`binn`) for setup, admin and debugging, the MCP server, which is the agents' main interface, and the web dashboard.

## What stays external

| Concern | Provided by |
| --- | --- |
| Code | Git repository |
| Task tracker | GitHub Issues / GitLab Issues |
| Documentation | Markdown in the repository |
| ADR | `docs/adr/` |
| Product and domain knowledge | `CONTEXT.md`, docs |
| Workflow | Matt Pocock Skills |
| Code navigation | Serena |
| Architecture graph | Graphify |
| Framework docs | Context7 |
| Structural code search | ast-grep |
| Human knowledge UI | Obsidian |
| Git hosting | GitHub / GitLab |
| Coding agents | Claude Code, Codex, GLM, Gemini, future ones |
| CI/CD | GitHub Actions, GitLab CI, an existing system |

Binnacle connects all of these and replaces none.

## Project Brain

```text
Durable knowledge: CONTEXT.md, docs/, docs/adr/, specs, roadmap
Live state:        GitHub/GitLab issues, dependencies, blockers, PR/MR, CI
Code intelligence: Serena, Graphify, Context7, ast-grep
Runtime:           AgentRuns, Questions / Answers, Reviews, Telemetry, Usage
```

Obsidian stays, as the human view of the Project Brain. Graphify stays, as a replaceable capability rather than the base of the whole system.

## Product

Product is a role, not a conversation: no month-long Product chats. In the morning a new chat runs `/product`, which reads a compact Product Snapshot through MCP — milestone, roadmap position, active tasks, overnight activity, blockers, questions, reviews, recent ADRs, Git and CI, usage, items needing attention — and understands the project without the old chat's history.

`/daily` adds what happened yesterday: what agents did overnight, which tasks finished, what is blocked, which questions wait for a decision, which reviews wait for the owner, and where to go next.

## Checkpoint instead of handoff

A Product session ends with `/checkpoint`, which saves only the delta into the canonical Project Brain and closes the conversation: a product decision goes to a spec, an architectural decision to an ADR, a new task or a priority change to the tracker, a roadmap decision to the roadmap, and chatter is discarded.

## Matt Pocock Skills and Ponytail

The workflow stays: idea, discussion, initial Markdown docs, `binn init`, Matt Pocock Skills set up, `grill-with-docs`, `to-spec`, `to-tickets`, Product, development. `binn init` does not replace Matt Pocock; it prepares the project and its integrations.

`binn init` installs or configures: Matt Pocock Skills, Ponytail, the Binnacle skills, the MCP configuration, Serena, Graphify, a Context7 check, an ast-grep check, and telemetry. Ponytail is a coding policy against over-engineering, not a guaranteed token optimiser; its effect is measured on the dashboard.

## `.scratch`

An ephemeral workspace of the current task only, for example `.scratch/<task>/` with the task, the current spec, questions, answers and run artifacts. It is not long-term memory, not the only tracker, not shared writable between worktrees, and may be deleted when the task closes. What matters is promoted before that into issues, specs, `CONTEXT.md` or ADRs.

## Task tracker

GitHub Issues or GitLab Issues for normal projects. Local Markdown stays supported for small or offline projects; new large projects are advised to use a remote tracker.

## Agent roles

Only Product and Developer are permanent. Architect, Reviewer, QA, Security, DevOps and Analyst are called when needed. Binnacle does not start them; it recommends, per task, for example:

```text
Developer: REQUIRED
Reviewer:  REQUIRED
QA:        RECOMMENDED
Architect: NOT NEEDED
Security:  NOT NEEDED
```

and the decision is the owner's.

## Automation

v1 is manual. Binnacle recommends whether to start a Developer or a Reviewer, whether work can run in parallel, whether an Architect is needed, and starts nobody by itself. Assisted and autonomous modes may come later; autonomous is not in v1. (ADR-0022's `/binnacle:autopilot`, started by the owner for one planned epic, is the one exception the owner later agreed.)

## Worktrees

Supported carefully: Product picks independent tasks, an impact and dependency analysis rates their conflict risk, and only low-risk ones run in parallel worktrees — at most two development tasks at first, then decided from real data.

## MCP and skills

The main UX: the owner should not keep going to a terminal from Claude or Codex. Base workflows: `/product`, `/daily`, `/task`, `/status`, `/checkpoint`, `/audit`. The slash syntax depends on the client; the logical operation is one. A skill calls MCP underneath, and skills hold no project state.

## Web UI

Only what is needed in v1: Overview; Projects; a Project with its Tasks, Agent Runs, Reviews, Usage and Attention. The dashboard shows what is running, what waits for the owner, Claude, Codex and GLM usage, tokens per task, cache, runs per task, rework, context growth, and the distribution by provider and model. No enterprise UI.

## Telemetry

Provider-agnostic: Claude Code, Codex, Gemini, GLM, future agents and local models are normalised into AgentRun telemetry. Only data that is really available is stored; a missing value, such as reasoning tokens, is `null`, never invented. Every number knows its origin: measured, provider-reported or estimated.

## Audit

Stays an important part. For an existing project: adopt, then `/audit`. The audit fixes nothing by itself. It checks Git, docs, ADR, Matt Pocock, `.scratch`, Serena, Graphify, the tracker, tests, CI, Docker, secrets, security basics, telemetry and project structure, and gives a migration plan.

## Git

A simple workflow: `main`, a task branch, a worktree. One task: issue, branch, worktree, Developer, review, CI, PR/MR, merge. No complex GitFlow without need.

## Not in v1

Autonomous agent orchestration; an own task tracker, Git, CI or observability platform; Kubernetes management; an SRE or incident subsystem; a full release subsystem; automatic model routing; automatic role spawning; LiteLLM integration; team or server mode; a complex AI optimisation advisor. These are integrations or future capabilities.

## The Standard setup

```text
Binnacle:      core, MCP, CLI, web dashboard, telemetry
Project Brain: docs / ADR / CONTEXT, GitHub/GitLab issues, Matt Pocock Skills, Ponytail,
               Serena, Graphify, Context7, ast-grep
Human view:    Obsidian
Agents:        Claude Code, Codex, GLM, Gemini, future and local ones
```

If Binnacle is removed, Git, source, docs, ADRs, `CONTEXT.md`, issues, specs and Matt Pocock artifacts remain, and development continues by hand. No lock-in, even to Binnacle itself.

## In one sentence

A local, provider-agnostic AI Development Control Plane that keeps project state outside chats, gives any fresh agent a compact current context, measures the cost and quality of agents' work, and helps the owner run the process — without taking control away from the owner and without becoming a required part of the project itself.
