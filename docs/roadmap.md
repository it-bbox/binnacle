# Roadmap

Where the project stands. This file holds **position only** — status, spec links, current focus. What each epic contains and how it is judged complete lives in `docs/05-mvp-plan.md`; nothing from there is repeated here.

This is the roadmap's single home because this repository uses the local Markdown tracker (`ADR-0017`). A project on GitHub or GitLab keeps its roadmap in tracker milestones instead.

**Status vocabulary:** `not started` → `spec` (being specified) → `tickets` (sliced, not yet built) → `in progress` → `done`.

## v1

| # | Epic | Status | Spec |
| --- | --- | --- | --- |
| 1 | Core and persistence | tickets | [`core-and-persistence`](specs/core-and-persistence/spec.md) |
| 2 | MCP and Product Snapshot | not started | — |
| 3 | Tracker and Matt Pocock integration | not started | — |
| 4 | Telemetry | not started | — |
| 5 | Minimal dashboard | not started | — |
| 6 | Audit and adopt | not started | — |

Epics are ordered by dependency, not by preference. Epic 1 is the foundation; epics 5 and 6 are only meaningful once 1 to 4 exist.

## Current focus

Design is complete and recorded: every question in `docs/08-open-questions.md` is resolved across ADR-0001 to ADR-0018, and specifying epic 1 added ADR-0019. Epic 1 is specified and sliced into seven tickets. Implementation has not begun — `apps/` and `packages/` are intentionally empty.

Next action: implement epic 1 ticket 01, the walking skeleton. Ticket 06 has no blockers and can run alongside it.

## Later

Deferred deliberately, each with the decision that deferred it:

- installing `binnd` as an auto-starting service per platform — `ADR-0016`;
- standalone binaries for users without Node — `ADR-0016`;
- adopting a large third-party repository as a baseline case — `docs/00-scope.md`;
- deeper Graphify integration, Obsidian export automation, worktree parallelism recommendations, further harness adapters — `docs/05-mvp-plan.md`, phase 7, and only after real measurement.

Items excluded from the product altogether are not listed here. See the non-goals in `docs/00-scope.md`.

## Keeping this current

Update the status column when an epic changes state, and fill the spec link when `to-spec` produces one. A stale roadmap is worse than none, because Product Snapshot reads its position from here.
