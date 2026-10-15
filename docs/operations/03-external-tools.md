# External Tools

_Русская версия: [03-external-tools.ru.md](03-external-tools.ru.md)._

Binnacle integrates these tools; it embeds none of them, and works without any of them ([Security and resilience](04-security-resilience.md#graceful-degradation)). `binn init` installs and registers them in its one plan, confirmed once (ADR-0034). This page says what it runs, and how to do the same by hand.

## The tools at a glance

| Tool | What it is for | How `binn init` sets it up |
| --- | --- | --- |
| Matt Pocock Skills | Grilling a plan, writing the spec, slicing it into tickets | Claude Code's plugin CLI; the `skills` CLI for other harnesses |
| Ponytail | A coding policy against over-engineering | Claude Code's plugin CLI; the `skills` CLI for other harnesses |
| Serena | Symbol-level code navigation and editing, over MCP | `uv tool install`, then its MCP server with each harness |
| Graphify | An architecture graph, for cross-module impact and paths | `uv tool install`, its MCP server for this project, the first graph |
| Context7 | Current docs of external libraries, frameworks and APIs | its MCP server with each harness; nothing to install |
| ast-grep | Syntax-aware structural search and codemods | `npm i -g` |
| Obsidian | A human-facing view of the project's knowledge | never installed; init sets the vault when Obsidian lists exactly one |

## What `binn init` installs

The tools that are executables are installed outside the repository, through a package manager only (ADR-0035):

| Tool | Detected by | Prerequisite | Install command |
| --- | --- | --- | --- |
| Serena | `serena` on `PATH` | `uv` | `uv tool install -p 3.13 serena-agent` |
| Graphify | `graphify` on `PATH` | `uv` | `uv tool install graphifyy` |
| ast-grep | `ast-grep` on `PATH` (never `sg`) | `npm` | `npm i @ast-grep/cli -g --allow-scripts=@ast-grep/cli` |

- A tool already on `PATH` is reported as found and left alone.
- A tool the manifest declares `false` under `capabilities` is not proposed.
- A missing prerequisite is named with the command that installs it, and the tools that need it are left out. Init never installs `uv` and never runs an installer script.
- Each install is reported in the Summary; one that fails does not stop the rest.
- A manifest init creates declares `true` under `capabilities` for each tool it installs or finds.

The table is `apps/cli/src/tools.ts`, which `binn audit` reads too.

### The skill plugins it installs

Matt Pocock Skills and Ponytail ship as Claude Code plugins. Init installs them through Claude Code's plugin CLI, at user scope, as it installs the `binnacle` plugin:

| Skill set | Capability | Detected by | Install commands |
| --- | --- | --- | --- |
| Matt Pocock Skills | `matt_pocock_skills` | `claude plugin list --json` lists `mattpocock-skills@…` | `claude plugin install mattpocock-skills@claude-plugins-official --scope user`, from Claude Code's official marketplace |
| Ponytail | `ponytail` | `claude plugin list --json` lists `ponytail@…` | `claude plugin marketplace add DietrichGebert/ponytail --scope user`, then `claude plugin install ponytail@ponytail --scope user` |

- Claude Code is asked for its plugins once, for these and the `binnacle` plugin.
- A plugin it already lists, from any marketplace, is reported as found and left alone.
- A skill set declared `false` under `capabilities` is proposed to no harness at all.
- Without Claude Code detected, or without `claude` on `PATH`, no plugin is installed, and the Summary says why.
- A manifest init creates declares `true` for a skill set it installs or finds.

Init also writes the conventions Matt Pocock Skills read, each only where it is missing, so `/setup-matt-pocock-skills` never needs to run (ADR-0042):

- `docs/agents/issue-tracker.md`, for the tracker it detected, with the ticket header;
- `docs/agents/triage-labels.md` and `docs/agents/domain.md`;
- the *Agent skills* block that points to them, in `AGENTS.md`, or in `CLAUDE.md` when only it exists.

### Into every other harness

Every other harness gets both sets as Binnacle's own skills reach it (ADR-0039), when `binn` detected one. For each set the plan runs:

1. `npx skills add <repository> -g -y --json`, from `mattpocock/skills` or `DietrichGebert/ponytail`;
2. `npx skills remove -g -a claude-code [<skipped harness ids>] -s <each skill the add installed> -y`, since Claude Code keeps the plugin.

The plan shows the removal's skills as a placeholder: they are the ones the add's JSON lists. Without `npx` on `PATH`, both commands are printed instead.

An add is read by what it installed, not by its exit status alone:

- The `skills` CLI exits non-zero when one harness fails, such as PromptScript, which has no global install, while it still installs into the others. Init then asks `npx skills list -g --json`, removes from Claude Code the set's skills it shows, and the Summary names the reason the add gave.
- An add that installed nothing is recorded as failed, its removal is skipped, and the Summary says so.

### The MCP servers it registers

After the installs, init registers each tool's MCP server with every harness it detected, through the harness's own CLI, outside the repository:

| Server | Starts with | Scope |
| --- | --- | --- |
| Serena | `serena start-mcp-server`, with Serena's context for the harness (`claude-code`, `codex`, `vscode`) and `--project-from-cwd` for the CLI harnesses | user |
| Context7 | `npx -y @upstash/context7-mcp` (needs `npm`) | user |
| Graphify | `uv run --no-project --with 'graphifyy[mcp]' python -m graphify.serve <project>/graphify-out/graph.json` | this project only |

| Harness | Registers with | Graphify's server |
| --- | --- | --- |
| Claude Code | `claude mcp add --scope user <name> -- <command>` | `claude mcp add --scope local …`, kept in `~/.claude.json` for this project |
| Codex | `codex mcp add <name> -- <command>`, into `~/.codex/config.toml` | printed: Codex keeps no per-project server outside the repository |
| VS Code | `code --add-mcp '{"name":…,"command":…,"args":[…]}'`, into the user profile | printed, for the same reason |
| opencode | printed: its `opencode mcp add` is an interactive wizard | printed |

- A server already registered with a harness is reported and left as it is. Init reads the repository's files and the user-scope ones of Claude Code, Codex and VS Code's default profile.
- One exception: Serena in Codex's user file (`~/.codex/config.toml`) with Claude Code's context (`--context=claude-code`). The plan registers it again with `--context=codex`, which `codex mcp add` writes over the old entry, on the owner's yes.
- The same entry in the repository's `.codex/config.toml` is the owner's: it is left alone, and the Summary names its context.
- A harness whose CLI is not on `PATH` gets the entry printed, and the Summary says so.
- A tool declared `false`, or left out for a missing prerequisite, gets no registration. Nor does Graphify's server without `uv`, even with `graphify` found.

Init writes no MCP entry for these tools into the repository. Graphify's server runs in an environment of its own with the `mcp` extra, so its install stays plain `graphifyy`.

### The first graph it builds

Last in the plan, init builds the project's first graph, so that a project leaves `binn init` with one:

1. `graphify-out/` is appended to `.gitignore`, or `.gitignore` is created with it (ADR-0026). When Git already ignores `graphify-out/graph.json`, `.gitignore` is not touched.
2. `graphify extract . --code-only --allow-dedup-shrink` runs in the repository root: code only, local syntax trees, no API key and no model (ADR-0012). `--allow-dedup-shrink` lets a graph that deduplication made smaller be written; the graph is a rebuildable projection (ADR-0036).
3. After a successful extract, `graphify cluster-only . --no-label` writes Graphify's report, `graphify-out/GRAPH_REPORT.md`. `--no-label` keeps it from calling a model to name the communities.

The daemon runs the same two commands later (*Graphify*, below). The steps are in the plan only when Graphify is on `PATH` or installed by the same plan, and `capabilities.graphify` is not `false`.

- The build and its report are skipped, and the Summary says why, if Git still does not ignore `graphify-out/` by then, or `graphify` is not on `PATH` after its install.
- Each step is stopped after the daemon's ten-minute ceiling for one step.
- A failed build or report is in the Summary with Graphify's last line of stderr, and the rest of the plan has run. A failed report keeps the graph the extract wrote.
- Once the project is registered and `graphify` runs, the daemon builds the graph at a later poll.

## Each tool

### Matt Pocock Skills

The project-design flow: `/grill-with-docs` → `/to-spec` → `/to-tickets`. Binnacle detects and configures the skills; it hardcodes none of their internals. The one exception is the convention files `binn init` writes, in the shape `/setup-matt-pocock-skills` writes them, so that the skills read them as their own (ADR-0042).

### Ponytail

A coding policy that keeps changes small: no speculative abstraction, the simplest thing that works. Treat it as a policy, not as a token optimizer. The recommended level is `full`.

### Serena

Symbol-level retrieval and editing through language servers, over MCP. Binnacle checks that Serena is there; it never proxies Serena's operations.

### Graphify

The upstream package is `graphifyy`; its command is `graphify`. Its graph serves cross-module architecture and impact questions, and its report becomes the vault's `90-Graphify` note. Graphify stays optional and replaceable.

`graphify` 0.9.76, current when this was written, accepts `--allow-dedup-shrink`. A version that does not know the flag skips it, as it skips any argument it does not know. Its MCP server needs the `mcp` extra, which init's registration gets through `uv run --with 'graphifyy[mcp]'`.

The daemon keeps the graph current (ADR-0036). Once a minute it reads the commit of each registered project's default branch, `origin/HEAD` or `main`. When the branch has moved past the last run, it runs the extract and then the report, as `binn init` does, in the background, in the registered checkout. It runs only while:

- that checkout is on the default branch;
- `capabilities.graphify` is not `false`;
- `graphify` is on the daemon's `PATH`;
- Git ignores `graphify-out/`.

One run per project goes at a time, with at most one queued, so a burst of merges costs two runs. Each outcome is recorded as an event, which the snapshot's `graph` section and its attention items read (`docs/03-mcp-and-skills.md`). A failed run, the report's included, keeps the last good graph and is retried at the next move of the branch, not every minute.

Keep generated and vendored directories out of the graph, such as:

```text
.scratch/
node_modules/
.nuxt/
.output/
dist/
coverage/
```

### Context7

Current, version-specific docs of external libraries, frameworks and APIs; never for the project's own logic. A user may already have it configured: init reads the harnesses' files first, and registers it only with a harness that lacks it. An API key, if you have one, is added to that entry by hand.

### ast-grep

Structural, syntax-aware search and codemods, for large mechanical changes where a text search is unsafe. It does not replace Serena's symbol navigation.

### Obsidian

A human-facing view of the project: links, notes and Graphify's report. It is optional, and never the canonical store. `binn init` installs neither Obsidian nor a vault.

The vault is `obsidian.vaultPath` in this machine's settings file, `~/.binnacle/settings.json`, outside every repository. `binn init` proposes it when Obsidian's own list on this machine holds exactly one vault, and otherwise says how to set it. The daemon then projects each project into the vault:

```text
Vault/
└── Projects/
    └── <Project>/
        ├── Product/       roadmap, last snapshot, last daily
        ├── Specs/
        ├── Decisions/
        ├── Research/
        └── 90-Graphify/   Graphify's report
```

The settings and the projection in full: [Installation checklist](05-installation-checklist.md#optional-obsidian), *Optional: Obsidian*.

### OpenTelemetry

Binnacle uses each harness's own OpenTelemetry export where it has one, and records only what the harness reports. `binn init` configures it: [Installation checklist](05-installation-checklist.md#telemetry-export), *Telemetry export*.

## Harness and provider

A harness is the coding client; a provider is the backend serving it the model. Binnacle keeps the harness, the provider, the model and the launch profile apart, so the same harness can run on several providers ([CONTEXT.md](../../CONTEXT.md)).

## By hand, without `binn init`

Upstream's own commands, current when this was written; installers change, so check each project's docs:

| Tool | Harness | Commands |
| --- | --- | --- |
| Matt Pocock Skills | Claude Code | `claude plugin install mattpocock-skills@claude-plugins-official` |
| Matt Pocock Skills | other harnesses | `npx skills@latest add mattpocock/skills` |
| Ponytail | Claude Code | `/plugin marketplace add DietrichGebert/ponytail`, then `/plugin install ponytail@ponytail` |
| Ponytail | Codex | `codex plugin marketplace add DietrichGebert/ponytail`, then `codex plugin add ponytail@ponytail` |
| Ponytail | Gemini CLI | `gemini extensions install https://github.com/DietrichGebert/ponytail` |
| Serena | any | `uv tool install -p 3.13 serena-agent`, then `serena init` |
| Graphify | any | `uv tool install graphifyy`, then `graphify install --project` for the assistant integrations |
| Context7 | any | the MCP server `@upstash/context7-mcp` |
| ast-grep | any | `npm i @ast-grep/cli -g --allow-scripts=@ast-grep/cli`; check with `ast-grep --help` |

An install in one harness does not cover another: each harness gets its own.
