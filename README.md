# Binnacle

_Русская версия: [README.ru.md](README.ru.md)._

**Binnacle** is a local, provider-agnostic control plane for AI-assisted development. It keeps project state **outside chat sessions**, hands fresh agents a compact and current context, collects spend telemetry, and leaves the human in charge of the process.

> A binnacle is the stand that holds a ship's compass in front of the helm. It does not steer and it does not pick the course — it keeps the instruments where the helmsman can read them. That is the whole design brief.

## The problem

Modern AI development hits a ceiling in context management, not only in model quality:

- long Product sessions grow and become expensive;
- compaction loses or distorts details;
- every new Claude/Codex/GLM/Gemini re-explores the project from scratch;
- different agents re-read the same files;
- it is hard to see where tokens, cache, tool calls and rework went;
- switching models means carrying context over by hand;
- parallel agents without dependency control cause merge conflicts and duplicated work.

The Control Plane moves project state into durable sources: Git, Markdown documentation, ADRs, the tracker, and a local reconstructable event/telemetry layer. A chat becomes temporary working context, not the project's memory.

## Core principle

> **Project knowledge and task state belong to the project — not to a particular model, chat or coding harness.**

Claude Code, Codex, GLM, Gemini and future/local agents are replaceable executors.

## In scope for v1

- local daemon `binnd`;
- CLI `binn`;
- local MCP server;
- small Nuxt web dashboard;
- project registry;
- Project / Task / AgentRun / Review entities;
- Product Snapshot and Daily Snapshot;
- checkpoint instead of conversation handoff;
- telemetry ingestion from supported coding agents;
- GitHub/GitLab tracker adapters plus a local markdown fallback;
- audit/adopt for an existing project;
- integration with Matt Pocock Skills;
- integration with Ponytail;
- Serena, Graphify, Context7 and ast-grep as context/coding capabilities;
- Obsidian as a human-facing projection of the Project Brain;
- manual-first execution: the system recommends, the human launches.

## Out of scope for v1

- an autonomous "virtual company" of agents;
- automatic launching of Architect/QA/Security/Reviewer;
- automatic model routing;
- our own Git/task tracker/CI;
- a Kubernetes/SRE/incident platform;
- a full Release Captain subsystem;
- LiteLLM as a mandatory gateway;
- team/server mode;
- a complex AI optimization advisor;
- a hard dependency of the project on Binnacle.

## Stack

- **TypeScript** — all of our own application code;
- **Node.js 24 LTS** — runtime baseline;
- **pnpm** — package manager / workspace;
- **Nuxt** — web dashboard;
- local SQLite DB — projection/cache for v1;
- MCP — agent-facing API;
- OpenTelemetry — primary telemetry transport where supported;
- Markdown/YAML/JSON — portable formats for project knowledge/config.

Python/Go/Rust are not used in our own core. External tools may ship their own runtime (Serena/Graphify, for example); Binnacle only integrates them.

## Target repository layout

```text
binnacle/
├── apps/
│   ├── daemon/
│   ├── dashboard/
│   └── cli/
├── packages/
│   ├── core/
│   ├── mcp/
│   ├── telemetry/
│   └── adapters/
├── docs/
├── templates/
├── AGENTS.md
├── CLAUDE.md
└── CONTEXT.md
```

## New project: the short path

```text
idea / discussion
    ↓
initial Markdown docs
    ↓
binn init
    ↓
setup Matt Pocock Skills
    ↓
grill-with-docs
    ↓
to-spec
    ↓
to-tickets
    ↓
/product
    ↓
/task <id>
    ↓
Developer → Review → Merge
```

## Existing project: the short path

```text
binn adopt .
    ↓
/audit
    ↓
review migration plan
    ↓
normalize knowledge/tracker/telemetry
    ↓
/product
```

## Documentation

Read in this order:

1. `docs/00-scope.md`
2. `docs/01-architecture.md`
3. `docs/02-project-brain.md`
4. `docs/workflow/01-product-workflow.md`
5. `docs/workflow/02-development-workflow.md`
6. `docs/03-mcp-and-skills.md`
7. `docs/04-telemetry-dashboard.md`
8. `docs/05-mvp-plan.md`

Current architectural decisions are recorded in `docs/adr/`.
