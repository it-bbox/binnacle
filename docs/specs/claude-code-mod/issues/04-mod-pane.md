# 04: The mod's pane, opened by its command

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/claude-code-mod/spec.md`
Roles: Developer, Reviewer

**What to build:** the command `binnacle-pane` opens a pane with a compact snapshot, and closes it when it is open. Its buttons put a command in the prompt box and never send it. This ticket covers the spec's *The pane*.

The command is registered at `session.start`. The pane is drawn by a `ui.render` hook on `Pane` and shows the current epic with its progress, the band's items, the Tasks in flight, CI's state and the Next action. Its buttons call `$.prompt.fill` with `mode: "replace"`:

- the Next action's command;
- the first Suggested step's command, when it differs from the Next action's;
- `/binnacle:answer`, while a question is unanswered;
- `/binnacle:checkpoint`, when `checkout.taskId` is null.

The pane never opens by itself.

- [ ] The view function:
  - the pane's sections from a snapshot, in English and Russian;
  - each button shown or left out by its rule;
  - a section marked `available: false` left out.
- [ ] The hooks test run by `claude plugin test`: the command opens the pane and closes it on a second run, and a button fills the prompt box without submitting.
