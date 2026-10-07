# ADR-0038: OpenTelemetry Is the Path for Any Harness

**Status:** Accepted

**Extends:** ADR-0011, which made session artifacts the primary source and OpenTelemetry an optional, later path.

## Context

The owner works in one project from many harnesses in turn — Claude Code desktop, Codex CLI and desktop, a GLM desktop client, Antigravity, and others to come — and wants all of them counted. A session-artifact reader per harness never catches up with that list. OpenTelemetry was meant for this, and was deferred to *Later* when epic 4 was specified.

## Decision

- The daemon receives OpenTelemetry (OTLP over HTTP, on its local address). `binn init` configures the export in every detected harness that supports it.
- Any harness that exports OpenTelemetry is counted without an adapter of its own.
- Session artifacts stay: they give history before the export was configured, and cover harnesses without OpenTelemetry. A call seen through both is counted once.
- Provenance stays as ADR-0007 says: a value no harness reported is `null`.

## Consequences

- The specification of epic 10 lists which of the owner's harnesses export OpenTelemetry and adds artifact readers for the ones that do not.
- Support level 4 (ADR-0014) becomes reachable.
- The receiver takes no token, as `/health` takes none: an exporter is configured with an endpoint alone, and writing Binnacle's token into each harness's settings would spread it. The `Host` and `Origin` checks still apply, and an event gives no more than a call's metadata and token counts, so a local process can add usage records as it could already write a harness's artifacts, and read nothing (recorded by ticket 01 of epic 10, 2026-10-07).
