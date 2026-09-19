# MCP and Skills Interface

## Goal

The developer should be able to work from Claude Code/Codex/etc. without repeatedly switching to a terminal or Dashboard.

MCP is the stable contract. Client-specific slash commands/skills are thin UX wrappers.

## Initial MCP surface

### Read-oriented

- `project.detect`
- `project.status`
- `project.snapshot`
- `daily.get`
- `task.get`
- `task.list`
- `task.plan`
- `run.current`
- `run.list`
- `question.list`
- `review.status`
- `usage.summary`
- `audit.project`

### Controlled mutations

- `question.create`
- `question.answer`
- `checkpoint.prepare`
- `checkpoint.commit`
- limited task metadata updates where the tracker adapter supports them

Do **not** expose autonomous `spawn_agents`, `merge_to_main`, `deploy_prod` in v1.

## Logical workflows / skills

Initial user-facing actions:

- `/product` — load Product role + compact current Product Snapshot;
- `/daily` — show delta since previous daily/checkpoint and attention items;
- `/task <id>` — load a compact task brief;
- `/status` — concise project/session/run status;
- `/checkpoint` — extract durable delta and propose persistence;
- `/audit` — read-only audit/adoption analysis.

Actual command syntax may differ across Claude Code, Codex, Gemini and other clients. The logical action remains the same.

## Skill design rule

Skills contain procedure, not project state.

Example `/daily` skill:

1. Detect project through Binnacle MCP.
2. Request daily delta.
3. Present changes and attention items.
4. Do not mutate project state unless explicitly asked.

## Direct specialized MCPs stay direct

Do not make Binnacle a proxy for every MCP:

- Serena remains directly available to coding agents;
- Context7 remains directly available;
- Graphify can be direct or adapter-backed depending on client/workflow.

Binnacle owns project/task/run state, not all tool calls.
