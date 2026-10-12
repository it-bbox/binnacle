# 01: Autostart on Linux, end to end

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/daemon-autostart/spec.md`
Roles: Developer, Reviewer, Architect

**What to build:** a user turns the daemon's autostart on and off on Linux with one command (spec, *The service definition*, *One module owns the service*, *`binn daemon autostart on|off`*). A new module shared by the CLI and the daemon, `apps/daemon/src/service.ts`, beside the runtime file's `home.ts`, renders the service definition from the Node running `binn`, the daemon entry `binn daemon start` spawns, `BINNACLE_HOME` and `PATH`; reads the installed one back; tells *on*, *off* or *broken* for a home; and runs the service manager through one runner. The platform comes from the operating system, overridable by an environment variable. This ticket does the systemd user unit, named `binnacle`, `Restart=on-failure`, `WantedBy=default.target`. `binn daemon autostart on|off`, and the state with no argument, are routed in `apps/cli/src/bin.ts` beside `daemon-commands.ts`; `on` replaces a running user-process daemon of the same home, `off` leaves no daemon and no unit; both are idempotent; a definition Binnacle did not write is replaced with a warning; Linux without a systemd user manager is refused, changing nothing. `/binnacle:daemon` and `/binnacle:help` name the subcommand.

- [ ] Through `binn` with a fake `systemctl` on `PATH` and a temporary home directory: `on` writes the unit with absolute paths, `BINNACLE_HOME` and `PATH`, enables and starts it; `off` stops, disables and removes it; the state reads on, off and broken (a Node path that no longer exists).
- [ ] Repeating `on` or `off` succeeds and says nothing changed; a foreign unit of the same name is replaced with a warning; a refusal of `systemctl` is reported with its message; without a systemd user manager `on` refuses and writes nothing.
- [ ] The platform variable selects the platform in tests; `/binnacle:daemon` and `/binnacle:help` name `binn daemon autostart`, checked by the package build's test.
