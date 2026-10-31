# 02: The write-up from Binnacle's usage data

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** a write-up that tells what Binnacle's own work cost and where the tokens went, kept to summary aggregates, for the site to show and the README to link to (the spec's *The write-up keeps to summary aggregates*).

- [x] Usage is broken down by role — product, implementation, review, rework — with tokens.
- [x] Usage is broken down by model.
- [x] The rework share and first-pass acceptance are given.
- [x] Weekly trends are given.
- [x] No individual ticket or task is named.
- [x] Every number is read from Binnacle's own usage data and matches `usage_get` at the date of writing; a calculated reading is marked as such.

## Comments

### Review

Reviewed the branch against `main` on 2026-10-31, in a sub-agent separate from the implementation, on two axes: the project's standards and the ticket's spec.

**The write-up** is `docs/showcase/write-up.md` and its Russian twin `docs/showcase/write-up.ru.md`: a reading of Binnacle's own store on 2026-10-31, kept to summary aggregates, with no ticket, task, session, branch or path named and no assistant attribution.

Fixed:
- *The method* claimed every figure matched `usage_get`, which cannot be true for the model table: `usage_get` has no by-model grouping. It now says the totals, the breakdown by role, the weekly totals and the derived readings match `usage_get` on that date, and that the model breakdown is read from the same stored records, counted the same way.
- The model and weekly tables now say that a partial counter's zero can be an unreported kind, not a measured one.
- The mean-per-completed-Task line now says it is taken over the 200 Tasks with attributed runs, not the 50 without.
- Wording: "says the missing ones as no data" became "reports the missing ones as no data"; three Russian phrases were rewritten ("писался" → "создавался", the doubled genitive in the opening, and the "Прочие модели" sentence).

Kept:
- The `unknown` role row stays: it is Binnacle's own role for work it cannot place, the text explains it, and without it the role rows would not add up to the total.

Verified:
- The five role rows, the eight model rows and the seven weekly rows each add up exactly to the totals: 28,470 records, 2,845,108 input, 4,757,627,781 cached input, 114,658,043 cache creation, 19,990,342 output, 6,402,652 reasoning.
- The derived readings match `usage_get`: rework share 30.5% (calculated), first-pass acceptance 8.0% (calculated), 79.6 records and 54,354 output tokens per completed Task (calculated), 4.2 runs per Task with 3.3 subagent runs (calculated).
- Both pages link each other; the Russian twin is a translation of the English, with the dashboard's Russian terms for the token kinds and roles.

### Notes for the next tickets

- Ticket 05 (site): the write-up's text is at `docs/showcase/write-up.md` and `docs/showcase/write-up.ru.md`, one file per language and no site markup; render or embed them as they are. The figures are a frozen reading of 2026-10-31, mutually consistent across the three tables. If the page is built later and must carry a later date, re-read `usage_get` and refresh every table together, never one of them alone.
- Ticket 03 (README): link the site, which the spec makes the public surface; if the README links the write-up directly, use `docs/showcase/write-up.md`.
- No test was added, as the spec's *Testing Decisions* say: the write-up's numbers are checked against `usage_get` when it is prepared, not by an automated test.
