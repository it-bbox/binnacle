# 04: The Project and Task pages, to the mockup

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** the Project page with its board and the Task page are rebuilt to the mockup in both languages, keeping everything epic 5 showed. Binnacle's truth wins over the mockup's invented data. Decided in the spec, under *The shell and pages*, and in the brief, under *The mockup*.

- [ ] The Project page lists the roadmap's epics with their status and spec link.
- [ ] The Project page's mini kanban shows one epic, the current one by default, with a switcher, in four columns: Backlog, Ready, In progress, Done.
- [ ] A card shows its id, title, Unmet dependencies, `BLOCKED`, and whether a `DONE` Task has a Review. It shows no invented review state.
- [ ] An In progress card read from runs is marked "from runs" and names harness, model, role and latest activity, with a live dot while it runs.
- [ ] Done is collapsed to its count and its latest cards.
- [ ] The Task page shows id, title, state, triage, Blocked by, spec and ticket paths, and branch.
- [ ] The Task page shows the start command with a copy button, labelled as resuming it for a Task In progress from runs, and none for `DONE` or `CANCELLED`.
- [ ] The ticket's body and its Review are plain text with their line breaks kept, and "no Review yet" appears when there is none.
- [ ] The runs appear as a timeline (harness, model, role, branch, checkout, start, latest activity, tokens), with the Task's implementation usage. Review usage, rework usage, and questions and answers show "Not available" with their reasons.
- [ ] Pending decisions and CI show "Not available" with the daemon's reasons.
- [ ] Both pages read well in English and Russian, in both themes and at 1024 px. The components they no longer use are removed.
