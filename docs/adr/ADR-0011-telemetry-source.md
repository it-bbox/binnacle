# ADR-0011: Session Artifacts Are the Primary Telemetry Source

**Status:** Accepted

**Supersedes:** the statement in `README.md` that OpenTelemetry is the primary telemetry transport, and the OTel-first ordering of Phase 4 in `docs/05-mvp-plan.md`.

## Context

Coding harnesses write session artifacts to local disk. Measured on a development machine: Claude Code keeps 617 MB under `~/.claude/projects/<slug>/<session>.jsonl`, Codex keeps 636 MB under `~/.codex/`, of which 54 MB are session rollouts. Both record per-call token usage.

OpenTelemetry requires every user to configure an exporter inside their harness before any data exists, and it can never produce history for work already done.

## Decision

Reading local session artifacts is the **primary** telemetry path. OpenTelemetry is an **optional** additional path for live streaming and for harnesses whose artifacts cannot be parsed.

## Rationale

- An open-source tool that shows an empty dashboard until the user configures OTel loses the user at first run.
- Artifacts already on disk give retroactive history, which OTel cannot.
- The concepts reported by different harnesses match even where field names do not, so normalisation is renaming, not invention: Claude's `cache_creation_input_tokens` / `cache_read_input_tokens` / `thinking_tokens` correspond to Codex's `cache_write_input_tokens` / `cached_input_tokens` / `reasoning_output_tokens`.

## Consequences

- Aggregation semantics are part of the adapter contract: Claude reports per-message deltas, Codex reports running totals. Summing them the same way double-counts.
- Artifact formats are owned by third parties and can change without notice; adapters must fail loudly and degrade to a lower support level rather than emit wrong numbers.
- Provenance tagging from ADR-0007 carries the asymmetry between sources.
