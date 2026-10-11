# 03: Projects and Project, brief or full, and the board card

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** the Projects and Project pages' widgets in the shared frame, each *Brief* as the spec's user stories say (15 to 18), and the board card's fixes (stories 28 to 30): its mark for a Task In progress from its runs reads plainly in both languages, never as "no runs"; a running card shows its run's elapsed time from its start beside its latest activity, such as "идёт 15 мин · активность 7 с назад"; Task ids are shown in full.

- [x] Each widget of both pages has the control; *Brief* shows what the stories name, *Full* everything `docs/04-telemetry-dashboard.md` lists.
- [x] The card's reading from runs has a clear label in English and Russian, still marked as Binnacle's reading (ADR-0032).
- [x] A running card shows its elapsed time and its latest activity.
- [x] No Task id is cut on either page.
- [x] New strings are in both dictionaries, and the dictionaries' test passes.
- [x] Checked in a browser: both pages at both levels, in light and dark, English and Russian.

## Comments

Both pages' widgets sit in `Widget.vue`: on Projects the table, on Project the epics, *Waiting for the owner*, the board, usage by role, the checkout, the graph, decisions and CI. The board card's run carries its `startedAt` from `task.list`, and the card reads "running 15 min · active 7 sec. ago", "идёт 15 мин · активность 7 сек. назад", through `duration` in `i18n/index.ts`. Its mark from runs reads "In progress: it has runs", "In progress: есть runs", with the calculator icon the Overview gives Binnacle's readings and the ADR-0032 tooltip. Ids wrap at their hyphens (`break-words`), never cut.

Readings taken where no story names a *Brief*: the epics table leaves its spec column to *Full*, the board's tabs picking an epic at either level; usage by role shows input and output, as story 21 does for the usage page (`BRIEF_FIELDS`, beside `FIELDS`); the checkout's one line is the same at both levels, cut to the width in *Brief*; *Waiting for the owner*'s lists show their first item in *Brief* and unfold in place, as ticket 02's attention list does; a card's mark from runs stays in *Brief*, as ADR-0032's label for the column it stands in.

Checked in a browser at 1024 px against a temporary daemon with this repository registered, epic 16's board holding this ticket In progress from its own run: both pages at both levels, light and dark, English and Russian; the running card's time and activity; the Unmet dependency and BLOCKED marks in *Brief* and their details in *Full*; no Task id cut and nothing scrolling sideways. *Waiting for the owner* and CI had nothing to list (GitHub rate-limited the reading), so their lists were read in the code, on `FoldedList` as ticket 02 checked it.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground. The ticket names no role beyond the Developer and the Reviewer.

**Standards: one hard violation.** To fix:

1. **The Project page's lists did not fold in *Full*** **Fixed** in 8db6023. (`pages/project.vue`): `docs/04-telemetry-dashboard.md` folds a list after six rows, and the questions, approvals, owner's Tasks, decisions and pull requests rendered whole; a question's text was clamped to three lines with no way to open it. Fix: each list in `FoldedList`, the question in `FoldedText`.
2. **The graph's and CI's lines were written twice** **Fixed** in 8db6023. (`pages/project.vue`): *Brief* and *Full* repeated the built-from and the default branch's markup. Fix: one line each, cut in *Brief*, with *Full*'s extras after it.
3. **`BRIEF_FIELDS` sat on the page and claimed the usage page used it** **Fixed** in 8db6023. Fix: it moved beside `FIELDS` in `composables/usage.ts`, its comment citing story 21 alone, for ticket 05 to reuse.
4. **Questions were keyed by position** **Fixed** in 8db6023: `FoldedList` keys them by Task and text.

Kept:

5. The `snapshot.pendingDecisions.…` and `board.data.value.columns[key]` chains: the page's style before this ticket, unchanged in kind.

**Spec: nothing missing beyond the fold.** To fix:

6. **The fold on the Project page** **Fixed** in 8db6023, as 1.
7. **The ticket said READY, no box ticked** **Fixed** in this Review's commit and the next.

Kept:

8. "активность 7 сек. назад" against the story's "7 с назад": the story says "such as", and every other relative time on the dashboard reads the same way.
9. The board's columns and the Projects table do not fold after six: a column is the daemon's ten cards with a remainder, Done keeps the fold of three its documented view gives it, and a table row has no list to fold into.
10. The board's list of Tasks in an unknown state does not fold: it appears only when a tracker value is broken, and each row is an error to read.
