# 04: The migration plan

Status: READY
Triage: ready-for-agent
Blocked by: 01, 02, 03
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** the audit ends with a migration plan (spec, *The migration plan*; `CONTEXT.md`, *Migration plan*). Every finding carries whether `binn init` closes it, a boolean set by the check that knows it: the manifest, the roadmap skeleton, the Matt Pocock layout and its ticket-header section, the tools init installs, Binnacle's skills and the telemetry export. The plan is computed from the findings: step 1 every non-`ok` finding `binn init` closes; step 2 every non-`ok` secret finding; then one step per area in the areas' order, its gaps first and its unknowns after. Each step has a number, a title, the codes of its findings and what to do; an area with nothing to do has no step, and with no step the plan says there is nothing to do. The text output prints it after the findings; `--json` carries `plan` beside `root` and `findings`, and the init boolean on each finding. `/binnacle:audit` shows the plan first, then the gaps and unknowns by area, then the number of `ok`. `docs/03-mcp-and-skills.md` and `docs/operations/02-existing-project-adopt.md` with its twin describe the new areas and the plan.

- [ ] Through `binn audit --json` on a bare repository with a committed `.env`: step 1 holds the findings `binn init` closes, step 2 the secret, the rest follow by area.
- [ ] On a repository with every finding `ok` the plan says there is nothing to do, in the text and the JSON.
- [ ] Every finding in the JSON has the init boolean; the plan's first step is built from it, not from a recommendation's text.
- [ ] The `/binnacle:audit` skill presents the plan first.
- [ ] The docs and the Russian twin describe the three areas and the plan.
