# 02: start and stop through the service manager

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/daemon-autostart/spec.md`

**What to build:** with autostart on, the daemon's commands keep their names and there is one daemon (spec, *`binn daemon start` and `stop`*). In `apps/cli/src/daemon-commands.ts`, `start` and `stop` check whether autostart is on for the current `BINNACLE_HOME`: if so, `start` rewrites the definition with the current paths, starts through the service manager and waits for the daemon to answer; `stop` stops through it and waits. For any other home, or with autostart off, they behave as today. `binn daemon status` adds the autostart line: on, off, or broken with the command that repairs it. Autopilot's restart, `binn daemon stop` then `binn daemon start`, keeps working unchanged.

- [x] Through `binn` with a fake `systemctl`: with autostart on, `start` and `stop` call the manager and no detached process is spawned; `stop` then `start` leaves one daemon.
- [x] A unit pointing at a Node path that no longer exists is rewritten by `start` with the current one.
- [x] With another `BINNACLE_HOME`, or autostart off, `start` and `stop` spawn and signal a user process as today and never call the manager.
- [x] `status` shows on, off and broken, the last with the repairing command.

## Comments

- "Autostart is on" for `start` and `stop` includes *broken*: a unit of this home whose Node or daemon entry is gone still goes through the manager, so that `start` repairs it (story 19).
- `start` rewrites the unit, and runs `daemon-reload`, only when it differs from the current one; a daemon already running keeps running, as today, under the old paths until it next starts.
- `stop` asks the manager to stop, then signals any process of the home still alive, so that a user-process daemon started by hand while autostart was on is stopped too.
- The fake `systemctl`, `apps/cli/test/fake-systemctl.ts`, shared with `init.test.ts` since ticket 05, now runs the unit's `ExecStart` with its `Environment` when the `runs` flag is set, and stops it synchronously, as the user manager does.

### Review

Against `main`, on the standards and the spec.

1. **A stale runtime file removed under the service** could orphan a daemon the manager had just restarted, in `start` (`apps/cli/src/daemon-commands.ts`): the new daemon's file removed, `start` waiting 10 s for nothing. **Fixed**: under the service `start` leaves the file to the daemon, which replaces a stale one itself, and waits for a live pid.
2. **`service` named a path in `start` and a flag in `stop`**. **Fixed**: `stop`'s is `supervised`.
3. **The fake's stop loop had no bound**, a hung test if the daemon ignored SIGTERM. **Fixed**: it sends SIGKILL after a while, as systemd does after its stop timeout.
4. **No test of a manager's refusal for `start`** (spec, *Testing Decisions*). **Fixed**: `systemctl start` refusing is reported with its message, and nothing is spawned; tested.
5. **Kept**: `stop` signals the runtime's pid after `systemctl stop`; that returns once the main process is gone, so the pid is gone (ESRCH) or a hand-started daemon of this home, and the reuse window is today's.
6. **Kept**: with the unit installed and no user manager answering, `start` and `stop` fail with the manager's message rather than fall back to a user process, which would be the second, unsupervised daemon the spec rules out (story 28).
7. **Kept**: `start` with the daemon already running rewrites the unit but does not restart it; the ticket keeps "already running" as today.
8. **Kept**: `autostartOn` renders the unit once for its "already on" check and `rewriteUnit` again; one small string.
9. **Kept**: `waitForStart` under the service accepts any live pid holding the home, the daemon having claimed the file exclusively.
10. **Kept**: the timeout path with its `journalctl` hint and a missing daemon entry (story 20) are not tested on their own: the first costs 10 s, the second shares the Node path's code.
