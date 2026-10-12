# 04: Autostart on Windows

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/daemon-autostart/spec.md`

**What to build:** `binn daemon autostart on|off` works on Windows with no administrator rights (spec, *The service definition*, *Windows*). The service module from ticket 01, `apps/daemon/src/service.ts`, renders a Task Scheduler task named `binnacle`, defined by XML: triggered at the current user's logon, restarted on failure, with no execution time limit, running the same Node and daemon entry with `BINNACLE_HOME` and `PATH`. `on` creates it under the current user and runs it; `off` ends and deletes it; start and stop go through `schtasks` as ticket 02 does for systemd where 02 has merged. Paths follow `node:path` and `%USERPROFILE%` conventions (ADR-0016).

- [ ] Through `binn` with the platform variable set to Windows and a fake `schtasks` on `PATH`: `on` creates the task from XML holding the logon trigger, the restart on failure and the paths, and runs it; `off` ends and deletes it; the state reads on, off and broken.
- [ ] Repeating `on` or `off` is harmless; a refusal of `schtasks` is reported with its message.
