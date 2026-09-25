# MCP and Skills Interface

## Goal

The developer should be able to work from Claude Code/Codex/etc. without repeatedly switching to a terminal or Dashboard.

MCP is the stable contract. Client-specific slash commands/skills are thin UX wrappers.

## Initial MCP surface

### Read-oriented

- `project.detect`
- `project.status`
- `project.snapshot`
- `task.get`
- `task.list`
- `task.plan`
- `run.current`
- `run.list`
- `question.list`
- `review.status`
- `usage.get` (the tool `usage_get`: the project's token usage by Task and by role, or one Task's with its runs)
- `audit.project`

### Controlled mutations

- `daily.get` (it records the baseline for the next daily)
- `question.create`
- `question.answer`
- `checkpoint.prepare`
- `checkpoint.record` (ADR-0020: it records the checkpoint; the calling session writes the files)

No tool writes to the tracker (ADR-0013). Closing an issue is done by the agent with its own tooling, or by the human in the tracker's own interface.

Do **not** expose autonomous `spawn_agents`, `merge_to_main`, `deploy_prod` in v1. `/autopilot` (ADR-0022) does not change this: it runs in the human's harness and uses the harness's own agents and Git, not Binnacle tools.

## Logical workflows / skills

Initial user-facing actions:

- `/product` — load Product role + compact current Product Snapshot;
- `/daily` — show delta since previous daily/checkpoint and attention items;
- `/task <id>` — load a compact task brief;
- `/status` — concise project/session/run status;
- `/checkpoint` — extract durable delta and propose persistence;
- `/audit` — read-only audit/adoption analysis;
- `/autopilot` — finish one planned epic with an agent per ticket; started only by a human (ADR-0022).

Actual command syntax may differ across Claude Code, Codex, Gemini and other clients. The logical action remains the same.

In Claude Code the actions are served by a plugin named `binnacle` (ADR-0023), so each is namespaced: `/binnacle:product`, `/binnacle:daily`, `/binnacle:task`, `/binnacle:checkpoint` and `/binnacle:autopilot`. Other projects get the plugin from the installed npm package (ADR-0027).

## How the interface reaches a harness

MCP is the universal path, and registering it is a config edit in a location each harness already defines — `~/.claude.json` or a project's `.mcp.json` for Claude Code, `[mcp_servers.*]` in `~/.codex/config.toml` or a trusted project's `.codex/config.toml` for Codex. `binn init` performs that registration, after confirmation (ADR-0026), from one config template per known harness — Claude Code, Codex, opencode and VS Code to start with — and prints a generic stdio snippet for any other. Supporting another harness is adding a template. This is support level 1 from ADR-0014, and it requires no adapter code.

Command wrappers are generated from a single procedure description per action, so supporting a new harness means adding an output template, not new logic. A harness with no wrapper mechanism still works: the human asks for the tool by name.

Both MCP transports are served — stdio for harnesses that spawn processes, Streamable HTTP from the daemon for those that prefer an endpoint. The tool implementations behind them are the same.

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
