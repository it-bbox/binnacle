---
name: status
description: Show this project and this session's checkout in a few lines, from the binnacle MCP server's project_status tool: the project, its tracker, the checkout with its branch, commit and dirty state, and the diagnostics. Changes nothing.
disable-model-invocation: true
---

1. Call the `binnacle` MCP server's `project_status` tool once, with no arguments. If this session has no `binnacle` MCP tools, run each Binnacle tool this skill calls as `binn call <tool> '<arguments as one JSON object>'` in the shell instead, with the same arguments, and read the JSON it prints: what the tool returns, or the same error with its code. If it fails, stop. Quote the error's code and message, and give the human the fix without running it yourself:
   - `daemon.unreachable`: `/binnacle:daemon start`, or `binn daemon start` at a terminal.
   - `project.not_registered`: `/binnacle:register`, or `binn project register` run in the main checkout.
   - If the shell cannot find `binn` (`command not found`, exit 127), `binn` is not on this harness's PATH (see the README's setup section).

   Binnacle is optional. Until it answers, `git status` and the manifest at `.binnacle/project.yaml` give the Git and tracker facts.
2. Present the answer in a few lines:
   - **Project**: `project.name` and `project.id` when they are set, and `project.path`. If `project.unavailable` is set, the manifest could not be read: quote it.
   - **Tracker**: `manifest.tracker.provider`, and `manifest.tracker.repository` when it is set. A null provider means the manifest does not declare one: say "not declared", not a default. Leave the line out when `manifest` is null.
   - **Checkout**: `checkout.root`. If `checkout.registered` is true, it is not a linked worktree of the project. If `registered` is false, say plainly that this session runs in a linked worktree, not the registered checkout at `project.path`, and that the Git facts below are this worktree's.
   - **Git**: the branch, or "detached" when `git.detached` is true; the commit, short, or "no commits yet" when `git.commit` is null; and "dirty" or "clean" from `git.dirty`. If `git.available` is false, quote its `code` and `reason` instead.
   - **Diagnostics**: every item with its code and message, such as a remote that does not match the manifest. If there are none, say "none".
3. Stop there. The roadmap, the Tasks and usage are not part of this answer: leave them to `/binnacle:product`, and say so only if the human asks for them.

Change nothing: no files, no commits, no shell commands other than `binn call project_status`, and no Binnacle call other than `project_status`.
