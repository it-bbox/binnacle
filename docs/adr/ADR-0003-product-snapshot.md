# ADR-0003: Fresh Product Sessions Use Project Snapshots

**Status:** Accepted

## Context

Long-lived Product chats consume growing context, compact repeatedly and eventually become expensive/unreliable.

## Decision

Product is a logical role, not a persistent conversation. New sessions start from a compact Product Snapshot generated from current project state. `/checkpoint` persists only durable delta before rotation.

## Consequences

- old conversation history is not required for continuity;
- model/provider can change between Product sessions;
- Project Brain quality becomes measurable;
- snapshot design must stay compact and current.
