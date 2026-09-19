# Claude Code Instructions

Read and obey `AGENTS.md` first. This file only adds Claude-specific workflow guidance.

## Project operating model

- Do not treat conversation history as project memory.
- For Product work, request/use a fresh Product Snapshot from Binnacle rather than relying on a long-lived chat.
- Prefer fresh sessions for distinct implementation tickets.
- Use `/checkpoint` (once implemented) to persist only durable session delta before rotating a long Product session.
- Do not spawn subagents unless the user explicitly approved that execution plan or the current task policy explicitly allows it.

## Codebase navigation

1. Serena for symbols/references/editing.
2. Graphify for architecture/impact questions.
3. Context7 for version-specific external docs.
4. ast-grep for structural patterns.
5. Broad grep/full-file reads only when the above are insufficient or local implementation context is necessary.

## Coding policy

Use Ponytail principles: the simplest solution that meets the requirement, minimum new surface area, no speculative abstraction.

## Matt Pocock Skills

The intended multi-session build chain is:

`/grill-with-docs → /to-spec → /to-tickets → implementation/review`

Do not advance from a grilling answer into implementation unless explicitly instructed.

## Agent skills

### Issue tracker

Specs and issues live as markdown files in Git under `docs/specs/<slug>/`, not in `.scratch/`. See `docs/agents/issue-tracker.md` and `docs/adr/ADR-0017-specs-in-git-tickets-in-tracker.md`.

### Triage labels

The five canonical triage roles, used verbatim as label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
