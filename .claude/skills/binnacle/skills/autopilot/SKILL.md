---
name: autopilot
description: Finish one planned epic. Run its remaining tickets through one background agent each, verify and fast-forward every branch onto main, stop at any question only the owner can answer, and end with a report and a push notification.
argument-hint: "[epic number or spec slug]"
disable-model-invocation: true
---

The human who started this skill approved, for this one epic, spawning an agent per ticket and merging every branch that passes your verification (ADR-0022). Nothing more: you orchestrate and verify, the agents implement. You write no file and make no commit of your own, and you run no planning step.

Rules for the whole run. Never force-push, change settings, touch another repository, or stop, restart or reconfigure a daemon the human is running, except as step 7 allows. Never simulate a human step: a hand check, a confirmation, a demonstration is prepared by the agent and left for the human. Never set anything `DONE` yourself.

## Start

1. Call the `binnacle` MCP server's `project_detect` tool. If it fails, stop. Quote the error's code and message, and give the human the fix without running it yourself:
   - `daemon.unreachable`: `binn daemon start`.
   - `project.not_registered`: `binn project register`, run in the main checkout.
   - If the `binnacle` server is missing or disconnected, `binn` is not on this harness's PATH (see the README's setup section).

   Binnacle is optional. If the human then asks you to go on without it, read the same position from the roadmap and the tickets' `Status:` and `Blocked by:` lines wherever the steps below read the snapshot, and what changed from the log.
2. Call `project_status`. If its `checkout.registered` is false, this session runs in a linked worktree, such as the one the desktop app opens under `.claude/worktrees/`. Stop there: start nothing and change nothing. Tell the human, in this order:
   - this session's checkout: `checkout.root`;
   - the registered checkout: `project.path`;
   - how to start a session there with worktree isolation off: in the desktop app, **+ New session**, environment **Local**, project folder `project.path`, and the **worktree** option next to the branch name turned off; in a terminal, `cd <project.path> && claude`, without `--worktree`. Then run `/binnacle:autopilot` there again, with the same argument.

   Without Binnacle, this session's checkout is `git rev-parse --show-toplevel`, and the registered one is the first path `git worktree list` prints. If they differ, refuse in the same way.

   Otherwise check that `main` is checked out and the tree is clean, and bring it up to date with `git pull --ff-only`. If not, stop and say why. Note `main`'s HEAD: the run's start.
3. Call `project_snapshot`, with no arguments. Choose the epic: the one the human named (`$ARGUMENTS`), or else the single epic the roadmap has `in progress`, or else, with none `in progress`, the single one it has at `tickets`, as `/to-tickets` leaves it. If none or several fit, stop and ask.
4. Refuse to start unless the epic is planned: its spec exists, its issues directory holds tickets, and the roadmap has it at `tickets` or `in progress`. Say what is missing and that planning is the human's (`/grill-with-docs`, `/to-spec`, `/to-tickets`). Never run those, and never move on to another epic.

## Loop

5. **Start ready tickets.** The epic's tickets are the snapshot's Tasks whose ticket lies under the epic's spec directory. Start one background agent for every ticket of the epic in `readyToStart` (`READY`, no Unmet dependency, no attributed run) that has no agent yet and was not stopped. Such tickets have no blocking edge between them, so they may run side by side, but never more agents at once than the manifest's `automation.max_parallel_development_tasks` (`.binnacle/project.yaml`), or two where it writes none. An agent counts until its ticket merges or stops, and the others wait until then. One ticket never has two agents. If `readyToStart` has a remainder, read the rest from the tickets' `Status:` and `Blocked by:` lines, leaving out any the snapshot lists in `inFlight`.

   Use the Agent tool with `run_in_background: true` and `isolation: "worktree"`, and give it this brief, filled in:

   > You are the implementation session for one ticket, `<ticket path>`, running unattended. Nobody answers questions until the owner is back. Follow the per-ticket process the project's instruction files point to: branch `feat/<slug>` from the local `main`, implement test-first, typecheck and run the full suite, run the code review skill against `main` on both axes, with its sub-agents in the foreground (`run_in_background: false`) so their reports come back to you, record its findings under the ticket's `## Comments` → `### Review` as fixed, kept or left, tick every criterion that holds, and make the ticket's `Status: DONE` (and the roadmap's current focus, if the frontier moved) your last commit.
   >
   > When the ticket retires a document or a section, move any durable rule it holds instead of deleting it. A criterion only a human can verify stays unticked; write a short script for it under `## Comments`. A question that blocks nothing: answer it in the smallest way the spec allows and record it in the ticket. A genuine product question the ticket, spec and ADRs cannot answer: do not guess — commit what is sound without `DONE`, and put the question at the top of your report.
   >
   > Do not merge, push, touch `main`, delete branches or remove your worktree. No `Co-Authored-By` or "Generated with" lines, and no assistant named in any commit. Add no dependency the ticket does not ask for. Do not stop, restart or reconfigure the owner's Binnacle daemon; run any CLI against a temporary `BINNACLE_HOME`. Change nothing outside your worktree: no global installs or links, no settings.
   >
   > Report: branch and worktree path, commits, typecheck and tests, review summary, and any question.

