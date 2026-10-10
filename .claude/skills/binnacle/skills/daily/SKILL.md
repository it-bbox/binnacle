---
name: daily
description: Show what changed in this project since the previous daily on this machine, what waits for the owner, CI, what can start next and what needs attention. Records the next daily's baseline and changes nothing else.
argument-hint: "[commit to look back from]"
disable-model-invocation: true
---

1. Call the `binnacle` MCP server's `project_detect` tool. If this session has no `binnacle` MCP tools, run each Binnacle tool this skill calls as `binn call <tool> '<arguments as one JSON object>'` in the shell instead, with the same arguments, and read the JSON it prints: what the tool returns, or the same error with its code. If it fails, stop. Quote the error's code and message, and give the human the fix without running it yourself:
   - `daemon.unreachable`: `/binnacle:daemon start`, or `binn daemon start` at a terminal.
   - `project.not_registered`: `/binnacle:register`, or `binn project register` run in the main checkout.
   - If the shell cannot find `binn` (`command not found`, exit 127), `binn` is not on this harness's PATH (see the README's setup section).

   Binnacle is optional. Until it answers, the project's position is in its roadmap and in its tickets' `Status:` lines.
2. Call `daily_get` once.
   - With no argument, call it with no arguments. It returns the delta since the last daily or checkpoint and records this HEAD as the next baseline. That is what running `/binnacle:daily` asks for. Do not call it a second time to check: the second call returns an empty delta and records again.
   - If the human passed a commit (`$ARGUMENTS`), pass it as `since`. The delta then runs from that commit and records nothing.
   - `request.invalid` means that commit does not exist or is not an ancestor of HEAD. Say so, and suggest another commit.
3. Present only what changed, compactly:
   - **Range**: from `from.commit` (`from.source`) to `head`. A null `from.commit` means the range starts at the first commit. If `fallback` is set, quote its message, because the range was chosen by the fallback and not by a baseline.
   - If `dirty` is true, say that uncommitted edits are not in the delta.
   - **Commits**: the count, then the subjects, with "and N more" for any remainder.
   - **Task transitions** (`from` → `to`), **new tickets**, **roadmap status changes** and **decisions**, each with its ticket or ADR path. Leave out a list that is empty or null. A null list means its source could not be read, and the attention items say why. A list with `available: false` could not be computed, as on a remote tracker's first daily or with a commit passed: quote its `reason` instead, so that it is not read as "nothing changed".
   - **Waiting for the owner**, from `pendingDecisions`, as of now and not only what changed: the unanswered **questions**, each with its Task id, title, ticket path, its text and the branch it was read from when `branch` is set; the **approvals**, the Tasks in `READY_FOR_REVIEW` waiting for the human's review; and the human's **to start**, the Tasks triaged `ready-for-human` and ready to start, each with id, title and ticket path. Give every remainder as "and N more", and say "none" for an empty list. A list or the section marked `available: false`: quote its `reason`.
   - **CI**, from `ci`, as of now and as the forge reports it, never Binnacle's reading: the forge, `forge.provider` and `forge.repository`; the default branch's state, `passing`, `failing`, `running` or `none` (no check at all), with its commit and link; then each open pull request with its number, title, branch, the Task it maps to (`taskId`) or no Task, whether it is a draft, and its state, with "and N more" for the remainder, or "none". A failing default branch is also the attention item `ci.failing`. When `ci` is marked `available: false`, quote its `reason`.
   - **Attention**: every item with its code. If there are none, say "none".
   - **Can start next**: the `readyToStart` Tasks, with id, title and ticket path.
   - If nothing changed, say "nothing changed since `<from.commit>`" in one line instead of the empty lists, and still give what waits for the owner, CI, the attention items and what can start next.
4. End with a recommendation for what to do next. Do not act on it until the human asks.

Change nothing else: no files, no commits, and no Binnacle calls other than the two above.
