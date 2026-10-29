# ADR-0048: The Bind Address and the Allowed Hosts Are the User's

**Status:** Accepted. Narrows `docs/01-architecture.md`, *Security boundary*, and ADR-0031's address for the dashboard: the default bind stays loopback.

## Context

The daemon binds `127.0.0.1`, hard-coded, and refuses any request whose `Host`, or `Origin` when sent, does not name the address it bound; every call under `/ops/` carries the token from a `0600` file. Inside a container, loopback is the container's own: a port published to the host does not reach it, and a port forwarded under another number sends a `Host` the daemon refuses. A developer who runs every project in a container of its own patched the address at install to reach the dashboard from the host, and each update undid it (`docs/specs/dev-container/brief.md`). The OpenTelemetry endpoint takes no token, because a harness's exporter is configured with an endpoint and nothing else.

## Decision

- The user may set **the address the daemon binds** and **the `Host` values it accepts** beyond that address, from the environment, read when the daemon starts, like `BINNACLE_PORT`. Unset, it binds `127.0.0.1` and accepts only the address it bound, as before.
- **The token is unchanged**: every call but `/health` and the OpenTelemetry endpoint carries it.
- **The `Origin` check keeps its rule**: an `Origin`, when sent, must name an address the daemon accepts as `Host`. The `Host` and `Origin` checks stop DNS rebinding from a page in the browser; they are not authentication.
- **The OpenTelemetry endpoint accepts calls from a loopback peer only**, whatever the bind, since it has no token to stand in for.
- Binnacle's guide for containers binds every interface inside the container and publishes the port on the host's loopback only.

## Considered Options

- **A proxy inside the container rewriting `Host` and `Origin`.** Rejected: one more process to install and supervise in every container, untried, and it rewrites the very headers the checks read.
- **Host networking with a port of its own per container.** Rejected: it works for one container, and with several it breaks their routing.
- **Dropping the `Host` check when the daemon binds beyond loopback.** Rejected: DNS rebinding would turn any page the developer opens into a client of the published port.

## Consequences

- A daemon on a host machine behaves as before unless its user sets the address.
- A user who publishes the port beyond the host's loopback exposes it to their network; the token still guards every operation, and the guide says to publish on `127.0.0.1` only.
- `binn mcp`, the CLI and `binn dashboard` find the daemon's address through the runtime file and must reach it when it binds every interface.
