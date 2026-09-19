# ADR-0014: Harness Support Levels

**Status:** Accepted

## Context

The product promises persistent project context across any coding agent. Agents differ enormously in what they expose: Claude Code records `gitBranch` in its session artifacts and emits explicit `compact_boundary` events with an `auto`/`manual` trigger; Codex records neither, and signals context exhaustion by rotating a `context_window` identifier. A future agent may expose nothing at all.

A binary "supported / not supported" flag cannot describe this honestly.

## Decision

Support is graded:

| Level | Requirement | What the user gets |
| --- | --- | --- |
| 1 — Context | the agent can call an MCP server | project memory: snapshots, tasks, checkpoints, questions and answers |
| 2 — Attribution | a local session artifact carrying `cwd` and a session identifier | session-to-project attribution, timings, history |
| 3 — Usage | that artifact carries token counts | spend analytics, cost, rework metrics |
| 4 — Live | OpenTelemetry or an observable stream | current activity |

**Level 1 is the only requirement for an agent to count as supported, and it needs no adapter at all.** Levels 2 to 4 follow the data that actually exists.

## Consequences

- `binn doctor` and the dashboard report the level reached per harness instead of a checkmark.
- A new agent gains the product's central value — project memory — on the day it can speak MCP, with no code written in `packages/adapters`.
- Harness and provider stay separate dimensions per ADR-0004: GLM is a provider reached through Claude Code or Codex, not a harness. Codex session metadata carries `model_provider` directly, which confirms the split in the data.
