# ADR-0037: A Confirmation in the Chat Counts as the Human's

**Status:** Accepted

**Extends:** ADR-0026 and ADR-0034, which require `binn init`'s writes to be confirmed by a human at a terminal.

## Context

The owner's baseline makes MCP plus skills the main UX: the owner should not have to go to a terminal. On 2026-10-02 the owner asked that `binn init`, starting and stopping the daemon, registering a project and opening the dashboard all be done from the chat. `binn init` writes into the repository only after a human confirms its plan, and the daemon cannot be started over MCP when it is not running.

## Decision

- Each of these has a skill in the `binnacle` plugin that runs `binn` through the harness's shell, so it works with the daemon stopped.
- `/binnacle:init` asks `binn init` for its plan without writing (`--plan --json`), shows it in the chat, and runs exactly that plan only after the human answers yes in the chat. The plan is identified, so a plan that changed since it was shown is refused.
- A human's answer in the chat is a confirmation, as Enter at a terminal is (ADR-0034). An agent cannot give it: the skills are started by a human only (`disable-model-invocation`), and an agent never answers its own confirmation.

## Consequences

- `binn init` gains a non-interactive form that writes a given plan and nothing else.
- ADR-0026's terms stand: shown first, nothing overwritten, nothing committed.
