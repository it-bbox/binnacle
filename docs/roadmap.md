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

Design is complete: every question in `docs/08-open-questions.md` is resolved across ADR-0001 to ADR-0018, and specifying epics 1 and 2 added ADR-0019 to ADR-0021.

Epic 1 is done and demonstrated on this repository: the daemon and its authenticated loopback API, the machine store and the project registry (ADR-0019), the two storage tiers of ADR-0015, `project.status` and `project.detect`, and manifest validation and the domain state machines as pure functions in `packages/core`. The one defect registering it found became epic 2's ticket 01.

Epic 2 has eight tickets under `specs/mcp-and-product-snapshot/issues/`, the eighth (`/autopilot`) added by ADR-0022. Tickets 01 to 06 are done. Ticket 07 is prepared and awaits its exit demonstration: `/product`, `/daily` and `/checkpoint` are committed as skills, and the manual Product workflow is retired.

`project.status` and `project.detect` answer from a linked worktree with that checkout's Git facts. `project.snapshot` returns the roadmap, the Tasks in flight and ready to start, the five most recent ADRs, Git facts and attention items, read live from the caller's checkout. `binn mcp` serves the operations as MCP tools on stdio, proxying the running daemon, and the committed `.mcp.json` connects every Claude Code session here once `binn` is linked onto PATH. `daily_get` returns what changed since the last daily or checkpoint and records the next baseline. `checkpoint_prepare` returns the delta since the last checkpoint, the promotion targets with this project's paths and the attention items; `checkpoint_record` records the checkpoint at HEAD once the session has committed its promotions. Binnacle writes nothing into the repository.

Next action: the human runs ticket 07's exit demonstration, following the script in its `## Comments`, then marks it `DONE` and moves this focus to ticket 08, via `/autopilot` or a fresh session. Epic 2 stays `in progress`.

## Later

Deferred deliberately, each with the decision that deferred it:

- installing `binnd` as an auto-starting service per platform — `ADR-0016`;
- standalone binaries for users without Node — `ADR-0016`;
- adopting a large third-party repository as a baseline case — `docs/00-scope.md`;
- autopilot notifications through a Telegram bot, beside the push notification it sends today — `ADR-0022`;
- deeper Graphify integration, Obsidian export automation, worktree parallelism recommendations, further harness adapters — `docs/05-mvp-plan.md`, phase 7, and only after real measurement.

Items excluded from the product altogether are not listed here. See the non-goals in `docs/00-scope.md`.

## Keeping this current

Update the status column when an epic changes state, and fill the spec link when `to-spec` produces one. A stale roadmap is worse than none, because Product Snapshot reads its position from here.

The epic table's header and the `## Current focus` heading are a contract with Binnacle (`specs/mcp-and-product-snapshot/spec.md`). Change them and the snapshot reports a diagnostic instead of a position. Each row's `#` must be a number, its Status one of the vocabulary above, written exactly, and its Spec cell `—` or a link to `specs/<slug>/spec.md`; a row that is not is left out of the snapshot, with a diagnostic. The current focus reaches a fresh session only up to its first 2000 characters, so keep it short.
