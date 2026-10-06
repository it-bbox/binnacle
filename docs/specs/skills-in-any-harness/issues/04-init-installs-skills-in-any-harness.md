# 04: binn init installs Binnacle's skills into every harness

Status: READY
Triage: ready-for-agent
Blocked by: 03
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** `binn init`'s skills step, after the plugin step (spec, *`binn init`'s skills step*). When `binn` detected at least one harness, the plan holds `npx skills add <the package's copy> -g -y`, then `npx skills remove -g -a claude-code -s <the binnacle-* skills> -y`, with every `--skip-harness <id>` added to the removal; both run in that order only after the confirmation. With no harness detected the step is skipped and says why, since the `skills` CLI would install into every harness it knows. Without `npx` on PATH the commands are printed instead. A failed call is reported with its output and the plan goes on. The Summary names the harnesses from the `skills` CLI's output, and its next step for a harness other than Claude Code says to run `binnacle-product` there instead of pointing at a `SKILL.md` path. `--skip-harness` may be repeated and is an option of the interactive run and of `--plan --json`, so the plan's identifier covers it.

- [ ] Tests with a fake `npx` first on PATH, as with the fake `claude`: add before remove; the removal names `claude-code` and each `--skip-harness`; a declined plan runs no `npx`; no harness detected skips the step; no `npx` prints the commands; a failed call is reported and the rest goes on.
- [ ] `--plan --json` shows the same commands, and `--apply` runs them; a changed `--skip-harness` changes the plan's identifier.
- [ ] The Summary names the harnesses from the fake `npx`'s output, and the per-harness next step names `binnacle-product`.
