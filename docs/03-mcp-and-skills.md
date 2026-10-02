# MCP and Skills Interface

## Goal

The developer should be able to work from Claude Code/Codex/etc. without repeatedly switching to a terminal or Dashboard.

MCP is the stable contract. Client-specific slash commands/skills are thin UX wrappers.

## Initial MCP surface

### Read-oriented

- `project.detect`
- `project.status`
- `project.snapshot` (the tool `project_snapshot`: the Product Snapshot, including `next` — `action`, the roadmap's Next action, or `null` when the current focus does not end with one, and beside it `alternatives`, Binnacle's Suggested step (ADR-0032): a list of up to three, each with `kind` (`wait`, `parallel`, `resume`, `autopilot`, `byHand`, `owner`, `blocked`, `close`, `plan` or `finished`), `tasks`, the Task ids it names, `command` or `null`, an English `description` and provenance `calculated`, from the first of its eight rules that applies; a Task being worked on gives `wait`, then `parallel` when `tasks.parallel.free` is at least one and a Task is ready to start, and Tasks ready in the current epic give `autopilot` and `byHand`; `parallel` and `byHand` carry the ready Task's start command when exactly one is ready, and name several with none, so that no order is implied; a Task triaged `ready-for-human` is the owner's to do, so `parallel`, `autopilot` and `byHand` leave it out, and when every Task ready to start in the current epic is `ready-for-human`, one `owner` alternative names them with no command, while a Task with no triage counts as any other; an alternative whose command is the Next action's is left out, and none has a command under any `workflow.provider` but `matt-pocock`; `alternatives` is empty when no rule applies, and `available: false` with the tracker's reason when the Tasks cannot be read — and `activity`, the runs running now and recently; each Task in flight and ready to start carries `start`, the command that starts it; a `READY` Task with an attributed run is in flight, not ready to start, as the board reads it, and the daily's `readyToStart` leaves it out the same way; `tasks.parallel`, labelled `calculated`, gives how many Tasks may be worked on at once: `limit`, the manifest's `automation.max_parallel_development_tasks` or 2 where it writes none, as autopilot reads it, `inProgress`, every Task in flight, and `free`, `limit` less `inProgress` and never below zero; and `graph`, how fresh the Graphify graph the daemon keeps is (ADR-0036): `available`, whether there is a graph to use, with `reason` when not — `capabilities.graphify` declared `false`, `graphify` not on the daemon's PATH, or no `graphify-out/graph.json` built yet — `builtFrom`, the commit and time of the last successful run or `null`, `behind`, whether the default branch has moved past `builtFrom` (`null` when its commit cannot be read), and `lastRun`, the last run's `commit`, `at`, `outcome` (`built` or `failed`) and Graphify's `reason` when it failed, or `null` when none ran)
- `task.get` (the tool `task_get`: the Task brief, with the command that starts it and the Task's Review — on the local tracker the text under `### Review` inside the ticket's `## Comments`, cut at the body limit, or `null` when the ticket records none; not available on GitHub or GitLab, whose comments Binnacle never reads)
- `task.list` (the daemon's only, for the dashboard's board: an epic's Tasks, the current epic's unless a spec slug is given, each with its column, In progress read from runs where the ticket still says `READY`, its Unmet dependencies, whether its ticket records a Review (`null` on GitHub or GitLab), its start command and its latest run; `spec: null` gives a remote tracker's Tasks that carry no spec)
- `task.plan`
- `run.current`
- `run.list`
- `question.list`
- `review.status`
- `usage.get` (the tool `usage_get`: the project's token usage by Task and by role, with derived metrics labelled as Binnacle's calculations; or one Task's, with its runs)

### Controlled mutations

- `daily.get` (it records the baseline for the next daily)
- `question.create`
- `question.answer`
- `checkpoint.prepare`
- `checkpoint.record` (ADR-0020: it records the checkpoint; the calling session writes the files)

The snapshot's attention includes `next_action.missing`, `next_action.stale` and `review.missing`, which names each `DONE` Task on the local tracker whose ticket records no Review, `graph.update_failed`, whose message names the failed commit and Graphify's reason while the last good graph is kept, and `graph.not_ignored`, when Git does not ignore `graphify-out/` and the daemon therefore runs nothing; a missing `graphify` is the `graph` section's reason, never an attention item. The dashboard reads the same operations over the daemon's local API (ADR-0031), and adds no MCP tool.

The read-only audit is not an MCP tool: it is the CLI command `binn audit [path]` (`specs/audit-and-adopt/spec.md`), which needs no daemon, so an agent runs it as a command and reads `--json`. The skill `/audit` does exactly that and adds no tool and no daemon operation. It writes nothing; applying a recommendation is the human's, through `binn init`.

No tool writes to the tracker (ADR-0013). Closing an issue is done by the agent with its own tooling, or by the human in the tracker's own interface.

Do **not** expose autonomous `spawn_agents`, `merge_to_main`, `deploy_prod` in v1. `/autopilot` (ADR-0022) does not change this: it runs in the human's harness and uses the harness's own agents and Git, not Binnacle tools.

## Logical workflows / skills

Initial user-facing actions:

- `/product` — load Product role + compact current Product Snapshot;
- `/daily` — show delta since previous daily/checkpoint and attention items;
- `/task <id>` — load a compact task brief, ending with the command that starts the Task;
- `/status` — concise project/session/run status;
- `/checkpoint` — extract durable delta and propose persistence;
- `/audit [path]` — run `binn audit --json` on the current repository or a path and show its findings in the chat;
- `/autopilot` — finish one planned epic with an agent per ticket; started only by a human (ADR-0022). A ticket triaged `ready-for-human` is the owner's: autopilot starts no agent for it and lists it under *Waiting for the owner*.

Actual command syntax may differ across Claude Code, Codex, Gemini and other clients. The logical action remains the same.

In Claude Code the actions are served by a plugin named `binnacle` (ADR-0023), so each is namespaced: `/binnacle:product`, `/binnacle:daily`, `/binnacle:task`, `/binnacle:checkpoint`, `/binnacle:audit` and `/binnacle:autopilot`. Other projects get the plugin from the installed npm package (ADR-0027).

## How the interface reaches a harness

MCP is the universal path, and registering it is a config edit in a location each harness already defines — `~/.claude.json` or a project's `.mcp.json` for Claude Code, `[mcp_servers.*]` in `~/.codex/config.toml` or a trusted project's `.codex/config.toml` for Codex. `binn init` performs that registration as part of one plan of every write, shown whole and confirmed once (ADR-0034; Enter accepts it at a terminal, and without a terminal nothing is written), from one config template per known harness — Claude Code, Codex, opencode and VS Code to start with — and prints a generic stdio snippet for any other. Its Summary then suggests `binn audit` and, for each detected harness other than Claude Code, prints the next step for it, ending with the prompt that makes an agent read the Binnacle product skill file and follow it: skills install into Claude Code alone, and no skill format for another harness exists. Supporting another harness is adding a template. This is support level 1 from ADR-0014, and it requires no adapter code.

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
