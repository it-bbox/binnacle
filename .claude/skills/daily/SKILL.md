---
name: daily
description: Show what changed in this project since the previous daily on this machine, what can start next and what needs attention. Records the next daily's baseline and changes nothing else.
argument-hint: "[commit to look back from]"
disable-model-invocation: true
---

1. Call the `binnacle` MCP server's `project_detect` tool. If it fails, stop and give the fix, as `/product` does: `binn daemon start` for `daemon.unreachable`, and `binn project register` for `project.not_registered`. Do not run either yourself.
2. Call `daily_get` once.
   - With no argument, call it with no arguments. It returns the delta since the last daily or checkpoint and records this HEAD as the next baseline. That is what running `/daily` asks for. Do not call it a second time to check: the second call returns an empty delta and records again.
   - If the human passed a commit (`$ARGUMENTS`), pass it as `since`. The delta then runs from that commit and records nothing.
   - `request.invalid` means that commit does not exist or is not an ancestor of HEAD. Say so, and suggest another commit.
3. Present only what changed, compactly:
   - **Range**: from `from.commit` (`from.source`) to `head`. A null `from.commit` means the range starts at the first commit. If `fallback` is set, quote its message, because the range was chosen by the fallback and not by a baseline.
   - If `dirty` is true, say that uncommitted edits are not in the delta.
   - **Commits**: the count, then the subjects, with "and N more" for any remainder.
   - **Task transitions** (`from` → `to`), **new tickets**, **roadmap status changes** and **decisions**, each with its ticket or ADR path. Leave out a list that is empty or null. A null list means the tracker could not be read, and the attention items say why.
   - **Attention**: every item with its code. If there are none, say "none".
   - **Can start next**: the `readyToStart` Tasks, with id, title and ticket path.
   - If nothing changed, say "nothing changed since `<from.commit>`" in one line. Do not pad it.
4. End with a recommendation for what to do next. Do not act on it until the human asks.

Change nothing else: no files, no commits, and no Binnacle calls other than the two above.
