# 10: A skills add that fails for one harness still leaves Claude Code clean

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** `binn init`'s skills step no longer takes one harness's failure for the whole add's. On 2026-10-08, in epic 10's exit demonstration, `npx skills add mattpocock/skills -g -y --json` and the same for Ponytail, with `skills` 1.7.1, exited non-zero and reported every skill `failed` with `PromptScript does not support global skill installation`, while installing them into Antigravity, Claude Code, Codex, Continue, Gemini CLI, OpenCode, Pi and ZCode. `binn init` recorded both adds as failed and skipped their removal from Claude Code, which left 44 skills in `~/.claude/skills` beside the two plugins; the owner removed them by hand with `npx skills remove -g -a claude-code`.

The step reads what the add installed, not its exit status alone: the set's skills are removed from Claude Code whenever the add installed them there, and the Summary names a harness the add failed for, with the CLI's reason, rather than calling the whole add failed (spec, *One install for every harness*).

- [ ] Process test with a stub `npx skills` whose add exits non-zero and reports one harness's failure for every skill while it installs them elsewhere: the removal from Claude Code runs for the set's skills, and the Summary names the failing harness and its reason.
- [ ] An add that installed nothing is still recorded as failed, and nothing is removed.

## Comments

- How to tell what was installed is this ticket's to choose: the add's own output, or the installed skills listed after it.

### Decisions

- **Both.** With `--json`, `skills` 1.7.1 calls a skill `failed` when any harness failed it, without naming the harnesses, and exits 1. An add that exits 0 is read from its JSON, as before; one that exits non-zero is followed by `npx skills list -g --json`, and the skills the add named that it lists anywhere were installed, those in Claude Code removed from it.
- **Binnacle's add runs with `--json` too**, so that one reader serves the three sets; its removal still names the copy's own skills and runs after any add, as in ticket 04.
- **The second criterion's "nothing is removed"** reads as the repository sets' removal: Binnacle's names are its own, so its removal runs as ticket 04 and 05 keep it.
- **The Summary names the harness by the CLI's reason**, `failed <set> for a harness: <reason>`: the JSON gives the reason alone, and `skills` names the harness in it ("PromptScript does not support global skill installation").

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Findings:

1. **`shownSkills` repeats `planSkillSet`'s local `shown`.** To fix: one function.
2. **`spawnSkills`, `runSkills` and `addSkills` differ only by their verb; `parsedArray` is vague.** Kept: each has a comment saying what it records.
3. **`'Claude Code'` is a literal in `installedInto` and in `addSkills`.** Kept: the CLI's display name, matched where it is read, as before.
4. **`addSkills` is long, with `name as string` casts beside a `typeof` guard.** To fix the casts; the recovery branch stays in the function that reads the add.
5. **`installedInto`'s `ponytail:` says `--json` gives agent ids if the line changes, now that every add runs with `--json`.** To fix, with Spec 1.
6. **`fakeNpx`'s `failing` mixes a failing subcommand with a partial-failure scenario.** Kept: one fake, one switch, each value documented.

**Spec: both criteria implemented.** Findings:

1. **After a partial add, the Summary's harnesses come from the `Installing to:` line**, which names every target, the failing harness too: the real CLI's line would put PromptScript among the harnesses Binnacle's skills went into. To fix: after a non-zero add, the harnesses are those `skills list` shows the skills in.
2. **A skill the add named `failed` that `skills list` shows in Claude Code is removed even when it is the human's own**, against ticket 05's rule. Kept: `skills` overwrites a skill of that name in each harness it installs into, so it is the human's own only when Claude Code itself failed it; the `ponytail:` comment is to name that case.
3. **A reason that names no harness is still written `for a harness`.** Kept: the JSON gives no harness, and the human output's `✗ skill → harness` lines are not printed with `--json`; in 1.7.1 the global-install refusal names its harness.
