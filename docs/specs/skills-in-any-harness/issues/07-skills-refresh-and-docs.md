# 07: The refresh after a merge, and the documentation

Status: DONE
Triage: ready-for-agent
Blocked by: 02, 04
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** on this repository, after a merge that changed the plugin's skills, autopilot also reinstalls the package's `binnacle-<action>` copy through the `skills` CLI, right after the plugin refresh epic 9 introduced, with the same rules: reported, never stopping the run (spec, *Autopilot's refresh*). `docs/workflow/02-development-workflow.md` names the same step for a merge done by hand. `docs/03-mcp-and-skills.md` states both channels, the names outside Claude Code, and no longer says no skill format exists for another harness. `README.md` and `README.ru.md` say that one `binn init` sets up every harness, with the skills' names outside Claude Code.

- [x] Autopilot's step and report carry the reinstall; the package's wording test holds it.
- [x] The development workflow, `docs/03-mcp-and-skills.md`, `README.md` and `README.ru.md` say the above, the two READMEs alike.

## Comments

### Decisions

- **The reinstall's commands** live in `docs/workflow/02-development-workflow.md`, *Per ticket* step 4, beside the plugin refresh, and autopilot points at them as it does for the plugin, so the skill names no harness's mechanism: `npx skills add apps/cli/skills -g -y` then `npx skills remove -g -a claude-code -s $(ls apps/cli/skills) -y`, the same pair `binn init`'s skills step plans for Binnacle's set. They run only when `~/.agents/skills` holds a `binnacle-*` skill, so a machine that never installed the copy gets none; without `npx` they wait, reported.
- **One sequence**: the reinstall runs right after the plugin refresh, under autopilot's existing rule: a failed command stops the rest of the refresh and is reported, and the run goes on. The report carries its own line for the copy.
- **`--skip-harness`** ids are not recorded anywhere, so autopilot's reinstall names only `claude-code`; the workflow and the README tell a human merging by hand to add theirs.
- **Docs**: `docs/03-mcp-and-skills.md` states the two channels, the `binnacle-<action>` names, freshness and autopilot's refusal, and its *How the interface reaches a harness* no longer says no skill format exists for another harness. `README.md` and `README.ru.md` say one `binn init` sets up every harness under *Working from another harness*, which replaces the read-the-skill-file prompt, and give the reinstall beside the plugin refresh. `docs/operations/05-installation-checklist.md`, left by ticket 05's review, says `binn init` installs Matt Pocock Skills and Ponytail's skills elsewhere and keeps upstream's manual commands as the way without it.
- **A harness installed later**: the docs say what the code does after ticket 06, `binn init` installs while the set is stale and prints the commands once it is current; ticket 06's question to the owner stands.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation of a documented rule; two factual errors against the code.** Findings:

1. **The READMEs and `docs/03` said one more `binn init` adds a harness installed later**, while a current set only prints the commands. **Fixed** in all three.
2. **The READMEs said `binn audit` reports skills "older than" `binn`**; the version is drawn from the files, so it differs rather than ages. **Fixed**.
3. **The checklist left out that a set declared `false`, or no harness detected, installs nothing.** **Fixed**.
4. **The README's manual reinstall left out `--skip-harness` harnesses.** **Fixed**, in both READMEs.
5. **The twelve `binnacle-<action>` names are listed in the READMEs and `docs/03`.** **Kept**: the ticket asks for the names outside Claude Code, and a reader types them.
6. **The reinstall pair is in the READMEs and the workflow.** **Kept**: the README gives the plugin refresh's commands the same way, for a reader of the setup.
7. **The test read the workflow file twice.** **Fixed**: `workflowText()`.
8. **`docs/03`'s paragraph on command wrappers generated from one procedure** sits beside the two channels. **Left**: still true of the copy built from the plugin, and outside this ticket.

**Spec: every requirement present, no scope creep.** Findings:

1. **The ticket was not yet `DONE`.** **Fixed** by this commit.
2. **The README's manual reinstall left out `--skip-harness`** — Standards 4. **Fixed**.
3. **The checklist made Ponytail's `skills` install equal to its Codex plugin and Gemini extension.** **Fixed**: it says `binn init` installs Ponytail's skills, not those, which stay upstream's own install.
4. **The checklist's omissions of `false` and no harness** — Standards 3. **Fixed**.
