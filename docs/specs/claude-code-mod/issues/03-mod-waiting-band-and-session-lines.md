# 03: The mod's Waiting for you band and session-start lines

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/claude-code-mod/spec.md`
Roles: Developer, Reviewer

**What to build:** in every session of the project, a *Waiting for you* band above the prompt while something waits for the owner, and nothing when nothing does. A session whose branch maps to no Task also starts with at most three lines on the project's position in its context. This ticket covers the spec's *The band*, *The stale Next action already exists* and *The session-start lines*.

The band is a `ui.render` hook on `AbovePrompt`. It shows the counts of unanswered questions, approvals and the owner's `ready-for-human` Tasks, each with the first one's Task id; `main`'s CI failing; and `next_action.stale`, worded by its code. With none of these it passes to `next(e)`.

The session-start lines are a `prompt.context` hook. It adds one context block when `checkout.taskId` is null and the snapshot answered: the current epic with its status and progress, what waits for the owner as counts, and the Next action with its command. Otherwise it adds nothing.

- [ ] The view function:
  - no band with nothing waiting;
  - each kind of item alone and together, in English and Russian;
  - `next_action.stale` worded as `/binnacle:product` words it;
  - a section marked `available: false` left out.
- [ ] The view function: the session-start lines are at most three, absent when `checkout.taskId` is set, and absent when the snapshot did not answer.
- [ ] The hooks test run by `claude plugin test` renders the band with a question waiting and draws nothing without one.
- [ ] Checked by hand in a terminal session: the band appears with a question recorded on a ticket's branch and goes once it is answered; a session on `main` starts with the lines, and one on a ticket's branch without them.
