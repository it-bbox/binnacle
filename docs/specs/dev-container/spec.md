# Spec: Binnacle in a dev container

Status: READY
Triage: ready-for-agent

Epic 23, from its grilling's brief, `docs/specs/dev-container/brief.md` (2026-10-29), ADR-0048, and the product inbox's entry planned into it, *Binnacle in a dev container* (2026-10-25). Exit criterion: in a clean dev container whose `devcontainer.json` names Binnacle's feature and publishes port 7717 on the host's loopback, the daemon starts with the container, `binn init` registers the project, and `binn dashboard` prints an address that opens the dashboard in the host's browser, with no patch to the package. The registration survives a rebuild. A daemon on a host machine with nothing set behaves as in 0.6.0. The guide states one container's footprint, measured. 0.7.0 and the feature's 1.0.0 are installed from their registries. The owner confirmed the test seams on 2026-10-29, recorded under *Further Notes*.

## Problem Statement

A developer who keeps each project's development in a container of its own, the harness inside it and nothing on the host, cannot use Binnacle there without patching it. Binnacle has to run inside each app container, since the daemon reads the harness's session artifacts and the checkout from disk and the harness starts `binn mcp` as a local process, and nothing says how to put it there.

Once it is there, its dashboard cannot be reached from the host. The daemon binds `127.0.0.1`, hard-coded, which is the container's own loopback: a port published to the host does not reach it. It also refuses any request whose `Host` is not the address it bound, so a port forwarded under another number is refused too. The one developer who got it working replaced the address in the installed package, and every update undid it.

## Solution

The daemon's bind address and the extra `Host` values it accepts become the user's to set, from the environment, read when the daemon starts (ADR-0048). With nothing set, it behaves exactly as before. The token, the `Origin` rule and the `Host` check stay. The OpenTelemetry endpoint, which has no token, takes calls only from the machine's own loopback.

A dev container feature, published under `ghcr.io/it-bbox`, does in one line of `devcontainer.json` what a developer would otherwise do by hand: it installs `@it-bbox/binnacle` from npm, keeps Binnacle's home on a volume, binds the daemon to every interface inside the container, accepts the host-side address, and starts the daemon with the container. A guide in both languages describes the feature, the same steps by hand for an image built without features and for `docker compose`, how to publish the port on the host's loopback only, what to keep on a volume for the harness, and what one container's Binnacle costs, measured.

## User Stories

