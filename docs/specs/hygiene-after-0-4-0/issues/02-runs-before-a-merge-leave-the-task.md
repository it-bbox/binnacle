# 02: Runs before a merge no longer keep the Task in progress

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`
Roles: Developer, Reviewer, Architect

**What to build:** a Task whose branch is merged into the default branch is not read as in progress because of the runs before that merge (spec, *Runs after a merge*; product inbox, *Left after epic 20's tickets*). The Git adapter reads, from the default branch's reflog, the latest time each branch was merged there, from the `merge <branch>: …` entries `git merge` writes. The snapshot's set of Tasks with attributed runs, which the Tasks in flight, *Waiting for the owner* and the Suggested step read, leaves out a run that started before the latest merge of its Task's branch; a run that starts after it counts. Usage, a Task's runs by role and `task.get`'s brief keep every attributed run.

- [ ] Through `project.snapshot` on a fixture with a real Git repository and a real `git merge`: a `READY` Task with a run on its branch is in flight; after the merge it is not, and the Suggested step does not wait for it.
- [ ] A `ready-for-human` Task whose branch is merged is among the owner's Tasks to start.
- [ ] A run that starts on the branch after its merge puts the Task in flight again; a branch merged twice reads by its latest merge.
- [ ] A branch that reached the default branch by a squash commit, with no `merge` entry, reads as before.
- [ ] Usage by Task and a Task's runs by role are unchanged by the merge.
- [ ] `CONTEXT.md` or `docs/04-telemetry-dashboard.md`, wherever a Task in progress from activity is defined, says that a merge ends it.
