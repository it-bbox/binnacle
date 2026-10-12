# Daemon autostart: what the grilling decided

Epic 15's material is `docs/product-inbox.md`, *A daemon that does not come back after a reboot* (2026-10-09), and ADR-0016. This brief is what `/to-spec` starts from.

## The problem

After a reboot the owner found the daemon down: nothing starts it. ADR-0016 made autostart "a documented manual step in v1", but no document describes it. The owner runs a systemd user unit written by hand, which pins one nvm version of Node and the repository's path, and which `binn daemon stop` then `binn daemon start` — autopilot's restart after a merge — leaves behind, with a daemon the service no longer supervises. A new user has nothing.

## The outcome wanted

The daemon comes back at login on Linux, macOS and Windows, set up by Binnacle itself, not by a step the user reads about (the owner, 2026-10-09). Starting and stopping it keep their commands, and a service whose paths broke says so instead of failing silently at the next login.

## Who it concerns

Every Binnacle user after the release on 2026-10-13, a large share of them on Windows (ADR-0016); the owner, whose hand-written unit it replaces; autopilot, which restarts the daemon after a merge that changes it.

## The systems it touches

- `binn init` and `binn daemon` (`start`, `stop`, `status`, a new `autostart on|off`);
- the user's service manager: systemd user units, launchd LaunchAgents, Windows Task Scheduler;
- the daemon's snapshot attention and the dashboard's Settings page;
- CI, which gains macOS and Windows jobs;
- ADR-0016, `docs/01-architecture.md`, `docs/08-open-questions.md`, the installation checklist and both READMEs.

## Decided in the grilling, 2026-10-13

- **`binn init` asks** "Start the daemon at login? [Y/n]", as it asks for the import window, and `binn daemon autostart on|off` turns it on or off later.
- **All three platforms in v1**: a systemd user unit, a launchd LaunchAgent, a Task Scheduler task at logon.
- **With autostart on, `binn daemon start` and `stop` go through the service manager**, so the human's and autopilot's commands stay the same and there is one daemon, under the service.
- **Self-repair and a signal**: `binn daemon start` and `autostart on` rewrite the service with the current paths every time; `binn daemon status` and the snapshot report a service whose paths no longer exist, with the command that repairs it.
- **The dashboard shows the state only** — on, off, broken — with the command to change it, to copy. No switch.
- **macOS and Windows are checked in CI**, on their runners, with the real service manager; a reboot is checked by hand on Linux, in the epic's demonstration.

Defaults taken from the docs and Ponytail, confirmed with the owner: the service runs the same Node and daemon entry `binn daemon start` runs today, with the `BINNACLE_HOME` and `PATH` of the shell that turned it on, and restarts the daemon when it stops; only the home the service was installed for goes through it, so an agent's temporary daemon is never the owner's; without a terminal `binn init` installs nothing and says so; a later `binn init` offers it again while it is off; the owner's hand-written `binnacle.service` is replaced, under the same name; `autostart off` stops the service and removes it. ADR-0043 records the decision and narrows ADR-0016; `CONTEXT.md` defines *Autostart*.

## Open questions

None left for the owner. The test seams were confirmed on 2026-10-13: the CLI with a fake service manager on `PATH`, the snapshot for the broken-paths signal, and a live test with the real manager in CI.
