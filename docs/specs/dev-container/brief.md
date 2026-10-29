# Binnacle in a dev container: what the grilling decided

Epic 23's material is `docs/product-inbox.md`: *Binnacle in a dev container* (2026-10-25); and the roadmap's line for epic 23. This brief is what `/to-spec` starts from.

## The problem

Some developers keep each project's development, its harness included, in a container of its own, and nothing on the host. One Binnacle container serving the others cannot work: the daemon reads the harness's session artifacts and the checkout from disk, and the harness starts `binn mcp` as a local stdio process. So Binnacle has to run inside each app container, beside the harness, and nothing says how. Its dashboard cannot be reached from the host either: the daemon binds `127.0.0.1` only, which a published port does not reach, and refuses any `Host` other than the address it bound, which a port forwarded under another number sends. One developer patched the hard-coded address at install, and every package update undoes the patch.

## The outcome wanted

A developer adds Binnacle to an app container in one line, a dev container feature, or by following a guide, and gets a daemon that starts with the container, keeps its registration and the harness's MCP settings across a rebuild, and serves its dashboard on a port published on the host's loopback only. Nothing is patched. The token, the `Origin` check and the default bind stay as they are, and a daemon on a host machine behaves exactly as before. The guide states what one container's Binnacle costs in memory and disk, measured. 0.7.0 and the feature's first version are released with it.

## Who it concerns

Developers who work in containers, the dev container kind or plain `docker compose`, one project per container, with the harness inside; and a visitor who works that way and arrives after epic 24's launch.

## The systems it touches

- the daemon's listener and its `Host`, `Origin` and OpenTelemetry checks (`apps/daemon/src/server.ts`), and where the bind address comes from, beside `BINNACLE_PORT`;
- the runtime file, through which `binn mcp` and the CLI find the daemon, and `binn dashboard`'s address;
- `docs/01-architecture.md`, *Security boundary*, and ADR-0031's address for the dashboard;
- a dev container feature, new, published under `ghcr.io/it-bbox`;
- a new guide in `docs/operations/`, with its Russian twin, and the README's pointer to it in both languages;
- the roadmap's *Later*;
- ADR-0048.

## Decided in the grilling, 2026-10-29

- **One view over many daemons waits.** Each container publishes its own port on the host's loopback, 7717, 7718 and so on, and its dashboard is opened on its own. A dashboard that lists or reads other daemons goes to *Later*, to come back when users with many containers ask for it.
- **A guide and a dev container feature.** The feature does in one line what the guide describes by hand: Node 24, `@it-bbox/binnacle` from npm, the daemon started with the container, the volumes and the bind settings. The guide covers the same steps for an image built without features and for `docker compose`. The owner publishes the feature, as with npm.

Defaults, from the docs and the inbox, not put to the owner:

- **The bind address and the allowed `Host` values are the user's**, from the environment like `BINNACLE_PORT`, and read when the daemon starts. Unset, the daemon binds `127.0.0.1` and accepts only the address it bound, as today (ADR-0048).
- **The token stays on every call** but `/health` and the OpenTelemetry endpoint. **The `Origin` check keeps its rule**: an `Origin`, when sent, must name an address the daemon accepts as `Host`.
- **The OpenTelemetry endpoint takes calls from the container's own loopback only.** It has no token, since an exporter cannot send one, so a bind beyond loopback must not open it to the other containers on the same network.
- **The guide publishes the port on the host's loopback only**, `127.0.0.1:7717:7717`, and says why: a bare `7717:7717` reaches the local network, through rules Docker writes past `ufw`. Inside the container the daemon binds every interface, which the container's network isolates.
- **What survives a rebuild is on a volume**: `~/.binnacle`, and the harness's home, `~/.claude` and `~/.claude.json` for Claude Code. `binn init` runs once per project, inside the container.
- **The daemon starts with the container**, from the feature's start command or the guide's; a container has no service manager, so autostart is not used there.
- **`binn dashboard` inside a container prints the address the host opens**, the first allowed `Host` value, with the token in its fragment, as ADR-0031 does on a host.
- **The footprint is measured, not assumed**: one daemon's memory and its home's size, one project per container, written into the guide with the date and the setup.
- **Nothing is written into a project's repository** (ADR-0020): the developer adds the feature to their own `devcontainer.json`.
- **The epic ends with its exit demonstration and 0.7.0.** The last ticket is the exit demonstration, `ready-for-human`: the feature and 0.7.0 installed from the registries into a clean dev container, the dashboard opened from the host through the published port, and the owner's manual checks. The owner publishes, as before.

## Constraints and open questions

- Binnacle stays optional in a container as on a host: without the daemon the project is developed as before (`AGENTS.md`, principle 3). A default install on a host changes in nothing.
- No container runtime becomes a requirement, and no image of Binnacle is published: the feature installs the npm package into the developer's own image.
- Open: the variables' names and the allowed values' syntax; which address the runtime file gives clients when the daemon binds every interface; how the OpenTelemetry endpoint tells a loopback caller; the feature's id, its options, which harness homes it mounts and how its version follows npm's; where its source lives in this repository and how CI tests it; which editor's forwarding, if any, the guide covers beside a published port.
