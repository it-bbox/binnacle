# Roadmap

Where the project stands. This file holds **position only** — status, spec links, current focus. What each epic contains and how it is judged complete lives in `docs/05-mvp-plan.md`; nothing from there is repeated here.

This is the roadmap's single home, whatever the tracker (`ADR-0025`).

**Status vocabulary:** `not started` → `spec` (being specified) → `tickets` (sliced, not yet built) → `in progress` → `done`.

Epics 1 to 19 are v1.

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
| 11 | The state of work | done | [`the-state-of-work`](specs/the-state-of-work/spec.md) |
| 12 | Audit, completed | done | [`audit-completed`](specs/audit-completed/spec.md) |
| 13 | Human output | done | [`human-output`](specs/human-output/spec.md) |
| 14 | Skills in any harness | done | [`skills-in-any-harness`](specs/skills-in-any-harness/spec.md) |
| 15 | Daemon autostart | done | [`daemon-autostart`](specs/daemon-autostart/spec.md) |
| 16 | Dashboard redesign | done | [`dashboard-redesign`](specs/dashboard-redesign/spec.md) |
| 17 | Release: npm and open source | done | [`release`](specs/release/spec.md) |
| 18 | Lean flow | done | [`lean-flow`](specs/lean-flow/spec.md) |
| 19 | Starting a project: new and existing | done | [`starting-a-project`](specs/starting-a-project/spec.md) |
| 20 | Hygiene after v1 | done | [`hygiene-after-v1`](specs/hygiene-after-v1/spec.md) |
| 21 | Hygiene after 0.4.0 | done | [`hygiene-after-0-4-0`](specs/hygiene-after-0-4-0/spec.md) |
| 22 | A Binnacle mod for Claude Code | done | [`claude-code-mod`](specs/claude-code-mod/spec.md) |
| 23 | Binnacle in a dev container | spec | [`dev-container`](specs/dev-container/spec.md) |
| 24 | Showcase and launch | not started | — |
| 25 | Cheaper runs | not started | — |
| 26 | Binnacle's own planning skills | not started | — |
| 27 | The agents' configuration in the audit | not started | — |

## Epics

After v1, cut from the product inbox on 2026-10-22, 2026-10-23 and 2026-10-28; what epics 1 to 19 contain is in `docs/05-mvp-plan.md`.

- **20 Hygiene after v1**: the roadmap's derived state written without a yes, a shared sanitizer for manifest text, a session named so a person knows it, the wording left after epic 13, the daemon reporting its own version, and `/binnacle:roadmap` reading the product inbox; whether TypeScript 7 belongs here is the grilling's to decide. Small enough for autopilot.
- **21 Hygiene after 0.4.0**: `/binnacle:task` taking a ticket's path, and whether the snapshot flags a `Next action:` naming no known Task; the Russian wording left after epic 20 (a pair's conflict-risk reason and a failed Graphify run's output marked `(англ.)`, one spelling of "пулл-реквест", a reason's capital after a dash); the context-pressure item's start as the session's, with its date; whether `binn mcp` keeps the session's id across `/clear` and `--resume`; a session's runs on a Task's branch after its merge no longer keeping the Task in progress, nor the Suggested step advising to wait for them; a context-pressure threshold that follows the session's model, and whether the dashboard sets it, narrowing ADR-0041, is the grilling's to decide; a trap as a sixth checkpoint target. Small enough for autopilot.
- **22 A Binnacle mod for Claude Code**: a status line, a *Waiting for you* band, a pane and toasts, and a `SessionStart` hook adding two or three lines from the snapshot, read-only and off by default; an ADR first. Taken early, by the owner, 2026-10-22.
- **23 Binnacle in a dev container**: a bind address and the allowed `Host` values set by the user, with the token and the `Origin` check unchanged, an ADR first; a guide in both languages for Binnacle inside each app container, its port published on the host's loopback only, with its footprint measured; whether one dashboard lists other daemons is the grilling's to weigh against principle 3 and ADR-0020. Before the launch, so a visitor who works in containers is answered.
- **24 Showcase and launch**: what a visitor from a post sees and where Binnacle can be found: the repository's description and topics, a demo and screenshots of the dashboard in the README, listings in the Claude plugin marketplace, MCP directories and awesome lists, npm keywords, a write-up from Binnacle's own usage data, and a launch checklist. The posts themselves are the owner's. After the mod, so its pane and status line can be shown (the owner, 2026-10-23).
- **25 Cheaper runs**: measure first, from Binnacle's own usage per role and per Task; then a model per ticket, review where it pays, ticket size by volume, autopilot reading no full diff, hard stops, review markers, classes of a red CI and stop reasons from facts; measure again. Before 26, so it runs cheaper.
- **26 Binnacle's own planning skills**: grilling, a spec and tickets in place of Matt Pocock Skills, with requirements traced end to end, blind acceptance, a depth checklist, a red proof, tests-first, delivery signals, a check owned by a role that can perform it, the modules a ticket expects to touch for the conflict risk, and tests on the skills and instruction files themselves.
- **27 The agents' configuration in the audit**: a read-only audit area for what drives the agents: `.mcp.json` and each harness's MCP settings, hooks and the commands they run, permission modes that skip approval, secrets in instruction files and skills, and MCP servers that differ between a project's harnesses.

