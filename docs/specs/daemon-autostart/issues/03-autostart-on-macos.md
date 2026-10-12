# 03: Autostart on macOS

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/daemon-autostart/spec.md`

**What to build:** `binn daemon autostart on|off` works on macOS (spec, *The service definition*, *macOS*). The service module from ticket 01, `apps/daemon/src/service.ts`, renders a LaunchAgent property list named `binnacle` in the user's LaunchAgents directory, run at load and kept alive on an unsuccessful exit, with the same Node, daemon entry, `BINNACLE_HOME` and `PATH`; `on` loads it into the user's GUI domain, `off` removes it from there and deletes the file; start and stop go through `launchctl` as ticket 02 does for systemd where 02 has merged.

- [ ] Through `binn` with the platform variable set to macOS and a fake `launchctl` on `PATH`: `on` writes the property list and loads it; `off` unloads and removes it; the state reads on, off and broken.
- [ ] Repeating `on` or `off` is harmless; a refusal of `launchctl` is reported with its message.
