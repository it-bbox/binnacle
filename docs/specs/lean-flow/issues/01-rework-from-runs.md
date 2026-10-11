# 01: Rework read from runs

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/lean-flow/spec.md`

**What to build:** Binnacle tells review from rework by the runs, not by the order of the commits (spec, *Roles from runs*; `CONTEXT.md`, *Review run*, *Rework run*). On a Task's branch a subagent run is a review run when it starts after the branch's first commit changing anything but its ticket; rework is the implementation work after the Task's first review run ends. A Task with no review run keeps the commit that first records its Review as the boundary; a review requesting changes on GitHub or GitLab stays the boundary there. Roles are computed when usage is read, so epic 11's Tasks read by the new rule with nothing to migrate.

- [x] Through the daemon's `usage.get` and `task.get`, on a Git repository with session artifacts: a review subagent with fixes after it reads review and rework apart whether the Review was committed before the fixes, after them, or last.
- [x] A Task with no review subagent reads rework after the commit that first records its Review; a subagent that starts before the branch's first commit changing anything but the ticket is implementation.
- [x] A run that crosses the end of the first review run is split there.
- [x] GitHub's and GitLab's review boundary is unchanged; the existing tests for it pass.
- [x] `usage_get`'s description and `docs/04-telemetry-dashboard.md` state the new rule; the derived metrics keep their shape and their `calculated` label.
- [x] On this repository, `usage_get` shows epic 11's Tasks with review and rework read by the new rule.

## Comments

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground. The ticket names no role beyond the Developer and the Reviewer.

**Standards: no hard violation.** To fix, all fixed:

1. **A merged branch loses its own commits** **Fixed** in 2a140a2. (`packages/adapters/src/git.ts`, `readOwnChangeTimes`): every value of the default branch's reflog reachable from the anchors, other than the anchors, is left out with its ancestors, so when the branch's merged tip is not an anchor, as when `DONE` is committed on `main` after the merge, the branch's commits are all left out, `firstChange` is null and its review runs read as implementation. Fix: a reflog value that merged one of the Task's branches (`merge <branch>:`) is the branch's own tip and an anchor, and the walk over the default branch's other values stops at the anchors, so no later value reaches through them; a test merges, then commits on `main`, then sets `DONE` there.
2. **The `--not` list grows with the reflog** **Fixed** in 2a140a2. (same function): every excluded value is an argument, and on Windows a command line stops near 32,000 characters, about 780 hashes. Fix: read the history's parents once (`git rev-list --parents`) and walk the default branch's values in the code, so the command line stays short.
3. **Seconds against milliseconds** **Fixed** in 2a140a2. (`apps/daemon/src/usage.ts`, `reviewPoints`): a commit's author time, in whole seconds, is compared with the first record's time in milliseconds, so a commit in the same second as that record is dropped. Fix: compare against the first record's second.
4. **Duplicated Code** **Fixed** in bb1f97b. (`apps/daemon/test/usage.test.ts`): the first test of *Implementation, review and rework* keeps its own `commit` and writes out the Review, the ticket's path and the run ids the new constants hold. Fix: the constants and `commitAt` move to the top of the `describe`, and the first test uses them.
5. **Mysterious Name** **Fixed** in 1b60df0, the map now `firstReview`. (`packages/telemetry/src/index.ts`): `own` holds a Task's review runs. Fix: rename it; it goes with 7 anyway.
6. **Russian wording** **Fixed** in bb1f97b. (`apps/dashboard/app/i18n/ru.ts`): «субагента, начавшего после…» reads unfinished. Fix: «запущенного после…».

**Spec.** To fix, both fixed:

7. **Reviewers side by side end the first review together** **Fixed** in 1b60df0. (`packages/telemetry/src/index.ts`, `CONTEXT.md`, `docs/04-telemetry-dashboard.md`, `usage_get`'s description, the dashboard's strings): the spec says rework starts "after the last record of the Task's first review run", and `CONTEXT.md` already held the definitions; the change extended them. Fix: back to the first review run alone, `CONTEXT.md` as it was. With the code review's two reviewers in the foreground, as under autopilot, the implementer makes no call while they run, so little moves.
8. **The reflog's ceiling is not named** **Fixed** in 2a140a2. (`readOwnChangeTimes`): the default branch's reflog is local and expires, after 90 days by default, so a Task read later can take the default branch's commits made during its run for its own. Fix: a `ponytail:` comment names it and the upgrade path.

Kept:

9. Rework is any record but review after the boundary, a subagent's too, against the spec's "non-subagent record": under autopilot the implementer is itself a subagent, and `CONTEXT.md` and user story 11 read rework as the implementation work after the review.
10. The default branch's reflog and the first record's time narrowing the branch's commits are not in the spec: the spec asks for the branch's first commit, and on a history rebased and merged fast-forward, with the branch deleted, nothing else tells the branch's commits from `main`'s.
11. A helper subagent started after the first commit reads as review and its end starts rework: it is the spec's rule (`CONTEXT.md`, *Review run*).
12. First-pass acceptance still counts a Task as reviewed by its ticket's Review: the spec keeps `### Review` (*Out of Scope*).
13. `Pick<TrackerTask, 'id' | 'title' | 'ticket'>` repeats in `reviewPoints`: the pattern of the whole file.
14. `reduce` for the earliest time rather than `Math.min(...)`: a spread over every commit of a long history can exceed the call stack.
15. `taskOf(record)!` in the second pass: a record with no role yet is on a Task's branch by the first pass.
16. The criterion on this repository, unverified by the reviewer, who could not run a daemon: the implementer ran it, see *On this repository* below; Task 12, the exit demonstration, was run with the owner on `main` and has no run on a branch of its own.

