# Spec: Daemon autostart

Status: READY
Triage: ready-for-agent

Epic 15 of v1, from its grilling's brief, `docs/specs/daemon-autostart/brief.md` (2026-10-13), the product inbox's *A daemon that does not come back after a reboot*, and ADR-0043. Exit criterion: on Linux, after `binn init` answered yes and a reboot, the daemon answers without anyone starting it; `binn daemon stop` then `binn daemon start` leaves one daemon, supervised by the service; a service whose Node path is gone is reported by `binn daemon status`, the snapshot and the dashboard, and the next `binn daemon start` repairs it; `binn daemon autostart off` leaves no service behind; and CI turns autostart on and off with the real service manager on macOS and Windows. The owner confirmed the test seams on 2026-10-13, recorded under *Further Notes*.

## Problem Statement

The daemon does not come back after a reboot. Nothing starts it, and the manual step ADR-0016 promised is written nowhere, so a user who restarts their machine finds the dashboard dark and every Binnacle tool answering `daemon.unreachable` until they remember `binn daemon start`.

The owner works around it with a systemd user unit written by hand. It pins one nvm version of Node and the repository's own path, so it breaks the day Node is upgraded, silently, at the next login. And it is outside Binnacle's knowledge: `binn daemon stop` then `binn daemon start`, which autopilot runs after a merge that changes the daemon, kills the supervised daemon and starts a second one the service does not watch. On macOS and Windows, where a large share of the audience works (ADR-0016), there is nothing at all.

## Solution

Binnacle sets autostart up itself, through the user's own service manager: a systemd user unit on Linux, a launchd LaunchAgent on macOS, a Task Scheduler task at logon on Windows. `binn init` asks for it, yes by default, and `binn daemon autostart on|off` changes it later. Once it is on, the daemon starts at login and again when it stops, and `binn daemon start` and `stop` act through the service manager, so the commands the human and autopilot type stay the same and there is always one daemon.

The service remembers absolute paths, so Binnacle keeps them current: every `binn daemon start` and `autostart on` rewrites the service with the paths in use, and when they break anyway, `binn daemon status`, the snapshot's attention and the dashboard say so and name the command that repairs it. The dashboard shows whether autostart is on, off or broken, and the command to change it; it changes nothing itself.

## User Stories

1. As a new user running `binn init`, I want to be asked whether the daemon should start at login, so that I do not find it down after my next reboot.
2. As a new user, I want the question answered yes when I just press Enter, so that the common choice costs nothing.
3. As a user who answers no, I want init to tell me the command that turns autostart on later, so that I can change my mind without reading docs.
4. As a user running `binn init` in CI or with `--yes` and no terminal, I want init to install no service and say so in its summary, so that a build machine is never changed behind my back.
5. As a user who already ran `binn init` before this epic, I want a later `binn init` to offer autostart while it is off, so that I get it without a separate step.
6. As a user, I want `binn daemon autostart on`, so that I can turn autostart on at any time.
7. As a user, I want `binn daemon autostart off`, so that I can stop the daemon starting at login and leave no service behind.
8. As a user, I want `binn daemon autostart` with no argument to tell me whether it is on, off or broken, and for which Binnacle home, so that I can check it at a glance.
9. As a Linux user, I want autostart to be a systemd user unit, so that it runs as me, needs no root, and starts at my login.
10. As a macOS user, I want autostart to be a launchd LaunchAgent, so that it runs as me at my login, the way macOS expects.
11. As a Windows user, I want autostart to be a Task Scheduler task at logon, so that it needs no administrator rights and no Windows Service.
12. As a user, I want the service to restart the daemon when it stops unexpectedly, so that a crash does not leave me without it until the next login.
13. As a user, I want the service to start the same Node and the same daemon that `binn daemon start` would, so that what runs at login is what I installed.
14. As a user, I want the service to carry the `BINNACLE_HOME` and `PATH` of the shell that turned it on, so that the daemon finds my home and reaches `git`, `graphify` and `npx` at login.
15. As a user with autostart on, I want `binn daemon start` to start the daemon through the service manager, so that the daemon it starts is the one the service supervises.
16. As a user with autostart on, I want `binn daemon stop` to stop it through the service manager, so that the service does not immediately start it again and does not lose track of it.
17. As the owner, I want autopilot's restart after a merge, `binn daemon stop` then `binn daemon start`, to keep working unchanged, so that a merged daemon runs under the service.
18. As an agent running a temporary daemon with its own `BINNACLE_HOME`, I want `binn daemon start` to start a plain user process, so that I never touch the owner's service or daemon.
19. As a user who upgraded Node with nvm, I want the next `binn daemon start` to rewrite the service with the new Node path, so that autostart repairs itself.
20. As a user who upgraded Binnacle, I want the next `binn daemon start` or `autostart on` to point the service at the new package, so that login starts the version I upgraded to.
21. As a user whose service points at a Node or daemon that no longer exists, I want `binn daemon status` to say autostart is broken and name the command that repairs it, so that I learn before the next reboot.
22. As a user, I want the snapshot's attention to report a broken autostart, so that `/binnacle:product` and `/binnacle:daily` tell me too.
23. As a user, I want the dashboard to show autostart on, off or broken, with the command to change it and a copy button, so that I see it where I look at Binnacle.
24. As a user, I want the dashboard not to change autostart itself, so that a browser request never changes my system or stops the daemon serving it.
25. As the owner, I want my hand-written `binnacle.service` replaced by Binnacle's own under the same name, so that I do not end up with two units starting two daemons.
26. As a user who turns autostart on with a different `BINNACLE_HOME` than before, I want the one service to move to that home and say so, so that I know which home starts at login.
27. As a user, I want `autostart off` when it is already off, and `on` when it is already on, to succeed and say so, so that repeating a command is harmless.
28. As a user, I want a clear error naming the service manager's own message when it refuses, so that I can fix what it complains about.
29. As a user on a Linux without systemd, I want `autostart on` to say autostart is not available there and change nothing, so that I am not left with a unit nothing reads.
30. As a user, I want the README, in both languages, and the installation checklist to say that `binn init` sets autostart up, so that the docs match what happens.
31. As a maintainer, I want ADR-0016's "autostart is a manual step" narrowed by ADR-0043, and `docs/01-architecture.md` and `docs/08-open-questions.md` to agree, so that no document contradicts the code.
32. As a maintainer, I want CI to turn autostart on and off with the real service manager on macOS and Windows, so that platforms I do not use are not shipped untried.
33. As a maintainer, I want every platform's behaviour tested on any machine through a fake service manager, so that an agent on Linux can change the Windows path safely.
34. As the owner, I want to reboot my Linux machine in the epic's demonstration and find the daemon answering, so that the exit criterion is the one I actually care about.

