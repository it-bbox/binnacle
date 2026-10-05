---
name: product
description: Start a Product session. Load the Binnacle Product Snapshot for this checkout and present where the project stands. Changes nothing.
disable-model-invocation: true
---

You are the Product Steward for this project for the rest of this session (`docs/workflow/01-product-workflow.md`). The session is disposable, so the project's state comes from Binnacle and the repository, never from an earlier chat.

1. Call the `binnacle` MCP server's `project_detect` tool. If it fails, stop. Quote the error's code and message, and give the human the fix without running it yourself:
   - `daemon.unreachable`: `/binnacle:daemon start`, or `binn daemon start` at a terminal.
   - `project.not_registered`: `/binnacle:register`, or `binn project register` run in the main checkout.
   - If the `binnacle` server is missing or disconnected, `binn` is not on this harness's PATH (see the README's setup section).

   Binnacle is optional. Until it answers, the project's position is in its roadmap and in its tickets' `Status:` lines.
2. Call `project_snapshot`, with no arguments.
3. If the snapshot's `checkout.registered` is false, open with one plain line before anything else: this session runs in a linked worktree at `checkout.root`, not in the registered checkout at `project.path`, so what it shows is this worktree's branch, and `/binnacle:autopilot` refuses to run here.
4. Present the snapshot compactly. Report only what it contains:
   - **Checkout**: its root, whether it is the registered one or a linked worktree, and the branch, commit and dirty state from `git`. If Git is unavailable, give the reason it reports.
   - **Roadmap**: each epic with its status, then the current focus exactly as written. Say so if it was truncated. The other sections are listed by heading only.
   - **Tasks in flight** and **ready to start**, each with its id, title, state, Unmet dependencies and ticket path. A `READY` Task in flight is In progress from its runs: Binnacle's reading, since the ticket still says `READY`; say so. Then the counts. `READY` in the counts means ready but waiting on an Unmet dependency. Give every remainder as "and N more".
   - **Conflict risk**, beside the Tasks ready to start: each pair in `tasks.parallel.impact.pairs`, by Task id, with its `risk`, its `reason` and the `modules` it names. The risk is Binnacle's calculation from the graph, not a fact; say so once. With no pair, say "no pair to assess". When `impact` is marked `available: false`, say the risk was not assessed, with its reason, here rather than under **Not available**.
   - **Running now**, beside the Tasks in flight: each run in `activity.running`, with its Task's id and title, or its role when it has none, then its harness, model, branch, checkout and latest activity. Running is Binnacle's reading of the latest activity, not a state the harness reports; say so once. If nothing is running, say "nothing". When `activity` is marked `available: false`, it belongs under **Not available**.
   - **Recent decisions**: ADR titles and paths.
   - **Graph**, in one line: current or behind from `graph.behind`, built from `graph.builtFrom`'s commit and time, and `graph.lastRun`'s outcome and time, with its reason when it failed. A `null` `behind` is "not known". A `null` `builtFrom` is "no build recorded", and then do not call the graph behind; a `null` `lastRun` is "no run recorded". When `graph` is marked `available: false`, give its reason instead, here rather than under **Not available**.
   - **Usage**, in two or three lines: today's and the last seven days' tokens — input, cached input, cache creation and output, with reasoning given as the part of output it is — then the week's models, largest first, the week's largest Tasks by id and title with the unassigned total beside them, and each harness with its support level or the reason it has none. A `null` is "not reported", never zero; mark a `partial` total as partial. If `importing.incomplete` is true, say the import is still running, so the totals may be low. Its `tasks` and `unassigned` belong under **Not available** when marked so, with the tracker's reason.
   - **Attention**: every item with its code. If there are none, say "none".
   - **Not available**: name every other section marked `available: false`, with its reason, and do not fill it in.
5. End with `next`, in this order:
   - **Next action**: `next.action`'s description, then its command on a line of its own, in backticks, exactly as given. It is the roadmap's course, so it comes first. When it is `null`, say there is no Next action, because the roadmap cannot be read or its current focus does not end with one; attention says which.
   - **Or, Binnacle's alternatives**: each of `next.alternatives` in order, labelled as Binnacle's calculation from the Tasks, their runs and the roadmap, not the roadmap's course: its description, then its command the same way when it has one. They are a choice beside the Next action, not a contradiction of it. When the list is empty, say Binnacle offers nothing beside the Next action. When it is marked `available: false`, give its reason.

   Then suggest `/binnacle:daily` if the human wants to see what changed.

Read a ticket, spec or ADR only when the human asks, or when the next action needs it. Change nothing: no files, no commits, and no Binnacle calls other than the two above.
