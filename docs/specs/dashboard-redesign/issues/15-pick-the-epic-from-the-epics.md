# 15: The board's epic picked from the epics' column, which folds

Status: DONE
Triage: ready-for-agent
Blocked by: 14
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** the owner, 2026-10-12, after ticket 14: on the Project page the epics' column on the left lists every epic and cannot be clicked, while a row of numbered tabs over the board picks its epic. The owner's first wish is to click an epic in the column. An epic in the column picks the board's epic, as the tabs did, and the tabs go: the board's header keeps its epic's number, name and status. The column folds to a narrow strip of the epics' numbers, still picking the board's epic, so the board gets the width, and unfolds again; the choice is kept in the browser, as a widget's level is.

- [x] Clicking an epic with a spec, or the current one, in the column shows its board; the board's epic is highlighted there. An epic with neither cannot be picked, as before.
- [x] The board's header has no tabs, and still names its epic and its status.
- [x] The column folds to a strip of numbers and unfolds, the choice kept in the browser; folded, a number still picks its epic and says its name and status in its tooltip.
- [x] New strings are in both dictionaries; the dashboard's tests pass.
- [x] `docs/04-telemetry-dashboard.md`, *Project*, says so.
- [x] Checked in a browser: unfolded and folded, light and dark, English and Russian.

## Comments

Each row of the epics' column picks the board's epic, by a click on the row or on its name, a link for the keyboard; an epic without a spec picks nothing unless it is the current one, as the tabs were disabled. The tabs over the board are gone; its header keeps the epic's number, name and status. A button in the column's header folds it to a 4.5rem strip of the epics' numbers, each a button that picks its epic, with its name and status in its tooltip, disabled where the row picks nothing; a button at the strip's head unfolds it. The choice is kept as `binnacle.widget.project.epics.folded`, beside the widget's level (`readFolded`, `storeFolded` in `app/widget.ts`, tested in `widget.test.ts`). Under 1360 px the column, or the strip, follows the board, the strip's numbers wrapping in a row.

Checked in a browser against a temporary daemon on this repository: at 1440 px, clicking "Minimal dashboard" shows epic 5's board and highlights its row; folded, the board takes the width, 16 in the strip shows epic 16's board, 12 is disabled, the strip survives a reload and unfolds; light and dark, English and Russian; at 1024 px nothing scrolls sideways and no text is below 13 px.

### Review

Reviewed by the session itself over the diff, the change being one page, two storage functions and two strings.

1. **The epic's address was built twice**, in `pick` and in the name's link (`pages/project.vue`). **Fixed** in its own commit: one `epicQuery`.

Kept:

2. The folded strip is a plain card, not the shared widget frame: a 4.5rem strip has no room for a title or *Brief* / *Full*, and has one level.
3. A title that picks nothing is dimmed, where the tabs dimmed the number: the column is where the epic is picked now.

### After the owner's check, 2026-10-12

The owner clicked epics and saw the board stay as it was. The owner's daemon takes 3 to 10 seconds to read another epic's board, and the page kept the old board, its header and its highlight until the answer came. Now the picked epic is read from the address: its row is highlighted and the board's header names it at once, and the old board gives way to the skeleton until the daemon answers. Checked in a browser: 150 ms after a click the header reads "7 Audit and adopt" over the skeleton. The fold button now stands before the column's title, as the owner asked.
