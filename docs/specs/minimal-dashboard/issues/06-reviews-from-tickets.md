# 06: Reviews, read from the tickets

Status: DONE
Triage: ready-for-agent
Blocked by: 02, 04
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** a Task's Review, as its ticket records it, shows on its Task page, and a `DONE` Task without one is an attention item. Decided in the spec, under *The Review*.

- [x] The local tracker reads a ticket's Review: the text under `### Review` inside `## Comments`, up to the next heading of the same level or above.
- [x] `task.get`'s brief carries it as `review`:
  - cut at the body limit, with `truncated`;
  - `null` when the ticket has none;
  - unavailable on GitHub and GitLab, with the reason that comments are not read.
- [x] `task.list` says, for each Task, whether a Review is recorded, or `null` where that is unavailable.
- [x] `review.missing` names each `DONE` Task on the local tracker that has no Review. It does not run on a remote tracker.
- [x] The Task page shows the Review as text. Otherwise it says that none is recorded, or that it is not available and why.
- [x] A Done card without a Review is marked.
- [x] Tests through the daemon seam cover a Review found, a Review cut at the limit, a missing Review raising `review.missing`, and a Review unavailable on a remote tracker.

## Comments

- **What exists.**
  - `TrackerTask` in `packages/core/src/tracker.ts` gains `review`: the text of the ticket's Review, or null. A remote tracker always gives null, since it never reads comments. The daemon tells "none recorded" from "not read" by the manifest's `tracker.provider`, as it already does for branches.
  - `ticketReview` in `packages/adapters/src/local-tracker.ts` reads it.
  - The brief's `review` is set in `apps/daemon/src/task.ts`: `{ text, truncated }` cut at `BODY_LIMIT` with `cut`, `null`, or `Unavailable` with the reason on GitHub and GitLab.
  - The board's cards carry `review: boolean | null` (`apps/daemon/src/board.ts`).
  - `review.missing` is raised in `readState` in `apps/daemon/src/snapshot.ts`, beside the roadmap's and the Next action's items. It therefore also reaches the daily's attention, which is `readState`'s too.
  - The Task page (`apps/dashboard/app/pages/task.vue`) shows the Review under its own heading, before the runs, as preformatted text. With none it says so, as a warning when the Task is `DONE`; unavailable, it quotes the reason.
  - The Project page marks a `DONE` card without a Review with "No Review recorded".
  - The Attention page needed nothing: it lists the snapshot's attention.
  - Documented in `docs/03-mcp-and-skills.md`, the `task_get` tool description, the `task` skill's presentation, and `docs/agents/issue-tracker.md`, which now says where a ticket's Review goes and what ends it.
- **Decided while building, within the spec.**
  - **Only the first `### Review` inside `## Comments` is read.** `CONTEXT.md` defines a Review as one review of a Task's work. A `### Review` in the body is not it.
  - **An empty `### Review` records nothing**, so it reads as none and a `DONE` Task with one is `review.missing`.
  - **A line inside a code fence is never a heading.** A fence closes only with a run of its own character at least as long as the opening one, so a `# comment` in a shell block ends no Review early. The body's cut at `## Comments` still ignores fences, as before.
  - **The heading is matched exactly**, `### Review`, as `docs/workflow/02-development-workflow.md` names it. Every Review on this repository is written that way.
  - **Only a `DONE` card is marked**, not a `MERGED` one in the Done column, so the board agrees with `review.missing`, which the spec fires for `DONE` Tasks only.
- **For the next tickets.**
  - **On this repository, `review.missing` names one Task:** `mcp-and-product-snapshot/01`, which came from epic 1 without a Review. It is the only `DONE` ticket without one. A Product session decides whether to leave it as a true reading or record why it has none. This session did not invent a Review for it.
  - A ticket's Review ends at the next `###`, `##` or `#` heading. Sections a session writes after it, such as `### Hand check`, stay out of the Review. Its own sub-headings must be `####`, as `docs/agents/issue-tracker.md` now says.
