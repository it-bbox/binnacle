# ADR-0015: Local Storage and Migration Policy

**Status:** Accepted

## Context

Binnacle is installed by strangers who upgrade without reading a changelog, on three operating systems. A native SQLite binding means `node-gyp`, prebuilt binaries per platform and per Node version, and a first-run failure mode we would then have to support.

ADR-0002 already establishes that the local database is a projection, not a source of truth.

## Decision

- Use **`node:sqlite`** from the Node standard library. No native modules, no build step.
- One database per machine under `~/.binnacle/`, overridable with `BINNACLE_HOME`. Project directories hold `.binnacle/project.yaml` in Git and a disposable `.binnacle/cache/`.
- Migration policy has exactly two tiers:
  - **Projections** — `Project`, `Task`, `Review`, `Snapshot`, `AttentionItem` — are dropped and rebuilt from canonical sources on a schema version mismatch. They are never migrated.
  - **Ingested telemetry and events** live in one append-only table of normalised records with provenance. This table is migrated properly and never recreated, because it is the only copy of what was parsed out of third-party artifacts.

## Rationale

One machine-level database is what makes the cross-project Overview possible at all. The two-tier rule replaces a per-table migration suite with a single sentence, and it is ADR-0002 that makes it safe.

## Consequences

- A rebuild is a normal, expected operation rather than a recovery procedure.
- Artifacts that are gone from disk cannot be re-ingested, which is exactly why the raw table is never dropped.
- `better-sqlite3` and similar native bindings are excluded for v1.
