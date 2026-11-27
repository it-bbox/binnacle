# The checkout autopilot counts

Epic material from the grilling of 2026-11-27. ADR-0049. This brief is what `/to-spec` starts from. Epic 25's next action is unchanged.

## The problem

Autopilot starts in Claude, where the tool that starts an agent takes a parameter and the harness creates the worktree. It does not start in Cursor or Codex. Cursor has no such parameter: one type of background agent is specified as receiving its own worktree and branch, and a remote machine with a clone of a remote branch is not a checkout the session can rebase or remove. Codex brings the worktree in through other tools of the session, and calling them from the coordinator moves that chat. A second copy of the skill for one harness is not the fix.

## The outcome wanted

One skill text. The run takes one route, the earliest the schemas show: the start parameter; otherwise the agent type whose schema gives it a worktree and a branch; otherwise the tools the agent calls to create, wait out, list and archive a managed worktree. The coordinator does not call those tools and stays in the registered checkout. A remote clone and `git worktree add` do not count. On the second and third routes the first message only brings the worktree into existence, and the brief follows once the path is accepted; on the first the brief is the first message. Removal is `git worktree remove` for the parameter and the type, and an archive by identifier for the tools. An unconfirmed archive, or a path that is not accepted, leaves the ticket to the owner, `main` is untouched, and there is no retry.

## Who it concerns

The owner, who runs autopilot from Claude, Cursor and Codex.

## The systems it touches

- `.claude/skills/binnacle/skills/autopilot/SKILL.md`, which the package's `binnacle-autopilot` copy is built from
- `apps/cli/test/pack.test.ts`, the assertions on that skill

## Decided in the grilling, 2026-11-27

- **The agent may call the harness's tools.** Creating, waiting out, listing and archiving a managed worktree counts, when the coordinator does not call the tools and accepts the path from the registered checkout: `git worktree list` shows it, it is not the root of `main`, the common git directory is the same.
- **A type counts too.** A background agent type whose schema says the harness gives it a worktree and a branch counts. If the start tool has the parameter, that parameter is the only route.
- **The brief waits, except on the parameter.** Where the worktree does not exist at the start, the first message implements nothing. The implementation brief is sent after the path is accepted. If it cannot be sent, the ticket stops.
- **The type comes before the tools.** With no start parameter, a type that qualifies is the route. The tools are the route only when no such type is present.
- **Removal follows the route.** The parameter and the type use `git worktree remove`, as today. The tools' worktree is archived by its identifier, and `git worktree remove` is not used on it. No retry.
- **Not taken:** a remote clone; `git worktree add` by the session or the agent; a prompt to work in an environment of its own; a skill file per harness; moving epic 25.

## Open

Nothing in the decision. The owner's check that Claude still takes the parameter, and that Cursor and Codex take the route their schemas offer, comes after the ticket. Epic 29 remains the later end-to-end check of the clients.
