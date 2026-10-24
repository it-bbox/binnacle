@AGENTS.md

# Claude Code Instructions

`AGENTS.md`, imported above, is the instruction file every agent reads, and it binds here in full. This file only adds Claude-specific workflow guidance.

## Project operating model

- Do not treat conversation history as project memory.
- For Product work, start a fresh session with `/binnacle:product` (and `/binnacle:daily`) rather than relying on a long-lived chat.
- A Product session commits to `main` directly, documentation only; code changes go through a ticket branch.
- Prefer fresh sessions for distinct implementation tickets.
- An implementation session starts by branching `feat/<slug>` from an up-to-date `main`, and never commits a ticket to `main`. Its last commit sets the ticket's `Status:` to `DONE` and touches nothing in the roadmap, which a Product session, a checkpoint or autopilot's end writes: the derived part, an epic's status from `tickets` on and the focus's *Done* line, which follow from the tickets, are written without a yes, in a commit of their own; the rest of the current focus and the `Next action:` paragraph only on the owner's yes (`docs/roadmap.md`, *Who writes what*).
- Use `/binnacle:checkpoint` to persist only durable session delta before rotating a long Product session.
- Do not spawn subagents unless the user explicitly approved that execution plan or the current task policy explicitly allows it.

## Codebase navigation

1. Serena for symbols/references/editing.
2. Graphify for cross-module architecture and impact.
3. Context7 for version-specific external docs.
4. Broad grep/full-file reads only when the above are insufficient or local implementation context is necessary.

ast-grep is not set up for this repository (`.binnacle/project.yaml`, `capabilities`). Add it back here when the manifest says it is installed.

## Coding policy

Use Ponytail principles: the simplest solution that meets the requirement, minimum new surface area, no speculative abstraction.

## Matt Pocock Skills

The intended multi-session build chain is:

`/grill-with-docs → /to-spec → /to-tickets → implementation/review`

Do not advance from a grilling answer into implementation unless explicitly instructed.

Grilling is a quiz, whatever the skill says about rounds: one question at a time, through the `AskUserQuestion` tool, the recommended option first and marked "(Recommended)", never options written out as chat text. Decide yourself what the docs, ADRs or Ponytail already answer, and list those defaults in the summary; only genuine product trade-offs go to the owner.

How that chain runs on this repository — a branch and a fresh session per ticket, `DONE` in the same step as the merge, Product work in a disposable session through `/binnacle:product`, `/binnacle:daily` and `/binnacle:checkpoint` — is in `docs/workflow/02-development-workflow.md`, under *Standard task flow* → *On this repository*.

## Agent skills

### Issue tracker

Specs and issues live as markdown files in Git under `docs/specs/<slug>/`, not in `.scratch/`. See `docs/agents/issue-tracker.md` and `docs/adr/ADR-0017-specs-in-git-tickets-in-tracker.md`.

### Triage labels

The five canonical triage roles, used verbatim as label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