6. **Wait.** Each agent's result arrives as a notification. Handle each as it comes:
   - A report from a sub-agent that an implementation agent spawned, such as a review, may reach you instead of that agent. Relay it to that agent with `SendMessage`, word for word, and keep waiting.
   - An agent that stops on a question: decide whether only the owner can answer it. If the spec, its ADRs and the ticket answer it, send the answer with `SendMessage` and let the agent record it. Otherwise the ticket stops (step 8).
   - An agent that reports its ticket done: verify it (step 7).
7. **Verify, then merge.** In the agent's worktree, yourself, not from its report:
   - the typecheck and the full suite pass;
   - every criterion is ticked, except one only a human can verify, which has its script under `## Comments`;
   - `### Review` is present, and none of its findings is left unresolved without a reason;
   - the last commit sets the ticket's `Status: DONE`;
   - `git log main..<branch>` holds no `Co-Authored-By`, no "Generated with" and no assistant named;
   - `git diff main...<branch>` adds no dependency the ticket did not ask for, and changes nothing outside the ticket's scope;
   - `main` is an ancestor of the branch (`git merge-base --is-ancestor main <branch>`). If it is not, because a parallel branch merged first, send the agent back with `SendMessage` to rebase onto `main`, resolve the conflicts, check its code still fits, rerun the checks and keep `DONE` last; then verify again. A conflict it cannot resolve mechanically stops the ticket.

   A failed check goes back to the agent once, with the exact failure. If it fails again, the ticket stops. Otherwise, in the main checkout, with `main` checked out there:
   - `git merge --ff-only <branch>`. Fetching into a checked-out branch is refused, so merge, do not fetch.
   - `git push origin main`, never forced. If the push fails, keep going and report it.
   - Once a minute has passed since the agent's report, call `project_snapshot` again, and again while its `usage.importing.incomplete` is true. Its ingest takes the branch of the agent's work from the worktree's reflog, which `git worktree remove` deletes: read later, that work is credited to no Task (ADR-0030). It leaves out a session's last message until its file has gone unwritten for a minute, and goes on in the background with what does not fit in one call. If it fails, keep going and report it.
   - `git worktree remove <path>`. A worktree created for an agent may be locked: if `git worktree list` shows it `locked`, run `git worktree unlock <path>` first. Then delete, with `git branch -d`, the ticket's branch and the branch the Agent tool created for the worktree.
   - If the merge changed the lockfile or added a workspace package, run the project's frozen install in the main checkout (`pnpm install --frozen-lockfile` in a pnpm workspace), so that what runs from it matches what was merged. If it changed the code of the Binnacle daemon the human runs (only when this project is Binnacle itself), restart that daemon with `binn daemon stop` then `binn daemon start`, and say so in the report. Never stop a daemon for any other reason. If it changed `apps/dashboard` (only when this project is Binnacle itself), run `pnpm dashboard:generate` in the main checkout, after any frozen install, so that the daemon serves the dashboard just merged, and say so in the report.

   Then go back to step 5.
8. **Stop a ticket** on a question only the owner can answer, on checks that fail twice, on a review finding left unresolved without a reason, on a conflict that is not mechanical, or on a change outside the ticket. Merge nothing of it and set nothing `DONE`. Leave its branch and worktree in place for the owner. Every ticket that depends on it stays unstarted, because its dependency never becomes `DONE`. Tickets that do not depend on it go on. For a question, send a push notification at once naming the ticket and the question. Then go back to step 5.

## End

9. The run ends when no agent is running and the snapshot has no ready ticket of the epic left to start. Call `project_snapshot` once more for the epic's final counts and attention items, and `daily_get` with `since` set to the run's start, which records nothing, for what changed.
10. Report:
    - **Merged**: each ticket with its commits.
    - **Reviews**: per ticket, what the review found and what was fixed, kept or left.
    - **Waiting for the owner**: each stopped ticket with its reason, branch and worktree; each question; each human step prepared and not done (a hand check, a `/binnacle:checkpoint` confirmation, a demonstration); a failed push; a daemon restarted; the dashboard regenerated.
    - **Attention**: every item with its code, or "none".
    - **Next**: tell the owner to run `/binnacle:checkpoint` in this session before closing it, so that what the run decided reaches canonical sources and the checkpoint is recorded. You cannot run it: only a human starts it.
11. Send a push notification: the epic, how many tickets merged, how many wait for the owner, and that `/binnacle:checkpoint` is next.
