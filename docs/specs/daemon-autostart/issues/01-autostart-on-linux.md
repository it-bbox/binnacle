# 01: Autostart on Linux, end to end

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/daemon-autostart/spec.md`
Roles: Developer, Reviewer, Architect

**What to build:** a user turns the daemon's autostart on and off on Linux with one command (spec, *The service definition*, *One module owns the service*, *`binn daemon autostart on|off`*). A new module shared by the CLI and the daemon, `apps/daemon/src/service.ts`, beside the runtime file's `home.ts`, renders the service definition from the Node running `binn`, the daemon entry `binn daemon start` spawns, `BINNACLE_HOME` and `PATH`; reads the installed one back; tells *on*, *off* or *broken* for a home; and runs the service manager through one runner. The platform comes from the operating system, overridable by an environment variable. This ticket does the systemd user unit, named `binnacle`, `Restart=on-failure`, `WantedBy=default.target`. `binn daemon autostart on|off`, and the state with no argument, are routed in `apps/cli/src/bin.ts` beside `daemon-commands.ts`; `on` replaces a running user-process daemon of the same home, `off` leaves no daemon and no unit; both are idempotent; a definition Binnacle did not write is replaced with a warning; Linux without a systemd user manager is refused, changing nothing. `/binnacle:daemon` and `/binnacle:help` name the subcommand.

- [x] Through `binn` with a fake `systemctl` on `PATH` and a temporary home directory: `on` writes the unit with absolute paths, `BINNACLE_HOME` and `PATH`, enables and starts it; `off` stops, disables and removes it; the state reads on, off and broken (a Node path that no longer exists).
- [x] Repeating `on` or `off` succeeds and says nothing changed; a foreign unit of the same name is replaced with a warning; a refusal of `systemctl` is reported with its message; without a systemd user manager `on` refuses and writes nothing.
- [x] The platform variable selects the platform in tests; `/binnacle:daemon` and `/binnacle:help` name `binn daemon autostart`, checked by the package build's test.

## Comments

- `apps/daemon/src/service.ts` renders and reads back the unit and reads the state from the file alone, with no manager call, so the snapshot (ticket 06) can read it cheaply; the manager's call sequences live in `daemon-commands.ts`, beside `start` and `stop`, which ticket 02 routes through them.
- The platform variable is `BINNACLE_SERVICE_PLATFORM` (`linux`, `darwin`, `win32`); on macOS and Windows `autostart on|off` says it is not available yet, until tickets 03 and 04.
- `on` runs `daemon-reload`, `enable`, then `restart` rather than `enable --now`, so that a service already running an older definition picks up the new one. It does not wait for the daemon to answer: ticket 02's `start` brings that wait.
- Decided, as a question that blocks nothing: `off` turns autostart off only for the home the service serves. From another home, such as an agent's temporary one, it says autostart is already off there and leaves the service alone (story 18: never touch the owner's service).
- `BINNACLE_HOME` is now made absolute by `resolveHome`, so that the home written into the unit is the one compared against it.

### Review

Against `main`, on the standards and the spec, with the Architect's concerns.

1. **`off` removed the service whatever home it served**, in `autostartOff` (`apps/cli/src/daemon-commands.ts`): an agent's temporary home would stop the owner's daemon. **Fixed**: `off` acts only when the service serves this home, otherwise says already off and names the home it serves; tested.
2. **`off` left a user-process daemon of the same home running**, against "leaving no daemon running". **Fixed**: it stops one after disabling the service; tested.
3. **A relative or slash-ended `BINNACLE_HOME`** went into the unit as written, and a trailing slash made the own unit read off. **Fixed**: `resolveHome` resolves it; `readInstalled` resolves the unit's.
4. **An unreadable unit exited 2, a usage error**, in `autostart`. **Fixed**: only an invalid `BINNACLE_SERVICE_PLATFORM` is a usage error; anything else exits 3.
5. **An unsupported OS blamed `BINNACLE_SERVICE_PLATFORM`** though it was unset, in `servicePlatform`. **Fixed**: it says autostart does not support that platform.
6. **`on` that rewrote stale paths said only that autostart is on**, against "say what they changed". **Fixed**: it says it rewrote the unit with the current paths; tested.
7. **Unused surface**: `ManagerResult`'s `missing` and `output`, and the `definitionPath` export. **Fixed**: removed. The daemon's `autostart` was renamed `readAutostart`, which the CLI had to alias.
8. **Kept**: `autostartOn` and `autostartOff` read the unit again after `readAutostart`; it is one small file read just before writing.
9. **Kept**: `on` does not wait for the daemon to answer; the ticket asks for enable and start, and ticket 02 brings the wait to `start`.
10. **Kept**: drop-ins under `binnacle.service.d/` are not read; nothing Binnacle writes makes one.
11. **Kept**: the unit holds the `PATH` of the shell that turned it on, as the spec asks; `on` again refreshes it.

#### Architect

12. **Kept**: the systemd call sequences live in the CLI, not in `service.ts`: there is one platform so far, and a table per platform waits for its second implementation in ticket 03. `binn init` (ticket 05) calls the same `autostart` function as the command.
13. **Kept**: `service.ts` sits beside `home.ts` in the daemon package, as the spec says, and its state reads files only, so the daemon's snapshot needs no manager. No new ADR: ADR-0043 covers the design.
