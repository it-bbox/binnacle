# 13: Widgets laid out without gaps

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** found by the owner at the exit demonstration (09, 2026-10-12). The Usage page sets its widgets in rows of a grid (`apps/dashboard/app/pages/usage.vue`), so a short widget beside a tall one leaves a large empty space under it, and the page reads as a jumble. The Overview's and the Project page's rows of widgets do the same. Widgets of different heights are laid out so that none leaves a hole under it: each column flowing on its own, or another arrangement found in dashboard layout practice, the widgets' order kept as `docs/04-telemetry-dashboard.md` lists them. A widget switched to *Full* or unfolded moves the ones below it, never over them.

Done with the Impeccable and UI UX Pro Max skills, as the epic's other tickets were. Ticket 12 owns the Project page's epics and board; this ticket the rows of widgets around them.

- [ ] On the Usage page of this repository, in *Brief* and in *Full*, no widget has an empty space under it taller than the gap between widgets, at 1440 and 1024 px.
- [ ] The same on the Overview and the Project page's rows of widgets.
- [ ] Nothing scrolls sideways, and the reading order stays the documented one.
- [ ] Checked in a browser: both levels, light and dark, English and Russian.