**In all**: eight findings fixed, eight kept. The typecheck and the full suite, 707 tests, pass after the fixes.

### Decisions taken without the owner

- **Rework is any record but review after the boundary**, a subagent's too (Review, 9).
- **The branch's own commits** are read from its tips that exist or that the default branch's reflog says it merged, its Review commit and its `DONE` commit on the default branch, leaving out what the default branch's other reflog entries reach and what was authored before the Task's first record on its branch (Review, 10). On this repository, without the reflog, a Product commit on `main` rebased under ticket 14 of epic 11 read as its first change, and its implementer as a reviewer.
- **The first review run** is the first review subagent's alone, as the spec says (Review, 7).

### On this repository

Read on 2026-10-11 through `usage.get` and `task.get` of a temporary daemon of this branch, its home in the worktree's git-ignored `.scratch/`, over a copy of the owner's store (`VACUUM INTO`, the owner's daemon untouched), since a fresh home cannot tell the branches of worktrees already removed (ADR-0030). Records, then tokens, by role; `task.get` gave the same:

| Task | implementation | review | rework | review runs | rework share |
|---|---|---|---|---|---|
| 01 | 41, 4.1M | 21, 1.7M | 31, 4.5M | 2 | 0.52 |
| 02 | 83, 14.0M | 24, 2.1M | 21, 4.1M | 2 | 0.23 |
| 03 | 94, 16.9M | 21, 2.0M | 24, 6.3M | 2 | 0.27 |
| 04 | 108, 24.7M | 19, 1.8M | 33, 10.4M | 2 | 0.30 |
| 05 | 69, 11.7M | 18, 1.5M | 59, 16.5M | 2 | 0.59 |
| 06 | 62, 8.6M | 20, 1.9M | 24, 4.8M | 2 | 0.36 |
| 07 | 108, 23.1M | 22, 2.0M | 46, 14.2M | 2 | 0.38 |
| 08 | 117, 24.1M | 16, 1.4M | 28, 7.9M | 2 | 0.25 |
| 09 | 63, 10.8M | 14, 1.1M | 31, 7.3M | 2 | 0.40 |
| 10 | 36, 4.5M | 13, 1.1M | 20, 3.4M | 2 | 0.43 |
| 11 | 30, 5.5M | 19, 1.7M | 25, 5.7M | 2 | 0.51 |
| 12 | — | — | — | 0 | — |
| 13 | 18, 2.7M | 23, 2.0M | 27, 4.2M | 2 | 0.61 |
| 14 | 26, 2.4M | 13, 1.0M | 18, 2.4M | 2 | 0.50 |

Each reviewed Task shows the code review's two reviewers as its review runs. Task 12, the exit demonstration, was run with the owner on `main` and has no run on a branch of its own.

To see it in your own daemon once this branch is merged: restart the daemon so that it runs the new code, then ask a session for `usage_get` with `task: the-state-of-work/05`, or open a Task of epic 11 on the dashboard; its review and rework should match the row above, give or take the records ingested since.
