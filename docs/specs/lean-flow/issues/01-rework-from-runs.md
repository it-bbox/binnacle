# 01: Rework read from runs

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/lean-flow/spec.md`

**What to build:** Binnacle tells review from rework by the runs, not by the order of the commits (spec, *Roles from runs*; `CONTEXT.md`, *Review run*, *Rework run*). On a Task's branch a subagent run is a review run when it starts after the branch's first commit changing anything but its ticket; rework is the implementation work after the Task's first review run ends. A Task with no review run keeps the commit that first records its Review as the boundary; a review requesting changes on GitHub or GitLab stays the boundary there. Roles are computed when usage is read, so epic 11's Tasks read by the new rule with nothing to migrate.

- [ ] Through the daemon's `usage.get` and `task.get`, on a Git repository with session artifacts: a review subagent with fixes after it reads review and rework apart whether the Review was committed before the fixes, after them, or last.
- [ ] A Task with no review subagent reads rework after the commit that first records its Review; a subagent that starts before the branch's first commit changing anything but the ticket is implementation.
- [ ] A run that crosses the end of the first review run is split there.
- [ ] GitHub's and GitLab's review boundary is unchanged; the existing tests for it pass.
- [ ] `usage_get`'s description and `docs/04-telemetry-dashboard.md` state the new rule; the derived metrics keep their shape and their `calculated` label.
- [ ] On this repository, `usage_get` shows epic 11's Tasks with review and rework read by the new rule.

## Comments

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground. The ticket names no role beyond the Developer and the Reviewer.

**Standards: no hard violation.** To fix:

1. **A merged branch loses its own commits** (`packages/adapters/src/git.ts`, `readOwnChangeTimes`): every value of the default branch's reflog reachable from the anchors, other than the anchors, is left out with its ancestors, so when the branch's merged tip is not an anchor, as when `DONE` is committed on `main` after the merge, the branch's commits are all left out, `firstChange` is null and its review runs read as implementation. Fix: a reflog value that merged one of the Task's branches (`merge <branch>:`) is the branch's own tip and an anchor, and the walk over the default branch's other values stops at the anchors, so no later value reaches through them; a test merges, then commits on `main`, then sets `DONE` there.
2. **The `--not` list grows with the reflog** (same function): every excluded value is an argument, and on Windows a command line stops near 32,000 characters, about 780 hashes. Fix: read the history's parents once (`git rev-list --parents`) and walk the default branch's values in the code, so the command line stays short.
3. **Seconds against milliseconds** (`apps/daemon/src/usage.ts`, `reviewPoints`): a commit's author time, in whole seconds, is compared with the first record's time in milliseconds, so a commit in the same second as that record is dropped. Fix: compare against the first record's second.
4. **Duplicated Code** (`apps/daemon/test/usage.test.ts`): the first test of *Implementation, review and rework* keeps its own `commit` and writes out the Review, the ticket's path and the run ids the new constants hold. Fix: the constants and `commitAt` move to the top of the `describe`, and the first test uses them.
5. **Mysterious Name** (`packages/telemetry/src/index.ts`): `own` holds a Task's review runs. Fix: rename it; it goes with 7 anyway.
6. **Russian wording** (`apps/dashboard/app/i18n/ru.ts`): «субагента, начавшего после…» reads unfinished. Fix: «запущенного после…».

**Spec.** To fix:

7. **Reviewers side by side end the first review together** (`packages/telemetry/src/index.ts`, `CONTEXT.md`, `docs/04-telemetry-dashboard.md`, `usage_get`'s description, the dashboard's strings): the spec says rework starts "after the last record of the Task's first review run", and `CONTEXT.md` already held the definitions; the change extended them. Fix: back to the first review run alone, `CONTEXT.md` as it was. With the code review's two reviewers in the foreground, as under autopilot, the implementer makes no call while they run, so little moves.
8. **The reflog's ceiling is not named** (`readOwnChangeTimes`): the default branch's reflog is local and expires, after 90 days by default, so a Task read later can take the default branch's commits made during its run for its own. Fix: a `ponytail:` comment names it and the upgrade path.

Kept:

9. Rework is any record but review after the boundary, a subagent's too, against the spec's "non-subagent record": under autopilot the implementer is itself a subagent, and `CONTEXT.md` and user story 11 read rework as the implementation work after the review.
10. The default branch's reflog and the first record's time narrowing the branch's commits are not in the spec: the spec asks for the branch's first commit, and on a history rebased and merged fast-forward, with the branch deleted, nothing else tells the branch's commits from `main`'s.
11. A helper subagent started after the first commit reads as review and its end starts rework: it is the spec's rule (`CONTEXT.md`, *Review run*).
12. First-pass acceptance still counts a Task as reviewed by its ticket's Review: the spec keeps `### Review` (*Out of Scope*).
13. `Pick<TrackerTask, 'id' | 'title' | 'ticket'>` repeats in `reviewPoints`: the pattern of the whole file.
14. `reduce` for the earliest time rather than `Math.min(...)`: a spread over every commit of a long history can exceed the call stack.
15. `taskOf(record)!` in the second pass: a record with no role yet is on a Task's branch by the first pass.
16. The criterion on this repository, unverified by the reviewer, who could not run a daemon: the implementer ran it, see *On this repository* below; Task 12, the exit demonstration, was run with the owner on `main` and has no run on a branch of its own.
