# 12: Autopilot lets Binnacle read a ticket's worktree before removing it

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/telemetry/spec.md`

**What to build:** an autopilot run's ticket work stays attributed to its Task. Today the `autopilot` skill removes a ticket's worktree right after the merge and calls `project_snapshot` only afterwards, so the ingest never sees that worktree's reflog and ADR-0029 falls back to Claude Code's per-process `gitBranch`, which is usually `main` (ticket 10). Found during epic 4's own autopilot run on 2026-09-25.

- [x] The `autopilot` skill calls `project_snapshot` (which runs the ingest) after the fast-forward merge and before `git worktree remove`.
- [x] The skill's step 5 starts no more agents at once than the manifest's `automation.max_parallel_development_tasks`.

## Comments

- **Open for the owner.** The run also honoured the manifest's `automation.maxParallelDevelopmentTasks: 2`, which the skill does not mention; whether the skill should say so is part of triage.
- **Decided by the owner on 2026-09-25, in a Product session.**
  - Part of epic 4, and built first, by an autopilot run of its own. An autopilot run keeps the skill text it started with, so a run that went on to tickets 10 and 11 after this one would still remove their worktrees before reading them. They wait in `BACKLOG` until this ticket merges, and a second run builds them.
  - The skill names the manifest's limit. Its key is `automation.max_parallel_development_tasks`.
  - The re-check on a new autopilot run moved to ticket 09's criterion 2, which reads tickets 10 and 11. So this ticket is done when it merges.
- **What changed.** One skill file and one test; no production code.
  - `/binnacle:autopilot`'s step 7 calls `project_snapshot` between the push and `git worktree remove`, instead of at the end of the step. It calls it once a minute has passed since the agent's report, and again while `usage.importing.incomplete` is true. If the call fails, the run goes on and reports it, as for a failed push.
  - Step 5 reads the next tickets from that snapshot. Removing a worktree, deleting branches, installing and restarting the daemon change no ticket's status, so a second call after them would add nothing.
  - Step 5 starts no more agents at once than the manifest's `automation.max_parallel_development_tasks`, or two where it writes none. An agent counts until its ticket merges or stops. Step 8 now goes back to step 5, so that a stopped ticket's place is taken.
  - `apps/cli/plugin/`, the copy the npm package ships, picks the change up on the next install.
- **Test-first, as read here.** The skill is procedure text, and as for epic 2's tickets 07 to 09, a test of its wording would test nothing. What it relies on is a fact of the daemon that no test pinned: a record read while its worktree exists keeps the branch the reflog gave after the worktree is removed, because the branch is resolved at ingest and stored (the spec, *Ingest*).
  - `apps/daemon/test/usage.test.ts` now shows it at the daemon seam, under *Where a record's branch comes from*. A subagent works in a worktree on `feat/first`, and its records say `main`, as Claude Code writes them. A snapshot reads it, then `git worktree remove` and `git branch -d` run. Its run stays on `epic/01`, with the `implementation` role and a `reflog` branch.
  - The test was written first and run in the old order, the removal before the snapshot. There it fails: the Task has no run. In the new order it passes.
  - It also guards this ticket against ticket 10, which changes how stored branches are read.
- **Answered here, as a question that blocks nothing: the limit where the manifest writes none.** The owner's decision names the key, and says nothing of a manifest without it.
  - Such a manifest is the common case: `readAutomation` then gives `null`, and the manifest `binn init` proposes has no `automation` section.
  - The skill says two. `docs/workflow/04-git-tracker-worktrees.md` says to "begin with max two parallel development tasks", and two is the template's value.
  - Before this ticket, autopilot started every ready ticket at once. This repository's manifest writes 2, so nothing changes here. The owner may prefer another default, or none.
- **Why a minute.** The ingest leaves a Claude Code file's last message out until the file has gone unwritten for a minute (`SETTLED_AFTER_MS`). An agent's report is the last message of its session.
  - In epic 4's first autopilot run, seven merges came 21 to 52 seconds after their implementation agent's session file was last written, six of them within 28 seconds. This compares `main`'s reflog with the modification time of the largest subagent file written before each merge.
  - Without the wait, each ticket's report would be read after its worktree's removal, and credited to no Task. The wait costs at most a minute per ticket.

### Review

`/code-review` ran against `main` on both axes, with its two sub-agents in the foreground.

**Standards: no hard violation; four judgement calls and one smell.**

1. The new call had no failure path. It comes just before `git worktree remove`, which cannot be undone, and the push beside it has one. **Fixed**: if the call fails, the run goes on and reports it, as for the push. Binnacle stays optional (`AGENTS.md`, principle 3).
2. "Or two where it writes none" names no source. The limit also sat between "every ticket … in `readyToStart`" and "Such tickets have no blocking edge", so "such tickets" read as the ones that wait. **Fixed**: the limit now follows that sentence. The source is **kept** out of the skill, which ships to projects that do not have this repository's docs; it is recorded above.
3. The test's comment named autopilot's order, but the test called the snapshot once, not until the import was complete. **Fixed**: it uses `untilImported`, as the skill now does.
4. An agent's last message is held back for a minute, so a snapshot sooner than that reads it only after the removal. **Fixed**, with Spec 1.
5. Possible Duplicated Code: the test builds the same repository and subagent as the test of a subagent in a worktree. **Left**: every test in the file builds its own case from the shared helpers.

**Spec: both criteria met and nothing missing; one wrong behaviour and two changes not asked for.**

1. The ingest takes a Claude Code file's last message only once the file has gone unwritten for a minute, and `importing.incomplete` does not cover that. So a snapshot within a minute of the agent's report leaves the report to be read after the removal, and credited to no Task. **Fixed**: step 7 calls the snapshot once a minute has passed since the agent's report. See *Why a minute*.
2. The call after the cleanup was moved, not kept beside the new one, so nothing calls a daemon step 7 has just restarted until the next ticket's snapshot. **Kept**: step 5 needs one snapshot after the merge, and the cleanup after it changes no ticket's status (*What changed*). `binn daemon start` waits until the daemon listens and fails otherwise, so a failed restart shows there. A failed snapshot is now reported (Standards 1).
3. "Or two where it writes none" was not asked for. **Kept**: see *Answered here*. It is recorded for the owner.

Typecheck is clean, and the full suite passes: 308 of 308.
