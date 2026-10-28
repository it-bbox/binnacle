# 01: `/binnacle:task` takes a ticket's path

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`
Roles: Developer, Reviewer

**What to build:** a ticket's path works wherever a Task id does (spec, *A ticket's path as a Task id*; product inbox, *The ticket brief takes a ticket's path*). `task.get` reads a path ending in `<spec-slug>/issues/NN-<name>.md`, relative or absolute, with or without the specs directory before it, as the Task `<spec-slug>/NN`, so `/binnacle:task <ticket path>`, `task_get` through MCP and `binn call task_get` give that Task's brief. The existing forms, `<spec-slug>/<NN>`, `#<number>` and `<number>`, read as before.

- [ ] Through `task.get`: a relative path, an absolute one and one without the specs directory give the Task `<spec-slug>/NN`.
- [ ] A path to a ticket the tracker does not hold is `task.not_found`, naming the path.
- [ ] `#3` and `3` on a remote tracker, and `<spec-slug>/6` on the local one, are unchanged.
- [ ] `/binnacle:task`'s text says it takes a ticket's path as well as a Task id, and the copies match the plugin (`apps/cli/test/pack.test.ts`).
