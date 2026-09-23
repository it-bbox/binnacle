# ADR-0022: Autopilot Finishes a Planned Epic, Started Only by a Human

**Status:** Accepted

## Context

v1 rules out automatic spawning of agents (`AGENTS.md`, principle 1; `docs/00-scope.md`, non-goals), so every implementation session is started by hand. On this repository that makes the human the scheduler: they start a session per ticket, relay review requests, and merge — even when the epic is fully specified and sliced and nothing is left to decide. Epic 2's tickets 06 and 07 were run overnight by a Product session that spawned one agent per ticket, verified each branch and merged it, with the human's explicit approval of that plan. It worked, and it was an exception to a rule that should say when it applies.

## Decision

**Autopilot** is a skill, `/autopilot`, that a human starts for one epic. It runs that epic's remaining tickets to the end and nothing else:

- **Started only by a human.** The skill cannot be invoked by a model, and nothing in Binnacle starts it.
- **Only for a planned epic.** The epic has a spec and tickets, and the roadmap has it at `tickets` or `in progress`. Autopilot never runs `/grill-with-docs`, `/to-spec` or `/to-tickets`, and never moves on to the next epic.
- **The session orchestrates; agents implement.** One agent per ticket, each in its own worktree, following the per-ticket process. The session verifies every branch before it merges it. Starting autopilot is the human's approval of spawning those agents and of merging what passes verification.
- **The owner is asked, not guessed for.** A question only the owner can answer stops the ticket it blocks and everything depending on it, and notifies the owner. A question that blocks nothing is answered in the smallest way the spec allows and recorded in the ticket.
- **A human step stays a human's.** A hand check, a confirmation, a demonstration is prepared and left for the human, never simulated.

Binnacle itself is unchanged. It spawns nothing, merges nothing and invokes no model: `/autopilot` runs in the human's harness and reads Binnacle through the same MCP tools as `/product` and `/daily`. The ban on `spawn_agents` and `merge_to_main` MCP tools stands.

## Rationale

- The line that matters is who decides to start work, not who types each command. A human choosing an epic whose every decision is already in its spec and tickets has made the decision; spawning a session per ticket by hand adds latency, not control.
- Bounding autopilot to one planned epic keeps planning — where product decisions are made — human-driven, and bounds how much can happen between two looks by the owner.
- Keeping orchestration in a skill, not in the daemon, keeps Binnacle a control plane that observes and records rather than an orchestrator, and keeps it harness-agnostic.

## Consequences

- `AGENTS.md` principle 1, `docs/00-scope.md`'s non-goals and `CONTEXT.md`'s *Manual-first* name autopilot as the one exception.
- `docs/03-mcp-and-skills.md` lists `/autopilot` among the skills.
- Epic 2 gains ticket 08, the skill itself, after ticket 07.
- Notification is a push today. A Telegram bot is deferred (`docs/roadmap.md`, *Later*).
