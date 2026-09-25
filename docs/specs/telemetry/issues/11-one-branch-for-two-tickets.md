# 11: Two tickets with the same slug get one branch, and it credits neither

Status: READY
Triage: ready-for-agent
Blocked by: 12
Spec: `docs/specs/telemetry/spec.md`, `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** found by ticket 09. On the local tracker, `task_get` names the branch `feat/<slug>` from the ticket's file name, without the epic (`taskBranch` in `packages/core/src/tracker.ts`). `docs/specs/tracker-and-matt-pocock-integration/issues/12-exit-demonstration.md` and `docs/specs/telemetry/issues/09-exit-demonstration.md` both get `feat/exit-demonstration`. `branchTask` finds two tickets for that branch and returns none, as the spec requires. So the branch `/binnacle:task` names for either ticket credits nothing. That breaks user story 21 of the telemetry spec: "the branch `/binnacle:task` names is the branch that gets the credit". It is the only collision in the repository today, and every epic that ends with an exit demonstration adds one.

The owner chose option 2 under *Comments*: the convention stays, slugs are unique when slicing, and an ambiguous branch is reported.

- [ ] `task_get` for a local ticket whose branch another ticket's slug also gives reports a diagnostic that names the other ticket.
- [ ] `binn init`'s ticket-header section for the local tracker says that a ticket's slug is unique across epics, as this repository's `docs/agents/issue-tracker.md` does.
- [ ] A test at the core seam shows the diagnostic for two tickets in different epics with the same file slug, and no diagnostic for a unique slug.

## Comments

- **Measured on 2026-09-25.** `task.get` gives `feat/exit-demonstration` for both `telemetry/09` and `tracker-and-matt-pocock-integration/12`. The 25 records ticket 09's first session wrote in its worktree on that branch, which is where the reflog placed them, were all `unknown`.
- **Options, for the owner.**
  1. **Put the epic in the branch.** For example `feat/<epic-slug>/<slug>`, or `feat/<slug>` only while the slug is unique and the longer form otherwise. This changes the convention "as this repository has always named them". Past branches keep mapping only where their slug is unique, which is what happens today.
  2. **Keep the convention, and make the slugs unique when slicing.** `/to-tickets` gives each ticket a file name that no other epic uses, and `task_get` reports a diagnostic when its branch is ambiguous. The second exit demonstration's ticket would need a new name.
  3. **Resolve a tie by the ticket that is not `DONE`.** This rests on the tracker's current state, so a finished ticket's runs would move to the other ticket when it opens. It is a guess, which the spec rules out.
- **Decided by the owner on 2026-09-25, in a Product session.**
  - Option 2. `docs/agents/issue-tracker.md` now requires a ticket's slug to be unique across epics.
  - The existing pair keeps its names. Renaming `telemetry/09` would make `feat/exit-demonstration` map to `tracker-and-matt-pocock-integration/12` alone, and ticket 09's own records on that branch would move to it. So that branch credits neither, as user story 22 wants.
  - Built after ticket 12, by autopilot, so that ticket 09's criterion 2 can read this ticket's own runs. It waits in `BACKLOG` while ticket 12's own autopilot run goes, so that run does not take it. A Product session sets it `READY` after ticket 12 merges.
