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
| 4 | Telemetry | done | [`telemetry`](specs/telemetry/spec.md) |
| 5 | Minimal dashboard | in progress | [`minimal-dashboard`](specs/minimal-dashboard/spec.md) |
| 6 | Audit and adopt | not started | — |

Epics are ordered by dependency, not by preference. Epic 1 is the foundation; epics 5 and 6 are only meaningful once 1 to 4 exist.

## Current focus

Design is complete: `docs/08-open-questions.md` is resolved by ADR-0001 to ADR-0018; building the epics added ADR-0019 to ADR-0032.

Epics 1 to 4 are done. The daemon, its store and `packages/core` (epic 1). `binn mcp` serves the snapshot, the daily and the checkpoint to every session through the committed `.mcp.json`, and the `binnacle` plugin gives `/binnacle:product`, `:daily`, `:checkpoint` and `:autopilot` (epic 2, ADR-0022, ADR-0023). GitHub and GitLab issues are Tasks, `/binnacle:task` gives a Task's brief and branch, and `binn init` sets up a fresh repository (epic 3, ADR-0024 to ADR-0027). The snapshot's usage section and `usage_get` give Claude Code's and Codex's tokens by model, by Task and by role; a run's branch comes from its checkout's reflog or not at all, and autopilot lets Binnacle read a ticket's worktree before removing it (epic 4, ADR-0028 to ADR-0030). Binnacle writes nothing into the repository.

Epic 5, Minimal dashboard, was grilled on 2026-09-26, starting from the owner's feedback that the process was hard to follow. Its main screen answers where each project stands and what to type next: the Next action from this focus, Binnacle's Suggested step beside it, what is running, and what can start, with the command that starts it. The dashboard is read-only and served by the daemon (`docs/05-mvp-plan.md`, phase 5; ADR-0031, ADR-0032). Its spec is `specs/minimal-dashboard/spec.md`, sliced into nine tickets. Tickets 01 to 04 and 07 are done: `binn dashboard` opens it, each Task shows its start command, it shows what is running now and who runs it, the Project page shows each epic's board, and the Usage page shows what each project consumed. Tickets 05, 06 and 08 can start now. Ticket 09, the exit demonstration, is the owner's.

Next action: run epic 5's tickets, from a Product session in the registered checkout. `/binnacle:autopilot`

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
- reading a record's branch again when its checkout's reflog can still give one: a record stored with the harness's branch before ADR-0029's order, or whose reflog lookup failed or timed out — `ADR-0030`, only if it matters in practice;
- autopilot resuming by itself once a usage limit resets: on 2026-09-25 a Product session did it by hand, with a script that waited for the reset and a message to the autopilot session — `ADR-0022`, when limits interrupt runs often;
- deeper Graphify integration, Obsidian export automation, worktree parallelism recommendations, further harness adapters — `docs/05-mvp-plan.md`, phase 7, and only after real measurement.

Items excluded from the product altogether are not listed here. See the non-goals in `docs/00-scope.md`.

## Keeping this current

Update the status column when an epic changes state. An epic moves to `spec` in the change that fills its spec link, when `to-spec` produces the spec: a `spec` row whose Spec cell is `—` is reported as `roadmap.spec_missing`. A stale roadmap is worse than none, because Product Snapshot reads its position from here.

The epic table's header and the `## Current focus` heading are a contract with Binnacle (`specs/mcp-and-product-snapshot/spec.md`). Change them and the snapshot reports a diagnostic instead of a position. Each row's `#` must be a number, its Status one of the vocabulary above, written exactly, and its Spec cell `—` or a link to `specs/<slug>/spec.md`; a row that is not is left out of the snapshot, with a diagnostic. The current focus reaches a fresh session only up to its first 2000 characters, so keep it short.

The current focus ends with a paragraph that starts with `Next action:` and ends with exactly one command in backticks, the one the owner types to take it, such as `/binnacle:autopilot` or `/mattpocock-skills:implement <ticket path>`, so that the next step can be copied rather than worked out (the owner, 2026-09-26). Epic 5's dashboard reads that command as the Next action and shows Binnacle's Suggested step beside it (ADR-0032). A focus that ends otherwise, or whose command names a Task already done, is an attention item there.
