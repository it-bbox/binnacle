# Spec: Lean flow

Status: READY
Triage: ready-for-agent

Epic 18 of v1, as defined in `docs/05-mvp-plan.md` phase 18. Exit criterion, restated while specifying: on this repository, the snapshot and the dashboard show epic 11's Tasks with review and rework apart under the rule read from runs, as the baseline; a question an agent records offers its options, and the owner answers it with `/binnacle:answer`, the answer read without its date line; the full suite passes run after run; and the per-ticket process, by hand and under autopilot, no longer asks for the roadmap edit, the Review's commit order or the upkeep after each merge. Whether the flow got cheaper is read on the next epic autopilot runs, 16, by a Product session, not here. The phase was grilled on 2026-10-11; the owner confirmed this spec's test seams the same day, recorded under *Further Notes*.

## Problem Statement

Epic 11's autopilot run showed the per-ticket process spending tokens and time for little return.

Every ticket's last commit rewrote the roadmap's current focus. Two tickets run side by side always conflicted there: 03, 05, 10 and 08 went back to their agents to rebase, each a reload of 100 to 300 thousand tokens, and the agents cut each other's wording to stay under the 2000 characters a fresh session reads. What is done and what can start, the snapshot already derives from the tickets' statuses.

When `main` moved on, autopilot sent the branch back to its agent even when Git would have rebased it cleanly. It also checked that the Review was committed before its fixes, and sent a branch back when it was not, only so that Binnacle could tell review from rework at that commit. After each merge it refreshed the plugin, reinstalled the skills copy, regenerated the dashboard and restarted the daemon, though no later agent of the run used any of them. Reviews and commit messages grew long; agents checked pages in a browser on tickets that never touched the dashboard.

A question an agent asked reached the owner as a trade-off in English prose, with no options and no recommendation, so the owner could not answer it as written; the answer Binnacle read back carried the date line `/binnacle:answer` writes above it.

And one test, the audit's check that Binnacle's current skills are not reported, failed now and then in a full run and passed alone.

## Solution

The process an agent follows per ticket, by hand or under autopilot, gets shorter.

A ticket no longer touches the roadmap. Its last commit sets its `Status: DONE`, and nothing else in the roadmap moves until a Product session, a checkpoint, or autopilot at the end of its run on the owner's yes, writes the current focus.

Autopilot rebases a branch onto `main` itself and runs the checks; only a conflict Git reports, or checks that fail after a clean rebase, send it back to the agent. It no longer checks the order of the Review's commits: Binnacle reads rework from the runs, as the implementation work after the first review run ends, and reads epic 11 again by the same rule, so that it stays comparable. Upkeep happens once, at the end of the run, for whatever the run's merges touched.

A Review lists its findings to fix in full and those kept in one line each; a commit has a short subject and a body only when needed. A ticket is checked in a browser only when it changes the dashboard.

A question carries its options, each with its cost, the recommended one first; `/binnacle:answer` shows them in the owner's language and explains them on request, and the answer is read without its date line.

The flaky test is fixed at its cause.

## User Stories

