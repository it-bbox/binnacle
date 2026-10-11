# 05: The exit demonstration of epic 18

Status: DONE
Triage: ready-for-human
Blocked by: 01, 02, 03, 04
Spec: `docs/specs/lean-flow/spec.md`

**What to build:** epic 18's exit criterion, demonstrated by the owner on this repository (spec, *Further Notes*). Whether the flow got cheaper is read after epic 16's autopilot run by a Product session, not here.

- [x] The usage page and `usage_get` show epic 11's Tasks with review and rework apart by the rule read from runs.
- [x] A question with options, committed to a Task branch by hand if no agent asked one, shows in the snapshot; `/binnacle:answer` shows it in Russian with its options, explains them on request, and writes the owner's choice, which `task_get` reads without the date line.
- [x] `pnpm test` passes several times in a row.

## Comments

### Question

The usage page opens authorised only in the owner's browser, so this session cannot see it; `usage_get` shows epic 11's Tasks with review and rework apart. Does ticket 05 wait for the owner's look at the usage page before it is marked DONE?

- Wait for the owner's look (recommended): as epic 11's demonstration did; one look at the dashboard before the ticket closes.
- Close on `usage_get` alone: no wait; the page's half of the first criterion rests on the seam it shares with `usage_get`, unseen.

### Answer

2026-10-11

Wait for the owner's look (recommended): as epic 11's demonstration did; one look at the dashboard before the ticket closes.

### Demonstration, 2026-10-11

Run with the owner in this ticket's session, on its own branch as the carrier.

1. `usage_get` read every implemented Task of epic 11 with review and rework apart by the rule read from runs; 12, run in a Product session, has no branch and reads none. The owner looked at the usage page: its rework share listed the-state-of-work/13 at 61% and 05 at 59%, and 05's Task page gave implementation, review and rework records and tokens equal to `usage_get`'s (69, 18 and 59 records).
2. A question with options, committed to this branch by hand, showed under the snapshot's `pendingDecisions.questions` with its branch. `/binnacle:answer lean-flow/05` showed it in Russian with its options, explained them on request, and committed the owner's choice; `task_get` read the answer without its date line.
3. `pnpm test` passed three times in a row, 714 tests each, none failed.

Found on the way:

- The dashboard reads poorly for the owner: the Task page renders the Review as one long block of text, and the usage page cuts Task ids short (`the-state…`), so a row does not say which Task it is. Input for epic 16.
- `usage_get`'s rework share and first-pass acceptance list ten Tasks and a remainder, so the page cannot show one epic's Tasks together; a Product session averaging an epic after epic 16's run reads each Task with `usage_get`'s `task`.
