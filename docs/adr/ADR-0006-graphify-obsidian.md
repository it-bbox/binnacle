# ADR-0006: Graphify and Obsidian Are Recommended Capabilities, Not Kernel Dependencies

**Status:** Accepted

## Decision

Graphify is the recommended architecture/dependency graph provider for the Standard profile. Obsidian is the recommended human-facing knowledge view. Neither is required for Binnacle kernel correctness.

## Consequences

- user gets the intended high-value workflow;
- system stays replaceable/portable;
- canonical state is not trapped in generated graph/vault files.
