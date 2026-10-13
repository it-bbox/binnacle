# 05: Tracker tokens and the autostart service

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** a user whose tracker token lives only in the shell learns that the service's daemon will not see it (spec, *Tracker tokens and autostart*). When `binn daemon autostart on` installs or repairs the service, or `binn init`'s plan turns it on, and a tracker token variable is set in the environment while `credentials.json` holds none for that tracker, the command prints a warning that the service will not see it and how to put it in `credentials.json`. The token is never printed, copied or written. `docs/operations/05-installation-checklist.md` and its twin say the same.

- [ ] Through the `binn` process with a stand-in service manager: `binn daemon autostart on` with `BINNACLE_GITHUB_TOKEN` set and no credentials file prints the warning; with the token in `credentials.json` it does not.
- [ ] `binn init` whose plan turns autostart on prints the same warning in its Summary.
- [ ] The token's value appears in no output, and no file holds it after the run that did not before.
- [ ] The installation checklist and its Russian twin describe it.
