# 06: The Parallel limit on the machine

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/dashboard-redesign/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** the Parallel limit (`CONTEXT.md`) lives in the machine's settings and the Settings page edits it (spec, *The Parallel limit on the machine*, *One write, through the daemon*; ADR-0041). The settings file holds a positive integer or `auto`, 2 when unset; a project manifest's `automation.max_parallel_development_tasks` still wins for its project. The snapshot's `tasks.parallel` gives the limit with its mode, `number` or `auto`, and its source, `manifest`, `machine` or `default`; with `auto` its limit is the ceiling, 4. Two operations over the daemon's authenticated API read and set it; the set keeps every other key of the file and refuses a bad value with a reason. Autopilot reads the limit from the snapshot: with `auto` it starts every ready Task whose pairs with every Task in flight are at low conflict risk, up to 4, and one at a time when the risk is not assessed; without Binnacle, the manifest's value or two.

- [ ] Through the daemon's HTTP API: the limit read from a temporary home's settings with its source; a manifest's value winning; `auto` with its ceiling; the set writing the limit, keeping `obsidian.vaultPath`, and refusing zero, a negative, a fraction, a value over the bound and any other string.
- [ ] The set needs the daemon's token, as every operation does, and no MCP tool writes the limit.
- [ ] The snapshot's `tasks.parallel` carries the mode and the source; `docs/03-mcp-and-skills.md` says so.
- [ ] The Settings page edits the limit, a number or *auto*, says when a manifest overrides it, and shows the daemon's reason for a refused value; it writes nothing else.
- [ ] Autopilot's skill reads the limit from the snapshot by the rule above.
- [ ] `docs/04-telemetry-dashboard.md`'s Settings section says the page writes the Parallel limit and nothing else.
- [ ] Checked in a browser: setting a number, *auto*, and a refused value, in English and Russian.