1. As a developer working in containers, I want to add Binnacle to my app container with one line in `devcontainer.json`, so that I do not assemble the install myself.
2. As that developer, I want the feature to install `@it-bbox/binnacle` from npm, so that it is the same Binnacle as on a host.
3. As that developer, I want to pin the npm version through the feature's option, so that a rebuild does not upgrade Binnacle behind my back.
4. As that developer, I want the latest npm version when I pin nothing, so that the default stays current without a new feature release.
5. As that developer, I want the feature to fail its install with a clear message when the image has no Node 24, so that I know to add Node first.
6. As that developer, I want the feature installed after the Node feature when both are listed, so that the order in my file does not matter.
7. As that developer, I want the daemon started when the container starts, so that I need no service manager inside it.
8. As that developer, I want a restarted container to start the daemon again without complaint, so that a stale runtime file from the last run does not block it.
9. As that developer, I want Binnacle's home on a volume of this container's own, so that a rebuild keeps the registration, the token and the history.
10. As a developer with 20 containers, I want each container's Binnacle home kept apart, so that one project's state never mixes with another's.
11. As that developer, I want to say which host port I publish, so that the daemon accepts the address my browser uses.
12. As that developer, I want the feature to accept both `127.0.0.1` and `localhost` at that port, so that either address opens the dashboard.
13. As that developer, I want `binn dashboard` inside the container to print the address my host's browser opens, with the token in its fragment, so that I can open it from the host.
14. As that developer, I want `binn dashboard` not to try to open a browser that the container does not have, beyond saying it could not, so that the printed address is what I use.
15. As that developer, I want `binn daemon status` to show the address the daemon binds and the addresses it accepts, so that I can tell why a request is refused.
16. As that developer, I want `binn mcp`, the CLI and the harness's telemetry export to keep reaching the daemon inside the container, so that binding every interface breaks nothing local.
17. As that developer, I want the telemetry export's address written as the container's loopback, not as `0.0.0.0`, so that the harness's settings name a real address.
18. As a developer with several containers on one Docker network, I want the OpenTelemetry endpoint closed to the other containers, so that none of them can write usage into my project's history.
19. As that developer, I want every operation still to require the token, so that a published port is no weaker than loopback on a host.
20. As that developer, I want a request with a `Host` I did not allow refused, as before, so that DNS rebinding from a page in my browser still fails.
21. As that developer, I want an `Origin` accepted only when it names an address the daemon accepts, so that a page from anywhere else cannot call it.
22. As a user on a host machine who sets nothing, I want the daemon to bind `127.0.0.1` and accept only that address, so that upgrading changes nothing for me.
23. As a user who sets a bind address Binnacle does not support, I want the daemon to refuse to start and say which values it takes, so that a typo does not leave it listening somewhere unexpected.
24. As a user who sets an allowed `Host` value without a port, I want the daemon to refuse to start and say the form it takes, so that a value that could never match is caught at once.
25. As a user, I want `binn --help` to list the new variables in my language, so that I find them where `BINNACLE_PORT` is.
26. As a developer who does not use the feature, I want a guide that does the same steps by hand in a `Dockerfile`, so that I can build my own image.
27. As a developer using `docker compose`, I want the guide to give the service's ports, environment, volume and start command, so that I can copy them.
28. As a developer, I want the guide to publish the port as `127.0.0.1:7717:7717` and say why a bare `7717:7717` reaches my local network past `ufw`, so that I do not expose the dashboard by accident.
29. As a developer with several containers, I want the guide to give each one its own host port, 7717, 7718 and so on, so that their dashboards do not collide.
30. As a developer whose editor forwards ports, I want the guide to say what the forwarded address must be allowed as, so that a forward under another number works too.
31. As a developer, I want the guide to say which harness directories to keep on a volume, `~/.claude` and `~/.claude.json` for Claude Code, so that a rebuild keeps the MCP registration `binn init` wrote.
32. As a developer, I want the guide to say `binn init` runs once per project, inside the container, so that I know where to run it.
33. As a developer deciding whether to run 20 Binnacles, I want the guide to state one container's memory and disk, measured with the date and the setup, so that I know the cost before I start.
34. As a reader of the guide in Russian, I want its twin, linked both ways, so that I read it in my language.
35. As a visitor of the README, I want a pointer to the container guide in both languages, so that I find it without reading `docs/`.
36. As a developer, I want Binnacle to write nothing into my repository, so that the feature line is mine to add and remove.
37. As a developer whose container stops the daemon, I want the project still to be developed as before, so that Binnacle stays optional inside a container as on a host.
38. As the owner, I want the feature's source in this repository, so that it changes in the same review as the daemon it configures.
39. As the owner, I want a check that the feature's files and options agree, so that a renamed option or variable is caught in `pnpm test`.
40. As the owner, I want a live test that builds a container with the feature where Docker and the dev container CLI are installed, so that I can check it before publishing without slowing CI.
41. As the owner, I want to publish the feature to `ghcr.io/it-bbox` myself, as I publish npm, so that nothing is released without me.
42. As the owner, I want 0.7.0 and the feature's 1.0.0 installed from their registries into a clean dev container in the exit demonstration, so that what users get is what I checked.

## Implementation Decisions

- **Two variables, read by the daemon when it starts** (ADR-0048), beside `BINNACLE_PORT`:
  - `BINNACLE_HOST`, the address the daemon binds: `127.0.0.1`, the default, or `0.0.0.0`, every interface. Anything else is refused at start with an error naming both.
  - `BINNACLE_ALLOWED_HOSTS`, comma-separated `host:port` values accepted as `Host` beyond the daemon's own address, such as `127.0.0.1:7718,localhost:7718`. Each is trimmed and lower-cased; an empty list is the default; a value without a port is refused at start with an error giving the form.
  - Both are resolved the way `resolvePort` resolves `BINNACLE_PORT`, and passed to `startDaemon`, which takes them as options so tests need no environment.
