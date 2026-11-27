# Spec: The checkout autopilot counts

Status: READY
Triage: ready-for-agent

Epic 31, from its grilling's brief, `docs/specs/harness-created-checkout/brief.md` (2026-11-27), and ADR-0049. Exit criterion: the autopilot skill takes one route for the run, the earliest the session's schemas show, and the pack test holds that text. A harness whose tool for starting an agent takes a parameter that creates a local checkout is unchanged. The owner's check on the three clients comes after the ticket. Epic 25's next action is unchanged. Epic 29 stays the later check of the clients.

## Problem Statement

Autopilot starts where the harness creates the agent's checkout from a parameter of the tool that starts the agent. Elsewhere it stops at the first step, including where a type of background agent is specified as receiving its own checkout and branch, and where the agent can call the harness's own tools to create, wait out, list and archive a managed worktree. A remote clone of a remote branch is easy to take for such a checkout, and the session cannot rebase it or remove it. A second skill text for one harness is not available: one text names no harness (ADR-0039).

## Solution

The run takes one route, the earliest the schemas show, and keeps it for every ticket.

1. A parameter of the tool that starts the agent makes the harness create a local checkout when the agent starts. The brief is the agent's first message. The worktree is removed as today.
2. A type of background agent whose schema says the harness gives that type its own worktree and its own branch. Used only when the first route is absent.
3. Tools of the session, read by what their schemas do and not by their names, that create a managed worktree from the repository's root and a commit, waiting included when creation is asynchronous, list such worktrees with an identifier, and archive one by that identifier. The agent calls them. The session does not. Used only when the first two are absent.

On the second and third routes the first message only brings the worktree into existence. The session accepts the path from the registered checkout, and only then sends the brief. A path that fails, or a message that cannot be sent, stops the ticket. `main` is not touched. There is no retry.

A remote clone, `git worktree add` by the session or the agent, and a prompt to work in an environment of its own do not count. With none of the three routes, the first step stops and changes nothing, and the tickets are run by hand.

Removal follows the route, after the same ingest pause and the same check that no daemon runs from the worktree. The first and second routes use `git worktree remove`. The third is archived by its identifier. An archive that is not confirmed leaves the worktree and the branches for the owner.

## User Stories

1. As the owner running autopilot where the start tool takes a parameter that creates a local checkout, I want the brief to be the agent's first message, so that the run I have does not gain a setup turn.
2. As that owner, I want the worktree removed with `git worktree remove` after the ingest and the daemon check, so that the merge path is the one that already runs.
3. As that owner, I want a locked worktree unlocked before it is removed, so that a lock does not stop the removal.
4. As that owner, I want the ticket's branch and any branch the harness created deleted with `git branch -d` after the removal, so that the checkout does not leave branches behind.
5. As that owner, I want a parameter that places the agent on a remote clone not to be this route, so that the session is not left unable to rebase or remove the checkout.
6. As the owner where that parameter is absent and a background agent type's schema gives the type its own worktree and branch, I want that type to count, so that autopilot starts.
7. As that owner, I want a key the schema does not list not to count, so that a dropped field is not treated as a worktree.
8. As the owner where neither the parameter nor such a type is present, and the session has tools that create, wait out, list and archive a managed worktree, I want those tools to count, so that autopilot starts there too.
9. As that owner, I want the tools read by what their schemas do, so that the skill does not name a harness or a tool.
10. As that owner, I want the agent, not the session, to call those tools, so that the session's chat stays in the registered checkout.
11. As the owner, I want the session to stay in the registered checkout for the whole run, so that a command does not move the chat into an agent's worktree.
12. As the owner, I want one route for the whole run, so that a later ticket is not started a different way.
13. As the owner, I want the parameter to win when it is present, so that a type or the tools are not used beside it.
14. As the owner, I want the type to win over the tools when the parameter is absent, so that the harness's own checkout is preferred to one the agent must create.
15. As the owner on the second or third route, I want the agent's first message only to bring the worktree into existence, so that no ticket code is written before the path is accepted.
16. As that owner, I want the agent to report the checkout path, the common git directory, HEAD and the status, so that the session can check them.
17. As that owner, I want an asynchronous creation waited out before that report, so that the path is not judged early.
18. As the owner, I want the path accepted only when `git worktree list` from the registered checkout shows it, so that a path the agent invented does not count.
19. As the owner, I want a path that is the registered checkout's root refused, so that the agent does not write on `main`'s checkout.
20. As the owner, I want a path that is another agent's checkout of this run refused, so that two tickets do not share a checkout.
21. As the owner, I want a different common git directory refused, so that a nested or foreign repository is not this project's checkout.
22. As the owner, I want a HEAD other than the `main` the run named refused, so that the branch is cut from the run's `main`.
23. As the owner, I want a dirty tree refused, so that the ticket does not start from someone else's files.
24. As the owner, I want a refused path to stop the ticket without touching `main` and without a retry, so that a bad checkout is waiting for me.
25. As the owner, I want the implementation brief sent only after the path is accepted, on the second and third routes, so that the agent writes in the checkout the session checked.
26. As that owner, I want the brief to name that absolute path as the only checkout the agent writes, so that `main` and other worktrees stay untouched.
27. As that owner, I want the ticket's branch created by the per-ticket process, so that the setup message does not create it.
28. As that owner, I want the agent told not to delete the worktree, so that the session removes it after verification.
29. As the owner, I want a message that cannot be sent to stop the ticket, so that an agent without the brief does not continue.
30. As the owner, I want `git worktree add` by the session or the agent not to count, so that a checkout the model builds for itself is refused.
31. As the owner, I want a prompt to work in an environment of its own not to count, so that words in the prompt are not a worktree.
32. As the owner, I want a remote clone not to count on any route, so that verification can still rebase and remove.
33. As the owner with none of the three routes, I want the first step to stop before any other step and change nothing, so that the tickets are run by hand.
34. As that owner, I want the refusal to say whether a background agent, a checkout the harness creates, or both, are missing, so that I know which.
35. As the owner, I want the first and second routes removed with `git worktree remove` after the ingest and the daemon check, so that attribution of the work survives the removal.
36. As the owner, I want a daemon still running from the worktree to leave the worktree in place, so that stopping it is mine.
37. As the owner on the third route, I want the worktree archived by the identifier from the list, so that the tools that created it are the ones that retire it.
38. As that owner, I want `git worktree remove` not used on that worktree, so that the archive is the removal.
39. As that owner, I want the branches deleted only once the list shows the archive and `git worktree list` no longer has the path, so that a branch is not deleted out from under a live checkout.
40. As that owner, I want an unconfirmed archive to leave the worktree and the branches, so that it is waiting for me and not a loop.
41. As the owner resuming a ticket, I want the earlier worktree removed by the same route, so that a managed worktree is not removed with `git worktree remove`.
42. As the owner, I want the rebase, the verification, the fast-forward merge, the push, the parallel limit and the stop rules left as they are, so that this epic does not reopen them.
43. As the owner, I want one skill text with no harness and no tool named, so that ADR-0039 holds and the package copy is a build of that text.
44. As the owner, I want the pack test to fail if the parameter sentence, the three routes, the setup, or the two removals disappear, so that the text is the behavior.
45. As the owner, I want epic 25's next action left as it is, so that this epic does not take its place.
46. As the owner, I want the check that Claude, Cursor and Codex each take the route their schemas offer to stay mine, after the ticket, so that this spec does not pretend a live run.

