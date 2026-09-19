# External References

Verified 2026-09-17. These links are references for implementation; upstream behavior may change and should be rechecked before hardcoding install/config details.

## Matt Pocock Skills

- Repository: https://github.com/mattpocock/skills
- Setup: https://github.com/mattpocock/skills/blob/main/docs/engineering/setup-matt-pocock-skills.md
- Grill with docs: https://github.com/mattpocock/skills/blob/main/docs/engineering/grill-with-docs.md
- To spec: https://github.com/mattpocock/skills/blob/main/docs/engineering/to-spec.md
- To tickets: https://github.com/mattpocock/skills/blob/main/docs/engineering/to-tickets.md

Important: current upstream docs explicitly position `grill-with-docs → to-spec → to-tickets` as the multi-session build chain, and setup configures tracker/domain-doc layout per repository.

## Ponytail

- Repository: https://github.com/DietrichGebert/ponytail
- Skill concept: simplest/laziest solution that actually works; configurable lite/full/ultra modes.

## Serena

- Repository: https://github.com/oraios/serena
- Serena describes itself as an MCP-based IDE for coding agents using semantic/symbol-level retrieval/editing via language servers.

## Graphify

- Repository: https://github.com/Graphify-Labs/graphify
- Docs: https://graphify.com/docs
- PyPI package name: `graphifyy`; CLI name: `graphify`.
- Supports queryable graph/MCP access and optional Obsidian export.

## Context7

- Repository: https://github.com/upstash/context7
- MCP package: `@upstash/context7-mcp`
- Intended use: current/version-specific external library/framework/API docs.

## Gemini CLI telemetry

- https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/telemetry.md

Gemini CLI documents native OpenTelemetry observability.

## Node.js

- Release status: https://nodejs.org/en/about/previous-releases
- Node 24 is Active LTS as of 2026-09-17; Node 26 is Current.

## ast-grep

- Quick start: https://ast-grep.github.io/guide/quick-start
- CLI package can be installed as `@ast-grep/cli`.

## Ponytail installation

- https://github.com/DietrichGebert/ponytail/blob/main/README.md

## Serena quick start

- https://github.com/oraios/serena/blob/main/README.md

## Provider telemetry

Before implementing a telemetry adapter, re-check the current official Claude Code and Codex telemetry documentation rather than relying on old event schemas.