- **The runtime file carries what clients need.** `host` stays the address a client on this machine connects to: the bind address, or `127.0.0.1` when the daemon binds `0.0.0.0`. The file gains `bind`, the address bound, and `allowedHosts`, the list above. `binn mcp`, the CLI's client, `binn daemon status` and the export's address read it as today and so keep reaching the daemon over loopback. Clients never read the two variables themselves.
- **The `Host` check** accepts the daemon's own address, `host:port` from the runtime file, and each allowed value; anything else is `request.forbidden_host`, as today, with the accepted addresses in its params.
- **The `Origin` check** keeps its rule: absent, or `http://` followed by an accepted `Host` value. Anything else is `request.forbidden_origin`.
- **The OpenTelemetry endpoint** accepts a call only when the connection's peer is a loopback address, `127.0.0.1` or `::1`, IPv4-mapped included; anything else is refused with a new code, `request.forbidden_peer`, 403, worded in both languages in `@binnacle/core`. On a host this changes nothing, since a daemon bound to loopback has no other peer. The harness's exporter, inside the same container, reaches it at the runtime file's `host`.
- **`/health`** stays without a token and goes through the `Host` check, as today.
- **`binn dashboard`** builds its address from the first allowed value when there is one, and from the runtime file's `host` and `port` otherwise, as today; the token stays in the fragment (ADR-0031). When the opener fails, as it does in a container with no browser, it says so and the printed address is what the person opens; `--print` is unchanged.
- **`binn daemon status`** shows the bound address and the accepted addresses beside the address it shows today, in both languages.
- **`binn --help`** lists `BINNACLE_HOST` and `BINNACLE_ALLOWED_HOSTS` beside `BINNACLE_PORT`, in both languages.
- **The dev container feature**, id `binnacle`, published as `ghcr.io/it-bbox/binnacle/binnacle`, versioned on its own from 1.0.0:
  - its source sits beside the CLI app, as the dev container features format lays it out: a `devcontainer-feature.json` and an `install.sh`;
  - options: `version`, the npm version to install, `latest` by default; `hostPort`, the port published on the host, `7717` by default;
  - `installsAfter` the official Node feature; `install.sh` checks for Node 24 or later and fails with a message saying to add it, then runs `npm install -g @it-bbox/binnacle@<version>`;
  - `containerEnv` sets `BINNACLE_HOME` to a fixed directory and `BINNACLE_HOST` to `0.0.0.0`; `install.sh` writes `BINNACLE_ALLOWED_HOSTS` for `127.0.0.1:<hostPort>` and `localhost:<hostPort>` into the start command it installs, since an option's value cannot be read into `containerEnv`;
  - `mounts` puts `BINNACLE_HOME` on a named volume carrying `${devcontainerId}`, so each container keeps its own;
  - `postStartCommand` starts the daemon, and a daemon already running is not an error;
  - it does not publish the port or mount the harness's home: the developer's `devcontainer.json` does both, as the guide shows.
- **The guide**, a new page in `docs/operations/` with its Russian twin, linked from the README and its twin and from the installation checklist:
  - why Binnacle goes inside each app container and not into one of its own;
  - the feature line, `appPort` or `forwardPorts` with the host port, and the harness's volume;
  - the same by hand in a `Dockerfile` and in `docker compose`;
  - `127.0.0.1:<port>:7717`, not `<port>:7717`, and why;
  - a port per container;
  - `binn init` once per project inside the container, and `binn dashboard` for the address;
  - the footprint: one daemon's resident memory and its home's size, one project per container, with the date and the setup, measured in the exit demonstration.
- **Docs**: `docs/01-architecture.md`, *Security boundary*, says the default bind stays loopback and what the user may set, citing ADR-0048; ADR-0031 gains a line that the dashboard's address is the first allowed `Host` when one is set.
- **The release**: the CLI package's version becomes 0.7.0 and the feature's 1.0.0 in the exit demonstration's ticket; the owner publishes both.

## Testing Decisions

A good test exercises behaviour through the seam a caller uses, never an internal function's shape. This epic adds no seam: the daemon is tested through `startDaemon` and raw requests, the CLI through its commands, and the feature through its files and a live build.

