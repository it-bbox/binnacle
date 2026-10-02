# External Tools and Installation Profile

This document describes **recommended integrations**, not dependencies that must be embedded into Binnacle.

## What `binn init` installs

`binn init` installs the tools of the Standard setup that are executables (ADR-0035), in its one plan (ADR-0034), outside the repository, through a package manager only:

| Tool | Detected by | Prerequisite | Install command |
| --- | --- | --- | --- |
| Serena | `serena` on `PATH` | `uv` | `uv tool install -p 3.13 serena-agent` |
| Graphify | `graphify` on `PATH` | `uv` | `uv tool install graphifyy` |
| ast-grep | `ast-grep` on `PATH` (never `sg`) | `npm` | `npm i @ast-grep/cli -g` |

A tool already on `PATH` is reported as found and left alone. A tool the manifest declares `false` under `capabilities` is not proposed. A missing prerequisite is named with the command that installs it, and the tools that need it are left out of the plan: init never installs `uv` and never runs an installer script. Each install is reported in the Summary, and one that fails does not stop the rest. A manifest init creates declares `true` under `capabilities` for each tool it installs or finds. The table is `apps/cli/src/tools.ts`, which `binn audit` reads too; MCP registration and the skill plugins come with the next tickets of epic 8.

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

Current upstream package name is `graphifyy` (CLI `graphify`). Recommended installation uses `uv tool install graphifyy`; install `graphifyy[mcp]` if a separate Graphify MCP server is desired.

Recommended project behavior:

- code graph is useful for cross-module architecture/impact;
- `.scratch/**` should normally be ignored;
- update graph incrementally after structural changes;
- Obsidian export is optional;
- Graphify remains replaceable/optional at system architecture level.

## Context7

Purpose: retrieve current/version-specific external library/framework/API documentation. It should not be used for internal business logic.

The user may already have Context7 globally configured; init should detect before proposing installation.

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
