# 02: The start command, from the brief to the dashboard

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** every Task that can be started carries the one command that starts it:

- `/binnacle:task` ends with it;
- the main screen lists the Tasks ready to start, each with it;
- the Task page shows the brief with it.

Decided in the spec, under *The start command*.

- [ ] `packages/core` gives a Task's start command. When `workflow.provider` is `matt-pocock` and the Task is neither `DONE` nor `CANCELLED`, it is `/mattpocock-skills:implement <ticket>`, with the Task's ticket path or URL. Otherwise there is none.
- [ ] `task.get`'s brief carries it as `start`, and so do the snapshot's Tasks in flight and ready to start.
- [ ] The `task` skill ends with "To start it, in a fresh session:" followed by the command.
- [ ] When the Task has no start command, the `task` skill says why: the Task is `DONE` or `CANCELLED`, or the project's workflow is another one.
- [ ] The Overview lists each project's Tasks ready to start, each with its start command and a copy button.
- [ ] The Task page shows:
  - the brief: state, triage, dependencies with their states, spec, ticket, and the body as text;
  - its branch;
  - its start command, with a copy button.
- [ ] Copy buttons use the Clipboard API.
- [ ] Tests through the daemon seam cover `READY`, `DONE` and `CANCELLED` Tasks, another `workflow.provider`, and a remote Task's URL.
