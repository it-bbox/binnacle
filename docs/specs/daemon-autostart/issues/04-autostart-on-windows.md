# 04: Autostart on Windows

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/daemon-autostart/spec.md`

**What to build:** `binn daemon autostart on|off` works on Windows with no administrator rights (spec, *The service definition*, *Windows*). The service module from ticket 01, `apps/daemon/src/service.ts`, renders a Task Scheduler task named `binnacle`, defined by XML: triggered at the current user's logon, restarted on failure, with no execution time limit, running the same Node and daemon entry with `BINNACLE_HOME` and `PATH`. `on` creates it under the current user and runs it; `off` ends and deletes it; start and stop go through `schtasks` as ticket 02 does for systemd where 02 has merged. Paths follow `node:path` and `%USERPROFILE%` conventions (ADR-0016).

- [x] Through `binn` with the platform variable set to Windows and a fake `schtasks` on `PATH`: `on` creates the task from XML holding the logon trigger, the restart on failure and the paths, and runs it; `off` ends and deletes it; the state reads on, off and broken.
- [x] Repeating `on` or `off` is harmless; a refusal of `schtasks` is reported with its message.

## Comments

- The task's XML is `%LOCALAPPDATA%\binnacle\binnacle.xml`, what `schtasks /Create /XML` reads, kept so that the state reads back from a file as on the other platforms; Task Scheduler keeps its own copy. UTF-16 with its byte order mark, as schtasks reads a task's XML.
- The task: a logon trigger for the current user, `InteractiveToken` with `LeastPrivilege`, `RestartOnFailure` every minute up to 999 times, `ExecutionTimeLimit` `PT0S`, `IgnoreNew` for a second instance. An action has no environment of its own, so it runs `cmd.exe /d /s /c` setting `BINNACLE_HOME` and `PATH`, then Node and the daemon's entry, its output appended to the home's `daemon.log`.
- `on` creates the task with `/F` and runs it; `off` ends it while its daemon runs, deletes it and removes the XML; `start` creates it again when the XML changed, or when the task is gone, then runs it; `stop` ends it. Whether the task's daemon runs is read from the home's runtime file, since schtasks words its status in the system's language.
- Without Task Scheduler answering `schtasks /Query`, `on` says autostart is not available and writes nothing, as Linux and macOS do.
- With every platform supported, the "not supported yet" path is gone: `definitionPath` always gives a path. `autostart on` now creates the home, where the service's log goes, which neither cmd nor launchd creates.
- Tested through `binn` with a fake `schtasks`, `apps/cli/test/fake-schtasks.ts`, a Node script since the XML is UTF-16; the snapshot reads on, off and broken on Windows in `apps/daemon/test/snapshot.test.ts`. The real `schtasks` is ticket 07's live test in CI.

### Review

Against `main`, on the standards and the spec.

1. **`os.userInfo()` ran for every platform** in `serviceInputs` (`apps/daemon/src/service.ts`), for a user only the task names; it throws where the uid has no passwd entry, breaking Linux and macOS there. **Fixed**: `renderTask` reads the user itself.
2. **A task deleted by hand, its XML left behind, read on and `start` failed** at `/Run`. **Fixed**: the Windows `start` creates the task when `/Query` does not find it; tested.
3. **`runtime !== null && isAlive(runtime.pid)` repeated** in `daemon-commands.ts`. **Fixed**: `daemonAlive(home)`.
4. **Three platform switches in the test's `setup`**. **Fixed**: one table per platform.
5. **Kept**: Task Scheduler's `RestartOnFailure` is known to restart a task that fails to start, not one whose program exits with a failure; the ticket asks for it in the XML, and whether a crashed daemon comes back is ticket 07's live test to show.
6. **Kept**: with `InteractiveToken`, cmd's console window shows at logon, and closing it stops the daemon; hiding it needs an undocumented `conhost --headless` or a logon type a user without administrator rights may lack. Ticket 07's live test, or a follow-up, settles it.
7. **Kept**: whether `schtasks /End` ends Node, cmd's child, is unknown; `stop` and `off` signal the home's daemon after it as on every platform, so none is left.
8. **Kept**: whether the task's daemon runs is read from the home's runtime file, not from schtasks, whose status is localized; a daemon of the home started by hand reads as the task's.
9. **Kept**: cmd expands a `%NAME%` in a path, and its command line holds 8191 characters, PATH included; both are marked in `renderTask`.
10. **Kept**: `ensureHome` in `autostart on` changes macOS too; the fake found the missing directory, and one line serves both.
11. **Kept**: `managerFor` stays one branch per platform, the table ticket 03 made.
