# ADR-0009: Product Name Is Binnacle

**Status:** Accepted

## Context

The product had no name. Documentation referred to it as "Dev Control", with a CLI `devctl` and a daemon `devd`. A name was required before creating the repository, and the name would propagate into the CLI, the daemon, package scopes and every doc.

## Decision

The product is **Binnacle**.

- CLI: `binn`
- daemon: `binnd`
- packages: `@binnacle/core`, `@binnacle/mcp`, `@binnacle/telemetry`, `@binnacle/adapters`
- repository: `binnacle`

A binnacle is the stand that holds a ship's compass in front of the helm. It does not steer and it does not choose the course; it keeps the instruments where the helmsman can read them.

## Rationale

- The metaphor constrains the product in the direction already committed to in ADR-0001 and the manual-first principle: instruments for a human, not an autopilot. A future proposal to auto-launch AgentRuns reads as off-name, which is the point.
- The npm scope `@binnacle/*` is free. The only namesake, the npm package `binnacle` (a jQuery client for the defunct Binnacle.io logging service, v0.0.5), is dead.
- Short binaries keep everyday use cheap: `binn` is four characters, and `binnd` follows the `sshd`/`httpd` convention. `binnacled` was rejected because it reads as a participle.

## Consequences

- All documentation uses Binnacle / `binn` / `binnd`; `devctl` and `devd` no longer exist.
- Published packages must be scoped: the bare npm name `binnacle` is taken.
- The word is unfamiliar to most English readers, so `README.md` carries a one-line explanation of it.
- `binnacle.dev` and `binnacle.app` resolve to other owners. `binnacle.io` and `binnacle.sh` had no DNS records when this decision was made; verify with a registrar before relying on either.
- The single-`n` misspelling `binacle` is a predictable typo; register it defensively wherever that is cheap.
