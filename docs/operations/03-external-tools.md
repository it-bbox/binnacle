# External Tools and Installation Profile

This document describes **recommended integrations**, not dependencies that must be embedded into Binnacle.

## What `binn init` installs

`binn init` installs the tools of the Standard setup that are executables (ADR-0035), in its one plan (ADR-0034), outside the repository, through a package manager only:

| Tool | Detected by | Prerequisite | Install command |
| --- | --- | --- | --- |
| Serena | `serena` on `PATH` | `uv` | `uv tool install -p 3.13 serena-agent` |
| Graphify | `graphify` on `PATH` | `uv` | `uv tool install graphifyy` |
| ast-grep | `ast-grep` on `PATH` (never `sg`) | `npm` | `npm i @ast-grep/cli -g` |

A tool already on `PATH` is reported as found and left alone. A tool the manifest declares `false` under `capabilities` is not proposed. A missing prerequisite is named with the command that installs it, and the tools that need it are left out of the plan: init never installs `uv` and never runs an installer script. Each install is reported in the Summary, and one that fails does not stop the rest. A manifest init creates declares `true` under `capabilities` for each tool it installs or finds. The table is `apps/cli/src/tools.ts`, which `binn audit` reads too.

### The skill plugins it installs

Matt Pocock Skills and Ponytail ship as Claude Code plugins. Init installs them through Claude Code's plugin CLI, at user scope, outside the repository, as it installs the `binnacle` plugin, in the same plan:

