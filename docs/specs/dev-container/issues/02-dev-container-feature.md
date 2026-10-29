# 02: Binnacle's dev container feature

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/dev-container/spec.md`
Roles: Developer, Reviewer, DevOps

**What to build:** a developer who adds `ghcr.io/it-bbox/binnacle/binnacle:1` to their `devcontainer.json`, with Node 24 in the image, gets `binn` installed from npm, Binnacle's home on a volume of this container's own, and a daemon bound to every interface that accepts the host-side address and starts with the container. This ticket covers the spec's *The dev container feature*.

The feature's source sits beside the CLI app, as the dev container features format lays it out: a `devcontainer-feature.json` and an `install.sh`, the one shell script the format requires (spec, *Contested points*). Options: `version`, the npm version, `latest` by default; `hostPort`, `7717` by default. It installs after the official Node feature, and `install.sh` fails with a message saying to add Node when Node 24 or later is missing. `containerEnv` sets `BINNACLE_HOME` to a fixed directory and `BINNACLE_HOST` to `0.0.0.0`; `install.sh` writes `BINNACLE_ALLOWED_HOSTS` for `127.0.0.1:<hostPort>` and `localhost:<hostPort>` into the start command it installs; `mounts` puts `BINNACLE_HOME` on a named volume carrying `${devcontainerId}`; `postStartCommand` starts the daemon, and one already running is not an error. The feature neither publishes the port nor mounts the harness's home.

- [ ] With `node:test` in the CLI app's tests: `devcontainer-feature.json` parses; it names `version` and `hostPort` with their defaults; it sets `BINNACLE_HOST` to `0.0.0.0` and `BINNACLE_HOME` to the mount's target; `postStartCommand` starts the daemon; `install.sh` reads both options and installs `@it-bbox/binnacle`.
- [ ] A live test beside `apps/cli/test/mod.live.ts`, skipped unless `docker` and `devcontainer` are on PATH and never run in CI: `devcontainer features test` builds a container with the feature from this repository, where `binn` runs, the daemon answers `/health`, and `BINNACLE_HOME` is on the volume.
- [ ] Starting the container twice starts the daemon both times, a stale runtime file from the first run not blocking the second.
- [ ] `CONTRIBUTING.md`'s *Releasing* and its Russian twin say how the owner publishes the feature to `ghcr.io/it-bbox` and when its version moves.
