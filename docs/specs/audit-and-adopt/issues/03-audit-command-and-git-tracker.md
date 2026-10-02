# 03: binn audit, its findings, and the Git and tracker checks

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** the `binn audit [path]` command, end to end, with its first area. It reads the repository at `path`, the current directory by default, and prints a list of findings as text, or as JSON with `--json`. A finding has a check code, an area, a status of `ok`, `gap` or `unknown`, a reason and, for a `gap` or an `unknown`, a recommendation. No overall score. It needs no registration, no daemon and no `.binnacle/project.yaml`, writes nothing, makes no network call and runs no process but Git. The first area is Git and tracker: whether the path is a Git repository and on what branch, the tracker provider from the remote's URL, and whether a tracker token is present in the environment or in `~/.binnacle/credentials.json`, never its value. Whether a token works is `unknown`. A repository with no remote is told that local tickets under `docs/specs/` are a tracker Binnacle reads. Blocked by 02 only because both change `init.ts`: the provider-from-remote reading moves out of init so that the audit and init share it.

- [ ] `binn audit` on a Git repository prints findings, in a stable order, each with its code, area, status, reason and recommendation.
- [ ] `--json` gives the same findings.
- [ ] The exit code is 0 when there are gaps, and non-zero, with a reason, for a missing or unreadable path and for a directory that is not a Git repository.
- [ ] The tracker provider is read from the remote, and the token's presence is reported without its value, in either output.
- [ ] A test lists a fixture's files before and after the audit, with the daemon's home and `~` pointed at an empty directory, and finds no difference.
- [ ] A test runs the audit on a bare fixture with the daemon not started.
- [ ] The provider-from-remote reading is shared with `binn init`, not copied.
