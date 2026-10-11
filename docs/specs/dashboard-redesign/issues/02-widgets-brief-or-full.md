# 02: Widgets brief or full, on the Overview and Attention

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** the shared widget frame with its *Brief* / *Full* control (spec, *A widget with two levels*), and the Overview's and the Attention page's widgets in it, each *Brief* as the spec's user stories say (11 to 14). The level is kept in the browser per widget and page, *Brief* when nothing is stored or storage is unavailable; a long list or text folds in place with a control to unfold it. "What's next" has no control and is always in full.

- [x] Each Overview widget but "What's next", and the Attention page's, has the control; *Brief* shows what the spec's stories name, *Full* everything `docs/04-telemetry-dashboard.md` lists for it.
- [x] A widget's level survives a reload, and the page renders in *Brief* when the browser's storage throws.
- [x] Long lists and texts fold in place and unfold on request.
- [x] The control's labels are in both dictionaries, and the dictionaries' test passes.
- [x] `docs/04-telemetry-dashboard.md` describes the two levels.
- [x] Checked in a browser: both levels in light and dark, English and Russian.

## Comments

The frame is `components/Widget.vue`: `<Widget page="…" widget="…" :title="…">`, with an `aside` slot before the control, a `title` slot for a heading of its own, and `full` given to the default slot and the footer. The level lives in `app/widget.ts`, Nuxt-free and tested, under `binnacle.widget.<page>.<widget>`. Lists fold with `FoldedList` (rows of the caller's `<ul>`, keyed by `by`, after `LIST_FOLD`, 6) and texts with `FoldedText` (after six lines); `AttentionItems` renders attention items at either level. Tickets 03 and 05 put their widgets in the same frame and widen the paragraph `docs/04-telemetry-dashboard.md` gives the two levels.

Readings taken where the stories leave room: "Up to N can run in parallel" waits for *Full* with the conflict risk it comes from; a Brief attention list shows its first three messages and unfolds in place, codes staying in *Full*; on the Attention page a run in *Brief* names its project too, since the list spans projects; the Overview's line of usage is a link, not a widget, and has no control.

Checked in a browser at 1024 px against a temporary daemon, with this repository and a fixture project holding five attention items, one of them long: both pages at both levels, light and dark, English and Russian; a level survives a reload; with the widget keys' storage throwing, every widget renders *Brief* and still switches; a list of ten recent runs folds after six, the long message after six lines, and both unfold and fold back. Nothing scrolls sideways.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground. The ticket names no role beyond the Developer and the Reviewer.

**Standards: no hard violation.** To fix:

1. **Folded rows were keyed by position** **Fixed** in fb643f2. (`apps/dashboard/app/components/FoldedList.vue`): `:key="index"` replaced the ids the rows had, so an unfolded text or a "Copied" state would move to another row when a poll reorders the list. Fix: a `by` prop each caller sets to the row's id.
2. **The levels were spelled twice** **Fixed** in fb643f2. (`Widget.vue`, `widget.ts`): `LEVELS` in the component beside the `Level` type. Fix: `widget.ts` exports `LEVELS` and derives `Level` from it.

Kept:

3. The Overview's run row beside `RunRow`: the two show different details in *Full*, the Overview's without project or checkout, as `docs/04-telemetry-dashboard.md` lists them.
4. The Project board's own fold of Done: ticket 03's page.
5. A third `try`/`catch` around `localStorage`: three lines at each site, each with its own fallback.
6. `page` and `widget` as plain strings: two literals at each call, read nowhere else.
7. The storage passed into `readLevel` and `storeLevel`: the test's seam, defaulting to `localStorage`.
8. `showLess` beside `showFewer`: English says "fewer" of rows and "less" of a text.
9. No `aria-controls` on the fold toggles: the content they fold sits right above them, and `aria-expanded` says their state.

**Spec: nothing missing.** To fix:

10. **The doc said every widget was in the frame** **Fixed** in fb643f2. (`docs/04-telemetry-dashboard.md`): it named stories 11 to 24 while only the Overview and the Attention page have the frame. Fix: it names those two pages and stories 11 to 14.
11. **A Brief run on the Attention page did not say its project** **Fixed** in fb643f2. (`RunRow.vue`): the list spans projects, so a run without a Task said nothing of where it ran. Fix: the project's name stays in *Brief*, harness, model, role, branch and checkout in *Full*.
12. **The line of usage had no word on its missing control** **Fixed** in fb643f2. (`docs/04-telemetry-dashboard.md`): it says the line is a link, not a widget.

Kept:

13. Task ids kept whole on the rows this ticket touched: story 28 holds for every page, and the rows were rebuilt here.
14. "Up to N can run in parallel" in *Full*: it comes from the conflict risk story 12 sends to *Full*; the owner confirms each *Brief* at the demonstration.
15. A Brief attention list unfolds to every message: folding in place is the spec's rule for a long list, and the codes stay in *Full*.
