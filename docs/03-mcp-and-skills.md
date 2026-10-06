# MCP and Skills Interface

## Goal

The developer should be able to work from Claude Code/Codex/etc. without repeatedly switching to a terminal or Dashboard.

MCP is the stable contract. Client-specific slash commands/skills are thin UX wrappers.

## Initial MCP surface

### Read-oriented

- `project.detect`
- `project.status`
- `project.snapshot` (the tool `project_snapshot`: the Product Snapshot, including `next` — `action`, the roadmap's Next action, or `null` when the current focus does not end with one, and beside it `alternatives`, Binnacle's Suggested step (ADR-0032): a list of up to three, each with `kind` (`wait`, `parallel`, `resume`, `autopilot`, `byHand`, `owner`, `blocked`, `close`, `plan` or `finished`), `tasks`, the Task ids it names, `command` or `null`, an English `description` and provenance `calculated`, from the first of its eight rules that applies; a Task being worked on gives `wait`, then `parallel` when `tasks.parallel.free` is at least one and a Task is ready to start — and, when `tasks.parallel.impact` is available, only for a Task whose conflict risk with every Task in flight is `low`; without a graph the limit alone decides — and Tasks ready in the current epic give `autopilot` and `byHand`; `parallel` and `byHand` carry the ready Task's start command when exactly one is ready, and name several with none, so that no order is implied; a Task triaged `ready-for-human` is the owner's to do, so `parallel`, `autopilot` and `byHand` leave it out, and when every Task ready to start in the current epic is `ready-for-human`, one `owner` alternative names them with no command, while a Task with no triage counts as any other; an alternative whose command is the Next action's is left out, and none has a command under any `workflow.provider` but `matt-pocock`; `alternatives` is empty when no rule applies, and `available: false` with the tracker's reason when the Tasks cannot be read — and `activity`, the runs running now and recently; each Task in flight and ready to start carries `start`, the command that starts it; a `READY` Task with an attributed run is in flight, not ready to start, as the board reads it, and the daily's `readyToStart` leaves it out the same way; `tasks.parallel`, labelled `calculated`, gives how many Tasks may be worked on at once: `limit`, the manifest's `automation.max_parallel_development_tasks` or 2 where it writes none, as autopilot reads it, `inProgress`, every Task in flight, and `free`, `limit` less `inProgress` and never below zero, and `impact`, the conflict risk between every Task in flight and ready to start, read against the graph: `available: false` with the `graph` section's reason when there is no graph, or with `graphify-out/graph.json cannot be read as a graph`, and otherwise `tasks`, each Task's `id`, its `modules` (files of the graph) and `from`, `branch` when its branch (the one `task.get` names) has changed files since it left the default branch, read from that diff, or `ticket`, the modules its title and body name by path or by file name, and `pairs`, each pair's `tasks`, `risk` — `high` when they share a module, which `modules` names, `medium` when a module of one is a neighbour of a module of the other in the graph (one edge apart), which `modules` names, `low` otherwise, and `unknown` when either touches no module of the graph, never `low` — and `reason`; `impact`, each Task and each pair are labelled `calculated`; and `graph`, how fresh the Graphify graph the daemon keeps is (ADR-0036): `available`, whether there is a graph to use, with `reason` when not — `capabilities.graphify` declared `false`, `graphify` not on the daemon's PATH, or no `graphify-out/graph.json` built yet — `builtFrom`, the commit and time of the last successful run or `null`, `behind`, whether the default branch has moved past `builtFrom` (`null` when its commit cannot be read), and `lastRun`, the last run's `commit`, `at`, `outcome` (`built` or `failed`) and Graphify's `reason` when it failed, or `null` when none ran)
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

With an Obsidian vault set on this machine, serving `project.snapshot` or `daily.get` also writes its note into the vault's Product folder, outside every repository (`operations/05-installation-checklist.md`, *The vault projection*).

The snapshot's attention includes `next_action.missing`, `next_action.stale` and `review.missing`, which names each `DONE` Task on the local tracker whose ticket records no Review, `graph.update_failed`, whose message names the failed commit and Graphify's reason while the last good graph is kept, and `graph.not_ignored`, when Git does not ignore `graphify-out/` and the daemon therefore runs nothing; a missing `graphify` is the `graph` section's reason, never an attention item. `vault.unwritable` names an Obsidian vault set in the Binnacle home's `settings.json` that does not exist or cannot be written; with no vault set there is none (`docs/operations/05-installation-checklist.md`, *The vault projection*). The dashboard reads the same operations over the daemon's local API (ADR-0031), and adds no MCP tool.

