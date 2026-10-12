# 13: Widgets laid out without gaps

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** found by the owner at the exit demonstration (09, 2026-10-12). The Usage page sets its widgets in rows of a grid (`apps/dashboard/app/pages/usage.vue`), so a short widget beside a tall one leaves a large empty space under it, and the page reads as a jumble. The Overview's and the Project page's rows of widgets do the same. Widgets of different heights are laid out so that none leaves a hole under it: each column flowing on its own, or another arrangement found in dashboard layout practice, the widgets' order kept as `docs/04-telemetry-dashboard.md` lists them. A widget switched to *Full* or unfolded moves the ones below it, never over them.

Done with the Impeccable and UI UX Pro Max skills, as the epic's other tickets were. Ticket 12 owns the Project page's epics and board; this ticket the rows of widgets around them.

- [ ] On the Usage page of this repository, in *Brief* and in *Full*, no widget has an empty space under it taller than the gap between widgets, at 1440 and 1024 px.
- [x] The same on the Overview and the Project page's rows of widgets.
- [x] Nothing scrolls sideways, and the reading order stays the documented one.
- [x] Checked in a browser: both levels, light and dark, English and Russian.

## Comments

Each row of widgets is at most two columns, each a stack whose widgets follow one another, read down then across in the documented order: Usage is tokens by kind, by model, by Task, then derived metrics, harnesses, cost; the Project page's last row is the checkout and the graph, then decisions and CI. Nothing follows such a row on its page, so the Overview's line of usage now ends the column of Running now and Attention instead of standing under the row, where the shorter column left a hole above it. `docs/04-telemetry-dashboard.md` says so. Stretching each column's last widget to the row's height was tried first and dropped: on the Usage page in *Full* it left about 1700 px empty inside By Task.

Checked in a browser against a temporary daemon on this repository, measuring the space under every widget: at 1440 and 1024 px, *Brief* and *Full*, light and dark, English and Russian, the space under a widget inside its column is the gap between widgets, and no page scrolls sideways. At 1024 px the Overview and Usage are one column; the Project page's last row stays two. Two cases are left: the Project page's board, with 395 px (*Brief*) and 1120 px (*Full*) beside the taller epics, ticket 12's arrangement; and Usage in *Full* at 1440 px, where By Task's column ends about 1700 px above the end of derived metrics beside it (*Question* below), so the first criterion stays unticked.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground.

**Standards.** No hard violation.

1. Fixed: the test's helpers `open` and `own` named what they do not hold (`apps/dashboard/test/widget-layout.test.ts`): renamed `meaningful` and `outsideBoard`.
2. Fixed: a test name, "never wrapping into a second row", claimed more than it checks: now "are at most two columns side by side".
3. Fixed: "leave nothing under them" could pass on no row at all: it now asserts it found one.
4. Fixed: the doc's "Running now and attention items" mixed a title and an item: now "Running now and Attention".
5. Kept: the subject of 572c444 ends on "the Overview's", its noun implied; within the rules, and history stays as committed.
6. Kept: the test reads the pages by indentation, as the dashboard's other source tests do; the browser check covers the rendering.
7. Kept: the same short comment on the Usage and Project rows: two lines, no component worth adding for them.

**Spec.**

8. Left, for the owner: Usage in *Full* at 1440 px, By Task's column ends about 1700 px above the end of derived metrics (*Question* below). Derived metrics across the full width, suggested, keeps its height, its sections stacking, and puts holes above and below it in both levels.
9. Kept: the Overview's line of usage moved into the second column: still last, as documented, and no hole above it.
10. Kept: the layout test was not asked for: the process asks for one first.
11. Kept: the doc's sentence describes the arrangement; whether a column ending at the page's end is a hole is the *Question*.
12. Kept: the room under the Project page's board beside the taller epics: ticket 12 owns them, and recorded its decision for the demonstration.
