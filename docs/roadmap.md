# Roadmap

Where the project stands. This file holds **position only** — status, spec links, current focus. What each epic contains and how it is judged complete lives in `docs/05-mvp-plan.md`; nothing from there is repeated here.

This is the roadmap's single home because this repository uses the local Markdown tracker (`ADR-0017`). A project on GitHub or GitLab keeps its roadmap in tracker milestones instead.

**Status vocabulary:** `not started` → `spec` (being specified) → `tickets` (sliced, not yet built) → `in progress` → `done`.

## v1

| # | Epic | Status | Spec |
| --- | --- | --- | --- |
| 1 | Core and persistence | done | [`core-and-persistence`](specs/core-and-persistence/spec.md) |
| 2 | MCP and Product Snapshot | not started | — |
| 3 | Tracker and Matt Pocock integration | not started | — |
| 4 | Telemetry | not started | — |
| 5 | Minimal dashboard | not started | — |
| 6 | Audit and adopt | not started | — |

Epics are ordered by dependency, not by preference. Epic 1 is the foundation; epics 5 and 6 are only meaningful once 1 to 4 exist.

## Current focus

Design is complete and recorded: every question in `docs/08-open-questions.md` is resolved across ADR-0001 to ADR-0018, and specifying epic 1 added ADR-0019.

Epic 1 is done. `apps/daemon` and `apps/cli` carry the daemon lifecycle, the authenticated loopback API, the shared error envelope, the machine store and the project registry — which is ADR-0019 executed, not only recorded. `project.status` reports manifest facts beside live, read-only Git facts, and `project.detect` finds a project from any directory inside it. `packages/core` holds manifest validation, the tracker-versus-remote check, and the Project, Task, AgentRun and Review types with their three state machines, as pure functions with no dependencies. `packages/adapters` holds the Git adapter. The two storage tiers of ADR-0015 are executed: a schema version change drops and re-derives the projections, keeps the registry and the event history, and records the rebuild as an event.

The exit criterion is demonstrated on this repository: it commits `.binnacle/project.yaml`, declaring the local Markdown tracker, and `binn project register .` followed by `binn project status` reports its real manifest and Git facts. Stopping the daemon changes nothing in it. Registering it found one defect, filed as ticket 08 rather than fixed, because its fix is a decision about what a status describes.

Binnacle is not yet useful for its own Product work. `/product`, `/daily` and `/checkpoint` arrive with epic 2; until then that work is done by hand, as `docs/workflow/02-development-workflow.md` describes under *This repository, until epic 2*.

Next action: `/to-spec` for epic 2, after settling the questions below.

## Open before epic 2 is specified

Three open questions: two the plan leaves open, one found by registering this repository. Settle all three at `/to-spec` for epic 2, not partway through it.

- **The Product Snapshot promises active tasks and blockers, and tasks arrive in epic 3.** With epics ordered 2 then 3, a snapshot built in epic 2 knows Git, the roadmap and the event history, but not the tickets. Either swap epics 2 and 3, or give epic 2 a minimal read of the local Markdown tickets and leave the shared tracker contract to epic 3.
- **`binn init` is referenced by epics 3 and 4 but is a deliverable of neither.** Registering the MCP server in a harness's own configuration is its job (`docs/03-mcp-and-skills.md`). Without it, epic 2's MCP server is connected by hand with `claude mcp add`. Either accept that for epic 2, or place `binn init` in it.
- **`project.status` and `project.detect` do not understand linked worktrees** ([ticket 08](specs/core-and-persistence/issues/08-linked-worktrees.md)). Inside a worktree, status reports the main checkout's branch; outside the project, a worktree is not found. Epic 2's detect is called from wherever a harness started, and Claude Code starts in worktrees under `.claude/worktrees/`. Either take ticket 08 into epic 2, or state that epic 2 answers for the registered checkout only.

## Later

Deferred deliberately, each with the decision that deferred it:

- installing `binnd` as an auto-starting service per platform — `ADR-0016`;
- standalone binaries for users without Node — `ADR-0016`;
- adopting a large third-party repository as a baseline case — `docs/00-scope.md`;
- deeper Graphify integration, Obsidian export automation, worktree parallelism recommendations, further harness adapters — `docs/05-mvp-plan.md`, phase 7, and only after real measurement.

Items excluded from the product altogether are not listed here. See the non-goals in `docs/00-scope.md`.

## Keeping this current

Update the status column when an epic changes state, and fill the spec link when `to-spec` produces one. A stale roadmap is worse than none, because Product Snapshot reads its position from here.
