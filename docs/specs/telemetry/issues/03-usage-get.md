# 03: `usage.get` and `usage_get`

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/telemetry/spec.md`

**What to build:** a session asks for a project's usage, or one Task's usage with its runs, over MCP. Decided in the spec, under *`usage.get` and `usage_get`*.

- [ ] `usage.get` takes the caller's path and an optional Task id in the forms `task.get` takes, and runs the ingest first as the snapshot does.
- [ ] Without a Task: the project's totals over the whole ingested window, per Task and unassigned, with a limit and remainder.
- [ ] With a Task: its totals and its runs newest first, with a limit and remainder; each run carries id, harness, provider, model, role, branch and its source, Task, parent run, start, latest activity, `active` and totals.
- [ ] An unknown Task id is `task.not_found`; a Task with no runs is an empty list.
- [ ] `usage_get` takes one optional argument, `task`, and maps one-to-one onto `usage.get`. The MCP smoke test lists it and calls it once.
- [ ] `docs/03-mcp-and-skills.md` lists `usage_get`.
- [ ] The write-guarantee test's input table includes `usage.get`.
