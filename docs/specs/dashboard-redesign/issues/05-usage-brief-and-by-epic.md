# 05: Usage brief or full, and by epic

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** `usage.get` and `usage_get` take an optional epic, by its number in the roadmap, and the usage page offers the roadmap's epics with a spec (spec, *Usage by epic*). With an epic, its Tasks are those of the spec the roadmap names; tokens per completed Task, rework share and first-pass acceptance list every one of them, with no remainder, and the epic's averages, each `calculated`. An epic the roadmap does not list, or one with no spec, is an error with its reason. The page's widgets go into the shared frame, *Brief* as the spec's stories say (21 to 24), and no Task id is cut.

- [ ] Through the daemon's HTTP API, on a Git repository with tickets and session artifacts: `usage.get` with an epic lists every Task of it and the epic's averages; an unknown epic, and one with no spec, are refused with a reason.
- [ ] `usage_get`'s description and `docs/03-mcp-and-skills.md` name the epic.
- [ ] The usage page picks an epic and shows the same figures as `usage_get`, labelled as Binnacle's calculation.
- [ ] Each widget has the control, *Brief* as the stories say; Task ids are never cut.
- [ ] `docs/04-telemetry-dashboard.md` describes usage by epic.
- [ ] Checked in a browser: epic 11's Tasks together, both levels, in light and dark, English and Russian.
