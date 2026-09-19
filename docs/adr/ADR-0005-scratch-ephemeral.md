# ADR-0005: `.scratch` Is Ephemeral and Worktree-Local

**Status:** Accepted

## Decision

`.scratch` remains useful for Matt Pocock/task/run working artifacts but is not canonical durable state. Concurrent worktrees must not share one writable scratch directory.

Durable outcomes are promoted to tracker/spec/CONTEXT/ADR before scratch/worktree cleanup.

## Consequences

- avoids scratch race conditions;
- avoids old temporary notes polluting Project Brain/Graphify;
- requires an explicit knowledge-promotion/checkpoint step.
