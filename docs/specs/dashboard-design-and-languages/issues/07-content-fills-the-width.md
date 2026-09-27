# 07: The content fills the window's width

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** found by the owner in the exit demonstration (ticket 06, *Comments*): on a wide screen every page sits in a centred column of 1,120 px with empty margins on both sides. The content area right of the sidebar is fluid and fills the window's width, on every page and in the loading and unreachable states. Decided in the spec, under *Further Notes*, *Found in the exit demonstration*.

- [x] The content area of every page (Overview, Projects, Project, Task, Usage, Attention and Settings, once it exists) fills the width right of the sidebar, with the same side padding at every width, and no fixed maximum width.
- [x] Prose stays readable: the Next action's description and ticket bodies keep a measure of about 70 characters, while cards, tables and the board stretch.
- [x] The loading skeleton and the daemon-unreachable state follow the same layout.
- [x] At 1024 px nothing scrolls sideways, and at 1920 px and wider the pages' cards and columns use the width instead of leaving margins.
- [ ] Every page reads well at 1024, 1440 and 1920 px, in both themes. A human checks this; the steps are under `## Comments`.

## Comments

- **Where it lives.** `apps/dashboard/app/app.vue` holds the one content area every page, the loading skeleton and the unreachable state render in; it drops `mx-auto max-w-[1120px]` and keeps `px-8`, 32 px, at every width. The pages had no maximum of their own: their grids (`auto-fit` columns on the Overview, Task and Usage pages, two columns on Attention and Settings, four on the board) and the Projects table already stretch. `pages/task.vue` gives a ticket's body and its Review `max-w-[70ch]`, as `pages/index.vue` already gave the Next action's description; the cards around them stretch. No daemon operation changed, and the spec's *Testing Decisions* leave the pages unautomated, so there is no new test.
- **Decided here, where the ticket is silent:**
  - **The Review keeps the same measure as the ticket's body**, since it is the ticket's own text in the same kind of block.
  - **The unreachable state stays the mockup's centred message card of 520 px**, a message rather than a page's content, but in the full content area and with the pages' 32 px side padding (it had 40 px).
  - **"About 70 characters"** is `70ch` including the block's padding, so a ticket body line holds about 66 monospace characters.
- **The rule moved into the design brief**, under its decisions, as a change from the mockup, which still draws the 1,120 px column; the spec's *Found in the exit demonstration* note names the measure too.
- **Verified in a browser.** The generated dashboard ran against a daemon on a temporary `BINNACLE_HOME` and port, with this worktree registered. At 1024, 1440 and 1920 px, on the Overview, Projects, Project, Task, Usage, Attention and Settings pages, the content area was as wide as the space right of the sidebar (748, 1164 and 1644 px, 15 px less on a page that scrolls down), with 32 px on each side and nothing scrolling sideways; at 1920 px the Task page's cards ran in two columns of 773 px. The ticket body and its Review were 504 px wide at every width. With the daemon stopped, the unreachable card sat centred in the full content area, padded as the pages are. Not seen: the loading skeleton, which shows only until the first answer arrives; it now has the same classes as the pages' area.
- **Rebased onto ticket 08** (the mockup's palette), which merged first: no conflict, since 08's colour classes and these width classes touch different lines. After the rebase the typechecks and the full suite, 08's palette test among it, pass, and the pages measured the same at 1024 and 1920 px.
- **For the owner: the criterion left unticked.** "Reads well" is a judgement only a human makes. To check it on the running daemon:
  1. `pnpm dashboard:generate`, then `binn dashboard`.
  2. In the browser's device toolbar (responsive), set the width to 1920, then 1440, then 1024 px, and at each open Overview, Projects, Project, a Task from the board, Usage, Attention and Settings: the content reaches from the sidebar to the window's right edge with the same margin at each side, nothing scrolls sideways, and at 1920 px no page leaves an empty band on the right.
  3. On a Task page, the ticket's text and its Review wrap at about 70 characters inside cards that stretch; on the Overview, so does the Next action's description.
  4. Switch the system theme between light and dark and look at the pages again.
  5. Stop the daemon (`binn daemon stop`): the unreachable message sits centred right of the sidebar; `binn daemon start` brings the page back.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violations.** Findings, all judgement calls:

1. **`max-w-[70ch]` repeats** on the two `<pre>` blocks and the Next action's description. **Kept**: a utility class on each, as the dashboard writes its classes; a component for two blocks would be speculative.
2. **The branch was said not to be `feat/<slug>`.** **Left**: the reviewer read the worktree's first branch; the work is on `feat/content-fills-the-width`.
3. **The design brief cites the spec for the 70-character measure, which the spec did not state.** **Fixed**: the spec's note names the measure.
4. **The ticket had no `## Comments` or `DONE` yet.** **Fixed** by this commit.

**Spec: every criterion but the human one holds.** Findings:

5. **The Review's measure goes beyond the ticket**, which names ticket bodies. **Kept**: see *Decided here*.
6. **The unreachable state is still a centred card.** **Kept**: see *Decided here*; its container fills the content area with the pages' padding.
7. **At 1920 px a ticket's card is wider than its text**, leaving space on its right. **Kept**: the ticket asks for exactly that, cards that stretch and prose that keeps its measure; the owner's check above looks at it.
8. **The human check's steps were missing.** **Fixed**: above.
