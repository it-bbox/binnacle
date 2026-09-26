# 09: The exit demonstration

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** epic 5's exit criterion, demonstrated by the owner on their running daemon: the next step is taken from the dashboard alone. Decided in the spec, under *Further Notes*.

- [ ] `binn dashboard` opens the main screen, which shows this repository's position, its Next action and the Suggested step.
- [ ] The owner starts this ticket by copying a command the dashboard shows into a fresh session, without asking an agent what to type. The command may be the Next action's, the Suggested step's, or the ticket's own.
- [ ] Within one refresh, this ticket's card is In progress, read from runs, and names that session's harness and model.
- [ ] The Usage page's figures equal `usage_get`'s for the same window.
- [ ] Every element that is not available gives its reason.
- [ ] Once this ticket is merged, its card is Done.
- [ ] The owner records under `## Comments` whether the dashboard answered "what do I type" at every step.
- [ ] Defects are filed as tickets. The roadmap marks epic 5 done only when none of them is open.
