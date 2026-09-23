# 04: Project status and detect, with live Git facts

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/core-and-persistence/spec.md`

**What to build:** a user — or an agent session that only knows its own working directory — can ask what Binnacle currently believes about a project and get manifest facts and live Git facts in one answer. Git is read, never written, and a project outside Git is degraded rather than rejected.

- [x] `binn project status` returns manifest facts and current Git facts together.
- [x] Branch, detached HEAD, current commit, dirty flag and remotes are reported for a normal repository.
- [x] A repository with no commits, no branch or no remote is a normal result, not an error.
- [x] A directory that is not a repository registers and reports Git facts as unavailable with a reason.
- [x] A machine with no `git` on PATH behaves the same way: unavailable with a reason, daemon unaffected.
- [x] A `git` invocation that hangs hits a timeout and degrades to unavailable rather than hanging the API.
- [x] Git is only ever inspected: no fetch, no network, no write, no ref, index or config change. Arguments are passed as explicit arrays, never as a shell string.
- [x] `project.detect` maps a working directory to a project from the repository root and from any nested subdirectory.
- [x] Detect on an unregistered directory says so explicitly rather than guessing.
- [x] A manifest tracker that disagrees with the Git remote produces a diagnostic. Binnacle reports the disagreement and does not resolve it.
- [x] Git facts are read live at call time and are not stored in the projection.

## Comments

Implemented on `feat/project-status-and-git-facts`. 91 tests pass, `tsc --noEmit` clean.

Decisions worth knowing before tickets 05 and 07:

- **`packages/adapters` is born, with the Git adapter in it.** `readGitFacts(cwd, timeoutMs)` returns either the facts — `root`, `branch` (null when detached), `detached`, `commit` (null with no commits), `dirty` (untracked files included), `remotes` — or `{ available: false, code, reason }`, where `code` is one of `git.not_found`, `git.not_a_repository`, `git.timeout` and `git.failed`. It never throws for a Git problem. The daemon is its only consumer, and the ADR-0012 test now scans its sources as the daemon's own.
- **Read-only by construction, not by care.** Only `rev-parse`, `symbolic-ref`, `status` and `remote -v` run. Each is spawned from an argument array with no shell, with `--no-optional-locks` (otherwise `status` rewrites the index) and `-c core.fsmonitor=false` (otherwise `status` runs whatever hook the repository config names). The environment has every inherited `GIT_*` variable removed, plus `LC_ALL=C`, no prompts and no lazy fetch. One test fingerprints every byte under `.git` across a status call that an ordinary `git status` would have written to. Another configures an fsmonitor hook and asserts that it never ran.
- **A hung git settles on the timer, not on its exit.** A git that never closes its pipes cannot hold `project.status`. The limit is 5 s per call, and `BINNACLE_GIT_TIMEOUT_MS` raises it. That variable is also how the test gets a 200 ms timeout without a second seam; it is documented in the installation checklist and in `binn --help`.
- **Remote URLs lose their credentials.** Over HTTPS the whole user part is removed; elsewhere only a password is. These facts are on their way to agent transcripts (ADR-0013).
- **The tracker diagnostic is a pure function in core.** `trackerRemoteMismatch` returns `{ code: 'tracker.remote_mismatch', message }` only when `github` or `gitlab` is declared, at least one remote exists and none of them is hosted there. An undeclared or `local` tracker never disagrees, per ticket 03. The `ponytail:` comment records its limit: a self-hosted instance on a hostname with no `github` or `gitlab` label reads as a mismatch.
- **Detect and status share one lookup.** A path resolves to the deepest registered project containing it, with no Git involved. That makes detect work for a project outside Git, and makes `binn project status` work from any subdirectory. A path that no project contains is `404 project.not_registered` from both. Both re-derive the projection, so the manifest facts are current and `project.manifest_changed` is recorded where it applies. Git facts are never stored in the projection.
- **`project.register` does not return Git facts.** "Registers and reports Git facts as unavailable" is the register call succeeding and then `project.status` reporting. Registration stays independent of Git.

For ticket 05: when a registered repository has disappeared, `readGitFacts` checks the directory before it spawns anything. Otherwise the spawn's `ENOENT` would read as "git is not on PATH". Today `project.status` refuses a path that no longer exists before it gets that far, with `project.path_not_found`. Whether status should report a disappeared project instead of refusing is ticket 05's question.

### Review

Reviewed on both axes. No acceptance criterion was missing. Fixed:

- **`git status` ran a command named by the repository.** A `core.fsmonitor` hook in the repository config was executed on every status. Both reviewers confirmed it, and one ran it in a scratch repository. It is now disabled on every spawn and pinned by a test.
- **`status.showUntrackedFiles=no` hid untracked files from `dirty`.** The flag is now explicit, and a test covers it.
- **A missing working directory was reported as a missing `git`.** Node gives the same `ENOENT` for both.
- **A password in an `ssh://` remote got through.** Only HTTPS remotes were being cleaned.
- **An exit code was made up when git was killed by a signal.** It is now null and reported as a failure.
- **`project.detect` could answer `project: null`** for a registered path that had no projection row. It now re-derives, the same as status.
- **The diagnostic code lived in the daemon while its rule lived in core.** Core now returns both.
- **A comment on the timeout promised it took effect without a restart**, which holds only in-process. The comment now says it takes effect from the next daemon start.

Kept, deliberately: `detached` alongside a null `branch`, because the spec asks for "an explicit detached marker"; `root`, which the spec lists among the facts; and the timeout variable, because the spec forbids a test-only injection seam, so a documented setting is the honest alternative.
