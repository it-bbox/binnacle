# 15: The board's epic picked from the epics' column, which folds

Status: READY
Triage: ready-for-agent
Blocked by: 14
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** the owner, 2026-10-12, after ticket 14: on the Project page the epics' column on the left lists every epic and cannot be clicked, while a row of numbered tabs over the board picks its epic. The owner's first wish is to click an epic in the column. An epic in the column picks the board's epic, as the tabs did, and the tabs go: the board's header keeps its epic's number, name and status. The column folds to a narrow strip of the epics' numbers, still picking the board's epic, so the board gets the width, and unfolds again; the choice is kept in the browser, as a widget's level is.

- [ ] Clicking an epic with a spec, or the current one, in the column shows its board; the board's epic is highlighted there. An epic with neither cannot be picked, as before.
- [ ] The board's header has no tabs, and still names its epic and its status.
- [ ] The column folds to a strip of numbers and unfolds, the choice kept in the browser; folded, a number still picks its epic and says its name and status in its tooltip.
- [ ] New strings are in both dictionaries; the dashboard's tests pass.
- [ ] `docs/04-telemetry-dashboard.md`, *Project*, says so.
- [ ] Checked in a browser: unfolded and folded, light and dark, English and Russian.
