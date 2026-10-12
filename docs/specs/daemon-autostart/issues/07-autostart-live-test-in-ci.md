# 07: A live autostart test in CI on three platforms

Status: DONE
Triage: ready-for-agent
Blocked by: 02, 03, 04
Spec: `docs/specs/daemon-autostart/spec.md`
Roles: Developer, Reviewer, DevOps

**What to build:** macOS and Windows are not shipped untried (spec, *CI*, *Testing Decisions*). A live test, a `*.live.ts` beside the offline tests and never run by `pnpm test`, turns autostart on with the real service manager, waits for the daemon to answer, stops and starts it through the manager, turns autostart off and checks nothing is left. The CI workflow gains a job per runner — Linux, macOS, Windows — that runs it on every push to `main` and every pull request, beside the existing check, with a timeout. Where a runner cannot run the user's service manager (systemd's user manager on a hosted Linux runner, say), the job says so and the ticket records it rather than faking a pass.

- [ ] The live test passes on the macOS and Windows runners with the real `launchctl` and `schtasks`, and on Linux where the runner has a systemd user manager.
- [x] `pnpm test` does not run it; the existing check job is unchanged.

## Comments

- The live test is `apps/cli/test/autostart.live.ts`, run by the workflow's `autostart-live` job, one per runner (`ubuntu-latest`, `macos-latest`, `windows-latest`, `fail-fast: false`, 15 minutes), as `node --test apps/cli/test/autostart.live.ts`. `pnpm test:live` picks it up too. It skips unless `CI` is set: it installs a real service named `binnacle` for the user, which would replace a developer's own. It was never run on the development machine, whose systemd user manager runs the owner's service.
- Through `binn` with a temporary `BINNACLE_HOME`: `autostart on`, the daemon answers; it is killed with `SIGKILL` and the manager starts another; `binn daemon stop` stops it through the manager and none answers three seconds later; `binn daemon start` starts it through the manager; `autostart off` leaves no daemon, no definition, and nothing the manager knows (`systemctl --user cat`, `launchctl print`, `schtasks /Query`).
- Linux: a hosted runner's user has no login session, so the job enables lingering for it and starts its user manager, then sets `XDG_RUNTIME_DIR`. That is the runner's setup, not the product's: the spec leaves lingering out of the product. Where no user manager answers even so, the test skips, saying so, rather than passing.
- Ticket 04's three Windows questions. A daemon killed with a failure: the test waits 90 seconds and reports whether Task Scheduler restarted it, as a diagnostic, not an assertion, since `RestartOnFailure` is known not to cover a program's failure; Linux and macOS assert it. `schtasks /End`: after `binn daemon start`, the test ends the task itself and reports whether Node, cmd's child, ended with it. A console window at logon: a runner has no logon and no screen to look at, so CI cannot show it; it stays for a human on Windows or a follow-up.

### Verify after the merge

The first criterion is read from the CI run of `main` after the merge, since this branch was never pushed:

1. On GitHub, *Actions*, workflow *CI*, the run of the merge commit on `main`.
2. Its three `autostart-live` jobs, one per runner, each green.
3. In each job's last step: the Linux one passes, or reports `SKIP` with "this runner has no systemd user manager" (then record it here and leave Linux out of the criterion). The Windows one prints two diagnostics, "Task Scheduler restarted / did not restart a daemon killed with a failure" and "schtasks /End ended / left the daemon"; record both here, answering ticket 04's items 5 and 7. A Windows job failing at "the service starts a daemon that answers" prints Task Scheduler's view of the task: the runner's session may not run an `InteractiveToken` task.

### Review

Against `main`, on the standards and the spec.

1. **Windows stopped the daemon with `schtasks /End` before `binn daemon stop`**, so `stop` found it ended and never went through the manager. **Fixed**: the `/End` observation follows `binn daemon start`, and `stop`'s output is asserted to say "through the service manager".
2. **A Windows task that never answers failed with no clue** (an `InteractiveToken` task on a runner session that may not be interactive). **Fixed**: the test prints `schtasks /Query /V` before failing.
3. **README said CI runs "without the live tests"**, then dropped the tracker's. **Fixed**: both READMEs name the two live tests, which runs where.
4. **`answers` beside `answering`** read alike. **Fixed**: `waitForDaemon`.
5. **Kept**: the pid is read from `binn daemon status`'s output, not the runtime file: the CLI is the seam.
6. **Kept**: `platform === 'win32'` branches in one test; Windows reports where the others assert, and a table would be longer.
7. **Left**: the console window at logon; no runner can show it.

#### DevOps

8. **Lingering starts the user manager in the background**, which the test could outrun. **Fixed**: the step runs `systemctl start user@<uid>.service`, which waits for it.
9. **Kept**: no `needs: check`; the ticket puts the live jobs beside the check, and a failing check does not make the live result meaningless.
10. **Kept**: a Linux skip leaves its job green; the skip and its reason are in the log, and the script above records it.
11. None else: the check job is unchanged, `permissions: contents: read` covers the new job, no secret is used, and the test cleans its service up in `t.after`, on a runner thrown away anyway.
