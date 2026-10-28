# Project Brain

Project Brain is a **logical composition**, not a single database.

## Layer 1 — Durable knowledge

Stored in repository:

- `CONTEXT.md` — canonical project vocabulary/domain context;
- `docs/product/` — durable product docs;
- `docs/architecture/` — architecture descriptions;
- `docs/adr/` — hard-to-reverse decisions/trade-offs;
- `docs/specs/<slug>/spec.md` — durable specs (ADR-0017);
- the roadmap, in exactly one place: `docs/roadmap.md`, whatever the tracker (ADR-0025).

## Layer 2 — Live project state

Prefer remote tracker for serious projects:

- GitHub Issues or GitLab Issues/work items;
- task status;
- priority;
- parent/subtask relation;
- blocking dependencies;
- backlog;
- PR/MR and CI state via adapters.

Local Markdown tracker remains a supported fallback.

## Layer 3 — Runtime execution state

Binnacle stores/projects:

- AgentRun history;
- role/provider/model/profile;
- questions/answers;
- review cycles;
- current worktree/branch association;
- telemetry/usage;
- checkpoints and attention events.

## Layer 4 — Code intelligence

- Serena — symbol-level semantic navigation/editing;
- Graphify — architecture/dependency knowledge graph;
- Context7 — current external library/API documentation;
- ast-grep — structural code search/refactoring.

## Layer 5 — Human view

Obsidian is optional and recommended for the owner/operator. It may show/project:

- docs and ADR links;
- architecture notes;
- Graphify export/canvas;
- research and cross-project knowledge.

Obsidian is not canonical storage for required project state.

## Knowledge promotion rule

Temporary execution knowledge must be promoted before scratch cleanup when it matters long-term:

```text
Question/answer → if durable product rule → spec/product docs
Question/answer → if architectural trade-off → ADR
New work discovered → tracker task
Vocabulary clarified → CONTEXT.md
Trap that already cost time → one line in AGENTS.md, else CLAUDE.md
Temporary investigation → discard
```

## Scratch rule

`.scratch` is a disposable task/run workspace. Never rely on it as the only copy of durable state.
