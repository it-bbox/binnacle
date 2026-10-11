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
| 5 | Minimal dashboard | done | [`minimal-dashboard`](specs/minimal-dashboard/spec.md) |
| 6 | Dashboard design and languages | done | [`dashboard-design-and-languages`](specs/dashboard-design-and-languages/spec.md) |
| 7 | Audit and adopt | done | [`audit-and-adopt`](specs/audit-and-adopt/spec.md) |
| 8 | Project Brain: tools, Graphify, Obsidian | done | [`project-brain-tools-graphify-obsidian`](specs/project-brain-tools-graphify-obsidian/spec.md) |
| 9 | Everything from the chat | done | [`everything-from-the-chat`](specs/everything-from-the-chat/spec.md) |
| 10 | Telemetry for any harness | done | [`telemetry-for-any-harness`](specs/telemetry-for-any-harness/spec.md) |
| 11 | The state of work | tickets | [`the-state-of-work`](specs/the-state-of-work/spec.md) |
| 12 | Audit, completed | not started | — |
| 13 | Human output | not started | — |
| 14 | Skills in any harness | done | [`skills-in-any-harness`](specs/skills-in-any-harness/spec.md) |
| 15 | Daemon autostart | not started | — |
| 16 | Dashboard redesign | not started | — |
| 17 | Release: npm and open source | not started | — |

Epics are ordered by dependency, not by preference. Epic 1 is the foundation; epics 5 to 7 are only meaningful once 1 to 4 exist. Audit and adopt is epic 6 in the specs of epics 1 to 3, written before epic 6 was inserted on 2026-09-26. Epic 14 was added on 2026-10-06 and comes before epic 10, which reuses its list of harnesses.

## Current focus

Epics 1 to 10 and 14 are done. On 2026-10-10 the owner set a date: on the evening of 2026-10-13 a video presents Binnacle, published to npm and open source, and every remaining v1 epic is in it, 11, 12 and 13 included, not left for after the release.

Three epics were added for it. 15, Daemon autostart: `binn init` sets the daemon up to start at login, which narrows ADR-0016's documented manual step (`docs/product-inbox.md`). 16, Dashboard redesign: the dashboard reads too small and too crowded, so it is redesigned with the Impeccable and UI UX Pro Max skills. 17, Release: npm and open source, which takes publishing `@binnacle/cli` out of *Later*: the build step that turns its TypeScript into JavaScript with the dashboard generated into it (`ADR-0031`), the README's install from npm, and the repository made public under Apache-2.0 (`ADR-0010`).

Each epic goes through `/grill-with-docs`, `/to-spec` and `/to-tickets`, then autopilot, in sessions of their own. On 2026-10-10 the owner set the order: 11, the largest and the one that needs the owner least, is grilled that night and run by autopilot overnight; it also comes before 16, so that the redesign covers the questions, roles and CI state 11 adds to the dashboard. 16 follows on 2026-10-11 with the owner watching, beside 15 and 12; 13 rewrites every skill's output and comes after them; 17 publishes what the others merged and comes last.

Epic 11 was grilled on 2026-10-10 into its spec and twelve tickets (ADR-0040); the last, its exit demonstration, is the owner's. Done, 01 to 11: this repository's CI workflow; a Task's questions, from its ticket, branch or issue, and the owner's answer with `/binnacle:answer`; its roles with Binnacle's suggestions; what waits for the owner; GitHub's and GitLab's CI, on the Task and in the daily; attention matching the work; autopilot on questions, roles, CI. 12, the owner's exit demonstration, can start.

Next action: run epic 11 overnight with autopilot. `/binnacle:autopilot 11`

## Later

Deferred deliberately, each with the decision that deferred it:

- standalone binaries for users without Node — `ADR-0016`;
- adopting a large third-party repository as a baseline case — `docs/00-scope.md`;
- autopilot notifications through a Telegram bot, beside the push notification it sends today — `ADR-0022`;
- cost computed from a price table — `specs/telemetry/spec.md`: a subscription makes such a number conditional;
- changing a local ticket's `Status:` from the dashboard — a separate ADR narrowing `ADR-0020`, only if working with the read-only dashboard shows it is needed;
- forking the Matt Pocock skills into the `binnacle` plugin — only if a skill's procedure, not just its conventions in `docs/agents/`, has to change;
- reading a record's branch again when its checkout's reflog can still give one: a record stored with the harness's branch before ADR-0029's order, or whose reflog lookup failed or timed out — `ADR-0030`, only if it matters in practice;
- autopilot resuming by itself once a usage limit resets: on 2026-09-25 a Product session did it by hand, with a script that waited for the reset and a message to the autopilot session — `ADR-0022`, when limits interrupt runs often;
- fewer rebases in a parallel autopilot run: every ticket's last commit rewrites the same current-focus paragraph, so the second of two parallel branches always rebased (five of eight merges on 2026-09-26) — `ADR-0022`, if rebasing slows runs;
- advanced optimisation rules — only after real measurement. Graphify, Obsidian, worktree conflict analysis, further harnesses, OpenTelemetry, CI state, context pressure and everything from the chat left this list on 2026-10-02: they are baseline items, epics 8 to 12 (`docs/baseline.md`).

Items excluded from the product altogether are not listed here. See the non-goals in `docs/00-scope.md`.

## Keeping this current

Update the status column when an epic changes state. An epic moves to `spec` in the change that fills its spec link, when `to-spec` produces the spec: a `spec` row whose Spec cell is `—` is reported as `roadmap.spec_missing`. A stale roadmap is worse than none, because Product Snapshot reads its position from here.

The epic table's header and the `## Current focus` heading are a contract with Binnacle (`specs/mcp-and-product-snapshot/spec.md`). Change them and the snapshot reports a diagnostic instead of a position. Each row's `#` must be a number, its Status one of the vocabulary above, written exactly, and its Spec cell `—` or a link to `specs/<slug>/spec.md`; a row that is not is left out of the snapshot, with a diagnostic. The current focus reaches a fresh session only up to its first 2000 characters, so keep it short.

The current focus ends with a paragraph that starts with `Next action:` and ends with exactly one command in backticks, the one the owner types to take it, such as `/binnacle:autopilot` or `/mattpocock-skills:implement <ticket path>`, so that the next step can be copied rather than worked out (the owner, 2026-09-26). Epic 5's dashboard reads that command as the Next action and shows Binnacle's Suggested step beside it (ADR-0032). A focus that ends otherwise, whose command names a Task already done, or that runs autopilot on an epic with no ticket left for an agent, is an attention item there.
