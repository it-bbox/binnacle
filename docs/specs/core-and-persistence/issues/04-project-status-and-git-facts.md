# 04: Project status and detect, with live Git facts

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/core-and-persistence/spec.md`

**What to build:** a user — or an agent session that only knows its own working directory — can ask what Binnacle currently believes about a project and get manifest facts and live Git facts in one answer. Git is read, never written, and a project outside Git is degraded rather than rejected.

- [ ] `binn project status` returns manifest facts and current Git facts together.
- [ ] Branch, detached HEAD, current commit, dirty flag and remotes are reported for a normal repository.
- [ ] A repository with no commits, no branch or no remote is a normal result, not an error.
- [ ] A directory that is not a repository registers and reports Git facts as unavailable with a reason.
- [ ] A machine with no `git` on PATH behaves the same way: unavailable with a reason, daemon unaffected.
- [ ] A `git` invocation that hangs hits a timeout and degrades to unavailable rather than hanging the API.
- [ ] Git is only ever inspected: no fetch, no network, no write, no ref, index or config change. Arguments are passed as explicit arrays, never as a shell string.
- [ ] `project.detect` maps a working directory to a project from the repository root and from any nested subdirectory.
- [ ] Detect on an unregistered directory says so explicitly rather than guessing.
- [ ] A manifest tracker that disagrees with the Git remote produces a diagnostic. Binnacle reports the disagreement and does not resolve it.
- [ ] Git facts are read live at call time and are not stored in the projection.
