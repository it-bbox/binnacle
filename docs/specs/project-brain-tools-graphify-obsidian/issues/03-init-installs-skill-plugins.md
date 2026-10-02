# 03: `binn init` installs Matt Pocock Skills and Ponytail

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** the two skill sets of the Standard setup, installed by `binn init` where they ship as Claude Code plugins, through Claude Code's plugin CLI at user scope, as the `binnacle` plugin is installed today. A plugin Claude Code already lists is reported and left alone. For a detected harness with no install channel for them, the Summary names where to get them. They are rows of the tool table from ticket 01, in the same plan. This does not replace `/setup-matt-pocock-skills`, which init still names when the project has no Matt Pocock layout. Take the marketplace and plugin names from their current docs.

- [x] With Claude Code detected and neither plugin listed, the plan shows the marketplace and install commands, and after a yes the fake `claude` records them.
- [x] A plugin already listed is reported, and nothing is installed for it.
- [x] A tool declared `false` under `capabilities` is not proposed.
- [x] For Codex, opencode or VS Code detected, the Summary names where each skill set is had.
- [x] Without Claude Code detected, nothing is installed, and the Summary says why.
- [x] `docs/operations/03-external-tools.md` says what init installs for these two.

## Comments

### For the next tickets

- The tool table (`TOOLS` in `apps/cli/src/tools.ts`) gains a `plugin` column: `id` as `claude plugin list` names it, `marketplace` to add first where it is not Claude Code's official one, and `elsewhere`, what the Summary names for another harness. The rows are `matt_pocock_skills` and `ponytail`, which are also their `capabilities` keys; a new manifest declares them `true` when found or installed.
- Claude Code is asked for its plugins once, by `listClaudePlugins` in `init.ts`, before the manifest is proposed, so that the manifest can declare what is found; the `binnacle` plugin step reads the same listing. A plan item running `claude` commands is `planClaude`. A project that provides its own `binnacle` plugin is still listed, for the skill sets.
- The audit does not read plugins yet (`AUDITED` in `audit-tools.ts`); epic 12 adds its checks, and should read the listing through the same code rather than a copy.

### Questions answered in the smallest way the spec allows

- Names, from each plugin's README on 2026-10-02: Matt Pocock Skills is `mattpocock-skills` in Claude Code's official marketplace, "nothing to add first", so its plan has the install alone, as `mattpocock-skills@claude-plugins-official`; Ponytail is `ponytail@ponytail` after `claude plugin marketplace add DietrichGebert/ponytail`. Both at `--scope user`.
- A plugin is found by its name from any marketplace, as the `binnacle` plugin was.
- Codex has a plugin CLI for Ponytail, but the ticket names Claude Code's alone as the channel: Codex, opencode and VS Code get a Summary line instead, `npx skills@latest add mattpocock/skills` for Matt Pocock Skills and Ponytail's per-harness install section. A skill set Claude Code already lists is still pointed at for them, since they lack it. Without Claude Code and with no other harness, the step's own line says where to get them, though the Summary only gives the reason.
- A failed `claude plugin list --json` is one `failed` line; the `binnacle` plugin and both skill sets are then `skipped` with that reason.

### Checked by a human

Only the fakes are checked. On a machine with Claude Code that lists neither plugin, in a scratch repository:

```sh
BINNACLE_HOME=$(mktemp -d) binn init      # confirm the plan
claude plugin list | grep -E 'mattpocock-skills|ponytail'   # both, at user scope
BINNACLE_HOME=$(mktemp -d) binn init      # now "found  Matt Pocock Skills: Claude Code lists …", no install in the plan
```

Remove them afterwards with `claude plugin uninstall ponytail@ponytail` and `claude plugin uninstall mattpocock-skills@claude-plugins-official` if they were not wanted.

### Review

`/code-review` against `main`, both axes, after rebasing onto `main` (ticket 06 merged meanwhile).

- **Fixed:** the plugin-name match was written twice (`startsWith('binnacle@')` and a split in `detectTools`): one `listedAs` helper now serves both. The sentence-joining helper shadowed the local `listed` names: renamed `inSentence`. The tool step's comment still said executables through a package manager only; it names the plugin channel now, and `listClaudePlugins` has its own comment. With no Claude Code and no other harness, nothing said where to get the skill sets; the step's line now does. The failed-listing path had lost its test; one is added. The checklist's replacement sentence had dropped the rule that init never blindly reinstalls, and did not name the plugin; both restored.
- **Kept:** `why` on `ToolState` holds how a tool was found or why it has no channel, one string per state, rather than a field per state. `toolsStep` handles both install channels, as the ticket asks for rows of the one table. The "Asking Claude Code for its plugins" line now comes before the manifest proposal, which needs it.
- **Left:** a failed listing still prints its reason twice before the plan (once for the listing, once for the `binnacle` plugin); the Summary has it once as `failed`. Plugin detection is init's alone until epic 12's audit checks share it.