The read-only audit is not an MCP tool: it is the CLI command `binn audit [path]` (`specs/audit-and-adopt/spec.md`), which needs no daemon, so an agent runs it as a command and reads `--json`. The skill `/audit` does exactly that and adds no tool and no daemon operation. It writes nothing; applying a recommendation is the human's, through `binn init`.

No tool writes to the tracker (ADR-0013). Closing an issue is done by the agent with its own tooling, or by the human in the tracker's own interface.

Do **not** expose autonomous `spawn_agents`, `merge_to_main`, `deploy_prod` in v1. `/autopilot` (ADR-0022) does not change this: it runs in the human's harness and uses the harness's own agents and Git, not Binnacle tools.

## Logical workflows / skills

Initial user-facing actions:

- `/product` — load Product role + compact current Product Snapshot;
- `/daily` — show delta since previous daily/checkpoint and attention items;
- `/task <id>` — load a compact task brief, ending with the command that starts the Task;
- `/status` — concise project and session status from `project_status` alone: the project, the manifest's tracker, this session's checkout (the registered one, or a linked worktree, said plainly) with its branch, commit and dirty state, and the diagnostics; the roadmap, Tasks and usage stay with `/product`;
- `/checkpoint` — extract durable delta and propose persistence;
- `/audit [path]` — run `binn audit --json` on the current repository or a path and show its findings in the chat;
- `/init [path]` — run `binn init --plan --json` on the current repository or a path, show the whole plan in the chat and ask once; only the human's yes runs `binn init --apply <id>`, a changed plan is shown and asked again, and it never commits (ADR-0037);
- `/daemon [start|stop|status]` — run `binn daemon <action>`, `status` by default, and show what it printed, with the log tail of a failed start;
- `/register [path]` — run `binn project register` on a path, or else on the main checkout (the first path `git worktree list` prints), saying when that is not the session's checkout;
- `/dashboard` — run `binn dashboard`, which opens the dashboard in the browser, already authorised, and prints its address, which carries no token; answer that the dashboard opened at that address, and that if no browser appeared, `binn dashboard --print` at a terminal gives what to open there, never pasted into the chat; it never runs `binn dashboard --print`, because a skill's shell output reaches the model's provider and the token authorises the daemon's local API (ADR-0031);
- `/autopilot` — finish one planned epic with an agent per ticket; started only by a human (ADR-0022). A ticket triaged `ready-for-human` is the owner's: autopilot starts no agent for it and lists it under *Waiting for the owner*. Only tickets at low conflict risk run side by side: before starting a ticket beside one in flight, it reads `tasks.parallel.impact` from the snapshot and starts it only when the pair is `low`; a `medium`, `high` or `unknown` pair runs one after the other, and it says which pair and why; with `impact` not available, the parallel limit alone decides, and it says the risk was not assessed.
- `/help` — a plain guide to working with Binnacle, in the language the user writes in: what Binnacle is, each skill of the plugin with when to use it, grouped as setting up, a day's work and planning, and the usual order of a day (`/product`, the work, `/checkpoint`); it calls no tool, runs no command and needs no daemon.

The skills reach a harness through one of two channels, from one text per skill (ADR-0039). The text names no harness's mechanism: it says to ask the human, to start a background agent in a worktree of its own, or to open a new session, and takes what depends on the harness from `binn`'s output.

- **Claude Code** serves them as a plugin named `binnacle` (ADR-0023), so each is namespaced: `/binnacle:product`, `/binnacle:daily`, `/binnacle:task`, `/binnacle:status`, `/binnacle:checkpoint`, `/binnacle:audit`, `/binnacle:init`, `/binnacle:daemon`, `/binnacle:register`, `/binnacle:dashboard`, `/binnacle:autopilot` and `/binnacle:help`. Other projects get the plugin from the installed npm package (ADR-0027).
- **Every other harness** the `skills` CLI (skills.sh) detects, such as Codex, Antigravity, ZCode or Pi, gets the package's copy of the same skills, named `binnacle-<action>`: `binnacle-product`, `binnacle-daily`, `binnacle-task`, `binnacle-status`, `binnacle-checkpoint`, `binnacle-audit`, `binnacle-init`, `binnacle-daemon`, `binnacle-register`, `binnacle-dashboard`, `binnacle-autopilot` and `binnacle-help`. The package's build writes the copy from the plugin, renaming each skill and rewriting every `/binnacle:<action>` in the text, so a skill names the others the way the harness reading it does, and gives each the plugin's version under `metadata`. `binn init` installs it at user scope with `npx skills add <the copy> -g -y`, then takes it back out of Claude Code, which has the plugin, with `npx skills remove -g -a claude-code`, and out of each harness named with `--skip-harness`; running `binn init` again after installing another harness adds it. `binn audit` reports a copy in `~/.agents/skills` at another version than the package's as `capabilities.binnacle_skills`, and `binn init`'s plan reinstalls it.

