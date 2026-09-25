# 11: Two tickets with the same slug get one branch, and it credits neither

Status: DONE
Triage: ready-for-agent
Blocked by: 12
Spec: `docs/specs/telemetry/spec.md`, `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** found by ticket 09. On the local tracker, `task_get` names the branch `feat/<slug>` from the ticket's file name, without the epic (`taskBranch` in `packages/core/src/tracker.ts`). `docs/specs/tracker-and-matt-pocock-integration/issues/12-exit-demonstration.md` and `docs/specs/telemetry/issues/09-exit-demonstration.md` both get `feat/exit-demonstration`. `branchTask` finds two tickets for that branch and returns none, as the spec requires. So the branch `/binnacle:task` names for either ticket credits nothing. That breaks user story 21 of the telemetry spec: "the branch `/binnacle:task` names is the branch that gets the credit". It is the only collision in the repository today, and every epic that ends with an exit demonstration adds one.

The owner chose option 2 under *Comments*: the convention stays, slugs are unique when slicing, and an ambiguous branch is reported.

- [x] `task_get` for a local ticket whose branch another ticket's slug also gives reports a diagnostic that names the other ticket.
- [x] `binn init`'s ticket-header section for the local tracker says that a ticket's slug is unique across epics, as this repository's `docs/agents/issue-tracker.md` does.
- [x] A test at the core seam shows the diagnostic for two tickets in different epics with the same file slug, and no diagnostic for a unique slug.

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
- **What changed.**
  - `packages/core` gains `sharedBranch`, beside `taskBranch` and `branchTask`. It gives `task.shared_branch` when other Tasks have a Task's branch, and names each with its ticket path. It finds them by the rule `branchTask` credits by, so it fires exactly when the branch credits no Task. On a remote tracker it never fires, since a branch there carries the issue number.
  - `task.get`'s brief gains `diagnostics`: empty, or that one item. `task_get`'s description mentions it, and `/binnacle:task` quotes any diagnostic after it states the branch.
  - `binn init`'s ticket-header section for the local tracker now says: "A ticket's slug, its file name without the number, is unique across every spec's tickets: it names the ticket's branch, `feat/<slug>`, and Binnacle credits the work on a branch two tickets share to neither." The GitHub and GitLab sections are unchanged, byte for byte.
  - Nothing was renamed: the existing pair keeps its names, as the owner decided.
- **Test-first.** The tests came first and failed: the core test on the missing export, the daemon's and the MCP smoke test's on a brief without `diagnostics`, and `binn init`'s on the missing sentence.
  - At the core seam (criterion 3): `telemetry/09` and `tracker/12` share `exit-demonstration` and each is named in the other's diagnostic; `telemetry/11`'s unique slug gets none. Also one number written two ways, `03-a.md` and `3-a.md`, which the local tracker gives one id and still counts as two tickets, and two issues with one title, which share no branch.
  - At the daemon seam (criterion 1): `task.get` for a ticket whose slug another epic's ticket has names that ticket. The exact briefs on all three trackers, and the MCP smoke test's, carry `diagnostics: []`.
  - `binn init` as a subprocess (criterion 2): the local section states the rule, and GitHub's does not.
- **Checked on this repository on 2026-09-26**, through an in-process daemon on a temporary home, reading this ticket's worktree. `task.get` for `telemetry/09` gives `task.shared_branch` naming `tracker-and-matt-pocock-integration/12` and its path, and the reverse for that ticket; `telemetry/11` gives none.
- **Answered here, as questions that block nothing.**
  - The code is `task.shared_branch`, in the shape of `task.dangling_dependency` and `task.unknown_state`. The brief carries it in a `diagnostics` list, as `project.status` and `checkpoint.record` carry theirs.
  - Only `task_get` reports it, as the ticket and the spec say. The snapshot's attention does not list shared branches.
  - `/binnacle:task` quotes the brief's diagnostics. It presents the brief, so without that line it would drop the one thing this ticket adds, and user story 21 is about the branch that skill names.
  - The section says "across every spec's tickets" rather than "across epics": its own word for an epic is spec ("the tickets in the same spec"), and this repository's file says "across every `docs/specs/*/issues/`".

### Review

`/code-review` ran against `main` on both axes, with its two sub-agents in the foreground. Both also noted that this ticket's review, ticks and `DONE` were still to come; they are in its last commit.

**Standards: no hard violation; four judgement calls.**

1. Possible Shotgun Surgery: the three daemon test files that read a brief each copy its type, so `diagnostics` went into each. **Left**: every daemon test file states the shape it reads in its own types, and these copies predate this ticket.
2. Possible Duplicated Code: `sharedBranch` found the Tasks on a branch with a filter of its own, which agreed with `branchTask`'s on a remote tracker only because issue numbers are unique. **Fixed**: both call one `tasksOnBranch`, so the diagnostic and the attribution cannot come to disagree.
3. Possible Mysterious Name: `rule`, which replaced the nullable `closing` in `binn init`'s `CONVENTIONS`, holds the slug rule on the local tracker and the closing rule on a remote one. **Kept**: both are the tracker's own rule after the header's fields, as its doc comment says, and a name for the position alone would say less.
4. Possible Duplicated Code: `manifest?.tracker.provider !== 'local'` in `task.ts` repeats `isRemoteTracker` from `daily.ts`. **Left**: the expression was already there, and `usage.ts`, whose attribution the diagnostic must agree with, uses it twice. The two differ only without a manifest, which `findTask` refuses first.

**Spec: all three criteria and the owner's option 2 met, nothing asked for missing, nothing wrong; three notes.**

1. Epic 3's spec still lists the brief's output without `diagnostics`, and `binn init`'s ticket-header step without the local rule. **Left**: epic 4 records its changes to epic 3's surfaces in its own documents, as it does `binn init`'s import window. The telemetry spec records the diagnostic, under *Observed runs and attribution* and *Further Notes*, and this ticket's criterion 2 records the rule.
2. Only GitHub's section is checked for leaving the rule out, not GitLab's. **Left**: the rule is in the local entry of `CONVENTIONS` alone.
3. "Its file name without the number" understates the rule: `03-Foo_Bar.md` and `05-foo-bar.md` also share `feat/foo-bar`. The diagnostic catches that, since it compares branches. **Kept**: the wording is the one this repository's `docs/agents/issue-tracker.md` uses, which criterion 2 names.

Typecheck is clean, and the full suite passes: 310 of 310.
