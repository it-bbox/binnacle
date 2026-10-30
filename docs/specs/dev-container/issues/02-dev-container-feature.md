# 02: Binnacle's dev container feature

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/dev-container/spec.md`
Roles: Developer, Reviewer, DevOps

**What to build:** a developer who adds `ghcr.io/it-bbox/binnacle/binnacle:1` to their `devcontainer.json`, with Node 24 in the image, gets `binn` installed from npm, Binnacle's home on a volume of this container's own, and a daemon bound to every interface that accepts the host-side address and starts with the container. This ticket covers the spec's *The dev container feature*.

The feature's source sits beside the CLI app, as the dev container features format lays it out: a `devcontainer-feature.json` and an `install.sh`, the one shell script the format requires (spec, *Contested points*). Options: `version`, the npm version, `latest` by default; `hostPort`, `7717` by default. It installs after the official Node feature, and `install.sh` fails with a message saying to add Node when Node 24 or later is missing. `containerEnv` sets `BINNACLE_HOME` to a fixed directory and `BINNACLE_HOST` to `0.0.0.0`; `install.sh` writes `BINNACLE_ALLOWED_HOSTS` for `127.0.0.1:<hostPort>` and `localhost:<hostPort>` into the start command it installs; `mounts` puts `BINNACLE_HOME` on a named volume carrying `${devcontainerId}`; `postStartCommand` starts the daemon, and one already running is not an error. The feature neither publishes the port nor mounts the harness's home.

- [x] With `node:test` in the CLI app's tests: `devcontainer-feature.json` parses; it names `version` and `hostPort` with their defaults; it sets `BINNACLE_HOST` to `0.0.0.0` and `BINNACLE_HOME` to the mount's target; `postStartCommand` starts the daemon; `install.sh` reads both options and installs `@it-bbox/binnacle`.
- [x] A live test beside `apps/cli/test/mod.live.ts`, skipped unless `docker` and `devcontainer` are on PATH and never run in CI: `devcontainer features test` builds a container with the feature from this repository, where `binn` runs, the daemon answers `/health`, and `BINNACLE_HOME` is on the volume.
- [x] Starting the container twice starts the daemon both times, a stale runtime file from the first run not blocking the second.
- [x] `CONTRIBUTING.md`'s *Releasing* and its Russian twin say how the owner publishes the feature to `ghcr.io/it-bbox` and when its version moves.

## Comments

### Decisions

- **Where it lives.** `apps/devcontainer-feature/src/binnacle/`, beside the CLI app, a features collection with one feature: `devcontainer-feature.json` and `install.sh`. It has no `package.json`, so pnpm leaves it alone; `docs/07-initial-repository-layout.md` and `CONTRIBUTING.md`'s layout name it.
- **`BINNACLE_HOME` is `/var/lib/binnacle/home`, a directory inside the mount's target `/var/lib/binnacle`**, not the target itself. `install.sh` cannot give the volume to the container's user: that user may come from a feature installed later, and on Linux the dev container CLI changes its UID to the host's after the build. So the volume is `1777`, as `/tmp` is, and the daemon creates its home inside it, `0700`, as whichever user runs it. The first criterion reads "inside the mount's target" for this.
- **The start command** is `/usr/local/share/binnacle-start.sh`, written by `install.sh` with `BINNACLE_ALLOWED_HOSTS=127.0.0.1:<hostPort>,localhost:<hostPort>`. A daemon that answers `binn daemon status` is left running. Otherwise the runtime file is removed before `binn daemon start`: after a container restart the old pid can name another live process, and `binn daemon start` alone then says "already running" and starts nothing (seen by hand). A daemon that fails to start prints a line and leaves the container up (principle 3).
- **`hostPort`** must be 1 to 65535, checked by `install.sh` so that a bad value fails the build, not the daemon.
- **The feature's version is `0.1.0`**: ticket 04 makes it `1.0.0` (spec, *The release*).

### For the next tickets

- Ticket 03: the feature line is `"ghcr.io/it-bbox/binnacle/binnacle:1": { "hostPort": "7717" }`, after `"ghcr.io/devcontainers/features/node:1": { "version": "24" }`; the developer publishes the port (`appPort: ["127.0.0.1:7717:7717"]`) and mounts the harness's home. By hand, the same is: `npm install -g @it-bbox/binnacle`, `BINNACLE_HOST=0.0.0.0`, `BINNACLE_ALLOWED_HOSTS=127.0.0.1:<port>,localhost:<port>`, `BINNACLE_HOME` on a volume, and the start command's three lines. `documentationURL` in `devcontainer-feature.json` points at the repository; point it at the guide.
- Ticket 04: the live test installs `binn` from npm at `latest`, and checks `bind` and `allowedHosts`, which 0.6.0 does not write: run it after 0.7.0 is on npm and before publishing the feature.

### Checks for a human

The live test needs `docker`, the dev container CLI and 0.7.0 on npm, none of which this run had (it was skipped). The same flow was checked by hand with Docker: `install.sh` run on `node:24-slim` with the package packed from this branch, the daemon started as UID 1234 with its home on a named volume, `/health` answering on `127.0.0.1:7719` and `localhost:7719` from the host, `docker restart` with the stale runtime file, and with its pid pointing at a live process, the daemon starting again each time. Once 0.7.0 is published:

```bash
npm install -g @devcontainers/cli
node --test apps/cli/test/devcontainer.live.ts
```

Both tests pass, not skipped; then tick the second and third criteria.

### Review

Against `main`, in a sub-agent, on the standards, the spec and the ticket's DevOps role. Typecheck and the full suite pass; the live test is skipped here.

1. **The live test fails until 0.7.0 is on npm**: it installs `latest`, which writes no `bind`. **Kept**: the feature installs from npm by design; ticket 04 runs it after the release (*For the next tickets*).
2. **The home could belong to a stale UID**: the dev container CLI changes the user's UID after the build, and `install.sh` chowned the home to the old one. **Fixed**: the volume is `1777` and `BINNACLE_HOME` a directory inside it, created by the daemon.
3. **`chown` failed for a user a later feature creates.** **Fixed** by the same change: `install.sh` no longer names the user.
4. **`CONTRIBUTING.md` said the registry never takes a version twice**; the CLI skips a published version. **Fixed** in both languages.
5. **The live test left the feature's volume and, on a failed `up`, the workspace.** **Fixed**: new `binnacle-*` volumes are removed, and the workspace is removed first.
6. **`hostPort` took 0 and 99999.** **Fixed**: 1 to 65535.
7. **A daemon that failed to start failed `devcontainer up`.** **Fixed**: the start command says so and exits 0.
8. **`proposals` repeated the defaults, and the description promised the host-side address unconditionally.** **Fixed**. `documentationURL` stays the repository's until ticket 03.
9. **The layout tree's comment is out of column.** **Kept**: the directory name is longer than the column.

#### DevOps

The format, the option variables, the `${devcontainerId}` volume, `postStartCommand` and `installsAfter` are right; the detached daemon survives the lifecycle command; nothing runs in CI (`ci-workflow.test.ts` pins the three jobs). Findings 2, 3, 5 and 7 above were DevOps's, all fixed.

### The live test, run by the owner

The last two criteria hold (the owner, 2026-10-30, in ticket 04's exit demonstration): `node --test apps/cli/test/devcontainer.live.ts` passes 2 of 2 against 0.7.0 from npm, with `TMPDIR` inside the home, since Docker Desktop on Linux mounts nothing from `/tmp`.
