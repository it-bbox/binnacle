# 02: The Overview's state, and what can run in parallel

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** the Overview is rebuilt to the mockup, everything but the "What's next" block. It shows the epic's progress, what is running, attention and a line of usage. Ready to start reads as a set in any order and says how many Tasks can run in parallel, which the snapshot now computes. Decided in the spec, under *Parallel capacity* and *The shell and pages*.

- [ ] The snapshot's `tasks` gains `parallel`, labelled `calculated`:
  - `limit`: the manifest's `automation.max_parallel_development_tasks`, or 2 where it writes none;
  - `inProgress`: the Tasks in flight;
  - `free`: `limit` less `inProgress`, never below zero.
- [ ] Tests through the daemon seam cover `parallel` with the manifest's limit, with the default, and with `free` at zero.
- [ ] The Overview shows the roadmap's epics as a compact stepper, and the current epic's Tasks done out of all, leaving out `CANCELLED`, from `task.list`.
- [ ] Running now lists each run with its Task's id and title, or its role, plus harness, model, branch and latest activity. It says that "running" is Binnacle's reading of recent activity, and shows "nothing" when nothing runs.
- [ ] Ready to start is labelled "in any order". Each Task has its start command with a copy button.
- [ ] Ready to start says "up to {free} can run in parallel" when `free` is at least one and either two or more Tasks are ready or a Task is in progress.
- [ ] The current epic's `READY` Tasks that wait on an Unmet dependency appear dimmed, with "waits on NN", from `task.list`'s Ready column.
- [ ] Attention lists each item's message in the daemon's English and its code. A line shows today's and the last seven days' output tokens, linking to the Usage page.
- [ ] A project whose roadmap cannot be read and a project with no Tasks each show their state, with the snapshot's reason.
- [ ] The Overview reads well in English and Russian, in both themes and at 1024 px.
- [ ] `docs/03-mcp-and-skills.md` describes `tasks.parallel`.
