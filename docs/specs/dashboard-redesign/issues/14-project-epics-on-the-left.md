# 14: The Project page's epics on the left of the board

Status: DONE
Triage: ready-for-agent
Blocked by: 12
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** the owner, 2026-10-12, after ticket 12 merged: the epics' column goes on the left of the board, the board on the right; the owner's lead in 12 named the wrong side. Under 1360 px the board still comes first and the epics follow it at the page's width.

- [x] From 1360 px wide the epics stand in their 20rem column on the left, the board on the right.
- [x] Under 1360 px the board comes first, the epics after it.
- [x] `docs/04-telemetry-dashboard.md`, *Project*, says the epics stand on the left.
- [x] Checked in a browser: both levels, light and dark.

## Comments

The grid's columns are now `20rem` then the board, and the epics, after the board in the page's order, take `order-first` from 1360 px wide, so under it the board still comes first. Checked in a browser against a temporary daemon on this repository: at 1440 px the epics on the left and the board on the right, in light; at 1024 px the board first, the epics after it, nothing scrolling sideways, in dark. Both levels look the same as ticket 12's apart from the side.

### Review

Reviewed by the session itself, since the change is three class attributes and one line of the docs: no finding. The dashboard's tests (43), both typechecks and the type scale and layout tests pass.
