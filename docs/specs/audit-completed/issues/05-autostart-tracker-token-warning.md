# 05: Tracker tokens and the autostart service

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** a user whose tracker token lives only in the shell learns that the service's daemon will not see it (spec, *Tracker tokens and autostart*). When `binn daemon autostart on` installs or repairs the service, or `binn init`'s plan turns it on, and a tracker token variable is set in the environment while `credentials.json` holds none for that tracker, the command prints a warning that the service will not see it and how to put it in `credentials.json`. The token is never printed, copied or written. `docs/operations/05-installation-checklist.md` and its twin say the same.

- [x] Through the `binn` process with a stand-in service manager: `binn daemon autostart on` with `BINNACLE_GITHUB_TOKEN` set and no credentials file prints the warning; with the token in `credentials.json` it does not.
- [x] `binn init` whose plan turns autostart on prints the same warning in its Summary.
- [x] The token's value appears in no output, and no file holds it after the run that did not before.
- [x] The installation checklist and its Russian twin describe it.

## Comments

- Decisions where the ticket is silent: "that tracker" is each tracker of the variable's provider among the registered projects and, for `binn init`, its own repository whether registered yet or not; with none, the provider's default host (`github.com`, `gitlab.com`). The credentials file is read as the service's daemon reads it, through `trackerToken` with an empty environment, so an insecure or unreadable file warns with its own reason. The warning comes only when `on` installs or repairs the service, not when it was already on, and goes to stderr as `binn: warning: …`; `binn init` sends it to its Summary instead, as a `warned` line after `ran binn daemon autostart on`, and not to stderr.
- For ticket 06 (autostart from the chat): `autostart(home, 'on', { warn, root })` in `apps/cli/src/daemon-commands.ts` takes where its warnings go and the repository whose tracker counts; `planAutostart` in `apps/cli/src/init.ts` already passes both, so an autostart item planned by `--plan` and applied by `--apply` gives the same Summary warning.

### Review

Against `main`, in a sub-agent, on the standards, the spec and the ticket's Security role. Typecheck and the full suite pass; every criterion is pinned through the `binn` process.

1. **`binn init` did not count its own tracker**: on a fresh install the daemon is not running, the project is not registered, and the check fell back to the default host, warning wrongly for a declared `tracker.host` or missing one. **Fixed**: init passes its repository as `root`; a test with a declared host and no running daemon pins both directions.
2. **An insecure or malformed credentials file was reported as "has no token"**. **Fixed**: the warning carries `trackerToken`'s own failure message, which never holds a token.
3. **`unseenTokenWarnings` had an `env` parameter no caller passed**. **Fixed**: removed; it reads `process.env`.
4. With a remote tracker, init gives the shell-token advice twice: the tracker check's note and the Summary line. **Kept**: the spec asks for the Summary line, and the note belongs to the check.

#### Security

No blocking finding. The shell token is only tested for presence and never enters the lookup, which runs on an empty environment; the warning names the variable, the path and the key. The credentials file is only read, through the one descriptor and mode check `trackerToken` already uses. The tests check stdout, stderr and every file under the temporary roots for the token's value.

5. A manifest's `tracker.host` is quoted back through `JSON.stringify`, which leaves C1 controls and bidi overrides in. **Left**: the tracker check already prints it the same way, so this adds no exposure; a shared sanitizer for both is a ticket of its own.
