# 03: Projects and Project, brief or full, and the board card

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** the Projects and Project pages' widgets in the shared frame, each *Brief* as the spec's user stories say (15 to 18), and the board card's fixes (stories 28 to 30): its mark for a Task In progress from its runs reads plainly in both languages, never as "no runs"; a running card shows its run's elapsed time from its start beside its latest activity, such as "идёт 15 мин · активность 7 с назад"; Task ids are shown in full.

- [ ] Each widget of both pages has the control; *Brief* shows what the stories name, *Full* everything `docs/04-telemetry-dashboard.md` lists.
- [ ] The card's reading from runs has a clear label in English and Russian, still marked as Binnacle's reading (ADR-0032).
- [ ] A running card shows its elapsed time and its latest activity.
- [ ] No Task id is cut on either page.
- [ ] New strings are in both dictionaries, and the dictionaries' test passes.
- [ ] Checked in a browser: both pages at both levels, in light and dark, English and Russian.
