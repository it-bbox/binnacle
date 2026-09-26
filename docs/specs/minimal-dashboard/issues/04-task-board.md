# 04: The board on the Project page

Status: READY
Triage: ready-for-agent
Blocked by: 01, 02
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** the Project page shows the project's roadmap and a mini kanban of an epic's Tasks. In progress is read from runs, and each card names who works on it. Decided in the spec, under *The board: `task.list`*, and in ADR-0032.

- [ ] `packages/core` gives a Task's column from its state and from whether AgentRuns are attributed to it:
  - **Backlog**: `BACKLOG`.
  - **Ready**: `READY` without runs.
  - **In progress**: the in-flight states, and `READY` with runs, whose source is `runs`.
  - **Done**: `MERGED` and `DONE`.

  `CANCELLED` is counted, not listed. A Task whose state is unknown is listed apart, with its diagnostic.
- [ ] `task.list` takes the caller's path and an optional spec slug. Without a slug, it answers for the current epic.
- [ ] For each Task, `task.list` gives:
  - its id, title and state;
  - its column and the column's source;
  - its Unmet dependencies;
  - its ticket;
  - its start command;
  - its latest run — harness, model, role, latest activity and whether it is active — or none.
- [ ] Each column has the section limit and a remainder, and Done lists its latest Tasks by id. Remote Tasks without a spec form their own group.
- [ ] The Project page shows the roadmap's epics with their statuses, and the board for the current epic, with a switch to any other epic.
- [ ] A card shows its state and its Unmet dependencies. It carries the `runs` label when its column comes from runs, and says who works on it and whether that run is running now. A card links to its Task page.
- [ ] Done shows its count and its latest cards.
- [ ] The Project page also shows the registered checkout's Git state and the recent decisions. Pending decisions and CI appear as not available, with the snapshot's reason.
- [ ] The Overview links each project to its Project page.
- [ ] No ticket file changes: `task.list` joins the write guarantee's calls.
- [ ] Tests through the daemon seam cover:
  - every column;
  - a `READY` Task with a run, In progress from runs;
  - `CANCELLED` counted but not listed;
  - an unknown state listed apart;
  - the limit and the remainder;
  - the current epic when no slug is given.