## Implementation Decisions

- **The service definition**, one per platform, rendered from the same inputs: the absolute path of the Node running `binn`, the absolute path of the daemon's entry that `binn daemon start` spawns today, the `BINNACLE_HOME` and the `PATH` of the shell that turns autostart on. Its name is `binnacle` on every platform. It starts the daemon in the foreground and lets the service manager restart it when it exits with a failure.
  - *Linux*: a systemd user unit in the user's systemd configuration directory, `WantedBy=default.target`, `Restart=on-failure`; turned on with the user manager's enable-and-start, off with disable-and-stop and the file removed, followed by a daemon reload.
  - *macOS*: a LaunchAgent property list in the user's LaunchAgents directory, run at load and kept alive on an unsuccessful exit; loaded into and removed from the user's GUI domain.
  - *Windows*: a Task Scheduler task at the user's logon, defined by XML so that it can restart on failure and run with no time limit, created and deleted under the current user, needing no administrator rights.
- **One module owns the service**, shared by the CLI and the daemon, as the daemon's runtime file already is: it renders the definition, reads back the installed one, tells *on*, *off* or *broken* for a given home, and runs the service manager's commands through one runner. *Broken* means installed but pointing at a Node or a daemon entry that no longer exists. The platform it targets comes from the operating system, overridable by an environment variable so that tests exercise all three anywhere.
- **`binn daemon autostart on|off`**, and with no argument the state, the home it serves and the platform. `on` writes the definition with the current paths, registers it and starts the daemon through the service manager, replacing a running user-process daemon of the same home; `off` stops it through the manager and removes the definition, leaving no daemon running. Both are idempotent and say what they changed. On Linux without a systemd user manager, `on` says autostart is unavailable there and changes nothing.
- **`binn daemon start` and `stop`** check whether autostart is on for the current `BINNACLE_HOME`. If so, `start` first rewrites the definition with the current paths, then starts through the service manager and waits for the daemon to answer as today; `stop` stops through the manager and waits as today. For any other home they behave as today, a detached user process and a signal. `binn daemon status` adds the autostart line: on, off, or broken with the command that repairs it.
- **`binn init`** asks, after the import window and before the plan, "Start the daemon at login? [Y/n]" when autostart is off for the home it uses; yes turns it on at the end of the run as `autostart on` would, as an item of the one plan it shows (ADR-0034). Without a terminal, and under `--yes`, it installs nothing and its summary names the command. With autostart already on it asks nothing.
- **The snapshot** gains `autostart`: `{ state: 'on' | 'off' | 'broken', platform, home, command }`, read by the daemon for its own home through the shared module, `command` being the one that turns it on, off or repairs it. A broken autostart is the attention item `daemon.autostart_broken`, naming what is missing and the command. Off is not an attention item: it is the user's choice.
- **The dashboard's Settings page** shows the autostart state and its command with a copy button, read from the snapshot. It writes nothing: ADR-0041 stays the only setting it writes.
- **The owner's hand-written unit** is replaced by the first `autostart on`, since it has the same name; the CLI warns when it overwrites a definition it did not write, saying what it replaced.
- **CI** gains a job per runner, Linux, macOS and Windows, that runs a live test: autostart on, the daemon answers, stop and start through the service manager, autostart off, no service left. It runs on every push to `main` and every pull request, as the current job does.
- **Docs**: ADR-0043 (written in the grilling) narrows ADR-0016; `docs/01-architecture.md`, `docs/08-open-questions.md`, `docs/operations/05-installation-checklist.md`, `README.md` and `README.ru.md` say that `binn init` sets autostart up and name `binn daemon autostart`. `/binnacle:daemon` and `/binnacle:help` name the new subcommand. `CONTEXT.md` defines *Autostart* (written in the grilling).

