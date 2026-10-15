# 04: The migration plan

Status: READY
Triage: ready-for-agent
Blocked by: 01, 02, 03
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** the audit ends with a migration plan (spec, *The migration plan*; `CONTEXT.md`, *Migration plan*). Every finding carries whether `binn init` closes it, a boolean set by the check that knows it: the manifest, the roadmap skeleton, the Matt Pocock layout and its ticket-header section, the tools init installs, Binnacle's skills and the telemetry export. The plan is computed from the findings: step 1 every non-`ok` finding `binn init` closes; step 2 every non-`ok` secret finding; then one step per area in the areas' order, its gaps first and its unknowns after. Each step has a number, a title, the codes of its findings and what to do; an area with nothing to do has no step, and with no step the plan says there is nothing to do. The text output prints it after the findings; `--json` carries `plan` beside `root` and `findings`, and the init boolean on each finding. `/binnacle:audit` shows the plan first, then the gaps and unknowns by area, then the number of `ok`. `docs/03-mcp-and-skills.md` and `docs/operations/02-existing-project-adopt.md` with its twin describe the new areas and the plan.

- [x] Through `binn audit --json` on a bare repository with a committed `.env`: step 1 holds the findings `binn init` closes, step 2 the secret, the rest follow by area.
- [x] On a repository with every finding `ok` the plan says there is nothing to do, in the text and the JSON.
- [x] Every finding in the JSON has the init boolean; the plan's first step is built from it, not from a recommendation's text.
- [x] The `/binnacle:audit` skill presents the plan first.
- [x] The docs and the Russian twin describe the three areas and the plan.

## Comments

- The JSON: each finding carries `init` after `status`; `plan` is `{ "steps", "summary" }`, each step `{ number, title, findings, todo }`, `findings` its codes without repeats. With no step, `summary` is "Nothing to do: every finding is ok."; the text prints the same under *Migration plan*. `migrationPlan()` is in `apps/cli/src/audit.ts`; `Finding.init` is optional in `packages/core/src/audit.ts`, set only where it is true, and `audit()` writes `false` for the rest.
- Decisions where the ticket is silent: `init` is true for `binnacle.manifest`, `docs.roadmap` when the file is missing (not when it is out of format or `knowledge.docs` is undeclared), `layout.files` when a convention file is missing (not when only a spec directory is), `layout.ticket_header`, the unknown `capabilities.serena`, `.graphify` and `.context7`, `capabilities.binnacle_skills`, `telemetry.export_*` when the harness has no export (not when it exports elsewhere), and, as side effects of the convention files, `docs.docs` (they create `docs/`) and `instructions.sets` when there is no instruction file (init writes `AGENTS.md`; not when two files do not import each other); `tracker.token_works` stays false although its recommendation names `binn init`. Step titles are "Run binn init", "Deal with the committed secrets" and "The <area> area"; an area step's `todo` is its findings' distinct recommendations in order, step 1's and step 2's a fixed text.
- For ticket 11 (the exit demonstration): on the owner's checkout the plan today is the `git-and-tracker` step (`git.worktree_config`, `tracker.token_works`) and the `docs` step (`docs.stranded`).

### Review

Against `main`, in a sub-agent, on the standards, the spec and, for Binnacle's Security suggestion, secrets and trust boundaries. Typecheck and the audit's 49 tests pass; the plan's order, the empty plan, the flag on every finding and the skill's order hold.

1. **A commit subject of 73 characters**, over the 72 `AGENTS.md` allows. **Fixed**: reworded on the unpushed branch.
2. **`instructions.sets` was not flagged** with no instruction file, though init's conventions step writes `AGENTS.md`. **Fixed**: flagged for that gap only; the plan test pins it.
3. **`docs.docs` was not flagged**, though init's convention files under `docs/agents/` create `docs/`. **Fixed**: flagged; the test pins it and the decision above says so.
4. `layout.files` is flagged on a bare repository, where init writes the convention files and the spec directory stays missing. **Kept**: the ticket names the layout; once init ran, the next audit leaves only the spec directory, whose recommendation names `/to-spec`.
5. The tools' unknowns are flagged even when `uv` or `npm` is not on PATH, so init cannot install them. **Kept**: they are still init's to install, and its plan says how to get the prerequisite; a flag read from PATH would make the plan's first step depend on the machine.
6. Step 2's fixed text does not fit `secrets.scan` `unknown`, which only a failing `git ls-files` gives. **Left**: every file area is unknown then, and the finding's own recommendation is in the report.
7. "`unknown` —, whether" in the guide read oddly. **Fixed** in the guide and its twin.

#### Security

None. The plan carries codes, two fixed texts and the recommendations of the areas other than `secrets`; a secret finding reaches it by its code only, and its value never reached a finding. Nothing is run: step 1 points to `binn init`, which asks before writing, and step 2 leaves rewriting history to the owner.
