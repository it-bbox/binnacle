# 02: Runs before a merge no longer keep the Task in progress

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`
Roles: Developer, Reviewer, Architect

**What to build:** a Task whose branch is merged into the default branch is not read as in progress because of the runs before that merge (spec, *Runs after a merge*; product inbox, *Left after epic 20's tickets*). The Git adapter reads, from the default branch's reflog, the latest time each branch was merged there, from the `merge <branch>: …` entries `git merge` writes. The snapshot's set of Tasks with attributed runs, which the Tasks in flight, *Waiting for the owner* and the Suggested step read, leaves out a run that started before the latest merge of its Task's branch; a run that starts after it counts. Usage, a Task's runs by role and `task.get`'s brief keep every attributed run.

- [x] Through `project.snapshot` on a fixture with a real Git repository and a real `git merge`: a `READY` Task with a run on its branch is in flight; after the merge it is not, and the Suggested step does not wait for it.
- [x] A `ready-for-human` Task whose branch is merged is among the owner's Tasks to start.
- [x] A run that starts on the branch after its merge puts the Task in flight again; a branch merged twice reads by its latest merge.
- [x] A branch that reached the default branch by a squash commit, with no `merge` entry, reads as before.
- [x] Usage by Task and a Task's runs by role are unchanged by the merge.
- [x] `CONTEXT.md` or `docs/04-telemetry-dashboard.md`, wherever a Task in progress from activity is defined, says that a merge ends it.

## Comments

- **For the next tickets:** `readMergeTimes` in `packages/adapters/src/git.ts` gives, per branch, the latest `git merge` into the default branch from its reflog; `sinceMerge` in `apps/daemon/src/snapshot.ts` drops the runs that started before it, and its result feeds `taskSections`, `pendingDecisions` and `suggestedStep`. The exit demonstration's merged Task should leave *Tasks in flight* after `git merge --ff-only` or `--no-ff` in the main checkout.
- **Decision:** a run's branch is `run.branch`, the one that attributed it, not `taskBranch(task)`: they are the same name, and the run's own needs no lookup.
- **Decision:** the CONTEXT.md entry *In progress* says that the merge ends it in the Product Snapshot, not everywhere: the board (`latestRuns` in `apps/daemon/src/usage.ts`, read by `apps/daemon/src/board.ts`), the daily delta (`readAttributed` in `apps/daemon/src/operations.ts`) and the dashboard's Task page (`fromRuns` in `apps/dashboard/app/pages/task.vue`) still read every run, as the ticket's scope leaves them.
- **For a Product session:** a merged `READY` Task now reads Ready to start in the snapshot and on the dashboard's home, but In progress on the board, with "resume" on its Task page, and `/binnacle:daily`'s *Waiting for the owner* can disagree with `/binnacle:product`'s. Applying `sinceMerge` in `latestRuns`, before the latest run is chosen, would bring the board and the daily delta along with usage untouched; a Done card would then name no run, so the board might filter only the placement. Worth a ticket or an inbox entry.

### Review

Reviewed against `main` in a sub-agent, on the project's standards, the ticket's spec and the Architect's concerns. Every criterion holds and is pinned by `apps/daemon/test/next.test.ts`, *runs before a merge*; nothing blocks.

- `apps/daemon/test/next.test.ts`: both merges were `--no-ff`, while this repository merges with `--ff-only`, whose entry reads `merge <branch>: Fast-forward`. Fixed: the first merge is a fast-forward.
- `apps/daemon/src/snapshot.ts`, `Snapshot.tasks`: `inFlight` and `readyToStart` said "as the board reads it" and "no attributed AgentRun". Fixed: they name the merge and say the board does not read it.
- `packages/adapters/src/git.ts`, `readMergeTimes`: the comment said null for a default branch with no reflog, which gives an empty map; and a merge finished by `git commit` after a conflict, `commit (merge): …`, was not named. Fixed in the comment and in CONTEXT.md; the commit's message is not parsed, since it can be edited.
- `sinceMerge` ran two `git` processes on every snapshot, and repeated `readDefaultBranch(…) ?? 'main'`. Fixed: it returns early with no attributed run on a branch, and reuses `defaultBranch` from `apps/daemon/src/graph.ts`, now exported.
- An octopus merge, or `git merge refs/heads/<branch>` or `origin/<branch>`, reads as a name no Task's branch has. Kept: named in a `ponytail:` line; nothing here merges that way, and it errs towards in flight.
- A run started before the merge and still active after it is dropped. Kept: the spec's rule is the run's start; autopilot reads `activity.running` before it resumes, which is not filtered.

#### Architect

- Layers: the reflog reader sits in the Git adapter beside `readOwnChangeTimes`, and the filter in the snapshot after `usageAndActivity`, so usage, a Task's runs by role and `task.get` keep every run. No finding.
- The board, the daily delta and the dashboard's Task page still read In progress from every run (see *For a Product session* above). Left: the ticket names the snapshot's set alone; recorded for a Product session, and CONTEXT.md says the snapshot.
