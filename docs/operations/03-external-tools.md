# External Tools and Installation Profile

This document describes **recommended integrations**, not dependencies that must be embedded into Binnacle.

## What `binn init` installs

`binn init` installs the tools of the Standard setup that are executables (ADR-0035), in its one plan (ADR-0034), outside the repository, through a package manager only:

| Tool | Detected by | Prerequisite | Install command |
| --- | --- | --- | --- |
| Serena | `serena` on `PATH` | `uv` | `uv tool install -p 3.13 serena-agent` |
| Graphify | `graphify` on `PATH` | `uv` | `uv tool install graphifyy` |
| ast-grep | `ast-grep` on `PATH` (never `sg`) | `npm` | `npm i @ast-grep/cli -g` |

A tool already on `PATH` is reported as found and left alone. A tool the manifest declares `false` under `capabilities` is not proposed. A missing prerequisite is named with the command that installs it, and the tools that need it are left out of the plan: init never installs `uv` and never runs an installer script. Each install is reported in the Summary, and one that fails does not stop the rest. A manifest init creates declares `true` under `capabilities` for each tool it installs or finds. The table is `apps/cli/src/tools.ts`, which `binn audit` reads too; the skill plugins come with the next tickets of epic 8.

### The MCP servers it registers

After the installs, in the same plan, init registers each tool's MCP server with every harness it detected, through the harness's own CLI, outside the repository:

| Server | Starts with | Scope |
| --- | --- | --- |
| Serena | `serena start-mcp-server`, with the harness's context and `--project-from-cwd` | user |
| Context7 | `npx -y @upstash/context7-mcp` (needs `npm`) | user |
| Graphify | `uv run --no-project --with 'graphifyy[mcp]' python -m graphify.serve <project>/graphify-out/graph.json` | this project only |

| Harness | Registers with | Graphify's server |
| --- | --- | --- |
| Claude Code | `claude mcp add --scope user <name> -- <command>` | `claude mcp add --scope local …`, kept in `~/.claude.json` for this project |
| Codex | `codex mcp add <name> -- <command>`, into `~/.codex/config.toml` | printed: Codex keeps no per-project server outside the repository |
| VS Code | `code --add-mcp '{"name":…,"command":…,"args":[…]}'`, into the user profile | printed, for the same reason |
| opencode | printed: its `opencode mcp add` is an interactive wizard | printed |

A server already registered with a harness, in any file the audit reads for it (the repository's, and the user-scope ones of Claude Code, Codex and VS Code's default profile), is reported and left as it is. A harness whose CLI is not on `PATH` gets the entry printed, and the Summary says so. A tool declared `false`, or left out for a missing prerequisite, gets no registration. Init writes no MCP entry for these tools into the repository. Graphify's server runs in its own environment with the `mcp` extra, so its install stays `graphifyy`.

## Node / pnpm

Project runtime baseline: Node.js 24 LTS. Use pnpm for workspace management.

## Matt Pocock Skills

Purpose: requirements/domain grilling, durable context/ADR generation, spec creation and ticket slicing.

Expected project flow:

`grill-with-docs → to-spec → to-tickets`

Run `setup-matt-pocock-skills` once per repository so tracker/domain-doc layout is explicit.

Do not hardcode upstream implementation details into Binnacle; detect/configure via an adapter.

## Ponytail

Purpose: anti-overengineering/YAGNI coding policy. Keep it as a coding-policy capability rather than a guaranteed token optimizer.

Recommended default: `full`, configurable per project/role.

## Serena

Purpose: symbol-level semantic code retrieval/editing via language-server-based MCP tooling.

Binnacle should verify that Serena is available for supported clients/projects, but should not proxy all Serena operations.

## Graphify

Purpose: build/query a code/docs architecture knowledge graph; support impact/path queries and optional Obsidian export.

Current upstream package name is `graphifyy` (CLI `graphify`). Recommended installation uses `uv tool install graphifyy`; its MCP server needs the `mcp` extra, which init's registration gets through `uv run --with 'graphifyy[mcp]'`.

Recommended project behavior:

- code graph is useful for cross-module architecture/impact;
- `.scratch/**` should normally be ignored;
- the daemon keeps the graph current (ADR-0036): once a minute it reads the commit of each registered project's default branch (`origin/HEAD`, or `main`), and when it has moved past the last run, it runs `graphify extract . --code-only` in the background in the registered checkout — local syntax trees, no model, no network (ADR-0012). It runs only while that checkout is on the default branch, `capabilities.graphify` is not `false`, `graphify` is on the daemon's PATH and Git ignores `graphify-out/`; one run per project at a time, with at most one queued, so a burst of merges costs two runs. Each outcome is recorded as an event, and the snapshot's `graph` section and its attention items read it (`docs/03-mcp-and-skills.md`). A failed run keeps the last good graph and is retried at the next move of the default branch, not every minute;
- Obsidian export is optional;
- Graphify remains replaceable/optional at system architecture level.

## Context7

Purpose: retrieve current/version-specific external library/framework/API documentation. It should not be used for internal business logic.

The user may already have Context7 globally configured; init reads the harnesses' files first and registers it only with a harness that lacks it.

## ast-grep

Purpose: syntax-aware structural search/codemods, especially large mechanical changes where regex/text grep is unsafe.

## Obsidian

Purpose: human-facing Project Brain view, links, notes and Graphify canvas/export.

Obsidian is optional and must not be canonical required storage.

Suggested layout:

```text
Vault/
└── Projects/
    └── <Project>/
        ├── Product/
        ├── Architecture/
        ├── Decisions/
        ├── Research/
        └── 90-Graphify/
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