1. As the owner, I want a ticket's last commit to change only its own ticket's status, so that two tickets run side by side never conflict over the roadmap.
2. As the owner, I want the current focus written only by a Product session, a checkpoint or autopilot's end on my yes, so that it reads as one voice and stays under 2000 characters.
3. As the owner, I want autopilot to propose at its end the whole current focus, the epic's status and the Next action, so that the roadmap catches up in one change I approve.
4. As an implementation agent, I want a brief that does not ask me to edit the roadmap, so that I spend no tokens on it and leave no conflict behind.
5. As the owner, I want autopilot to rebase a branch onto `main` itself when `main` moved on, so that a clean rebase costs no agent a reload of its context.
6. As the owner, I want autopilot to run the typecheck and the full suite after its rebase, so that a branch that rebased cleanly but no longer fits is caught before the merge.
7. As the owner, I want a conflict Git reports to abort the rebase and send the branch back to its agent, so that only real conflicts cost an agent's time.
8. As the owner, I want checks that fail after a clean rebase to count as the one return to the agent, with the exact failure, so that the rule of one return still holds.
9. As an implementation agent, I want to commit my Review whenever it suits the work, before or after the fixes, so that I make no commit only for Binnacle's sake.
10. As the owner, I want autopilot to stop checking the Review's commit order, so that a branch is never sent back for it.
11. As the owner, I want rework read as the implementation work on a Task's branch after its first review run ends, so that it is measured whatever the order of the commits.
12. As the owner, I want a review run read as a subagent run on the Task's branch that starts after the branch's first commit changing anything but its ticket, so that the reviewer is told from the implementer without a marker commit.
13. As the owner, I want a Task with no review run to keep the commit that first records its Review as its rework boundary, so that a review done without a subagent still counts.
14. As a user of GitHub or GitLab issues, I want rework after a review requesting changes on the pull or merge request to stay as it is, so that remote trackers lose nothing.
15. As the owner, I want epic 11's Tasks read again by the new rule, so that their rework share stays the baseline the next epic is compared with.
16. As the owner, I want the rework share and first-pass acceptance still labelled as Binnacle's calculation, so that I never take them for a fact.
17. As the owner, I want `usage_get`'s description of review and rework to say the new rule, so that a session reading it is not misled.
18. As the owner, I want a run that crosses the end of the first review run split there, as a run crossing the Review commit was, so that one long session is not counted wholly as one role.
19. As the owner, I want a Review's findings to fix written in full and its findings kept in one line each, so that a Review costs less to write and to read.
20. As the owner, I want every commit to have an English subject of at most 72 characters and a body only when needed, so that the log reads at a glance.
21. As the owner, I want the same commit rule for Product sessions' commits, so that the whole log reads the same.
22. As the owner, I want the frozen install, the plugin refresh, the skills copy, the dashboard's regeneration and the daemon's restart done once at the end of an autopilot run, so that a run of many tickets pays for them once.
23. As the owner, I want each of them done only when one of the run's merges touched what it serves, so that a run that changed no skill reinstalls none.
24. As the owner, I want autopilot's report to say which of them ran, which were skipped and why, and any that failed, so that I know what reached me.
25. As the owner, I want my daemon left running the code it started with until the end of the run, so that a run never restarts it mid-way.
26. As the owner, I want a browser check only on tickets that change the dashboard, so that agents spend no time on pages a ticket did not touch.
27. As a planning session, I want the issue-tracker conventions to say that the criterion "checked in a browser" belongs only to tickets changing the dashboard, so that `/to-tickets` writes it there alone.
28. As the owner, I want every question an agent records to offer its options, each with its cost, so that I choose rather than compose an answer.
29. As the owner, I want the recommended option first and marked, so that I can accept it in one word.
30. As the owner, I want to be free to write my own answer instead of an option, so that the options never limit me.
31. As the owner, I want `/binnacle:answer` to show the question and its options in my language, so that I answer in the language I think in.
32. As the owner, I want `/binnacle:answer` to explain the options when I ask, without choosing for me, so that an agent still never answers a question.
33. As the owner, I want the answer Binnacle reads to leave out the date line `/binnacle:answer` writes above it, so that the answer an agent resumes from is my answer alone.
34. As a user of GitHub or GitLab issues, I want a question posted as an issue comment to carry its options the same way, so that both trackers read alike.
35. As the owner, I want the issue-tracker conventions and the section `binn init` offers a project to describe a question's options, so that every project's agents write them.
36. As the owner, I want the full suite to pass every time it runs, so that a failure always means something.
37. As the owner, I want the audit test fixed at its cause, its race with the package build's test, rather than retried, so that the flake does not come back elsewhere.
38. As the owner, I want the development workflow's *Per ticket* to describe the same short process as autopilot's brief, so that a ticket run by hand costs as little.
39. As a fresh Product session, I want the roadmap's *Keeping this current* to say who writes the current focus, so that no agent edits it by habit.
40. As the owner, I want a check over autopilot's skill text that the old rules are gone, so that a later edit does not bring them back unnoticed.
41. As a Product session after epic 16's run, I want to read the mean tokens and rework share per completed Task by epic from `usage_get`, so that I can record the before and after in the roadmap.

