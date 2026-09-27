# 06: The exit demonstration of the redesign

Status: DONE
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 07, 08, 09, 10, 11, 12
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** epic 6's exit criterion, demonstrated by the owner on their running daemon after `pnpm dashboard:generate`. Decided in the spec, under *Further Notes*.

- [x] The Overview opens in the browser's language.
- [x] Switched to the other language, it keeps the choice across a reload.
- [x] The "What's next" block shows the Next action and Binnacle's alternatives, each labelled, and the owner takes a step from it in a fresh session without asking an agent what to type.
- [x] Ready to start says "in any order" and how many Tasks can run in parallel.
- [x] Every page holds at 1024 px, in light and in dark.
- [x] The browser's network log shows requests to the daemon only.
- [x] The owner records under `## Comments` whether the dashboard is now easy to follow, in both languages. Defects are filed as tickets, and the roadmap marks epic 6 done only when none is open.

## Comments

- **The owner's findings, 2026-09-27**, on the dashboard as tickets 01 to 05 left it, given in a Product session with a screenshot of the Usage page:
  - **The content does not fill the window.** Every page sits in a centred column of 1,120 px. Filed as ticket 07.
  - **The palette is darker than the mockup's.** Only the accent was taken from it; the neutrals are Tailwind's `zinc`. Filed as ticket 08.
  - **The Usage page is less compact than the mockup's.** Its rows take two lines, and its token table adds a column and a row. Filed as ticket 09.
  - **A Settings page is needed**, and the language choice belongs there rather than on the main screen, since more languages will come. The owner chose a page that shows the language and, read-only, the project's and the daemon's settings. Filed as ticket 10.
- **What follows.** This demonstration is run again once tickets 07 to 10 are done, so it now waits on them.
- **The owner's second demonstration, 2026-09-27**, on the dashboard as tickets 07 to 12 left it: every criterion above holds, and the owner finds the dashboard easy to follow in both languages. The owner also checked the criteria tickets 07 to 10 left to them. No defect was found, so no ticket is filed and epic 6 is done.

### Review

None: this ticket changed no code, only this ticket, tickets 07 to 10 and the roadmap.
