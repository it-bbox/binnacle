# 09: A current set still reaches a harness installed since

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** `binn init`'s skills step plans the add of Binnacle's `binnacle-<action>` copy, and its removal from Claude Code and each `--skip-harness`, whether the set in `~/.agents/skills` is stale or current (spec, *Freshness*, as amended on 2026-10-07; story 8; ADR-0039). Freshness still tells which: the step says the set was current or names the stale skills, and `binn audit` keeps its `capabilities.binnacle_skills` finding. The printed commands that replaced the add for a current set go, with the `ponytail:` comment that explained them. The README, `README.ru.md` and `docs/03-mcp-and-skills.md` stop saying that a current set only prints the two commands: running `binn init` again gives a harness installed later the skills.

- [x] Init tests with the fake `npx`: a current set plans and runs the same add and removal as a stale one, and the step says it was current; no commands are printed in its place.
- [x] The README, `README.ru.md` (alike) and `docs/03-mcp-and-skills.md` say that running `binn init` again gives a harness installed later the skills, with no case for a current set.

## Comments

### Decisions

- **What the step says for a current set**: that it is current and that the plan installs it again, so that a harness installed since gets it; the Summary keeps `found  Binnacle's skills: current` beside the add's `ran`, which says which without a second line of its own. The stale message is unchanged.
- **Without `npx`** a current set is printed as a stale one is: the step says it is current, then names the two commands, as for any set when `npx` is missing. The early return that printed the commands for a current set, and its `ponytail:` comment, are gone.
- **The docs** say running `binn init` again installs the skills into a harness installed since, stale or current, and says which; `README.ru.md` says the same. Ticket 07's Decisions and ticket 06's text keep the old behaviour as their record; the spec's *Freshness* and Further Notes already say the new one.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation of a documented rule.** Findings:

1. **`Session.skills`' comment still said a current set fills it.** **Fixed**: only the add fills it now.
2. **Two independent `if`s on the freshness state**, once the first no longer returns. **Fixed**: one `if`/`else if`.
3. **The test counted the add's occurrences through `split(...).length` and sliced the output twice.** **Fixed**: one `beforeQuestion`, the add's first and last index compared, and the plan's add and removal matched whole.
4. **A current set without `npx` gets both `found ... current` and `printed ...` in the Summary.** **Kept**: the spec's *Freshness* asks the step to say which, whether or not it can run the add.
5. **`README.ru.md` against `README.md`.** Alike; nothing to do.

**Spec: every requirement present, no scope creep.** Findings:

1. **Story 35 in the spec still reads "plan nothing for them, so that a second run changes nothing"**, against the amended *Freshness*. **Left**: a user story is the owner's, for a Product session; the Further Notes of 2026-10-07 already record that *Freshness* changed.
2. **No test of a current set with `--skip-harness`.** **Left**: the removal is built by the same code for a stale and a current set, and the `--plan --json` test covers `--skip-harness`.
3. **Without `npx`, a current set's "the plan installs them again" is followed by the printed commands.** **Kept**: the stale message reads the same way, and the next line says why nothing ran.
4. **The test's Summary check named no harness.** **Fixed**: it matches `installed into Codex`.
5. **The ticket was not yet `DONE`, and the current focus said 09 can start.** **Fixed** by this commit.
