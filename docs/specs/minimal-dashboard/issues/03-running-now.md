# 03: What is running now, and who runs it

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** the dashboard and the Product Snapshot show what is running now and who runs it, and what ran recently. Decided in the spec, under *The snapshot*.

- [ ] The observed run carries its checkout: the root of the checkout its records' `cwd` lies in.
- [ ] The snapshot gains `activity`, and each run in it is as `usage.get` gives it, with its Task's title and its checkout:
  - `running`: the project's runs active now, with the section limit and a remainder;
  - `recent`: its latest other runs, up to the section limit.
- [ ] The Overview shows each project's runs running now: the Task, or the role when there is none, and the harness, model and latest activity.
- [ ] The Attention/current activity page lists every project's attention items with their codes, and the runs running now and recently.
- [ ] The Projects page shows each project's latest activity.
- [ ] The `product` skill shows `activity.running` beside the Tasks in flight.
- [ ] Tests through the daemon seam cover:
  - running and recent, split at telemetry's recency;
  - a run in a linked worktree, with its checkout;
  - an unassigned run;
  - a Product session's run, with the `product` role.
