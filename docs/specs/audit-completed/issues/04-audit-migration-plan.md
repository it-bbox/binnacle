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

## Comments

- The JSON: each finding carries `init` after `status`; `plan` is `{ "steps", "summary" }`, each step `{ number, title, findings, todo }`, `findings` its codes without repeats. With no step, `summary` is "Nothing to do: every finding is ok."; the text prints the same under *Migration plan*. `migrationPlan()` is in `apps/cli/src/audit.ts`; `Finding.init` is optional in `packages/core/src/audit.ts`, set only where it is true, and `audit()` writes `false` for the rest.
- Decisions where the ticket is silent: `init` is true for `binnacle.manifest`, `docs.roadmap` when the file is missing (not when it is out of format or `knowledge.docs` is undeclared), `layout.files` when a convention file is missing (not when only a spec directory is), `layout.ticket_header`, the unknown `capabilities.serena`, `.graphify` and `.context7`, `capabilities.binnacle_skills`, and `telemetry.export_*` when the harness has no export (not when it exports elsewhere); `docs.docs` stays a manual step although writing the roadmap skeleton creates `docs/`, since the ticket's list does not name it; `tracker.token_works` stays false although its recommendation names `binn init`. Step titles are "Run binn init", "Deal with the committed secrets" and "The <area> area"; an area step's `todo` is its findings' distinct recommendations in order, step 1's and step 2's a fixed text.
- For ticket 11 (the exit demonstration): on the owner's checkout the plan today is the `git-and-tracker` step (`git.worktree_config`, `tracker.token_works`) and the `docs` step (`docs.stranded`).
