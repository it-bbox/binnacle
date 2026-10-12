# 12: The Project page leads with the board

Status: READY
Triage: ready-for-agent
Blocked by: 10
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** found by the owner at the exit demonstration (09, 2026-10-12). The epics table fills the page's width and most of its first screen with little in it, a number, a name and a status per row, and the board, which the page is for, starts below the fold. The board comes up to the first screen and the epics take the room their content needs.

The owner's lead: the epics in a narrow column beside the board, the board on the left. Another arrangement that brings the board to the first screen and keeps the epics compact is open, judged by the owner at the demonstration. The epics keep what they show at each level today (ticket 03), and picking an epic still picks the board's tab. Nothing else on the page changes.

Done with the Impeccable and UI UX Pro Max skills, as the epic's other tickets were.

- [x] On this repository at 1440 × 900 and 100% zoom, the board's columns start on the first screen.
- [x] The epics show their number, name and status in *Brief*, and their spec in *Full*, without filling the page's width.
- [x] At 1024 px the page still reads, nothing scrolling sideways.
- [x] `docs/04-telemetry-dashboard.md`, *Project*, says where the epics stand if it changes what it describes.
- [x] Checked in a browser: both levels, light and dark, English and Russian.

## Comments

The owner's lead, taken as is: *Waiting for the owner*, then the board and, beside it on the right, the epics in a 20rem column, from 1360 px wide; under 1360 px the board's columns would be too narrow beside them, so the epics follow the board at the page's width. *Brief*: number, name and status, names wrapping rather than cut. *Full*: each epic's spec on a line of its own under its name and status, where its path has room, and still a link that picks the epic on the board. `docs/04-telemetry-dashboard.md`, *Project*, lists the epics after the board and says where they stand. Checked in a browser against a temporary daemon on this repository: at 1440 × 900 the board's columns start at 419 px; at 1024 px the epics follow the board and the page scrolls nothing sideways; both levels, light and dark, English and Russian.

A decision, for the owner's demonstration: in *Brief* this repository's 18 epics stand about 300 px taller than the board, which leaves room under the board before Usage. The epics keep the room their content needs, as the ticket asks, rather than scrolling inside the board's height or cutting their names.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground. Nothing to fix.

**Standards.** No hard violation. Kept:

1. The current epic's highlight and the `border-b` written on each row and cell: two rows per epic in *Full*, each a line.
2. `ps-` / `pe-` in the epics' cells: their padding is uneven, the column edges wider than between cells.
3. `gap-x-2.5` between the board and the epics: the gap of the page's other row of widgets.
4. 1360 px written in `docs/04-telemetry-dashboard.md`: the document says where the epics stand.

**Spec.** Kept:

5. The room under the board in *Brief*: the epics take the room their content needs, as the ticket asks; the owner judges the arrangement at the demonstration (*Comments* above).
6. "Checked in a browser" not shown to the reviewer: checked, both levels, light and dark, English and Russian (*Comments* above).
7. The spec on a row of its own in *Full*: the epics still show their spec in *Full*, where its path has room.
8. The epics' line in the document is long: it says where they stand, which the ticket asks.
9. The epics' rows still pick nothing in *Brief*: as on `main`, the board's tabs pick an epic at either level.
10. The Usage table's own sideways scroll at 1024 px: as on `main`, inside its widget; the page scrolls nothing sideways.
