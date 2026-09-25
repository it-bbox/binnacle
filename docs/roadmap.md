# Roadmap

Where the project stands. This file holds **position only** — status, spec links, current focus. What each epic contains and how it is judged complete lives in `docs/05-mvp-plan.md`; nothing from there is repeated here.

This is the roadmap's single home, whatever the tracker (`ADR-0025`).

**Status vocabulary:** `not started` → `spec` (being specified) → `tickets` (sliced, not yet built) → `in progress` → `done`.

## v1

| # | Epic | Status | Spec |
| --- | --- | --- | --- |
| 1 | Core and persistence | done | [`core-and-persistence`](specs/core-and-persistence/spec.md) |
| 2 | MCP and Product Snapshot | done | [`mcp-and-product-snapshot`](specs/mcp-and-product-snapshot/spec.md) |
| 3 | Tracker and Matt Pocock integration | done | [`tracker-and-matt-pocock-integration`](specs/tracker-and-matt-pocock-integration/spec.md) |
| 4 | Telemetry | in progress | [`telemetry`](specs/telemetry/spec.md) |
| 5 | Minimal dashboard | not started | — |
| 6 | Audit and adopt | not started | — |

Epics are ordered by dependency, not by preference. Epic 1 is the foundation; epics 5 and 6 are only meaningful once 1 to 4 exist.

## Current focus

Design is complete: `docs/08-open-questions.md` is resolved by ADR-0001 to ADR-0018; building the epics added ADR-0019 to ADR-0028.

Epics 1 to 3 are done. The daemon, its store and `packages/core` (epic 1). `binn mcp` serves the snapshot, the daily and the checkpoint to every session through the committed `.mcp.json`, and the `binnacle` plugin gives `/binnacle:product`, `:daily`, `:checkpoint` and `:autopilot` (epic 2, ADR-0022, ADR-0023). GitHub and GitLab issues are Tasks, `/binnacle:task` gives a Task's brief and branch, and `binn init` sets up a fresh repository (epic 3, ADR-0024 to ADR-0027). Binnacle writes nothing into the repository.

Epic 4, Telemetry, is in progress (ADR-0028). Tickets 01, 02, 03, 05, 06, 07 and 08 are done: the snapshot's usage section shows Claude Code's and Codex's totals for today and the week, by model, by Task and unassigned, with each harness's support level, dropped to 1 with a `telemetry.unreadable` attention item while one of its files cannot be read; runs are attributed to Tasks by branch, Codex's from the reflog; `usage_get` gives the project's usage by Task, or one Task's with its runs; the import window can be `all` or widened, a call waits for the import no longer than a fixed budget, and the daemon imports every registered project on start. `binn init` shows each harness's sessions in the repository and asks for the window.

Next action: ticket 04 (subagents) is stopped on an owner question: Claude Code's `gitBranch` is per process, not per worktree. 09, the exit demonstration, waits for 04 and for the owner's answer below. Ticket 03's comments leave a question for 09: no answer shows the role of an unassigned run, so a Product session on `main` cannot be seen as `product`.

## Later

Deferred deliberately, each with the decision that deferred it:

- installing `binnd` as an auto-starting service per platform — `ADR-0016`;
- standalone binaries for users without Node — `ADR-0016`;
- adopting a large third-party repository as a baseline case — `docs/00-scope.md`;
- autopilot notifications through a Telegram bot, beside the push notification it sends today — `ADR-0022`;
- CI state in the Product Snapshot, which stays marked unavailable — this repository has no CI to build it against;
- OpenTelemetry as a live telemetry path, and support level 4 — `ADR-0011`, `specs/telemetry/spec.md`;
- cost computed from a price table — `specs/telemetry/spec.md`: a subscription makes such a number conditional;
- context pressure and its attention item — `docs/04-telemetry-dashboard.md`, deferred by `specs/telemetry/spec.md`;
- CLI commands mirroring the MCP tools, for harnesses that have a shell but no MCP — `ADR-0014`, when such a user appears;
- changing a local ticket's `Status:` from the dashboard — a separate ADR narrowing `ADR-0020`, only if working with the read-only dashboard shows it is needed;
- forking the Matt Pocock skills into the `binnacle` plugin — only if a skill's procedure, not just its conventions in `docs/agents/`, has to change;
- publishing `@binnacle/cli` to npm, with the build step that turns its TypeScript into JavaScript: Node does not strip types under `node_modules`, so until then `binn` runs from the linked workspace — `specs/tracker-and-matt-pocock-integration/spec.md`, *Out of Scope*;
- deeper Graphify integration, Obsidian export automation, worktree parallelism recommendations, further harness adapters — `docs/05-mvp-plan.md`, phase 7, and only after real measurement.

Items excluded from the product altogether are not listed here. See the non-goals in `docs/00-scope.md`.

## Keeping this current

Update the status column when an epic changes state, and fill the spec link when `to-spec` produces one. A stale roadmap is worse than none, because Product Snapshot reads its position from here.

The epic table's header and the `## Current focus` heading are a contract with Binnacle (`specs/mcp-and-product-snapshot/spec.md`). Change them and the snapshot reports a diagnostic instead of a position. Each row's `#` must be a number, its Status one of the vocabulary above, written exactly, and its Spec cell `—` or a link to `specs/<slug>/spec.md`; a row that is not is left out of the snapshot, with a diagnostic. The current focus reaches a fresh session only up to its first 2000 characters, so keep it short.