## Testing Decisions

A good test exercises behaviour through the seam a caller uses — the `binn` command, the snapshot — never an internal function's shape. The seams were confirmed with the owner on 2026-10-13.

- **The CLI with a fake service manager**, as `apps/cli/test/` runs `binn` today: fake `systemctl`, `launchctl` and `schtasks` on `PATH` record their arguments and answer as the real ones; the service definition is written under a temporary home directory; the platform is set by the environment variable, so that all three run on any machine. Covered: `autostart on`, `off` and the state, each platform's definition and manager calls; idempotence; `start` and `stop` through the manager with autostart on and as user processes with it off or for another home; the rewrite of a stale path on `start`; the broken state and its command in `status`; a manager's refusal surfaced; Linux without systemd; `binn init`'s question, its default, its silence without a terminal, and its plan item, as `apps/cli/test/init.test.ts` drives init.
- **The snapshot**, through the daemon's `project.snapshot`, as `apps/daemon/test/snapshot.test.ts` does: `autostart` on, off and broken, and `daemon.autostart_broken` only when broken.
- **The dashboard**, checked in a browser: the Settings page shows the state and the command, with nothing to switch.
- **A live test with the real service manager**, a `*.live.ts` beside the offline tests, run in CI on Linux, macOS and Windows runners and never by `pnpm test`: on, the daemon answers, stop and start, off, nothing left.
- **A reboot** is the exit demonstration's, on the owner's Linux machine.

## Contested points

- **Where autostart is turned on.** A separate command that init only recommends is easy to skip; installing it silently changes the user's system unasked. Taken: init asks, yes by default, and `binn daemon autostart on|off` changes it later.
- **What the service runs.** `npx @binnacle/cli` would never hold a stale path, but needs the network at every login, starts slowly, changes version unseen, and Node's own path still breaks with nvm. Taken: absolute paths, rewritten on every start and reported when broken.
- **Who restarts the daemon.** A separate `binn daemon restart` would leave `stop` then `start` taking the daemon out from under the service. Taken: `start` and `stop` go through the service manager whenever autostart is on for that home.
- **Platforms.** Linux first would ship sooner; ADR-0016 counts a large share of the audience on Windows. Taken: all three, with Task Scheduler on Windows rather than a Windows Service, which needs administrator rights.
- **A switch on the dashboard.** It would be convenient, as the parallel limit is (ADR-0041), but the daemon would change the user's system from a browser request and could stop itself. Taken: state and command only.
- **Checking macOS and Windows.** A human with those machines may not exist before the release; unit tests alone ship them untried. Taken: a live test in CI on their runners, the reboot checked by hand on Linux.

## Out of Scope

- A system-wide service, run as root or before any user logs in, and systemd's lingering.
- A Windows Service.
- More than one service per machine, one per Binnacle home.
- Updating Binnacle itself; the service only follows the paths of what is installed.
- A switch on the dashboard.
- Starting the daemon on demand from the MCP server or a skill when it is down.

## Further Notes

The test seams, confirmed by the owner on 2026-10-13: the `binn` CLI with a fake service manager on `PATH` and the platform set by an environment variable; the snapshot for the broken state; a live test with the real service manager in CI on all three runners.

The owner's machine runs a hand-written `~/.config/systemd/user/binnacle.service` today, pointing at this repository's daemon with one nvm Node. The first `binn daemon autostart on` after this epic replaces it.
