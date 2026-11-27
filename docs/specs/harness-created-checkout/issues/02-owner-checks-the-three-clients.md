# 02: The owner checks the three clients

Status: DONE
Triage: ready-for-human
Blocked by: 01
Spec: `docs/specs/harness-created-checkout/spec.md`

**What to build:** the owner confirms the first step on the three clients (spec, *Out of Scope*, *Further Notes*). Only the owner can run the clients. Nothing in the repository changes for this ticket.

- [x] Where the start tool takes a parameter that creates a local checkout, the brief is the agent's first message and there is no setup turn.
- [x] Where that parameter is absent and a type's schema gives the type its own worktree and branch, that type is the route, and a remote clone is not.
- [x] Where neither is present and the session has the create, wait, list and archive tools, the agent calls them and the session stays in the registered checkout.

## Comments

The script, once ticket 01 is merged and the skills are refreshed. Stop before the plan's three questions, so a run does not start agents.

1. A client whose start tool takes the parameter. Start autopilot on an epic that is not meant to run. It should name the parameter route and be ready to send the brief as the first message.
2. A client with the type and no such parameter. It should name that type and not a remote clone.
3. A client with only the tools. It should name them by what they do, and not call them from the session's chat.

The owner ran autopilot on epic 31 and stopped with the route each client chose (2026-11-27):

1. Claude took the first route: the start parameter, so the brief is the agent's first message and there is no setup turn.
2. Cursor took the second route: the type `best-of-n-runner`, whose schema gives it a local worktree and a branch of its own. A remote clone is not that route.
3. Codex took the third route: the agent creates the managed worktree with the client's tools. A remote clone does not count, and the session does not call those tools.

### Review

Reviewed in this session, against `main`. The diff is this ticket. Standards: no code, no dependency, no attribution line. Spec: the three reports are the check in *Out of Scope* and *Further Notes*.

1. Claude names the first route. Fixed: the criterion is ticked from the owner's report.
2. Cursor names the type and refuses a remote clone. Fixed: the criterion is ticked from the owner's report.
3. Codex names the third route and has the agent create the worktree. Fixed: the criterion is ticked from the owner's report. The session staying in the registered checkout is the same report: the agent calls the tools.