## Implementation Decisions

- **Roles from runs.** The roles keep their names: `product`, `implementation`, `review`, `rework`, `unknown`. On a Task's branch a subagent run is `review` when it starts after the branch's first commit changing anything but its ticket. `rework` is a non-subagent record on the Task's branch after the last record of the Task's first review run. A Task with no review run keeps today's boundary, the commit that first adds `### Review` to its ticket; on GitHub or GitLab, the first review requesting changes stays the boundary, as now. Runs are split where a record's role differs from the one before it, as today. The daemon reads, per Task, the time of the branch's first commit changing anything but the ticket in place of the last one before the Review; the Review commit is read only for the fallback. `CONTEXT.md` already holds the new definitions.
- **Recalculation.** Roles are computed when usage is read, from the records and Git, so epic 11's Tasks read by the new rule with no migration. If anything about roles is stored in the projection, it is rebuilt from the records, as the local DB is a projection.
- **`usage_get`'s description** and `docs/04-telemetry-dashboard.md` say the new rule; the derived metrics keep their shape and their `calculated` label.
- **Autopilot**, in the plugin's skill text and the skills copy alike:
  - the brief no longer asks the agent to edit the roadmap, and says not to; it no longer asks for the Review's commit order; it asks for a short Review and short commit messages, and a browser check only when the ticket changes the dashboard;
  - step 8 drops the Review-order check. When `main` is not an ancestor of the branch, autopilot runs `git rebase main` in the agent's worktree; on a conflict it runs `git rebase --abort` and sends the branch back to its agent to rebase, as today; after a clean rebase it runs the typecheck and the full suite there, and a failure is the one return to the agent, with the exact failure. Rebasing the agent's branch is the one write autopilot makes during the run besides the merge;
  - the frozen install, the plugin refresh and the skills copy's reinstall, the dashboard's regeneration and the daemon's restart move from after each merge to the end of the run, after the last merge, in that order, each when at least one of the run's merges touched what it serves; the report says which ran, which were skipped and why, and which failed;
  - the end of the run proposes the whole current focus, the epic's status in the table and the Next action paragraph, written and committed only on the owner's yes.
- **The development workflow**, *Per ticket*: the session's last commit sets `Status: DONE` and nothing in the roadmap; no Review commit order; the short Review and commit rules; a browser check only for dashboard tickets; the upkeep after a merge by hand stays per merge, since there is no run to batch it in. The paragraph on the second of two parallel branches rebasing no longer mentions the roadmap.
- **The roadmap's *Keeping this current*** says that the current focus and the epic's status are written by a Product session, a checkpoint, or autopilot's end on the owner's yes, never by a ticket.
- **The checkpoint skill** and the product skill keep proposing the Next action; the checkpoint also offers the current focus's done and next as a candidate when the tickets' statuses moved past it.
- **Commit messages.** `AGENTS.md` gains the rule: an English subject of at most 72 characters, and a body only when the subject cannot carry the why. It applies to every commit.
- **A short Review.** The issue-tracker conventions and autopilot's brief say: a finding to fix in full, with its place and its fix; a finding kept in one line with its reason.
- **Browser checks.** The issue-tracker conventions say the criterion "checked in a browser" belongs only to a ticket that changes the dashboard.
- **Questions with options.** A `### Question` carries, after its text, its options as a list, each with its cost, the recommended one first and marked "(recommended)". The conventions (`docs/agents/issue-tracker.md`), the section `binn init` offers a project, and autopilot's brief describe it. A question's text stays free text for the parser: the options are part of it. `/binnacle:answer` shows the question and its options in the owner's language, explains them when the owner asks, and takes the owner's choice or their own words; it never picks for the owner. ADR-0040's rule that an agent never answers a question holds: the asker writes the options.
- **The answer's date line.** The ticket parser leaves out a first line of the answer that is a date alone, `YYYY-MM-DD`, from the answer's text; `/binnacle:answer` keeps writing it, as the record of when.
- **The flaky test.** The audit's test of current skills races the package build's test, which rebuilds the skills copy while the audit reads it. The fix removes the shared state: the audit test reads a copy of its own, or the package build's test writes to a directory of its own, whichever the cause turns out to be. No retry.
- **Measurement.** No new view: `usage_get` already gives each DONE Task's tokens and rework share; a Product session averages them by the epic's Task ids after epic 16's run.

