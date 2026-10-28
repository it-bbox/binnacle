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

- [x] The view function:
  - the pane's sections from a snapshot, in English and Russian;
  - each button shown or left out by its rule;
  - a section marked `available: false` left out.
- [x] The hooks test run by `claude plugin test`: the command opens the pane and closes it on a second run, and a button fills the prompt box without submitting.

## Comments

Decisions taken here, none of them the owner's:

- The pane's sections, each a bold heading over its lines, in this order: *Current epic* with its status and progress (`22, A Binnacle mod for Claude Code (in progress, 2 of 7 Tasks done)`, «(в работе, готово 2 из 7)»); the band's title and items, reused from `band`; *In progress*, each Task in flight with its id, title and state, then "and N more" for the remainder; *CI*, the default branch with its state (`main: passing`, «main: проходит»); *Next action*, its description and command. The state and status words are the dashboard's. A section with no data is left out: no current epic, no Task in flight, `tasks` null, `ci` or `pendingDecisions` unavailable, no Next action.
- CI shows the default branch only; the open requests are left to the dashboard. A pane's text draws no Markdown, so the Next action's command stands bare, without backticks.
- Each button's label is the command it puts in the prompt box, so the person sees what lands there; its `key` is `next`, `suggested`, `answer` or `checkpoint`. The Suggested step's button is the first alternative's command, left out when it has none, is the Next action's, or the alternatives cannot be read. `/binnacle:answer` needs at least one question counted as unanswered; questions that could not be read give no button.
- The command is `/binnacle-pane`, described in the typeahead in the person's language («Открыть или закрыть панель Binnacle»). Its hook answers for itself with `{}`, so it prints nothing. It closes the pane when `$.ui.panes()` lists it, and opens it otherwise; a command is the person asking, so Claude Code places the pane at any width. Nothing else opens it.
- Without a snapshot the pane draws an empty `Box`. A refresh asks for a redraw when the band's or the pane's content changed, so the first snapshot of a session now redraws once.

For the next tickets:

- `view()` returns `{ status, band, startLines, pane }`. A test snapshot needs `tasks` and `ci` now: the fixtures in `mod.test.ts` and `mod.live.ts` set `tasks: null` and `ci` unavailable.
- `claude plugin validate` reads a matcher's values and `$.command.register`'s `name` off the source: given through a named constant they read as `?`, and the command's hook then counts as a gate on every command. They are literals in `hooks.ts` for that reason.
- In `claude plugin test`, `ui.panes`, `ui.open`, `ui.close`, `command.register` and `prompt.fill` are answered by the test's own hooks (`{ value }` for a call on `$`, the event's result for `prompt.fill`); `$.command.run({ command })` runs a command and `ui.press({ key })` presses a Button.
- `pnpm test` fails one test outside this ticket, on `main` too: `pack.test.ts`'s *the five reporting skills … list CONTEXT.md's Russian words* wants "Mod — мод" in the skills' term lists since `CONTEXT.md` gained *Mod* (7adefa3). Ticket 06, which writes the docs, or a Product session can add it.

### Review

Reviewed in a sub-agent against `main`, on the standards and the spec. Every criterion holds; no finding was must-fix. `claude plugin validate` and `claude plugin test` pass on the built mod.

- Fixed: the command's typeahead line was English whatever the locale, while the spec puts the mod's text in the person's language. It follows `binn`'s locale rule now (`hooks.ts`, `view.ts`).
- Fixed: a rejected `$.prompt.fill` in a button's press was left unhandled. It is caught, and the press then does nothing (`hooks.ts`).
- Fixed: the Next action's command was drawn in backticks, which a pane's `Text` shows as they are. It stands bare now (`view.ts`).
- Kept: "Current epic" in sentence case, as the session-start lines and the band's labels have it.
- Kept: a pane open behind another pane's tab closes on the command rather than coming forward: whether `$.ui.open` brings a tab forward is not said, and the toggle stays the spec's.
- Kept: no `immediate: true` on the command, so `/binnacle-pane` typed during a turn runs when it ends. The spec does not ask for it.
- Kept: `PaneButton` stays exported, as part of the exported `View`.
