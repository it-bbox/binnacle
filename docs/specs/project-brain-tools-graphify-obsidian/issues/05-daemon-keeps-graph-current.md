# 05: The daemon keeps the graph current

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** the graph updated by the daemon when `main` moves (ADR-0036), and its freshness in the snapshot. Once a minute the daemon reads the commit of each registered project's default branch. When it has moved, the daemon runs Graphify's code-only extraction in the background in the registered checkout, under four conditions: the checkout is on the default branch, the capability is not `false`, `graphify` is on the daemon's PATH, and Git ignores the output directory. It runs one build per project at a time, with at most one queued. Each run's outcome — commit, time, success or Graphify's reason — is an event in the store, so it survives a restart. The snapshot gains a `graph` section: `available`, with a reason when false; the commit and time it was built from; `behind`, whether the default branch has moved past it; and the last run. A failed run is the attention item `graph.update_failed` and keeps the last good graph. An output directory Git does not ignore is `graph.not_ignored`, and nothing runs. A missing tool is the section's reason, not an attention item. The write guarantee allows the ignored graph directory and nothing else.

- [x] A commit to the default branch, with the fake `graphify` on PATH, leads to one code-only build, and the snapshot's `graph` names that commit.
- [x] A registered checkout on another branch runs no build, and `behind` is true.
- [x] Several commits during a run lead to at most one more run.
- [x] A failing fake is `graph.update_failed` with its reason; the previous graph is kept and `behind` is true.
- [x] An output directory not ignored by Git runs nothing and is `graph.not_ignored`.
- [x] No `graphify` on PATH, or the capability `false`, is `available: false` with a reason that tells them apart, and no attention item.
- [x] The last run's outcome survives a daemon restart.
- [x] The write-guarantee test allows the ignored graph directory and fails on any other write into the repository.
- [x] `docs/03-mcp-and-skills.md` describes the `graph` section; `docs/operations/03-external-tools.md` says the daemon keeps the graph current.

## Comments

### For the next tickets

- The runner is `apps/daemon/src/graph.ts`: `startGraphRunner`, started by `startDaemon` after it listens and stopped with it, and `graphSection`, which `project.snapshot` calls. The output directory is `GRAPH_DIRECTORY`, `graphify-out` (Graphify's default, checked through Context7), and the command is `graphify extract . --code-only`, as the spec fixes it. Ticket 04 should reuse both, and add `graphify-out/` to `.gitignore`: the daemon checks `graphify-out/graph.json` with `git check-ignore`, so a tracked `graph.json` also counts as not ignored.
- Outcomes are the events `graph.built` and `graph.failed`, with `{ commit, reason }`; `builtFrom` is the latest `graph.built`, `lastRun` the latest of either. Ticket 06 reads `graphify-out/graph.json` from the registered checkout; ticket 08 shows the `graph` section as the snapshot gives it.
- `DaemonOptions` gained `searchPath`, where `graphify` is looked for (`PATH` when omitted), and `graphPollMs` (60 000). `startTestDaemon` defaults `searchPath` to an empty directory, so no test sees a `graphify` installed on the machine it runs on; a test that wants one passes a fake's directory.
- The Git adapter gained `readBranchCommit` and `isIgnored`. The default branch is `origin/HEAD`, or `main` without one, as usage attribution reads it.

### Decisions taken here

- **A project with no recorded run is built at the first poll.** "When it has moved" is read as: moved past the last recorded run. The daemon cannot know the commit of a graph `binn init` built (ticket 04 records no event), so the first poll after registration builds once and records it. Until then `builtFrom` is `null` and `behind` is `true`.
- **A failed run is not retried every minute.** Its commit is recorded, so the next run waits for the next move of the default branch. Retrying a deterministic failure every minute would only repeat it.
- **`available`** is true when the capability is not `false`, `graphify` is on the PATH and `graphify-out/graph.json` exists; its reason otherwise says which of the three, in that order. `graph.not_ignored` is raised only when `graphify` is on the PATH and the capability is not `false`, so a missing tool stays the section's reason alone.
- **"Keeps the last good graph"** is the daemon's part only: it never deletes or rewrites the graph, and `builtFrom` stays on the last successful commit. What a failing Graphify leaves in its own directory is Graphify's.
- **A run is killed after ten minutes** and recorded as failed, so one hung run does not block the project's graph until a restart (`ponytail:` in the code).

### Review

`/code-review` ran against `main` on both axes, its two sub-agents in the foreground.

**Standards: no hard violation; three defects and several judgement calls.**

- Fixed: a spawn that fails emits `error` then `close`, which recorded two `graph.failed` events, the second hiding the first reason. `finish` now runs once.
- Fixed: a queued run that threw would have been an unhandled rejection, ending the daemon. The run's chain now catches and logs, as a poll does.
- Fixed: `stop()` did not wait for a poll in progress, which could read the store after it closed, and a SIGTERM'd run could hold the stop or leave its own children running. The stop now waits for the poll, and each run is spawned in its own process group, killed with SIGKILL.
- Fixed: an unreadable manifest counted as "Graphify allowed" (ADR-0007, never guess). It now runs nothing.
- Fixed: the default branch was read twice per check.
- Fixed: the Git adapter's header, which says a revision is only a hash and a path only a `:(literal)` pathspec, now names its two exceptions: a branch name only under `refs/heads/`, and `check-ignore`'s path after `--`. Neither can be read as an option.
- Kept: the run reads the working tree, so uncommitted changes in a registered checkout on `main` are in a graph recorded against the branch's commit. The spec says to run in the registered checkout; marked `ponytail:` with the upgrade, building from the committed tree as the vault will.
- Kept: `fakeGraphify` in two test files, the test's own `ignoredByGit`, and the test's hand-written `Graph` type. The tests check through the daemon seam and do not import the code they check.
- Left: `testing.ts`'s inline options type, which grows with each option; a `Pick<DaemonOptions, …>` is a refactor for its own change.

**Spec: no missing requirement; every criterion met.**

- Kept: the build at registration, which the spec does not name. See *Decisions taken here*.
- Kept: the ten-minute kill and the no-retry rule, both recorded above and in `docs/operations/03-external-tools.md`.
- Fixed: the write-guarantee test asserted the graph had been built right after the operations, which depended on a 20 ms poll. It now waits for the build, then compares the repository again.
- Kept: the dirty-checkout case, as under Standards.