- **The daemon's address**, in `apps/daemon/test/daemon.test.ts`, with raw requests as its `Host` tests already send:
  - with nothing set, the bind is `127.0.0.1` and an allowed-looking `Host` such as `localhost:<port>` is still refused;
  - with an allowed value, a request with that `Host` and the token succeeds, and one with that `Host` and no token gets `auth.missing`;
  - a `Host` neither own nor allowed is refused;
  - an `Origin` of `http://` and an allowed value passes, any other is refused;
  - bound to `0.0.0.0`, the runtime file's `host` is `127.0.0.1`, its `bind` is `0.0.0.0`, and a request over loopback succeeds;
  - a bind address other than the two, and an allowed value without a port, are refused by the resolvers with their messages.
- **The OpenTelemetry endpoint**, in `apps/daemon/test/opentelemetry.test.ts`: from loopback it is accepted as today; with the daemon bound to `0.0.0.0`, a call over the machine's own non-loopback address, when it has one, gets `request.forbidden_peer`, and the case is skipped when it has none.
- **The wording**: `request.forbidden_peer` worded in both languages, through the codes test that already covers every code.
- **The CLI**, through `apps/cli/test/dashboard.test.ts` and the smoke test: `binn dashboard --print` gives the first allowed value with the token when the runtime file has one, and the runtime file's address otherwise; `binn daemon status` shows the bound and accepted addresses; the export's address is the runtime file's `host`, never `0.0.0.0`; `binn --help` lists the variables in both languages.
- **The feature's files**, with `node:test` in the CLI app's tests: `devcontainer-feature.json` parses, names the options `version` and `hostPort` with their defaults, sets `BINNACLE_HOST` to `0.0.0.0` and `BINNACLE_HOME` to the mount's target, and starts the daemon in `postStartCommand`; `install.sh` reads both options and installs `@it-bbox/binnacle`.
- **The feature in a container**, as a live test beside `mod.live.ts`, run only where `docker` and `devcontainer` are on PATH, never in CI: `devcontainer features test` builds a container with the feature from this repository and checks that `binn` runs, the daemon answers `/health` inside it, and `BINNACLE_HOME` is on the volume.
- **The guide**: `apps/cli/test/user-guides.test.ts` already fails when a guide lacks its twin or a relative link does not resolve.
- **What a person sees**: the dashboard opened from the host's browser through the published port, a rebuild keeping the registration, two containers on two host ports, and the footprint. These are checked by hand in the exit demonstration.

## Contested points

- **One dashboard over many daemons.** It would save 20 bookmarks, but needs every daemon's token and calls across origins. Taken in the grilling: *Later*, until users with many containers ask.
- **A guide alone, or a feature too.** A guide publishes nothing, but every developer assembles the same steps. Taken in the grilling: both, the owner publishing the feature.
- **Any bind address, or two.** Any address is more general, but a specific non-loopback address would leave the harness's exporter reaching the daemon from that address, which the loopback-only rule for the OpenTelemetry endpoint refuses. Nobody asked for a specific address. Taken: `127.0.0.1` or `0.0.0.0` (ponytail: IPv4 only; `::` when a user on an IPv6-only network asks).
- **The OpenTelemetry endpoint open as before.** The roadmap's line keeps the token and the `Origin` check unchanged and says nothing of the endpoint. Binding `0.0.0.0` would open a write path without a token to every container on the same network. Taken: loopback peers only, which changes nothing on a host.
- **The runtime file's `host`.** Recording `0.0.0.0` would keep the file a plain record of the bind, but `0.0.0.0` is not an address to write into a harness's settings. Taken: `host` is where a client connects, `bind` what was bound.
- **A shell script in a TypeScript-only repository.** The dev container features format runs `install.sh`, and nothing else installs a feature. Taken: the one script the format requires, kept to checking Node, installing the package and writing the start command; it is not application code.
- **The feature in CI.** It would catch a broken feature on every push, but adds minutes to each run and another vendor's CLI to CI. Taken by the owner: a live test where Docker and the dev container CLI are installed, and the exit demonstration.

## Out of Scope

