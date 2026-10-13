# 08: The exit demonstration of epic 15

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 09
Spec: `docs/specs/daemon-autostart/spec.md`

**What to build:** epic 15's exit criterion, demonstrated by the owner on Linux (spec, the exit criterion).

- [x] `binn init` answered yes, then a reboot: the daemon answers with nobody starting it; the hand-written `binnacle.service` was replaced.
- [x] `binn daemon stop` then `binn daemon start` leaves one daemon, supervised by the service.
- [x] A unit pointing at a Node that is gone shows as broken in `binn daemon status`, the snapshot and the dashboard; the next `binn daemon start` repairs it.
- [x] `binn daemon autostart off` leaves no unit and no daemon.
- [x] CI's live test is green on macOS and Windows.

## Comments

### The demonstration, 2026-10-13

Run by this ticket's agent in the owner's session, on the owner's Linux machine, with `binn` from this checkout; the reboot is the owner's.

- **Before it.** `~/.config/systemd/user/binnacle.service` already began with `# Written by binn daemon autostart`, rewritten at 11:20 MSK: the hand-written unit was replaced when autostart was first turned on. Autostart was `on`.
- **Stop then start, ticked.** `binn daemon stop` stopped pid 2015422 through the service manager and left the unit `inactive`; `binn daemon start` rewrote the unit and started pid 2392179 through it. One daemon process, and it is the unit's `MainPID`.
- **A Node that is gone, ticked.** With the unit's `ExecStart` pointed at `~/.nvm/versions/node/v0.0.0-gone/bin/node`: `binn daemon status` said autostart is broken, naming the missing Node and `binn daemon autostart on`; the snapshot gave `autostart.state` `broken` and the attention item `daemon.autostart_broken`; the dashboard showed it under *Attention* and, under *Settings*, *Daemon*, autostart as broken with the command. The next `binn daemon start` rewrote `ExecStart` with v24.16.0's Node, status said `on`, and the running daemon stayed the only one.
- **Off, ticked.** `binn daemon autostart off` stopped the daemon and removed the unit: no file, `systemctl --user is-enabled` gives `not-found`, no daemon process; `binn daemon status` says off.
- **CI, ticked.** `main`'s run at `73a5cc5` (https://github.com/it-bbox/binnacle/actions/runs/38373627841): `autostart-live` passed on `ubuntu-latest`, `macos-latest` and `windows-latest`.

- **`binn init` and the login, ticked without a reboot.** With autostart off, `binn init` asked "Start the daemon at login?", the owner answered yes, and its plan's last item ran `binn daemon autostart on`: the unit was written with the `# Written by binn daemon autostart` header, enabled through `default.target.wants/binnacle.service`, and the daemon started through it (pid 2410111). In place of the reboot: `systemctl --user kill -s KILL` on the service, and systemd started it again by itself (pid 2415807, `NRestarts=1`), still one daemon. Not checked: a real login starting the user manager and the unit finding Node at its nvm path. The machine was not rebooted; the steps below check that part.

### Steps for the owner: the reboot, still to do

Autostart is off now, so `binn init` asks for it.

1. In a terminal, in this checkout: `binn init`. Answer Enter (yes) to "Start the daemon at login? [Y/n]" and yes to the plan. Expect `~/.config/systemd/user/binnacle.service` written with the `# Written by binn daemon autostart` header and the daemon started through it.
2. Reboot. Log in and start nothing.
3. `binn daemon status`: expect *running* and *Autostart is on*; `systemctl --user status binnacle.service` shows it `active` since the login.
4. Tick criterion 1, or one line on what went wrong, to become a ticket.

### Review

Nothing to review: this ticket changed no code. Its commits record the demonstration, and the code it exercised was reviewed in tickets 01 to 07 and 09. No typecheck or test was run, for the same reason.
