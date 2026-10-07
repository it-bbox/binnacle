# 09: Implementation, review and rework told apart

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** a run on a Task's branch is `implementation`, `review` or `rework`, read from Git: a review run is a subagent run that starts after the branch's last commit changing anything but the ticket and ends by the commit that first adds `### Review` to the ticket; a rework run is implementation work after that commit (spec, *Roles*). A run crossing that point is split there. The snapshot's `byRole`, `task_get`, `usage.get` and the dashboard's Task page show the three apart, replacing the two "not available" lines, in both languages.

- [x] Daemon process tests on a repository with a Task branch, a Review commit and a fix after it: implementation, review and rework runs, a crossing run split.
- [x] `task_get` and `usage.get` give a Task's totals by role; the snapshot's `byRole` lists the new roles.
- [x] The dashboard's Task page shows review and rework usage in both languages.

## Comments

### Decisions

- **Where the points come from.** One `git log --branches --reverse -G'^### Review'` over the tickets of the Tasks whose branches the records were on gives each ticket's first commit adding the heading (`readFirstReviews` in `packages/adapters/src/git.ts`). Every local branch is read, so a Task merged into the default branch and its branch deleted keeps its roles. The last change is the newest commit before that one, the Review commit itself left out, that changed anything but the ticket (`readLastChangeBefore`). It is read once per Review commit and ticket and kept in the daemon, because history under a commit does not change. Both use author time, which a rebase keeps.
- **A record's role**, in `observedRuns`:
  - `rework` after the Review commit;
  - `review` up to that commit for a subagent that started after the last change;
  - `implementation` otherwise.

  A run is split wherever its records' role changes, as it is where its branch changes. So a session that crosses the Review commit is split there. A reviewer still running after the Review commit is split there too, its tail being rework. An implementing subagent that started before the last change stays implementation throughout: the spec says a review run *starts* after that change.
- **The snapshot's `byRole`.** The snapshot's `usage` had no `byRole`; only `usage.get` did. The ticket and story 28 ask for one in the snapshot, so the snapshot's `usage` gains `byRole` over the last seven days, like its `tasks` and `unassigned`, every role listed. Without the tracker it is unavailable with the tracker's reason. Its existing fields are unchanged.
- **`task.get` gains `byRole`**: the Task's implementation, review and rework totals over everything ingested, the same as `usage.get` gives for the Task. It now waits up to the ingest budget, as `task.list` and `usage.get` do. `taskBrief` takes the Task `findTask` read, so the tracker is read once per call.
- **On GitHub or GitLab** no ticket file holds a Review, so every run on a Task's branch stays implementation until ticket 10 reads the forge's reviews.
- **The Suggested step's "being worked on"** (`packages/core/src/roadmap.ts`) now counts an active run in any role on a Task's branch, not only `implementation`. Otherwise a Task under review or in rework would read as idle.
- **The dashboard.**
  - The Task page's usage shows *Usage by role*: implementation, review and rework side by side, with a line saying they are Binnacle's calculation from the Task branch's commits. The two "not available" rows are gone; questions and answers stays.
  - The Project and Usage pages list review and rework among the roles.
  - Both dictionaries gain `roleReview`, `roleRework` and `rolesReading`. The strings left unused (`implementationUsage`, `reviewUsage`, `reworkUsage` and the two reasons) are gone.
- **The MCP tools' descriptions** for `task_get` and `usage_get` name the roles and how they are read. The documents are ticket 14's.
- **Checked by hand on 2026-10-07.** Setup: a daemon on a temporary home under `.scratch/`, an ephemeral port and a temporary Claude Code root. A demo repository had a Task branch, a code commit, a Review commit and a fix, and one session crossed the Review with a subagent between the code commit and the Review. The Task page showed three runs, `implementation`, `review` and `rework`, and *Usage by role* with one record in each column, in Russian and in English. The console showed no errors.
- **For the owner, about this repository's own flow.** Sessions here commit their review fixes *before* the commit that records the Review, which is also the `DONE` commit. Read as the spec defines the roles, the reviewing subagents here start before the last change, so they count as implementation, and so do the fixes; only work after the `DONE` commit counts as rework. A Product session may want to record the Review before committing its fixes, or amend the definition.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation of a documented rule.** The Git adapter's rules hold: `log` only, hashes from Git's own output, and caller paths as `:(top,literal)` pathspecs after `--`. Findings, all judgement calls:

1. **Duplicated code:** the ingest-then-runs preamble was in `latestRuns` and the new `taskByRole`. **Fixed**: one `storedRuns`.
2. **`TaskRole` was declared in `usage.ts` and imported by `task.ts`, which `usage.ts` imports.** **Fixed**: it lives beside `RunRole` in `packages/core/src/domain.ts`.
3. **Unclear names:** the `lastWork` cache and `ReviewPoints.work`. **Fixed**: `lastChangeBeforeReview` and `lastChange`.
4. **`ReviewPoints` had no doc comment.** **Fixed**.
5. **The sets of roles are written out in the daemon and in the dashboard's types.** **Kept**: the dashboard mirrors the daemon's types by hand everywhere.
6. **A record's role was computed again for every comparison.** **Fixed**: once per record.

**Spec: every criterion met.** Findings:

1. **"Every role is labelled as calculated":** no `provenance` on `role` or `byRole` in the JSON. **Left**: the role was already Binnacle's reading of the branch, unlabelled, and giving it a provenance changes the shape of `role` for the board, the Suggested step and every page. The tools' descriptions and the Task page say it is a calculation.
2. **`### Review` is matched anywhere in the ticket, not only under `## Comments`.** **Kept**, marked with a `ponytail:` comment: a ticket's body does not use that heading.
3. **Review and rework were added to the Project and Usage pages**, beyond the Task page. **Kept**: they list every role, and a missing one would hide usage.
4. **The Suggested step's filter changed.** **Kept**: needed for the new roles (see *Decisions*).
5. **A subagent that started before the last change was split into implementation and review there.** **Fixed**: a subagent is a reviewer by when it started, and the test now has one running past that commit.
6. **The last change is read from all of the Review commit's history, not only the branch's own commits.** **Left**: once merged, the branch's own commits cannot be told apart from Git alone. A branch with no change of its own takes the commit it started from as its last change.
7. **"The snapshot's usage keeps its shape" while gaining `byRole`.** **Kept**, as decided above; the existing fields are unchanged.