## Implementation Decisions

- **One text.** The autopilot skill is edited once. No second text is written for a harness, and nothing is copied from a harness's installed skills. The package's copy is the build of that text.
- **The earliest route is exclusive.** The parameter, then the type, then the tools. The run remembers the one it took and does not choose again per ticket. A parameter that places the agent on a remote clone is not the first route.
- **Setup is not a new step.** It sits in the step that starts agents, and only on the second and third routes. The first route's first message is the existing brief, and the checkout paragraph is not sent. Step numbers stay, so the later steps stay.
- **Acceptance is git's, from the registered checkout.** The agent reports `git rev-parse --show-toplevel`, `git rev-parse --path-format=absolute --git-common-dir`, `git rev-parse HEAD` and `git status --porcelain`. The session repeats the check with `git worktree list --porcelain` and `git -C` on the path. A failure stops the ticket.
- **The brief after acceptance** is the existing unattended brief plus one paragraph: the only checkout to write is the accepted absolute path, the per-ticket process creates the branch, and `main`, other worktrees and the worktree itself are left in place.
- **Teardown follows the route**, after the existing ingest pause and the existing daemon check. The first and second routes unlock when locked and run `git worktree remove`. The third archives by the identifier the list gave at acceptance, and deletes branches only after the list shows the archive and `git worktree list` no longer has the path. `git worktree remove` is forbidden there. An unconfirmed archive is waiting for the owner.
- **What does not count** is stated in the first step: `git worktree add` by the session or the agent, a prompt to work in an environment of its own, and a remote clone.
- **Unchanged.** The rebase in the agent's worktree, the verification checks, `git merge --ff-only`, the push, the parallel limit, the plan's three questions, and the stop rules of the verify step and the stop step.

## Testing Decisions

A good test reads the skill as a session would and holds the sentences that are the behavior. It does not start an agent and does not name a harness.

The module is the existing pack test that already holds the autopilot skill's wording, the same seam as the test that the first step reads the tool as the harness defines it and that a worktree the model would create does not count. That test gains the three routes, the rule that the earliest is the whole run, the remote clone, the setup and the acceptance, the first route's brief as the first message, and the two removals. It keeps the refusal, the missing-piece sentence, and the ban on a harness's mechanism. It asserts the skill does not name Cursor, Codex, a best-of-n runner, or the create and archive tools.

No new test module. The package copy is covered by the build that already checks a copy against its source. A live run on a client is not a test of this spec.

## Out of Scope

- Running autopilot in Claude, Cursor or Codex. That check is the owner's, after the ticket. Epic 29 remains the later end-to-end check of the clients.
- Epic 25, its tickets, and the roadmap's current focus and next action.
- A skill text per harness, and any copy taken from a harness's installed skills.
- The parallel limit, the plan's three questions, the rebase, the fast-forward merge, the push, and the stop rules.
- Retrying a refused path or an unconfirmed archive.
- Counting a remote clone.

## Contested points

- **A remote clone is a parameter that creates a worktree, and it still does not count.** Taken: the session cannot rebase it or remove it. The alternative, treating it as the first route, would start agents whose branches the run cannot merge.
- **The agent calls the tools, the session does not.** Taken: a call from the session can move its chat. The alternative, the session creating the worktree, leaves the coordinator's checkout.
- **The brief waits on the second and third routes.** Taken: the path is untrusted until the registered checkout sees it. The alternative, the brief as the first message, is the first route only, where the harness has already created the checkout.
- **The type comes before the tools.** Taken: the harness gives that checkout. The tools are the route only when no such type is present. The alternative, refusing when both exist, would stop a session that has a spare tool.
- **A managed worktree is archived, not removed.** Taken: the tools that create it archive it by identifier. The alternative, `git worktree remove` for every accepted path, retires it by a different operation.
- **No per-harness skill.** Taken: ADR-0039.

## Further Notes

ADR-0049. The glossary's Autopilot line already says the agent's checkout is one the harness creates; the three routes stay in the ADR and in this spec, not in the glossary. The skill text is written by the ticket, not by this spec.
