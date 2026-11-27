# 01: Autopilot counts the checkout the harness creates

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/harness-created-checkout/spec.md`
Roles: Developer, Reviewer

**What to build:** autopilot takes one route for the whole run, the earliest the session's schemas show, and a harness that already creates the checkout from a parameter of the start tool is unchanged (spec, *Solution*, *The earliest route is exclusive*, ADR-0049). Otherwise a background agent type whose schema gives it a worktree and a branch counts, and only if that type is absent do the session's tools count: the agent calls them to create, wait out, list and archive a managed worktree, and the session does not. On those two routes the first message only brings the worktree into existence; the brief follows once the registered checkout accepts the path. Removal is `git worktree remove` for the parameter and the type, and an archive by identifier for the tools. A refused path or an unconfirmed archive stops the ticket, leaves `main` untouched, and is not retried. With none of the three, the first step stops and changes nothing.

- [x] The earliest route is the whole run: the start parameter, else the type, else the tools. A parameter that places the agent on a remote clone is not the first route.
- [x] `git worktree add`, a prompt to work in an environment of its own, and a remote clone do not count. With none of the three routes the first step stops, changes nothing, and says whether a background agent, a checkout the harness creates, or both, are missing.
- [x] On the second and third routes the first message implements nothing, and the path is accepted only from the registered checkout. The first route sends the existing brief as the first message and does not send the checkout paragraph.
- [x] The first and second routes remove the worktree with `git worktree remove` after the ingest and the daemon check. The third archives by the list's identifier and does not use `git worktree remove`. An unconfirmed archive leaves the worktree and the branches, with no retry.
- [x] The pack test holds those sentences, and the skill names no harness and no tool.

## Comments

### Review

Standards: none. One skill text, no harness name and no agent-tool name, step numbers unchanged, the implementation brief quote unchanged.

Spec, fixed. Step 7's resume start said the resume paragraph follows the brief's first, which on the second and third routes put the brief into the first message. The first message on those routes stays the setup; the resume paragraph goes with the brief once the path is accepted. On the first route it still follows the brief's first paragraph, in that first message.

Spec, fixed. Step 7's resume deleted any branch the harness created even when step 9's removal deletes nothing. A harness branch is deleted only when that removal deletes branches; an unconfirmed archive deletes nothing. The ticket's branch stays.

Kept. Step 9 names the archive as the route's removal; who calls the tool is already step 1, the agent and not the session.

For ticket 02: this ticket did not start an agent. The three routes are step 1 of `.claude/skills/binnacle/skills/autopilot/SKILL.md`. The first route still sends the existing brief as the first message and removes with `git worktree remove`.
