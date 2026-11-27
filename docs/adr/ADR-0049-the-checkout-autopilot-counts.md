# ADR-0049: The Checkout Autopilot Counts

**Status:** Accepted. Narrows ADR-0039 and ADR-0022: a worktree of the agent's own is a checkout the harness creates, in one of three shapes, read from the session's schemas.

## Context

Autopilot runs one agent per ticket and verifies the branch before the merge (ADR-0022). The agent works in a checkout of its own that the harness creates; where the harness cannot, autopilot stops at its first step and changes nothing (ADR-0039). The step that checked this counted only a parameter of the tool that starts the agent. A harness whose schema promises a worktree another way was refused, including one where the agent calls the harness's own tools to bring the checkout into existence, and one where a type of background agent is specified as receiving its own worktree and branch. A checkout on a remote machine that is a clone of a remote branch was easy to mistake for one of these: the session cannot rebase it or remove it. The text stays one text and names no harness (ADR-0039).

## Decision

One route for the whole run, the earliest the schemas show:

1. **A parameter of the tool that starts the agent** makes the harness create a local checkout when the agent starts. The brief is the agent's first message. The worktree is removed as today, `git worktree unlock` when it is locked, then `git worktree remove`, then `git branch -d`.
2. **A type of background agent** whose schema says the harness gives that type its own worktree and its own branch. This route is used only when the first is absent.
3. **Tools of the session**, read by what their schemas do and not by their names, that create a managed worktree from the repository's root and a commit, waiting included when creation is asynchronous, list such worktrees with an identifier, and archive one by that identifier. The agent calls them. The session does not. This route is used only when the first two are absent.

On the second and third routes the agent's first message only brings the worktree into existence and reports its path, its common git directory, its HEAD and its status. The session, from the registered checkout, accepts the path only when `git worktree list` shows it, it is not that checkout's root, it is not another agent's checkout of the run, the common git directory is the same, HEAD is the `main` the run named, and the tree is clean. The brief follows that acceptance. Where a message cannot be sent, the ticket stops.

These do not count: `git worktree add` by the session or the agent, a prompt telling the agent to work in an environment of its own, and a checkout on a remote machine that is a clone of a remote branch.

The third route is not removed with `git worktree remove`. It is archived by its identifier, and the branches are deleted only once the list shows the archive and `git worktree list` no longer has the path. An archive that is not confirmed, or a path that is not accepted, leaves the worktree and the branches for the owner. `main` is not touched. There is no retry.

## Considered Options

- **Only a parameter of the start tool.** Rejected: harnesses that create the checkout another way would keep refusing, and the tickets would stay manual there.
- **Counting a remote clone.** Rejected: the session cannot rebase it or remove it, so it cannot verify and merge.
- **The session calling the tools that create the worktree.** Rejected: that call can move the session's own chat out of the registered checkout.
- **Sending the brief before the path is accepted**, on the second and third routes. Rejected: the agent would write before the session knows the checkout is this repository's.
- **`git worktree remove` for a worktree the tools created.** Rejected: those tools archive it by their identifier. Removing it underneath them is not the same operation.
- **A skill text per harness.** Rejected: ADR-0039. One text, no harness named in it.

## Consequences

- A harness whose start tool takes the parameter is unchanged: no setup message, and `git worktree remove` after the same checks.
- A harness with neither a parameter, nor such a type, nor such tools is refused at the first step, as today.
- The skill text that carries this is written by `/to-spec` and `/to-tickets`, then by the ticket. This ADR does not change it.
- Epic 29 stays the later check of the clients. It does not replace this decision.