Epics are ordered by dependency, not by preference:

- epic 1 is the foundation, and epics 5 to 7 are only meaningful once 1 to 4 exist;
- audit and adopt is epic 6 in the specs of epics 1 to 3, written before epic 6 was inserted on 2026-09-26;
- epic 14 was added on 2026-10-06 and comes before epic 10, which reuses its list of harnesses.

## Current focus

Done: epics 1 to 22. **v1 is complete.**

**Released** (the owner): `@it-bbox/binnacle` 0.1.0 on 2026-10-13, with `it-bbox/binnacle` public, private vulnerability reporting and Dependabot alerts on; 0.2.0, epic 12, on 2026-10-21; 0.3.0, epic 13, on 2026-10-22, the last of v1, installed from the registry into a clean container (`specs/human-output/issues/11-human-output-exit-demonstration.md`); 0.4.0, epic 20, on 2026-10-28, installed from the registry into a clean container (`specs/hygiene-after-v1/issues/09-hygiene-exit-demonstration.md`); 0.5.0, epic 21, on 2026-10-28, installed from the registry into a clean container (`specs/hygiene-after-0-4-0/issues/08-hygiene-after-0-4-0-exit-demonstration.md`); 0.6.0, epic 22, on 2026-10-29, installed from the registry into a clean container (`specs/claude-code-mod/issues/07-claude-code-mod-exit-demonstration.md`).

**Epic 22 done** on 2026-10-29: tickets 01 to 06 by autopilot, 08 by hand, the exit demonstration and 0.6.0 the owner's. `binnacle-mod`, beside `binnacle` in the package's marketplace and offered by `binn init` at a terminal: a status line, a *Waiting for you* band it shares with other mods, a pane by `/binnacle-pane`, toasts and session-start lines. The demonstration fixed the permission prompt on its own read and its first refreshes, made before the `binnacle` server connects.

Next: epics 23 to 27, cut from the product inbox on 2026-10-22, 2026-10-23 and 2026-10-28.

Next action: split epic 23, *Binnacle in a dev container*, into tickets from its spec, `docs/specs/dev-container/spec.md`. `/to-tickets`

## Later

Deferred deliberately, each with the decision that deferred it and when it comes back:

