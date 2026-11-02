# 02: Runs before a merge leave the Task everywhere

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-0-7/spec.md`
Roles: Developer, Reviewer

**What to build:** the board, `/binnacle:daily` and the dashboard's Task page read a Task in progress from activity as the snapshot does (spec, *One reading of runs after a merge*; product inbox, *Left after epic 21's tickets*). The rule the snapshot applies, dropping runs that started before the latest merge of their Task's branch, moves to where the latest run of each Task is chosen from the stored runs, so the board and the daily delta follow it; the snapshot uses that one function, not a copy. `task.get`'s brief says whether the Task is in progress from activity by the same reading, and the Task page shows "in progress" and the resume command from it rather than from the presence of runs. Usage, a Task's runs by role and `task.get`'s run list keep every attributed run.

- [ ] Through the board's operation on a fixture with a real Git repository and a real `git merge`, as ticket hygiene-after-0-4-0/02's test builds it: a `READY` Task with a run on its branch is in progress; after a fast-forward merge it is not.
- [ ] Through `daily`: the same Task is not among those waiting for the owner as in progress after the merge, so `/binnacle:daily` and `/binnacle:product` agree.
- [ ] `task.get`'s brief reads the Task in progress before the merge and not after it; a run that starts on the branch after the merge brings it back everywhere.
- [ ] Usage by Task, a Task's runs by role and `task.get`'s runs are unchanged by the merge.
- [ ] The Task page, checked in a browser in both languages: a merged `READY` Task with runs shows the start command, not "in progress" and the resume command; one in progress still shows them.
- [ ] `CONTEXT.md`'s *In progress* no longer says the merge ends it in the snapshot alone.

## Comments
