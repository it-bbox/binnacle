# 06: The task brief — `task.get`, `task_get` and `/binnacle:task`

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** a session starts one Task with `/binnacle:task <id>` and gets a compact brief: the Task's fields, its dependencies with their titles and states, its spec's path, the ticket body without comments, and the branch name. It works on the local tracker and on GitHub. Decided in the spec, under *Task brief*, and *`task_get` and `/binnacle:task`*.

- [ ] `task.get` takes the caller's path and an id: `<spec-slug>/<NN>` on the local tracker, `#<number>` or `<number>` on a remote one.
- [ ] It returns identity, title, state, triage, ticket path or URL, the spec path as `Spec:` gives it, and each declared dependency with its title, state and whether it is met; a dangling one says so.
- [ ] The body is the text after the header block, up to the first `## Comments` heading on the local tracker, and the issue body after the header block on a remote one. It is cut at a fixed limit in code points with a truncation flag. Issue comments are never read.
- [ ] The branch name is `feat/<slug>` from the ticket's file name on the local tracker, and `feat/<number>-<slug>` from the issue title on a remote one: lowercased, runs of characters other than ASCII letters and digits turned into one hyphen, hyphens trimmed, cut to a fixed length.
- [ ] An unknown id is an error with code `task.not_found`; an unreadable tracker is an error carrying its tracker code.
- [ ] On the local tracker the ticket is read from the caller's checkout.
- [ ] `task_get` takes `id` and maps one-to-one onto `task.get`. The existing MCP smoke test lists it and calls it once.
- [ ] The `binnacle` plugin gains a `task` skill: detect, `task_get`, present the brief, state the branch name. It creates no branch, edits no `Status:`, and runs only when a human starts it.
- [ ] `docs/03-mcp-and-skills.md` lists `/binnacle:task` among the plugin's actions.
- [ ] Tests through the daemon seam on both trackers: dependencies in each case, the body cut, comments excluded, both branch forms, both errors.
