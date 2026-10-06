# 05: Matt Pocock Skills and Ponytail reach the same harnesses

Status: DONE
Triage: ready-for-agent
Blocked by: 04
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** the skills step installs Matt Pocock Skills and Ponytail into the harnesses Binnacle's skills go to, from their repositories, through the same `npx skills add -g -y` and then `npx skills remove -g -a claude-code`, since Claude Code keeps both as plugins (spec, *Matt Pocock Skills and Ponytail*). A set the manifest declares false is left out of every harness, as it is left out of Claude Code. The Summary's line that pointed other harnesses at where each set is had goes away.

- [x] Tests with the fake `npx`: each set's add and removal, in order, beside Binnacle's; a set declared false is not planned.
- [x] Without a harness detected, without `npx`, and on a failed call, both sets behave as Binnacle's do.

## Comments

### Decisions

- **Where**: `skillsStep` in `apps/cli/src/init.ts` plans one item per skill set, Binnacle's first, then Matt Pocock Skills and Ponytail in the tools table's order, each its add then its removal. The tools table's `plugin.elsewhere`, which the Summary's per-harness line printed, became `plugin.source`, the repository: `mattpocock/skills` and `DietrichGebert/ponytail`. A set the manifest declares false is not planned, as the tools step already leaves it out of Claude Code.
- **The removal's skills**: the spec's removal names `-s <its skills>`, which for a repository are not known before its add runs, without the network. The `skills` CLI (1.7.0, read from its source) has no glob for `-s` and no option to exclude a harness from an add. A fixed list in the tools table would go stale: Matt Pocock's plugin had 25 skills in the cached 1.2.3 and 27 upstream at 1.3.1, and the add installs every `SKILL.md` under `skills/`, the deprecated and in-progress ones too. So a repository's add runs with `--json`, whose stdout is the list of skills it installed, and the removal names those with `status: "installed"`; the plan shows it as `-s <each skill the add installed>`. The plan's id covers that text, not the names.
- **A repository's add that fails** leaves its removal without names: it is skipped and the Summary says so (`skipped removing <set> from Claude Code: its add failed`), beside the add's own `failed` line with its output. Binnacle's removal still runs, as in ticket 04.
- **The Summary's harnesses** stay those of Binnacle's add: the `--json` add prints no `Installing to:` line, and the three sets go to the same harnesses.
- **With ticket 06**, rebased onto it: its current/stale check applies to Binnacle's set alone, inside the per-set planning, so a current Binnacle set plans no add while Matt Pocock Skills and Ponytail are still planned, as Binnacle does not version them (spec, *Freshness*). The copy's path and the freshness read are 06's `SKILLS_COPY` and `binnacleSkills()` from `tools.ts`.
- **A harness with no Claude Code detected**: the tools step's line says the set's Claude Code plugin is not installed, and no longer says where to get the set; the skills step installs it there.
- **Docs**: `docs/operations/03-external-tools.md`, `README.md` and `README.ru.md` say both sets go to every other harness. `docs/operations/05-installation-checklist.md`'s manual install from upstream is left to ticket 07.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: one hard violation.** Findings:

1. **`README.md` still said the Summary tells other harnesses where to get the sets, and `README.ru.md` with it** (AGENTS.md, *Documentation language*). **Fixed** in both.
2. **`docs/operations/05-installation-checklist.md` still gives the manual `npx skills@latest add mattpocock/skills`.** **Left** to ticket 07, which rewrites the docs; the manual path still works.
3. **The set's Binnacle-or-repository flag is derived from `skills !== null`.** **Kept**: the null is what makes it a repository's set, and the type's comment says so.
4. **`SkillSet.plugin` held a phrase, not a plugin.** **Fixed**: `claudeCodeHas`.
5. **The placeholder removal was built with `slice(0, -2)`.** **Fixed**: the removal's prefix is its own array.
6. **The skip's reason was written twice.** **Fixed**.
7. **`Tool.plugin.source` serves the plugin row and the `skills` CLI.** **Kept**: one table, one row per tool.
8. **The removal named every skill in the add's JSON, a failed one too**, which could remove a skill of the human's own by that name from Claude Code. **Fixed**: only `status: "installed"`, with a failed entry in the fake `npx`'s output.
9. **A failed add records `failed` and then `skipped` for its removal.** **Kept**: two calls, two lines.
10. **Anything but JSON on the add's stdout skips the removal quietly.** **Kept** and marked `ponytail:`; the Summary names the skip.

**Spec: every criterion implemented.** Findings:

1. **The plan's id covers the removal's placeholder, not the names it will run with.** **Kept**: the names are known only once the add ran, recorded under *Decisions*.
2. **The skip of a removal after a failed add, `from <repository>` in the heading, and the declined line `install <set> into every harness`.** **Kept**: needed for a removal without names, and to tell the set's line from its plugin's.
3. **The Summary names the harnesses from Binnacle's add only.** **Kept**, recorded under *Decisions*.
4. **Non-JSON on stdout leaves a second copy in Claude Code** — the same as Standards 10. **Kept**.