| Skill set | Capability | Detected by | Install commands | Every other harness, from |
| --- | --- | --- | --- | --- |
| Matt Pocock Skills | `matt_pocock_skills` | `claude plugin list --json` lists `mattpocock-skills@…` | `claude plugin install mattpocock-skills@claude-plugins-official --scope user` (Claude Code's official marketplace, nothing to add first) | `mattpocock/skills` |
| Ponytail | `ponytail` | `claude plugin list --json` lists `ponytail@…` | `claude plugin marketplace add DietrichGebert/ponytail --scope user`, then `claude plugin install ponytail@ponytail --scope user` | `DietrichGebert/ponytail` |

Claude Code is asked for its plugins once, for these and the `binnacle` plugin. A plugin it already lists, from any marketplace, is reported as found and left alone. A skill set declared `false` under `capabilities` is not proposed, to Claude Code or to any other harness. Without Claude Code detected, or without `claude` on `PATH`, no plugin is installed and the Summary says why. A manifest init creates declares `true` for a skill set it installs or finds. The conventions Matt Pocock Skills read, which `/setup-matt-pocock-skills` would write, init writes itself, each only where it is missing: `docs/agents/issue-tracker.md` for the tracker it detected, with the ticket header, `triage-labels.md`, `domain.md`, and the *Agent skills* block that points to them, in `AGENTS.md`, or in `CLAUDE.md` when only it exists (ADR-0042).

Every other harness gets both sets as Binnacle's own skills reach it (ADR-0039): when `binn` detected a harness, the plan runs, for each set, `npx skills add <repository> -g -y --json`, then `npx skills remove -g -a claude-code [--skip-harness ids] -s <each skill the add installed> -y`, since Claude Code keeps the plugin. The removal names the skills the add's JSON lists, so the plan shows them as a placeholder. An add is read by what it installed, not by its exit status alone: the `skills` CLI exits non-zero and calls every skill failed when one harness fails, such as PromptScript, which has no global install, while it installs them into the others, so `binn init` then asks `npx skills list -g --json`, removes the set's skills it shows in Claude Code, and the Summary names the reason the add gave for that harness. An add that installed nothing is recorded as failed, its removal is skipped, and the Summary says so. Without `npx` on `PATH` the commands are printed instead.

### The MCP servers it registers

After the installs, in the same plan, init registers each tool's MCP server with every harness it detected, through the harness's own CLI, outside the repository:

| Server | Starts with | Scope |
| --- | --- | --- |
| Serena | `serena start-mcp-server`, with the context Serena documents for the harness (`claude-code`, `codex`, `vscode`) and `--project-from-cwd` for the CLI harnesses | user |
| Context7 | `npx -y @upstash/context7-mcp` (needs `npm`) | user |
| Graphify | `uv run --no-project --with 'graphifyy[mcp]' python -m graphify.serve <project>/graphify-out/graph.json` | this project only |

| Harness | Registers with | Graphify's server |
| --- | --- | --- |
| Claude Code | `claude mcp add --scope user <name> -- <command>` | `claude mcp add --scope local …`, kept in `~/.claude.json` for this project |
| Codex | `codex mcp add <name> -- <command>`, into `~/.codex/config.toml` | printed: Codex keeps no per-project server outside the repository |
| VS Code | `code --add-mcp '{"name":…,"command":…,"args":[…]}'`, into the user profile | printed, for the same reason |
| opencode | printed: its `opencode mcp add` is an interactive wizard | printed |

A server already registered with a harness, in any file the audit reads for it (the repository's, and the user-scope ones of Claude Code, Codex and VS Code's default profile), is reported and left as it is. The one exception is Serena registered in Codex's user file (`~/.codex/config.toml`) with Claude Code's context (`--context=claude-code`): the plan registers it again with `--context=codex`, which `codex mcp add` writes over the old entry, and only on the owner's yes. The same entry in the repository's `.codex/config.toml` is the owner's: it is left alone, and the Summary names its context. A harness whose CLI is not on `PATH` gets the entry printed, and the Summary says so. A tool declared `false`, or left out for a missing prerequisite, gets no registration, nor does Graphify's server without `uv`, even with `graphify` found. Init writes no MCP entry for these tools into the repository. Graphify's server runs in its own environment with the `mcp` extra, so its install stays `graphifyy`.

### The first graph it builds

Last in the same plan, init builds the project's first graph, so that a project leaves `binn init` with one:

1. `graphify-out/`, Graphify's output directory, is appended to `.gitignore` (or `.gitignore` is created with it), under ADR-0026's append rule, unless Git already ignores `graphify-out/graph.json`; then `.gitignore` is not touched.
2. `graphify extract . --code-only --allow-dedup-shrink` runs in the repository root: Graphify's code-only extraction, local syntax trees, which needs no API key and calls no model (ADR-0012). It is the same command the daemon runs. `--allow-dedup-shrink` lets Graphify write a graph that its deduplication made smaller, which it otherwise refuses: the graph is a rebuildable projection (ADR-0036), so a smaller one after a merge is expected, not a loss.
3. After a successful extract, `graphify cluster-only . --no-label` builds Graphify's report, `graphify-out/GRAPH_REPORT.md`, which the vault's `90-Graphify` note is read from. The extract writes no report; `--no-label` keeps Graphify from calling a model to name the communities, so it too needs no API key. The daemon runs it after each extract as well.

All three are in the plan only when Graphify is on `PATH` or installed by the same plan, and `capabilities.graphify` is not `false`; Graphify left out for a missing `uv` gets none of them. The build and its report are skipped, and the Summary says why, if Git still does not ignore `graphify-out/` at that point, or if `graphify` is not on `PATH`, because its install failed or put it in a directory that is not. Each Graphify step is stopped after the daemon's ten-minute ceiling for one step. A failed build or report is reported in the Summary with the last line Graphify wrote to stderr, and the rest of the plan has run; a failed report keeps the graph the extract wrote; the daemon builds the graph at a later poll once the project is registered and `graphify` runs (*Graphify*, below).

## Node / pnpm

Project runtime baseline: Node.js 24 LTS. Use pnpm for workspace management.

## Matt Pocock Skills

Purpose: requirements/domain grilling, durable context/ADR generation, spec creation and ticket slicing.

Expected project flow:

`grill-with-docs → to-spec → to-tickets`

`binn init` writes the tracker and domain-doc layout these skills read, so `setup-matt-pocock-skills` is not needed.

Do not hardcode upstream implementation details into Binnacle; detect/configure via an adapter.

## Ponytail

Purpose: anti-overengineering/YAGNI coding policy. Keep it as a coding-policy capability rather than a guaranteed token optimizer.

Recommended default: `full`, configurable per project/role.

## Serena

Purpose: symbol-level semantic code retrieval/editing via language-server-based MCP tooling.

Binnacle should verify that Serena is available for supported clients/projects, but should not proxy all Serena operations.

## Graphify

Purpose: build/query a code/docs architecture knowledge graph; support impact/path queries and optional Obsidian export.

Current upstream package name is `graphifyy` (CLI `graphify`). Recommended installation uses `uv tool install graphifyy`, whose graphify (0.9.76 when this was written) accepts `--allow-dedup-shrink`; a graphify that does not know the flag skips it, as it skips any argument it does not know, so one that refuses a graph that shrinks fails that run with graphify's reason, as any failed run does. Its MCP server needs the `mcp` extra, which init's registration gets through `uv run --with 'graphifyy[mcp]'`.

Recommended project behavior:

- code graph is useful for cross-module architecture/impact;
- `.scratch/**` should normally be ignored;
- the daemon keeps the graph current (ADR-0036): once a minute it reads the commit of each registered project's default branch (`origin/HEAD`, or `main`), and when it has moved past the last run, it runs `graphify extract . --code-only --allow-dedup-shrink` in the background in the registered checkout — local syntax trees, no model, no network (ADR-0012) — and after a successful extract `graphify cluster-only . --no-label`, which builds `GRAPH_REPORT.md` with no model naming communities. A failed report is a failed run, with its reason, and the graph the extract wrote is kept. It runs only while that checkout is on the default branch, `capabilities.graphify` is not `false`, `graphify` is on the daemon's PATH and Git ignores `graphify-out/`; one run per project at a time, with at most one queued, so a burst of merges costs two runs. Each outcome is recorded as an event, and the snapshot's `graph` section and its attention items read it (`docs/03-mcp-and-skills.md`). A failed run keeps the last good graph and is retried at the next move of the default branch, not every minute;
- Obsidian export is optional;
- Graphify remains replaceable/optional at system architecture level.

## Context7

Purpose: retrieve current/version-specific external library/framework/API documentation. It should not be used for internal business logic.

The user may already have Context7 globally configured; init reads the harnesses' files first and registers it only with a harness that lacks it.

## ast-grep

Purpose: syntax-aware structural search/codemods, especially large mechanical changes where regex/text grep is unsafe.

## Obsidian

Purpose: human-facing Project Brain view, links, notes and Graphify canvas/export.

Obsidian is optional and must not be canonical required storage. `binn init` installs neither Obsidian nor a vault. The vault is named by `obsidian.vaultPath` in this machine's settings file, `~/.binnacle/settings.json`, outside every repository; `binn init` proposes it in its plan when Obsidian's own list on this machine holds exactly one vault, and otherwise says how to set it (`05-installation-checklist.md`, *Optional: Obsidian*).

The daemon's vault projection writes this layout (`05-installation-checklist.md`, *The vault projection*):

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

## OpenTelemetry

Use native OTel support from coding harnesses where available. Normalize only what is actually reported.

## Provider/harness support

Architecture must distinguish:

```text
harness: claude-code | codex | gemini-cli | other
provider: anthropic | openai | zai | google | local | other
model: nullable provider/model identifier
profile: user-defined launch/config profile
```

This allows the same harness to use different providers/profiles.
