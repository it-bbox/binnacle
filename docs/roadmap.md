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
| 4 | Telemetry | not started | — |
| 5 | Minimal dashboard | not started | — |
| 6 | Audit and adopt | not started | — |

Epics are ordered by dependency, not by preference. Epic 1 is the foundation; epics 5 and 6 are only meaningful once 1 to 4 exist.

## Current focus

Design is complete: every question in `docs/08-open-questions.md` is resolved across ADR-0001 to ADR-0018; specifying and building epics 1 and 2 added ADR-0019 to ADR-0023.

Epic 1 is done: the daemon and its authenticated loopback API, the machine store and the project registry, projections that rebuild on a schema change, `project.status` and `project.detect`, and manifest validation and the domain state machines in `packages/core`.

Epic 2 is done, closed on 2026-09-24 after its exit demonstration and hand checks. Binnacle now runs its own Product work: `binn mcp` serves the snapshot, the daily delta and the checkpoint as MCP tools over the running daemon, the committed `.mcp.json` connects every session, and the `binnacle` plugin (ADR-0023) provides `/binnacle:product`, `/binnacle:daily`, `/binnacle:checkpoint` and `/binnacle:autopilot` (ADR-0022). Status, detect and the snapshot answer from linked worktrees with the caller's own checkout. Binnacle writes nothing into the repository.

Epic 3 is done, closed on 2026-09-25 after its exit demonstration, which found no defect (ADR-0024 to ADR-0027). GitHub and GitLab issues are Tasks in the snapshot, the daily and the checkpoint, read with a read-only token when one is configured. `/binnacle:task` gives one Task's brief and branch name. `binn init` sets up a fresh repository end to end: the manifest, registration, each harness's MCP server, the `binnacle` plugin from the CLI package, the ticket-header section and the tracker check. `pnpm test:live` proves both adapters against the owner's test projects.

Next action: epic 4, Telemetry, which is not started. It begins with `/grill-with-docs` or `/to-spec` in a Product session.

## Later

Deferred deliberately, each with the decision that deferred it:

- installing `binnd` as an auto-starting service per platform — `ADR-0016`;
- standalone binaries for users without Node — `ADR-0016`;
- adopting a large third-party repository as a baseline case — `docs/00-scope.md`;
- autopilot notifications through a Telegram bot, beside the push notification it sends today — `ADR-0022`;
- CI state in the Product Snapshot, which stays marked unavailable — this repository has no CI to build it against;
- CLI commands mirroring the MCP tools, for harnesses that have a shell but no MCP — `ADR-0014`, when such a user appears;
- changing a local ticket's `Status:` from the dashboard — a separate ADR narrowing `ADR-0020`, only if working with the read-only dashboard shows it is needed;
- forking the Matt Pocock skills into the `binnacle` plugin — only if a skill's procedure, not just its conventions in `docs/agents/`, has to change;
- deeper Graphify integration, Obsidian export automation, worktree parallelism recommendations, further harness adapters — `docs/05-mvp-plan.md`, phase 7, and only after real measurement.

Items excluded from the product altogether are not listed here. See the non-goals in `docs/00-scope.md`.

## Keeping this current

Update the status column when an epic changes state, and fill the spec link when `to-spec` produces one. A stale roadmap is worse than none, because Product Snapshot reads its position from here.

The epic table's header and the `## Current focus` heading are a contract with Binnacle (`specs/mcp-and-product-snapshot/spec.md`). Change them and the snapshot reports a diagnostic instead of a position. Each row's `#` must be a number, its Status one of the vocabulary above, written exactly, and its Spec cell `—` or a link to `specs/<slug>/spec.md`; a row that is not is left out of the snapshot, with a diagnostic. The current focus reaches a fresh session only up to its first 2000 characters, so keep it short.
