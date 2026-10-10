---
name: task
description: Load the compact brief for one Task, its fields, roles, dependencies, spec path, ticket body, Review, questions with their answers, pull or merge request with its CI state and branch name, ending with the command that starts it. Changes nothing.
argument-hint: "<task id: spec-slug/NN, or #number>"
disable-model-invocation: true
---

1. Call the `binnacle` MCP server's `project_detect` tool. If this session has no `binnacle` MCP tools, run each Binnacle tool this skill calls as `binn call <tool> '<arguments as one JSON object>'` in the shell instead, with the same arguments, and read the JSON it prints: what the tool returns, or the same error with its code. If it fails, stop. Quote the error's code and message, and give the human the fix without running it yourself:
   - `daemon.unreachable`: `/binnacle:daemon start`, or `binn daemon start` at a terminal.
   - `project.not_registered`: `/binnacle:register`, or `binn project register` run in the main checkout.
   - If the shell cannot find `binn` (`command not found`, exit 127), `binn` is not on this harness's PATH (see the README's setup section).

   Binnacle is optional. Until it answers, the Task is in its ticket file or tracker issue, read directly.
2. If no id was given (`$ARGUMENTS` is empty), ask for one and stop. Otherwise call `task_get` once, with `$ARGUMENTS` as `id`.
   - `task.not_found`: say so, and that an id is `<spec-slug>/<NN>` on the local tracker, `#<number>` on GitHub or GitLab. Suggest `/binnacle:product` to see what can start.
   - Any other error: quote its code and message. A `tracker.` code means the tracker could not be read, not that the Task is missing.
3. Present the brief, compactly:
   - **Task**: id, title, state, triage role and ticket path or URL.
   - **Roles**: the `required` roles, from the ticket's `Roles:` line, or, when `source` is `default`, a Developer and a Reviewer because it has none; say which. Then each of `suggested`, with its `reason`, as Binnacle's suggestion: its calculation, never part of the ticket. With none, say Binnacle suggests no other role.
   - **Dependencies**: each with its id, title and state, marked met or not met. Say plainly when one is not met, and when one is dangling (`met` is null): it names no known Task, probably a typo in the ticket, and blocks nothing.
   - **Spec**: the path, to read when the ticket needs it. Do not read it now.
   - **Body**: the text as given. If `truncated` is true, say that the brief cut it, and that the full ticket is at the ticket path or URL.
   - **Review**: the text as given, cut like the body when `truncated` is true. When `review` is null, say that the ticket records none; when it is not available, quote its reason.
   - **Questions and answers**: each of `questions.items` in order, its `text` as given, then its `answer` as given, or "Unanswered" when `answer` is null. When `questions.branch` is not null, say they were read from the ticket on that branch, which is not merged yet. When `items` is empty, say the ticket records no question; when `questions` is not available, quote its reason.
   - **Pull request**: from `request`, as the forge reports it, never Binnacle's reading: its number, title, branch, whether it is a draft, its CI `state` (`passing`, `failing`, `running`, or `none`: no check at all) and its link, naming the forge, `forge.provider`. When `request` is null, say the Task has no open pull or merge request; when it is not available, quote its reason.
4. State the branch name: "The branch for this Task is `<branch>`." Then quote each of the brief's `diagnostics`, if any, with its code and message.
5. End with the brief's `start`, the same command the dashboard shows for this Task: "To start it, in a fresh session:", then the command on its own line, as code. When `start` is null, say why instead: the Task is `DONE` or `CANCELLED`, when its state is one of them, and otherwise the project's workflow is not Matt Pocock's (`workflow.provider` is not `matt-pocock`), so Binnacle offers no command for it.

Change nothing: no branch, no worktree, no `Status:` edit, no tracker write, no commit, and no Binnacle calls other than the two above. Starting the work is the human's call, or the implementation process's, never this skill's.