Where a harness cannot start a background agent in a worktree of its own, `binnacle-autopilot` refuses at its first step and changes nothing, and the epic's tickets are run by hand; it sends a push notification only where the harness can.

`/audit`, `/init`, `/daemon`, `/register` and `/dashboard` need no daemon: they run `binn` in the harness's shell, not an MCP tool, so they can be started while the daemon is stopped. `/register` and `/dashboard` then fail with `binn`'s message and name `/daemon start`. `/init` then leaves registration out of its plan, and says that `/daemon start` then `/register` adds it, as `/daemon start` names `/register` for a project not registered yet. When `/init` created `.mcp.json`, it ends by saying to open a new session in the repository and approve the project's `binnacle` server, since Claude Code reads `.mcp.json` only when a session starts. Where `/product`, `/daily`, `/task`, `/status`, `/checkpoint` and `/autopilot` meet `daemon.unreachable` or `project.not_registered`, they name `/binnacle:daemon start` or `/binnacle:register` beside the `binn` command.

## How the interface reaches a harness

MCP is the universal path, and registering it is a config edit in a location each harness already defines — `~/.claude.json` or a project's `.mcp.json` for Claude Code, `[mcp_servers.*]` in `~/.codex/config.toml` or a trusted project's `.codex/config.toml` for Codex. `binn init` performs that registration as part of one plan of every write, shown whole and confirmed once (ADR-0034; Enter accepts it at a terminal, and without a terminal nothing is written; from a chat, `binn init --plan --json` prints the plan with its id, and after the human's yes in the chat `binn init --apply <id>` writes that plan and no other, exiting 3 with `init.plan_changed` when the plan is no longer the one shown, ADR-0037), from one config template per known harness — Claude Code, Codex, opencode and VS Code to start with — and prints a generic stdio snippet for any other. Its Summary then suggests `binn audit`, names the harnesses the `skills` CLI installed Binnacle's skills into, and, for each detected harness other than Claude Code, says to run `binnacle-product` there. Supporting another harness's MCP registration is adding a template; a harness without one reaches the tools through `binn call`, below. This is support level 1 from ADR-0014, and it requires no adapter code.

Command wrappers are generated from a single procedure description per action, so supporting a new harness means adding an output template, not new logic. A harness with no wrapper mechanism still works: the human asks for the tool by name.

Both MCP transports are served — stdio for harnesses that spawn processes, Streamable HTTP from the daemon for those that prefer an endpoint. The tool implementations behind them are the same.

A harness with a shell and no Binnacle MCP server — one without MCP, or one whose `binnacle` server is not registered yet — reaches the same tools through `binn call <tool> [json]` (ADR-0039). It reads the same tool table and makes the same daemon call as `binn mcp`, so a tool exists in both or in neither, and it answers for the project containing the working directory. The arguments, if the tool takes any, are one JSON object, such as `binn call task_get '{"id":"<task id>"}'`, checked against the tool's schema as the MCP server checks them, and a tool that takes none is called with none. It prints what the tool returns as JSON on stdout and exits 0; the daemon's error envelope, the same the tool returns, on stdout with exit 3, or with exit 4 when it is `daemon.unreachable`; and an unknown tool, or arguments that are not JSON or that the tool does not take, as a message on stderr with exit 2. `binn call --help` lists the tools and their arguments. Each skill that calls a tool — `/product`, `/daily`, `/task`, `/status`, `/checkpoint` and `/autopilot` — says once to call the `binnacle` MCP tool and, where the session has none, to run `binn call` with the same arguments in the shell and read its JSON.

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
