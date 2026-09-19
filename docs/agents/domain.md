# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root: the canonical glossary.
- **`docs/adr/`**: read the ADRs that touch the area you're about to work in.

`AGENTS.md` additionally requires reading `docs/00-scope.md` and `docs/01-architecture.md` before architectural changes.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This repo is **single-context**: one glossary and one ADR directory at the root.

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── ADR-0001-local-control-plane.md
│   └── ADR-0002-canonical-sources.md
├── apps/
└── packages/
```

If it ever splits into per-package contexts, a root `CONTEXT-MAP.md` would point at one `CONTEXT.md` per context — re-run `/setup-matt-pocock-skills` to switch.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (telemetry truthfulness), but worth reopening because…_
