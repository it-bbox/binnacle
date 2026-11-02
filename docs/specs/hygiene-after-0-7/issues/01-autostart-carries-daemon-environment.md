# 01: Autostart carries the daemon's environment

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-0-7/spec.md`
Roles: Developer, Reviewer, DevOps

**What to build:** a daemon that autostart starts binds the port, address and allowed hosts that the environment of the latest `binn daemon start` or `binn daemon autostart on` gave (spec, *The service's environment*; product inbox, *The autostart unit ignores `BINNACLE_PORT`*). The service definition, the systemd unit, the launchd plist and the Task Scheduler task, carries `BINNACLE_PORT`, `BINNACLE_HOST` and `BINNACLE_ALLOWED_HOSTS` beside `BINNACLE_HOME` and `PATH`, each only when set, validated as the daemon validates them. A variable absent from the environment is absent from the definition, so the daemon takes its default. `binn daemon start` already rewrites a definition whose text differs and reloads the service; that picks up a changed or removed variable with no new rule.

- [ ] Through `binn daemon start` with the fake service managers: with the three variables set, the systemd unit, the plist and the task carry them, quoted as each format quotes its values; a value holding `%` or a space reaches the Windows task intact.
- [ ] A second `binn daemon start` with `BINNACLE_PORT` changed rewrites the definition, says so, and reloads; one without it drops the line.
- [ ] `binn daemon autostart on` writes the variables it sees.
- [ ] An invalid `BINNACLE_PORT` or `BINNACLE_HOST` is refused with the daemon's rule before the definition is written, which stays as it was.
- [ ] Reading a definition back, whether it is ours and which home it names, is unchanged by the new lines.
- [ ] CI's `autostart-live` on Linux, macOS and Windows: a daemon started through the service with `BINNACLE_PORT` set answers on that port.
- [ ] The README, the site and the container guide, with their Russian twins, say that autostart takes the variables of the latest `binn daemon start`.

## Comments
