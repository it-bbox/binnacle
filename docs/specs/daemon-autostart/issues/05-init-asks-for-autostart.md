# 05: binn init asks for autostart

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/daemon-autostart/spec.md`

**What to build:** a new user is not left without autostart (spec, *`binn init`*). `apps/cli/src/init.ts` asks, after the import window and before the plan, "Start the daemon at login? [Y/n]" when autostart is off for the home it uses; yes turns it on at the end of the run, as an item of the one plan it shows (ADR-0034). Without a terminal, and under `--yes`, it installs nothing and its summary names `binn daemon autostart on`. With autostart on it asks nothing; a later run offers it again while it is off. The docs stop saying autostart is not part of v1: `README.md` and `README.ru.md`, `docs/01-architecture.md`, `docs/08-open-questions.md` and `docs/operations/05-installation-checklist.md` say that `binn init` sets it up and name `binn daemon autostart` (ADR-0043).

- [x] Through init's plan and writes, as `init.test.ts` drives init, with a fake `systemctl`: the question's default is yes and its plan item turns autostart on; no turns nothing on and the summary names the command.
- [x] Without a terminal and under `--yes`, nothing is installed and the summary says so; with autostart on, nothing is asked.
- [x] The five documents above no longer say autostart is out of v1, and both READMEs say the same.

## Comments

- Decided, as a question that blocks nothing: `binn init` has no `--yes`. The forms that ask nothing, `--plan --json` and `--apply <id>` (ADR-0037), stand for it: they never put autostart in the plan, and their notes and Summary name `binn daemon autostart on`, so a chat yes never installs a service it was not asked about.
- Init asks only when autostart can be turned on here: on a platform not supported yet (macOS and Windows until tickets 03 and 04) or with no systemd user manager answering, it says so and asks nothing. A broken autostart is not asked either: it names the repair, `binn daemon autostart on`.
- The plan item runs the same `autostart(home, 'on')` as the command, last in the plan, after the registration that uses a daemon the home may run by hand, which `on` replaces.
- The fake `systemctl` moved to `apps/cli/test/fake-systemctl.ts`, shared by `autostart.test.ts` and `init.test.ts`.

### Review

Against `main`, on the standards and the spec.

1. **A tracker token from the shell was pointed at a shell the daemon no longer starts from**, in `trackerStep` (`apps/cli/src/init.ts`): after a yes, the service's daemon carries only `BINNACLE_HOME` and `PATH`, yet the hint said to start the daemon from a shell that has the token. **Fixed**: with autostart on for the home, the hint says the service manager does not carry it and points at the credentials file; tested.
2. **The branches recorded under Comments had no test**: broken, no systemd user manager, a platform not supported yet. **Fixed**: one test each, none asks and each Summary says why.
3. **`autostartOn(home, current.path, current)` passed `current` three ways**, in `apps/cli/src/daemon-commands.ts`. **Fixed**: it takes `current` and its narrowed `path`.
4. **Kept**: the chat form, `--plan --json` then `--apply`, never puts autostart in its plan and names the command instead; the spec and ADR-0043 say that without a terminal init installs nothing, and `--apply` runs without one. Carrying the answer as a flag, as `--window` does, is the owner's call for a later ticket.
5. **Kept**: `autostartUnavailable` asks `systemctl` for every platform with a definition path; only Linux has one until tickets 03 and 04, which add their own manager there.
6. **Kept**: `--plan --json` runs the read-only `systemctl --user show-environment`, so that its notes say when autostart is not available rather than name a command that would fail.
7. **Kept**: the READMEs and the installation checklist name the LaunchAgent and the Task Scheduler task, as ADR-0043 decides for v1; tickets 03 and 04 deliver them in this epic.
8. **Kept**: the Summary's `binn daemon autostart on` is a literal beside `AUTOSTART_ON`, which carries the backquotes the Summary's outcome line does not.