| Deferred | Decided by | Comes back when |
| --- | --- | --- |
| Standalone binaries for users without Node | `ADR-0016` | users without Node appear |
| Adopting a large third-party repository as a baseline case | `docs/00-scope.md` | — |
| Autopilot notifications through a Telegram bot, beside its push notification | `ADR-0022` | — |
| Cost computed from a price table | `specs/telemetry/spec.md` | a subscription makes such a number conditional, so not yet |
| Changing a local ticket's `Status:` from the dashboard | a new ADR narrowing `ADR-0020` | working with the read-only dashboard shows it is needed |
| One dashboard listing or reading other daemons, one per container | `specs/dev-container/brief.md` | users with many containers ask for it |
| Forking the Matt Pocock skills into the `binnacle` plugin | — | a skill's procedure, not just its conventions in `docs/agents/`, has to change |
| Reading a record's branch again from a checkout's reflog, for records stored before ADR-0029's order or whose lookup failed | `ADR-0030` | it matters in practice |
| Autopilot resuming by itself once a usage limit resets (done by hand on 2026-09-25) | `ADR-0022` | limits interrupt runs often |
| Embeddings over the documentation, for "was this decided already?", duplicate tickets and the checkpoint | the owner, 2026-10-22 (`docs/product-inbox.md`) | a measurement shows an agent misses the right ADR without them |
| An explicit claim of a Task, and ticket numbers that cannot collide, after beads | the owner, 2026-10-22 (`docs/product-inbox.md`) | parallel autopilot runs collide on a Task or a ticket number |
| Typed links, summaries of done epics, and beads as a tracker | the owner, 2026-10-22 (`docs/product-inbox.md`) | — |

Graphify, Obsidian, worktree conflict analysis, further harnesses, OpenTelemetry, CI state, context pressure and everything from the chat left this list on 2026-10-02: they are baseline items, epics 8 to 12 (`docs/baseline.md`).

Items excluded from the product altogether are not listed here. See the non-goals in `docs/00-scope.md`.

## Keeping this current

A stale roadmap is worse than none: Product Snapshot reads its position from here.

### Who writes what

- **The derived part**: an epic's status from `tickets` on, and the focus's *Done* line. It follows from the tickets alone, so autopilot at the end of its run, a checkpoint and a Product session write it without a yes: `tickets` while the epic has tickets and none is `DONE`, `in progress` while some are `DONE` and some open, `done` exactly when every one is `DONE` or `CANCELLED`, a `ready-for-human` ticket counting as any other; the *Done* line names the epics marked `done`. The writer reads each epic's progress and the `roadmap.status_mismatch` items from `project_snapshot`, or the tickets' `Status:` lines without the daemon, and counts nothing itself. It commits this file alone, on its branch, with a subject that says it is derived from the tickets, and only when something changed; it never pushes (the owner, 2026-10-23).
- **The rest of the current focus**: a Product session, a checkpoint, or autopilot at the end of its run, on the owner's yes, in a commit of its own. Never a ticket (the owner, 2026-10-11).
- **`not started` and `spec`**: a Product session, on the owner's yes.
- **A ticket's last commit** sets only its own `Status: DONE` and touches nothing here. Until the roadmap catches up, the snapshot derives what is done and what can start from the tickets' statuses.
- **The `Next action:` paragraph** is the owner's course, written only on the owner's yes (the owner, 2026-10-02).

### The status column

- Update it when an epic changes state; from `tickets` on, it is the derived part above.
- An epic moves to `spec` in the change that fills its spec link, when `to-spec` produces the spec.
- A `spec`, `tickets` or `in progress` row whose Spec cell is `—` is reported as `roadmap.spec_missing`. A `done` one is not: finished work, often older than Binnacle, may have no spec.
- A `spec.md` under the specs directory that no row links is reported as `roadmap.spec_unlisted`.

### The format is a contract

The epic table's header and the `## Current focus` heading are a contract with Binnacle (`specs/mcp-and-product-snapshot/spec.md`). Change them and the snapshot reports a diagnostic instead of a position.

- Each row's `#` is a number.
- Its Status is one of the vocabulary above, written exactly.
- Its Spec cell is `—` or a link to `specs/<slug>/spec.md`.
- A row that breaks these is left out of the snapshot, with a diagnostic.
- The focus reaches a fresh session only up to its first 2000 characters, so keep it short.

### The Next action

The current focus ends with a paragraph that starts with `Next action:` and ends with exactly one command in backticks, the one the owner types, such as `/binnacle:autopilot` or `/binnacle:task run <ticket path>`. The next step is then copied, not worked out (the owner, 2026-09-26). The dashboard shows that command as the Next action, with Binnacle's Suggested step beside it (ADR-0032).

It is an attention item when the focus ends otherwise, when its command names a Task already done, or when it runs autopilot on an epic with no ticket left for an agent.
