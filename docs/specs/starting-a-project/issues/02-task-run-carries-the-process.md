# 02: /binnacle:task run carries a ticket's process

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/starting-a-project/spec.md`

**What to build:** a ticket is worked by Binnacle's own skill, which holds the whole per-ticket process (spec, *`/binnacle:task run <ticket>`*). The `task` skill takes `run` and a ticket path, URL or Task id; without `run` it gives the brief, as today. It becomes model-invocable, and `run` starts only when a human or autopilot's brief asks for it. The run reads the Task through `task_get`, or from the ticket when the daemon is down; refuses a Task `DONE`, `CANCELLED` or with an Unmet dependency, saying why; resumes an unmerged branch by rebasing it onto `main`, or branches `feat/<slug>` from an up-to-date `main`; implements test-first, typechecks and runs the full suite; reviews the branch against `main` in a sub-agent where the harness can start one, on the project's standards and the ticket's spec and each role its `Roles:` line names; records the Review short; ticks the criteria; makes `Status: DONE` the last commit; leaves the roadmap alone; never merges, pushes or touches `main`. A question only the owner can answer is asked in the chat when the owner is there, and recorded in the ticket with its options when unattended. `docs/workflow/02-development-workflow.md`'s *Per ticket* starts from this command and keeps no second copy of the rules; `/binnacle:help` lists `run`.

- [ ] `/binnacle:task`, in the plugin and the skills copy, takes `run` and carries the process above; the package build's test checks its text, that it is model-invocable, and that the copy matches the plugin.
- [ ] Without `run`, the brief is unchanged.
- [ ] *Per ticket* in the development workflow points to `/binnacle:task run` instead of `/mattpocock-skills:implement`.
- [ ] `/binnacle:help` names `run`.
