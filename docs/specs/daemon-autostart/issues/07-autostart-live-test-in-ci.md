# 07: A live autostart test in CI on three platforms

Status: READY
Triage: ready-for-agent
Blocked by: 02, 03, 04
Spec: `docs/specs/daemon-autostart/spec.md`
Roles: Developer, Reviewer, DevOps

**What to build:** macOS and Windows are not shipped untried (spec, *CI*, *Testing Decisions*). A live test, a `*.live.ts` beside the offline tests and never run by `pnpm test`, turns autostart on with the real service manager, waits for the daemon to answer, stops and starts it through the manager, turns autostart off and checks nothing is left. The CI workflow gains a job per runner — Linux, macOS, Windows — that runs it on every push to `main` and every pull request, beside the existing check, with a timeout. Where a runner cannot run the user's service manager (systemd's user manager on a hosted Linux runner, say), the job says so and the ticket records it rather than faking a pass.

- [ ] The live test passes on the macOS and Windows runners with the real `launchctl` and `schtasks`, and on Linux where the runner has a systemd user manager.
- [ ] `pnpm test` does not run it; the existing check job is unchanged.
