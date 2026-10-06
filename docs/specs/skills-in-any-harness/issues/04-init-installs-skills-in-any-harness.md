# 04: binn init installs Binnacle's skills into every harness

Status: DONE
Triage: ready-for-agent
Blocked by: 03
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** `binn init`'s skills step, after the plugin step (spec, *`binn init`'s skills step*). When `binn` detected at least one harness, the plan holds `npx skills add <the package's copy> -g -y`, then `npx skills remove -g -a claude-code -s <the binnacle-* skills> -y`, with every `--skip-harness <id>` added to the removal; both run in that order only after the confirmation. With no harness detected the step is skipped and says why, since the `skills` CLI would install into every harness it knows. Without `npx` on PATH the commands are printed instead. A failed call is reported with its output and the plan goes on. The Summary names the harnesses from the `skills` CLI's output, and its next step for a harness other than Claude Code says to run `binnacle-product` there instead of pointing at a `SKILL.md` path. `--skip-harness` may be repeated and is an option of the interactive run and of `--plan --json`, so the plan's identifier covers it.

- [x] Tests with a fake `npx` first on PATH, as with the fake `claude`: add before remove; the removal names `claude-code` and each `--skip-harness`; a declined plan runs no `npx`; no harness detected skips the step; no `npx` prints the commands; a failed call is reported and the rest goes on.
- [x] `--plan --json` shows the same commands, and `--apply` runs them; a changed `--skip-harness` changes the plan's identifier.
- [x] The Summary names the harnesses from the fake `npx`'s output, and the per-harness next step names `binnacle-product`.

## Comments

### Decisions

- **Where**: `skillsStep` in `apps/cli/src/init.ts`, right after the plugin step. "A harness detected" is `binn`'s own detection, the harness step's list (Claude Code, Codex, opencode, VS Code); with none, the step is skipped and says the `skills` CLI would install into every harness it knows.
- **The commands**: `npx skills add <package>/skills -g -y`, then `npx skills remove -g -a claude-code <skip ids> -s <every binnacle-* folder of the copy> -y`. The skipped ids follow `claude-code` under the one `-a`, which the `skills` CLI (1.7.0, read from its source) reads up to the next option. Run without a shell, as the servers step runs its harness CLIs; Windows' `npx.cmd` would need one.
- **The harnesses in the Summary** come from the `Installing to: A, B` line `skills add` prints, colours stripped, Claude Code left out since it keeps the plugin. The `skills` CLI's `--json` gives agent ids, not names, and is not in the ticket's command. The removal names ids and the add's output names display names, so the Summary names the skipped ids apart ("then removed from cursor and pi") rather than matching them.
- **The per-harness next step** says to run `binnacle-product` in that harness once `skills add` ran, and otherwise once `binn init` has installed the skills. The old pointer at a `SKILL.md` path, and its test for a project carrying its own plugin, are gone.
- **`--skip-harness`** may be repeated on the interactive run, `--plan --json` and `--apply`; an empty id is a usage error. The plan item's body and heading carry the ids, so they change the plan's id. `/binnacle:init` passes the human's ids to the plan and to its apply alike.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Findings:

1. **`--skip-harness` ids reached a shell** (`shell: true`), which Windows' `cmd.exe` would not read through POSIX quoting. **Fixed**: `npx` runs without a shell.
2. **The Summary named skipped harnesses as installed.** **Fixed**: it says they were removed again, by their ids.
3. **The next step said to run `binnacle-product` even when nothing was installed** (declined, no `npx`, failed add). **Fixed**: it says so only once the add ran.
4. **`readdirSync` of the copy would fail the whole run without the package's `skills/`.** **Kept**: `prepare` builds it on install and pack, as ticket 03's review kept for the plugin.
5. **ANSI stripping covers colours only.** **Kept**: marked `ponytail:`; the line `skills add` prints carries colours alone.
6. **The Summary's line and each harness's next step both name `binnacle-product`.** **Kept**: the line covers harnesses `binn` does not know, such as Antigravity.
7. **The run-and-record shape repeats the servers step; the init options' type repeats in `bin.ts`.** **Kept**: two uses each.
8. **The plan's heading did not name the skipped harnesses; the fake `npx` compared against `undefined`.** **Fixed** both.

**Spec: every criterion implemented, no scope creep.** Findings:

1. **The next step and the Summary overclaimed** — the same as Standards 2 and 3. **Fixed**.
2. **A failed removal still leaves the Summary saying where the skills went.** **Kept**: the failed removal is its own `failed` line in the Summary.
3. **The skipped ids sit after `claude-code` under one `-a`.** **Kept**, and recorded under *Decisions*.
4. **The `/binnacle:init` edit** is needed for `--skip-harness` to reach `--plan --json` from the chat: kept.
