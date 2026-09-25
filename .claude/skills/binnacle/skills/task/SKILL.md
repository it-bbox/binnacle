---
name: task
description: Load the compact brief for one Task, its fields, dependencies, spec path, ticket body and branch name, before starting it. Changes nothing.
argument-hint: "<task id: spec-slug/NN, or #number>"
disable-model-invocation: true
---

1. Call the `binnacle` MCP server's `project_detect` tool. If it fails, stop. Quote the error's code and message, and give the human the fix without running it yourself:
   - `daemon.unreachable`: `binn daemon start`.
   - `project.not_registered`: `binn project register`, run in the main checkout.
   - If the `binnacle` server is missing or disconnected, `binn` is not on this harness's PATH (see the README's setup section).

   Binnacle is optional. Until it answers, the Task is in its ticket file or tracker issue, read directly.
2. If no id was given (`$ARGUMENTS` is empty), ask for one and stop. Otherwise call `task_get` once, with `$ARGUMENTS` as `id`.
   - `task.not_found`: say so, and that an id is `<spec-slug>/<NN>` on the local tracker, `#<number>` on GitHub or GitLab. Suggest `/binnacle:product` to see what can start.
   - Any other error: quote its code and message. A `tracker.` code means the tracker could not be read, not that the Task is missing.
3. Present the brief, compactly:
   - **Task**: id, title, state, triage role and ticket path or URL.
   - **Dependencies**: each with its id, title and state, marked met or not met. Say plainly when one is not met, and when one is dangling: it names no known Task.
   - **Spec**: the path, to read when the ticket needs it. Do not read it now.
   - **Body**: the text as given. If `truncated` is true, say that the brief cut it, and that the full ticket is at the ticket path or URL.
4. State the branch name: "The branch for this Task is `<branch>`."

Change nothing: no branch, no worktree, no `Status:` edit, no tracker write, no commit, and no Binnacle calls other than the two above. Starting the work is the human's call, or the implementation process's, never this skill's.
