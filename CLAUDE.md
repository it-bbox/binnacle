@AGENTS.md

# Claude Code Instructions

`AGENTS.md`, imported above, is the instruction file every agent reads, and it binds here in full. This file only adds Claude-specific workflow guidance.

## Project operating model

- Do not treat conversation history as project memory.
- For Product work, request/use a fresh Product Snapshot from Binnacle rather than relying on a long-lived chat.
- Prefer fresh sessions for distinct implementation tickets.
- An implementation session starts by branching `feat/<slug>` from an up-to-date `main`, and never commits a ticket to `main`. Its last commit sets the ticket's `Status:` to `DONE` and moves the roadmap's current focus if the frontier moved.
- Use `/checkpoint` (once implemented) to persist only durable session delta before rotating a long Product session.
- Do not spawn subagents unless the user explicitly approved that execution plan or the current task policy explicitly allows it.

## Codebase navigation

1. Serena for symbols/references/editing.
2. Context7 for version-specific external docs.
3. Broad grep/full-file reads only when the above are insufficient or local implementation context is necessary.

Graphify and ast-grep are not set up for this repository (`.binnacle/project.yaml`, `capabilities`). Add them back here when the manifest says they are installed.

## Coding policy

Use Ponytail principles: the simplest solution that meets the requirement, minimum new surface area, no speculative abstraction.

## Matt Pocock Skills

The intended multi-session build chain is:

`/grill-with-docs → /to-spec → /to-tickets → implementation/review`

Do not advance from a grilling answer into implementation unless explicitly instructed.

Until epic 2 lands, how that chain runs on this repository — a branch and a fresh session per ticket, `DONE` in the same step as the merge, Product work done by hand from the repository rather than from a chat — is in `docs/workflow/02-development-workflow.md`, under *This repository, until epic 2*.

## Agent skills

### Issue tracker

Specs and issues live as markdown files in Git under `docs/specs/<slug>/`, not in `.scratch/`. See `docs/agents/issue-tracker.md` and `docs/adr/ADR-0017-specs-in-git-tickets-in-tracker.md`.

### Triage labels

The five canonical triage roles, used verbatim as label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
