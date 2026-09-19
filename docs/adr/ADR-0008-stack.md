# ADR-0008: TypeScript/Node/Nuxt Stack

**Status:** Accepted

## Decision

Use:

- TypeScript for all first-party application code;
- Node.js 24 LTS baseline;
- pnpm workspace;
- Nuxt for Web Dashboard;
- SQLite for local v1 projection storage — specifically `node:sqlite`, see ADR-0015.

Avoid additional application runtimes/microservices unless a later requirement justifies them.

## Rationale

The system is predominantly local tooling, APIs, event/state processing and a dashboard. One TypeScript stack reduces operational and cognitive overhead.