- A dashboard listing or reading other daemons (*Later*).
- A Binnacle image of its own, or one Binnacle container serving others.
- A bind address other than `127.0.0.1` and `0.0.0.0`, and IPv6 binding.
- Autostart carrying `BINNACLE_HOST`, `BINNACLE_ALLOWED_HOSTS` or `BINNACLE_PORT` into its service: a container has no service manager, and a host keeps loopback.
- `binn init` detecting a container, or writing `devcontainer.json`.
- Mounting the harness's home from the feature.
- Any change to the token, its file, or which routes need it.
- The README's "why not Docker" sentence and the requirements up front, planned into epic 24.

## Further Notes

- **Decided in the grilling, by the owner on 2026-10-29** (`brief.md`):
  - one view over many daemons waits, in *Later*;
  - a guide and a dev container feature, the owner publishing the feature.
- **Test seams confirmed by the owner on 2026-10-29**:
  - `startDaemon` and raw requests in `daemon.test.ts` and `opentelemetry.test.ts`;
  - the CLI's `dashboard.test.ts` and the export's address;
  - the feature's files with `node:test`;
  - `devcontainer features test` as a live test where Docker and the dev container CLI are installed, not in CI;
  - the rest by hand in the exit demonstration.
- **Defaults taken from the brief, the docs and Ponytail, not asked**:
  - the variables' names and syntax;
  - the two bind values;
  - the OpenTelemetry endpoint's loopback rule;
  - the runtime file's `host` and `bind`;
  - the feature's id, options and volume;
  - `postStartCommand` for the start;
  - the guide's sections;
  - 0.7.0 and the feature's 1.0.0 in the exit demonstration.
- **Checked while specifying**:
  - the daemon's bind is `LOOPBACK`, overridable only through `startDaemon`'s `host` option, which `bin.ts` never passes;
  - `checkHost` and `checkOrigin` compare against `runtime.host:runtime.port` alone;
  - `binn dashboard`, the CLI's client, `binn daemon status` and the export's address all build `http://<runtime.host>:<runtime.port>`;
  - the dashboard calls `/ops/` relative to its page, so a page served at an allowed address calls the same address;
  - the OpenTelemetry endpoint is checked for `Host` and `Origin` but not for a token or a peer;
  - the artifact roots already follow `CLAUDE_CONFIG_DIR`, so a harness home moved onto a volume is read without change;
  - the autostart service carries no `BINNACLE_*` variable.
- **Order**:
  1. ticket 01: the two variables, the runtime file, the `Host`, `Origin` and peer checks, `binn dashboard`, `binn daemon status`, `binn --help`, and the architecture's and ADR-0031's lines, since the feature and the guide rest on them;
  2. ticket 02: the dev container feature with its files' test and its live test, after 01;
  3. ticket 03: the guide in both languages with the README's and the checklist's pointers, after 02, since it shows the feature;
  4. ticket 04: the exit demonstration last, `ready-for-human`.
- **The exit demonstration**, with the owner:
  - the feature published and 0.7.0 installed from the registries into a clean dev container, with port 7717 published on `127.0.0.1`;
  - `binn init` in the container, `binn dashboard`'s address opened in the host's browser;
  - a rebuild keeping the registration;
  - a second container on 7718, both dashboards open;
  - the OpenTelemetry endpoint refusing a call from the other container;
  - a host install with nothing set behaving as before;
  - one daemon's memory and its home's size measured and written into the guide, in both languages.

## Risks

- **What the epic can break.**
  - Ticket 01 changes the checks every request passes. A mistake could refuse the dashboard on a host, or accept a `Host` it should not. The tests pin the default: nothing set, the same answers as before.
  - The OpenTelemetry endpoint's new peer rule could refuse a harness's own export if a client reached the daemon over anything but loopback. The runtime file's `host` stays loopback, and the test checks the loopback case.
  - `binn dashboard`'s address could name a host-side port that is not published. It prints what the user allowed, and the guide says the two must agree.
- **The riskiest step.** Ticket 02, the feature against a format and a CLI outside this repository, which CI does not run: a feature that does not build fails only in the live test and the demonstration. A feature that fails leaves the developer's container as it was without Binnacle, which is principle 3.
- **What was dropped, and why.**
  - Any bind address: none was asked for, and it would break the loopback rule.
  - The feature mounting the harness's home: each harness keeps it elsewhere, and the developer's container already decides it.
  - The feature in CI: the owner chose not to.
