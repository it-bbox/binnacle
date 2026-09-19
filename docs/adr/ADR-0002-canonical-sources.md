# ADR-0002: Canonical Project State Stays Outside Binnacle

**Status:** Accepted

## Decision

Durable source of truth remains Git + Markdown docs/ADR/specs + GitHub/GitLab tracker. Binnacle DB is a local projection/cache and runtime history store.

## Consequences

- Binnacle failure does not lock project development;
- migration/backup is simpler;
- some state must be reconciled across adapters;
- duplicate project-management implementation is avoided.
