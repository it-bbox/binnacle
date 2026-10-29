# 03: The guide to Binnacle in a container

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/dev-container/spec.md`
Roles: Developer, Reviewer

**What to build:** a developer who works in containers finds, from the README, one page in their language that tells them how to put Binnacle into each app container and open its dashboard from the host safely. This ticket covers the spec's *The guide*.

A new page in `docs/operations/` with its Russian twin, each linking the other, linked from the README, the installation checklist and their twins.

- [x] The guide says why Binnacle goes inside each app container, beside the harness, and not into one container of its own.
- [x] It gives the feature's line with its options, the port published with `appPort` as `127.0.0.1:<port>:7717` or forwarded with `forwardPorts`, and the harness's home on a volume, `~/.claude` and `~/.claude.json` for Claude Code.
- [x] It gives the same by hand: a `Dockerfile`, and a `docker compose` service with its ports, environment, volume and start command.
- [x] It says why the port is published on `127.0.0.1` and never as a bare `<port>:7717`: Docker's own rules reach the local network past `ufw`.
- [x] It gives each container its own host port, 7717, 7718 and so on, and says the allowed `Host` must name the host-side port.
- [x] It says `binn init` runs once per project inside the container, and `binn dashboard` prints the address the host opens.
- [x] It leaves a place for the footprint, one daemon's memory and its home's size, which the exit demonstration fills.
- [x] `apps/cli/test/user-guides.test.ts` passes: both pages exist, link each other, and every relative link resolves.

## Comments

### Decisions

- **The page** is `docs/operations/07-containers.md`, *Binnacle in a Container*, with its twin; linked from the README's install paragraph and *User guides*, the installation checklist's opening, their twins and `MANIFEST.md`. The feature's `documentationURL` now points at it, as ticket 02 left for this ticket.
- **Claude Code's two places on one volume**: a volume holds a directory, not a file, so `CLAUDE_CONFIG_DIR` puts `.claude.json` beside the rest in `/home/node/.claude`, which Binnacle already follows (`apps/cli/src/tools.ts`, `export.ts`, `apps/daemon/src/home.ts`).
- **By hand**, the image sets what every container shares (`BINNACLE_HOME`, `BINNACLE_HOST`, `CLAUDE_CONFIG_DIR`), and the container what is its own: the port, `BINNACLE_ALLOWED_HOSTS` and the volumes. `/var/lib/binnacle` is `1777` in the image, as the feature makes it, since a dev container may change the user's UID after the build.
- **The footprint** is a table reading "not measured yet", for ticket 04 to fill in both languages.

### For the next tickets

- Ticket 04: write the measured memory, home size, date and setup into *What one container costs* in `docs/operations/07-containers.md` and its twin. The guide pins `0.7.0` in its examples and names the feature `ghcr.io/it-bbox/binnacle/binnacle:1`, so the feature must be published as 1.0.0.

### Review

Against `main`, in a sub-agent, on the standards and the ticket's spec. Typecheck and the full suite pass; `user-guides.test.ts` passes.

1. **"The same line as its `postStartCommand`" read as the compose `command`, whose `exec sleep infinity` would hang `devcontainer up`.** **Fixed**: the dev container line is given on its own, without `sleep`.
2. **"Answer no to its autostart"**: `binn init` does not ask where `systemctl --user` fails, as in a container. **Fixed**: it says init does not offer it there.
3. **The Dockerfile chowned `/var/lib/binnacle` to `node`**, which a dev container's UID change after the build would leave behind. **Fixed**: `1777`, as the feature does.
4. **`sudo chown` assumes `sudo`.** **Fixed**: named the images that have it, and the Dockerfile's way for one without.
5. **A changed forwarded port needs a rebuild**, since `install.sh` writes `hostPort` at build. **Fixed**.
6. **A plain `binn daemon start` after `binn daemon stop` drops the allowed hosts** with the feature. **Fixed**: restart through the feature's start command.