- **Checked by hand on 2026-09-26.** A daemon ran on a temporary `BINNACLE_HOME` and an ephemeral port, reading this machine's Claude Code artifacts, with this worktree registered and the dashboard generated. In the built-in browser:
  - `minimal-dashboard/04`'s Task page showed its Review, from "`/code-review` ran against `main`" to its last finding, as plain text.
  - `mcp-and-product-snapshot/01`'s Task page read "None is recorded: the ticket has no ### Review under ## Comments."
  - The Attention page listed `review.missing` for `mcp-and-product-snapshot/01` and nothing else of that code.
  - A throwaway project in the scratchpad with two `DONE` tickets, one with a Review and one without, showed "No Review recorded" on the second card alone. Epic 2's board could not show the mark, because `mcp-and-product-snapshot/01` falls in its Done column's remainder.
  - The console showed no error.
- **To see it yourself.**
  1. In the main checkout, once this branch is merged, run `pnpm dashboard:generate`, then `binn daemon stop` and `binn daemon start`.
  2. Run `binn dashboard`, and open *Attention*. It lists `review.missing` for `mcp-and-product-snapshot/01`.
  3. On the Overview, click the project's name, then click a Done card's id, such as `minimal-dashboard/05`. Under *Review*, the Task page shows the ticket's `### Review` section as written.
  4. To see the mark, rename `### Review` in `docs/specs/minimal-dashboard/issues/05-next-action-and-suggested-step.md` in the working tree. Within 15 seconds, its card on epic 5's board reads "No Review recorded", and *Attention* lists it. Undo the rename with `git checkout -- <that file>`.
  5. In a session, run `/binnacle:task minimal-dashboard/05`. The brief shows its Review before the branch.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground. Before the review, this branch was rebased onto `main` after ticket 05 merged. The one conflict was in `readState`, where ticket 05's `next_action` items and this ticket's `review.missing` both push attention; both stay, the Next action's first.

**Standards: no hard violations.** Findings:

1. **A fence toggled on any fence line**, so a ```` ```` ```` fence wrapping a ```` ``` ```` one, or a `~~~` line in a backtick block, could close it early and end the Review at a `#` line inside. **Fixed**: a fence closes only with a run of its own character at least as long, and a nested fence is tested.
2. **The body's cut at `## Comments` ignores fences, while `ticketReview` respects them.** **Left**: the body's cut is older than this ticket, and no ticket here fences a `## Comments` line.
3. **`### Review ###` or `### Review (round 2)` is not a Review.** **Kept**: the workflow names the heading exactly, and `docs/agents/issue-tracker.md` now says so.
4. **Another copy of the local-or-remote check**, in `board.ts` and `snapshot.ts`, beside `task.ts` and `usage.ts`; `isRemoteTracker` in `daily.ts` treats a missing manifest the other way. **Left**: each is one line, and the daily's differs on purpose: without a manifest there is no remote tracker whose Task states it must record. The others run only after the tracker was read, so a manifest is there. Extract a helper when one more caller needs it.
5. **`TrackerTask.review` is null both for "none recorded" and "not read"**, so three consumers read the provider again. **Kept**: widening the tracker contract with an unavailable state for one field its adapter cannot read contradicts its rule that a field the tracker cannot express is null.
6. **The `review.missing` loop is inline**, while its neighbours are named functions in `packages/core`. **Kept**: it is five lines with one caller, and it needs the manifest's provider, which the core functions do not take.

**Spec: every criterion holds.** Findings:

1. **A `MERGED` card without a Review was marked too**, while `review.missing` names only `DONE` Tasks. **Fixed**: only a `DONE` card is marked.
2. **No remote tracker is asserted to give no `review.missing` directly.** **Kept**: the GitHub and GitLab snapshot tests' `codes` now include `review.` items, and their closed, `DONE` issues give none.
3. **`docs/agents/issue-tracker.md` is not in *Documents this epic changes*.** **Kept**: it is where a ticket's shape is written, and the line states the rule the reading depends on.
4. **Fences and an empty Review go beyond "up to the next heading of the same level or above".** **Kept**, as recorded above: a fenced `#` line is not a heading, and an empty section records nothing.
5. **Only the first `### Review` is read.** **Kept**, as recorded above.
