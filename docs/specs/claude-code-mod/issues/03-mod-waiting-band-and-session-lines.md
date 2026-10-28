# 03: The mod's Waiting for you band and session-start lines

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/claude-code-mod/spec.md`
Roles: Developer, Reviewer

**What to build:** in every session of the project, a *Waiting for you* band above the prompt while something waits for the owner, and nothing when nothing does. A session whose branch maps to no Task also starts with at most three lines on the project's position in its context. This ticket covers the spec's *The band*, *The stale Next action already exists* and *The session-start lines*.

The band is a `ui.render` hook on `AbovePrompt`. It shows the counts of unanswered questions, approvals and the owner's `ready-for-human` Tasks, each with the first one's Task id; `main`'s CI failing; and `next_action.stale`, worded by its code. With none of these it passes to `next(e)`.

The session-start lines are a `prompt.context` hook. It adds one context block when `checkout.taskId` is null and the snapshot answered: the current epic with its status and progress, what waits for the owner as counts, and the Next action with its command. Otherwise it adds nothing.

- [x] The view function:
  - no band with nothing waiting;
  - each kind of item alone and together, in English and Russian;
  - `next_action.stale` worded as `/binnacle:product` words it;
  - a section marked `available: false` left out.
- [x] The view function: the session-start lines are at most three, absent when `checkout.taskId` is set, and absent when the snapshot did not answer.
- [x] The hooks test run by `claude plugin test` renders the band with a question waiting and draws nothing without one.

## Comments

Decisions taken here, none of them the owner's:

- The band's items: each section of *Waiting for the owner* is counted as `items` plus `remainder`, with the first item's Task id, as `Unanswered questions: 2 (spec/01 first)`, `Вопросы без ответа: 2 (сначала spec/01)`. The labels are the dashboard's (`waitingQuestions`, `waitingApprovals`, `waitingOwner`). The title is *Waiting for you*, «Ждёт вас».
- `main`'s CI failing is the snapshot's `ci.failing` attention item and the stale Next action its `next_action.stale`, each worded by `wordMessage`, the English marked « (англ.)» where core cannot word the params, as `binn` does. A `ci` or `pendingDecisions` marked unavailable raises no item, so it is left out.
- The session-start lines are English whatever the locale: the agent reads them, not the person, and text for an agent stays English (ADR-0045). The waiting line counts zeros, since a zero there is a count, not missing data; questions that could not be read are left out of it.
- The context block is named `binnacle`. `prompt.context` fires once per conversation and awaits the refresh under way, at most 8 seconds (`START_WAIT_MS`), inside Claude Code's 10-second budget for a hook; a slower daemon adds nothing.
- The band draws from the last finished view, never one under way, so drawing never waits on the daemon. A refresh asks for a redraw (`$.ui.invalidate('ui.render')`) only when the band's text changed. It passes to `next(e)` while a survey holds the band.
- What a session keeps lives in a `Kept` object made in `register`, not in module variables. `hooks.ts` stays `.ts` and calls Claude Code's global `h` by name instead of JSX.

For the next tickets:

- `view()` returns `{ status, band, startLines }`. The pane can reuse `band`'s items for its *Waiting* part.
- `claude plugin validate` refuses `$` passed to anything but a function declared at the top of the file: a helper that takes `$` cannot be an arrow inside `register` (`refresh` is top-level for that reason).
- In `claude plugin test`, `$.ui.mount` needs a `ui.render` answer beneath the mod, and that answer must be a tree, not `null`: the live test's engine draws an empty `Box`. `AbovePrompt` is raised on the terminal and desktop surfaces only.
- The fake engine in `mod.test.ts` has `state.held`, which holds the server's answer back, and `state.sleep`, which settles `$.clock.sleep`.

### Review

Reviewed in a sub-agent against `main`, on the standards and the spec. Every criterion holds and no finding was must-fix; `claude plugin validate` and `claude plugin test` pass on the built mod.

- Fixed: nothing pinned that `prompt.context` waits on the refresh under way. A test now holds the server's answer until the hook is raised (`mod.test.ts`).
- Fixed: the wait counted against the hook's 10-second budget without a bound. It is raced against `$.clock.sleep(8000)` now, and a slower daemon adds no block (`hooks.ts`).
- Fixed: the session-start lines were in the person's language although the agent reads them. English now, by ADR-0045 (`view.ts`).
- Fixed: "and 1 more" read as more Tasks where it counted questions. The band says which Task comes first instead (`view.ts`).
- Fixed: the live test mounted the band on `vscode` and `mobile`, where Claude Code does not raise `AbovePrompt`. It mounts on `terminal` and `desktop` now (`mod.live.ts`).
- Kept: if `$.ui.status` threw after the view was made, the band would stay while the line cleared. Ticket 02 found that call never throws.
