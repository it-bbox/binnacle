# ADR-0007: Telemetry Must Preserve Source and Uncertainty

**Status:** Accepted

## Decision

Do not normalize missing provider telemetry into invented values. Fields may be null. Derived or estimated metrics must carry provenance.

## Consequences

- cross-provider dashboards may have asymmetric detail;
- comparisons remain honest;
- adapters can evolve independently.
