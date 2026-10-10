# 04: What waits for the owner, everywhere

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer

**What to build:** the snapshot's `pendingDecisions` section, replacing its placeholder, lists what only the owner can move: the unanswered questions, the Tasks in `READY_FOR_REVIEW`, and the `ready-for-human` Tasks ready to start (spec, *Waiting for the owner*). Each Task item of the snapshot gains `questions: { asked, unanswered }`. The daily carries the same section; `/binnacle:product` and `/binnacle:daily` present it; the vault's snapshot and daily notes carry it; the dashboard's project page shows it and the board marks a card with an unanswered question.

- [ ] Daemon tests: each of the three lists filled and empty, with the snapshot's limit and remainder, a question read from a branch named with it, and the section unavailable with the tracker's reason when Tasks cannot be read.
- [ ] Each snapshot Task item has `questions: { asked, unanswered }`.
- [ ] `daily_get` carries the section as of now; `daily.test.ts` covers it.
- [ ] `/binnacle:product` and `/binnacle:daily` (plugin and copy) present it as *Waiting for the owner*.
- [ ] The vault's snapshot and daily notes carry it; `vault.test.ts` covers it.
- [ ] The project page shows it in place of *Not available*, the board marks a card with an unanswered question; strings in English and Russian; checked in a browser.
