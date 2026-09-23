# Roadmap

Where the project stands. This file holds **position only** — status, spec links, current focus. What each epic contains and how it is judged complete lives in `docs/05-mvp-plan.md`; nothing from there is repeated here.

This is the roadmap's single home because this repository uses the local Markdown tracker (`ADR-0017`). A project on GitHub or GitLab keeps its roadmap in tracker milestones instead.

**Status vocabulary:** `not started` → `spec` (being specified) → `tickets` (sliced, not yet built) → `in progress` → `done`.

## v1

| # | Epic | Status | Spec |
| --- | --- | --- | --- |
| 1 | Core and persistence | done | [`core-and-persistence`](specs/core-and-persistence/spec.md) |
| 2 | MCP and Product Snapshot | in progress | [`mcp-and-product-snapshot`](specs/mcp-and-product-snapshot/spec.md) |
| 3 | Tracker and Matt Pocock integration | not started | — |
| 4 | Telemetry | not started | — |
| 5 | Minimal dashboard | not started | — |
| 6 | Audit and adopt | not started | — |

Epics are ordered by dependency, not by preference. Epic 1 is the foundation; epics 5 and 6 are only meaningful once 1 to 4 exist.

## Current focus

Design is complete and recorded: every question in `docs/08-open-questions.md` is resolved across ADR-0001 to ADR-0018, and specifying epic 1 added ADR-0019.

Epic 1 is done. `apps/daemon` and `apps/cli` carry the daemon lifecycle, the authenticated loopback API, the shared error envelope, the machine store and the project registry — which is ADR-0019 executed, not only recorded. `project.status` reports manifest facts beside live, read-only Git facts, and `project.detect` finds a project from any directory inside it. `packages/core` holds manifest validation, the tracker-versus-remote check, and the Project, Task, AgentRun and Review types with their three state machines, as pure functions with no dependencies. `packages/adapters` holds the Git adapter. The two storage tiers of ADR-0015 are executed: a schema version change drops and re-derives the projections, keeps the registry and the event history, and records the rebuild as an event.

The exit criterion is demonstrated on this repository: it commits `.binnacle/project.yaml`, declaring the local Markdown tracker, and `binn project register .` followed by `binn project status` reports its real manifest and Git facts. Stopping the daemon changes nothing in it. Registering it found one defect, filed as ticket 08 rather than fixed and since moved into epic 2 as its ticket 01, because its fix is a decision about what a status describes.

Binnacle is not yet useful for its own Product work. `/product`, `/daily` and `/checkpoint` arrive with epic 2; until then that work is done by hand, as `docs/workflow/02-development-workflow.md` describes under *This repository, until epic 2*.

Epic 2 is specified. Its three open questions were settled at `/grill-with-docs` before `/to-spec`: epic 2 takes the Task-reading half of the tracker contract with the local Markdown tracker as its first adapter; the MCP server is registered by a committed `.mcp.json`, and `binn init` stays in epic 3; and ticket 08 (linked worktrees) moves into epic 2. Specifying it added ADR-0020 and ADR-0021.

Epic 2 is sliced into seven tickets under `specs/mcp-and-product-snapshot/issues/`. Tickets 01 (linked worktrees) and 02 (Tasks in the snapshot) had no blockers; 03 and 04 follow 02; 05 needs 03 and 04; 06 needs 05; 07, the skills and the exit demonstration, needs 01 and 06.

Tickets 01 and 02 are done. `project.status` and `project.detect` answer from a linked worktree, inside the repository or beside it, with the Git facts of the caller's own checkout. `project.snapshot` lists the Tasks in flight and the Tasks ready to start and counts the rest, read live from the local Markdown tracker through the Task-reading contract in `packages/core`.

Next action: implement tickets 03 and 04, each in a fresh session.

## Later

Deferred deliberately, each with the decision that deferred it:

- installing `binnd` as an auto-starting service per platform — `ADR-0016`;
- standalone binaries for users without Node — `ADR-0016`;
- adopting a large third-party repository as a baseline case — `docs/00-scope.md`;
- deeper Graphify integration, Obsidian export automation, worktree parallelism recommendations, further harness adapters — `docs/05-mvp-plan.md`, phase 7, and only after real measurement.

Items excluded from the product altogether are not listed here. See the non-goals in `docs/00-scope.md`.

## Keeping this current

Update the status column when an epic changes state, and fill the spec link when `to-spec` produces one. A stale roadmap is worse than none, because Product Snapshot reads its position from here.

The epic table's header and the `## Current focus` heading are a contract with Binnacle (`specs/mcp-and-product-snapshot/spec.md`). Change them and the snapshot reports a diagnostic instead of a position.