## Testing Decisions

A good test exercises behaviour through the seam a caller uses, never an internal function's shape. This epic adds no seam.

- **Roles**, through the daemon's `usage.get` and `task.get` against a Git repository with session artifacts, as the tests of *Implementation, review and rework* build them: a review subagent and fixes after it, with the Review committed before the fixes, after them, and last; a Task with no subagent, whose boundary is the Review commit; a run crossing the end of the review run, split there; a subagent before the first commit changing anything but the ticket, which is implementation; the forge's review on GitHub and GitLab unchanged.
- **The answer's date line**, through the snapshot's and `task.get`'s questions, as the tests of questions on a branch build them: an answer with a date line, without one, and one whose text starts with a date followed by more words, which stays.
- **The flaky test**: the full suite run repeatedly, in parallel as `pnpm test` runs it, passes every time.
- **The skill texts**, in the package build's test, which already checks them: autopilot's brief asks for no roadmap edit and no Review order; its step 8 holds the rebase and no Review-order check; its upkeep is at the end of the run; `/binnacle:answer` shows the options; the copy matches the plugin.
- **What agents do** with the new process — a rebase, a short Review, upkeep at the end, a question with options — is the exit demonstration's and epic 16's run's.

## Out of Scope

- Measuring the effect, which a Product session records after epic 16's run.
- A per-epic usage view or any new metric.
- Changing how a ticket's Review is parsed or required: `### Review` stays, and `review.missing` with it.
- Autopilot merging or rebasing anything but the agent's branch onto `main`, or force-pushing.
- The parallel agent limit and its setting, which belong to epic 16.
- Skill output for humans in general, which is epic 13's; only `/binnacle:answer`'s question and options are here.

## Further Notes

- **Decisions taken while grilling, by the owner on 2026-10-11**, recorded in `docs/05-mvp-plan.md` phase 18: rework read from runs, replacing the owner's 2026-10-08 decision to require the Review's commit order (`specs/telemetry-for-any-harness/spec.md`, *Further Notes*), with epic 11 recalculated; the measurement read after epic 16's run, not this epic's exit; upkeep once at the end of a run, with no exception for the next ticket; questions with options in this epic rather than epic 13.
- **Test seams confirmed by the owner on 2026-10-11**: the daemon's `usage.get` against a Git repository with session artifacts, the questions read from a ticket, the full suite for the flaky test, and the package build's test over the skill texts, including autopilot's; what agents do belongs to the exit demonstration and epic 16's run.
- **Defaults taken from the docs and Ponytail, not asked**: tickets touch nothing in the roadmap, and autopilot's end proposes the whole current focus on the owner's yes; the rebase in the agent's worktree, aborted on a conflict; a clean rebase's failing checks as the one return; a review run starting after the branch's first commit changing anything but the ticket; the Review commit as the fallback boundary; an English subject of at most 72 characters for every commit; the browser criterion only for dashboard tickets; the date line dropped by the parser rather than no longer written; upkeep by hand kept per merge; the checkpoint offering the current focus as a candidate; no ADR, since the roles are recomputed from the records and the rule is easy to reverse.
- **The exit demonstration**, on this repository with the owner: the usage page and `usage_get` show epic 11's Tasks with review and rework apart by the new rule; an agent's question with options shows in the snapshot, `/binnacle:answer` shows it in Russian with its options, explains them on request, and writes the owner's choice, which `task_get` reads without the date line; `pnpm test` passes several times in a row.
