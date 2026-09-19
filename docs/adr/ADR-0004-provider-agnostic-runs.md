# ADR-0004: Separate Harness, Provider, Model and Role

**Status:** Accepted

## Decision

AgentRun identity separates:

- role;
- coding harness/client;
- provider;
- model;
- profile/account configuration.

## Rationale

The same harness may route to different providers, and one Task may move between Claude, Codex, GLM, Gemini or local models.

## Consequences

Usage comparisons and handoffs remain possible without coupling project state to one vendor.
