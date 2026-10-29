# 03: The guide to Binnacle in a container

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/dev-container/spec.md`
Roles: Developer, Reviewer

**What to build:** a developer who works in containers finds, from the README, one page in their language that tells them how to put Binnacle into each app container and open its dashboard from the host safely. This ticket covers the spec's *The guide*.

A new page in `docs/operations/` with its Russian twin, each linking the other, linked from the README, the installation checklist and their twins.

- [ ] The guide says why Binnacle goes inside each app container, beside the harness, and not into one container of its own.
- [ ] It gives the feature's line with its options, the port published with `appPort` as `127.0.0.1:<port>:7717` or forwarded with `forwardPorts`, and the harness's home on a volume, `~/.claude` and `~/.claude.json` for Claude Code.
- [ ] It gives the same by hand: a `Dockerfile`, and a `docker compose` service with its ports, environment, volume and start command.
- [ ] It says why the port is published on `127.0.0.1` and never as a bare `<port>:7717`: Docker's own rules reach the local network past `ufw`.
- [ ] It gives each container its own host port, 7717, 7718 and so on, and says the allowed `Host` must name the host-side port.
- [ ] It says `binn init` runs once per project inside the container, and `binn dashboard` prints the address the host opens.
- [ ] It leaves a place for the footprint, one daemon's memory and its home's size, which the exit demonstration fills.
- [ ] `apps/cli/test/user-guides.test.ts` passes: both pages exist, link each other, and every relative link resolves.
