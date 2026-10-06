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
| 10 | Telemetry for any harness | not started | — |
| 11 | The state of work | not started | — |
| 12 | Audit, completed | not started | — |
| 13 | Human output | not started | — |
| 14 | Skills in any harness | in progress | [`skills-in-any-harness`](specs/skills-in-any-harness/spec.md) |

Epics are ordered by dependency, not by preference. Epic 1 is the foundation; epics 5 to 7 are only meaningful once 1 to 4 exist. Audit and adopt is epic 6 in the specs of epics 1 to 3, written before epic 6 was inserted on 2026-09-26. Epic 14 was added on 2026-10-06 and comes before epic 10, which reuses its list of harnesses.

## Current focus

Epics 1 to 9 are done: the daemon, snapshot, daily and checkpoint over MCP, the `binnacle` plugin with autopilot, Tasks from any tracker, `binn init` with the tools, the graph and the Obsidian vault, usage, the dashboard in two languages, `binn audit`, and setup from the chat; on 2026-10-06 a Product session ran in Codex from the README alone.

On 2026-10-06 the owner found that Binnacle's skills, Matt Pocock Skills and Ponytail reach Claude Code alone, while the baseline makes Codex, GLM and Gemini equal harnesses. That is epic 14, Skills in any harness (`docs/05-mvp-plan.md`). It comes before epic 10, which reuses its list of harnesses; epics 10 to 12 then need `to-spec`. Epic 13, Human output, is grilled last, since it rewrites every skill's output; the vault's notes being all in English is a candidate for it.

Epic 14 was grilled, specified and sliced on 2026-10-06 (ADR-0039, `specs/skills-in-any-harness/spec.md`): Claude Code keeps the plugin, every other harness gets `binnacle-<action>` skills through the `skills` CLI, and `binn call` serves harnesses without MCP. Tickets 01 to 07 and 09 are done: the skills name no harness's mechanism and fall back to `binn call` where a session has no Binnacle MCP tools, the package carries the `binnacle-<action>` copy, `binn init` installs it, Matt Pocock Skills and Ponytail into every harness the `skills` CLI detects, `binn audit` reports a stale installed set, which `binn init` reinstalls, autopilot and the development workflow reinstall the copy after a merge that changed the skills, and the docs and READMEs say one `binn init` sets up every harness. On 2026-10-07 the owner settled ticket 06's question, and ticket 09 carries it: `binn init` installs the skills even when they are current, so that running it again reaches a harness installed since. 08, the exit demonstration on the owner's Mac, can start; the owner runs it later, on its own, and epic 14 is done with it. Epic 10 goes on meanwhile.

Next action: specify epic 10, Telemetry for any harness, from `docs/05-mvp-plan.md`, phase 10, in a new session. `/mattpocock-skills:to-spec`

## Later

Deferred deliberately, each with the decision that deferred it:

- installing `binnd` as an auto-starting service per platform — `ADR-0016`;
- standalone binaries for users without Node — `ADR-0016`;
- adopting a large third-party repository as a baseline case — `docs/00-scope.md`;
- autopilot notifications through a Telegram bot, beside the push notification it sends today — `ADR-0022`;
- cost computed from a price table — `specs/telemetry/spec.md`: a subscription makes such a number conditional;
- changing a local ticket's `Status:` from the dashboard — a separate ADR narrowing `ADR-0020`, only if working with the read-only dashboard shows it is needed;
- forking the Matt Pocock skills into the `binnacle` plugin — only if a skill's procedure, not just its conventions in `docs/agents/`, has to change;
- publishing `@binnacle/cli` to npm, with the build step that turns its TypeScript into JavaScript and the dashboard generated into it (`ADR-0031`): Node does not strip types under `node_modules`, so until then `binn` runs from the linked workspace — `specs/tracker-and-matt-pocock-integration/spec.md`, *Out of Scope*;
- reading a record's branch again when its checkout's reflog can still give one: a record stored with the harness's branch before ADR-0029's order, or whose reflog lookup failed or timed out — `ADR-0030`, only if it matters in practice;
- autopilot resuming by itself once a usage limit resets: on 2026-09-25 a Product session did it by hand, with a script that waited for the reset and a message to the autopilot session — `ADR-0022`, when limits interrupt runs often;
- fewer rebases in a parallel autopilot run: every ticket's last commit rewrites the same current-focus paragraph, so the second of two parallel branches always rebased (five of eight merges on 2026-09-26) — `ADR-0022`, if rebasing slows runs;
- advanced optimisation rules — only after real measurement. Graphify, Obsidian, worktree conflict analysis, further harnesses, OpenTelemetry, CI state, context pressure and everything from the chat left this list on 2026-10-02: they are baseline items, epics 8 to 12 (`docs/baseline.md`).

Items excluded from the product altogether are not listed here. See the non-goals in `docs/00-scope.md`.

## Keeping this current

Update the status column when an epic changes state. An epic moves to `spec` in the change that fills its spec link, when `to-spec` produces the spec: a `spec` row whose Spec cell is `—` is reported as `roadmap.spec_missing`. A stale roadmap is worse than none, because Product Snapshot reads its position from here.

The epic table's header and the `## Current focus` heading are a contract with Binnacle (`specs/mcp-and-product-snapshot/spec.md`). Change them and the snapshot reports a diagnostic instead of a position. Each row's `#` must be a number, its Status one of the vocabulary above, written exactly, and its Spec cell `—` or a link to `specs/<slug>/spec.md`; a row that is not is left out of the snapshot, with a diagnostic. The current focus reaches a fresh session only up to its first 2000 characters, so keep it short.

The current focus ends with a paragraph that starts with `Next action:` and ends with exactly one command in backticks, the one the owner types to take it, such as `/binnacle:autopilot` or `/mattpocock-skills:implement <ticket path>`, so that the next step can be copied rather than worked out (the owner, 2026-09-26). Epic 5's dashboard reads that command as the Next action and shows Binnacle's Suggested step beside it (ADR-0032). A focus that ends otherwise, or whose command names a Task already done, is an attention item there.
