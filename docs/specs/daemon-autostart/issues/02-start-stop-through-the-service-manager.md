# 02: start and stop through the service manager

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/daemon-autostart/spec.md`

**What to build:** with autostart on, the daemon's commands keep their names and there is one daemon (spec, *`binn daemon start` and `stop`*). In `apps/cli/src/daemon-commands.ts`, `start` and `stop` check whether autostart is on for the current `BINNACLE_HOME`: if so, `start` rewrites the definition with the current paths, starts through the service manager and waits for the daemon to answer; `stop` stops through it and waits. For any other home, or with autostart off, they behave as today. `binn daemon status` adds the autostart line: on, off, or broken with the command that repairs it. Autopilot's restart, `binn daemon stop` then `binn daemon start`, keeps working unchanged.

- [ ] Through `binn` with a fake `systemctl`: with autostart on, `start` and `stop` call the manager and no detached process is spawned; `stop` then `start` leaves one daemon.
- [ ] A unit pointing at a Node path that no longer exists is rewritten by `start` with the current one.
- [ ] With another `BINNACLE_HOME`, or autostart off, `start` and `stop` spawn and signal a user process as today and never call the manager.
- [ ] `status` shows on, off and broken, the last with the repairing command.
