# ADR-0043: Autostart Through the User's Service Manager

**Status:** Accepted. Narrows ADR-0016's "installing the daemon as an auto-starting service is out of v1" and its consequence "autostart is a documented manual step in v1".

## Context

After a reboot the owner found the daemon down: nothing starts it, and no document describes the manual step ADR-0016 promised (`docs/product-inbox.md`, *A daemon that does not come back after a reboot*). The owner decided on 2026-10-09 that autostart is v1 and set up automatically, not a documented step, and on 2026-10-13, grilling epic 15, how.

## Decision

- **Every platform ADR-0016 supports gets autostart in v1**, through the user's own service manager, at login: a systemd user unit on Linux, a launchd LaunchAgent on macOS, a Task Scheduler task on Windows. It restarts the daemon when it stops.
- **`binn init` asks for it**, answered yes by default, and `binn daemon autostart on|off` turns it on or off later. Without a terminal, init installs nothing and says so.
- **With autostart on, `binn daemon start` and `stop` go through the service manager**, so the human and autopilot keep their commands and there is one daemon, the one the service supervises. Only for the Binnacle home the service was installed for: a daemon with another `BINNACLE_HOME`, such as an agent's temporary one, starts as a user process, as today.
- **The service is rewritten with the current paths** to Node and the daemon on every `binn daemon start` and `autostart on`; `binn daemon status` and the snapshot report a service whose paths no longer exist, with the command that repairs it.
- **The dashboard shows the state** — on, off, broken — and the command that changes it, to copy. It changes nothing (ADR-0041 stays the only setting the dashboard writes).
- **macOS and Windows are checked in CI**, on their runners: turn on, the daemon answers, stop and start through the service manager, turn off. A reboot is checked by hand on Linux.

## Considered Options

- **A documented manual step**, as ADR-0016 had it. Rejected: the owner hit the gap, and a new user would too.
- **Only `binn daemon autostart`, which init merely recommends.** Rejected: easy to skip.
- **A service that runs `npx @binnacle/cli`**, so that no path goes stale. Rejected: the network at every login, a slow start, a version that changes unseen, and Node's own path still breaks with nvm.
- **Linux first, macOS and Windows after the release.** Rejected: ADR-0016 counts a large share of the audience on Windows.
- **A switch on the dashboard.** Rejected: the daemon would change the user's system from a browser request, and could stop itself.

## Consequences

- `docs/01-architecture.md`, `docs/08-open-questions.md`, the installation checklist and the README stop saying that autostart is not part of v1.
- `binn daemon start` and `stop` gain a branch per service manager; a restart after a merge (`/binnacle:autopilot`, its upkeep) stays `binn daemon stop` then `binn daemon start`.
- CI gains a macOS and a Windows job.
