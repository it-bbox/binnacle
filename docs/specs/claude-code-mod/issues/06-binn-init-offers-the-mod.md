# 06: `binn init` offers the mod, and the guides say how to turn it off

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/claude-code-mod/spec.md`
Roles: Developer, Reviewer

**What to build:** `binn init` asks whether to install `binnacle-mod`, "no" by default, and installs it on a yes. The guides give the install line and how to disable or remove the mod. This ticket covers the spec's *`binn init`'s mod step* and *Docs*.

The question is asked before the plan, as the autostart question is. It is asked only where Claude Code is detected, `claude --version` is at least the mod's minimum version, and `claude plugin list --json` does not list `binnacle-mod`. It reads "[y/N]": Enter, an empty answer or the end of input declines. `--mod yes|no` answers it, and `--plan` and `--apply` without the flag decline it.

A yes plans `claude plugin install binnacle-mod@binnacle --scope user` through `planClaude`, after `claude plugin marketplace add` of the package when the plugin step did not add it. Each skip is recorded with its reason in the Summary.

- [x] Through `apps/cli/test/init.test.ts` with its fake `claude`:
  - asked and declined by Enter;
  - a yes plans and runs the install;
  - `--mod yes` and `--mod no`;
  - `--plan` without the flag declines.
- [x] Not asked with no Claude Code, with a version below the minimum, or with `binnacle-mod` already listed; each skip is in the Summary in English and Russian.
- [x] `binn --help` lists `--mod`.
- [x] The README, the installation checklist in `docs/operations/` and their Russian twins give the install line, `claude plugin disable binnacle-mod` and `claude plugin uninstall binnacle-mod`; `pnpm test`'s guide check passes.

## Comments

### Decisions

- The mod step runs right after `claude plugin list --json` is read, which it needs, and before the plan, after the autostart question. Its checks, in order: Claude Code listed its plugins (else the plugin step's own reason), `binnacle-mod` not listed, `claude --version` naming a version, that version at least `MINIMUM_CLAUDE_CODE` (`apps/cli/src/mod/hooks.ts`), compared with numeric collation. `--version` runs only when the first two pass.
- Only `y` or `yes` accepts. Unlike autostart, the question is asked without a terminal too: the plan is not written there anyway, and no extra branch is needed.
- The mod's plan item comes right after the `binnacle` plugin's. `pluginStep` now returns whether it planned `claude plugin marketplace add`; when it did not (the plugin listed, or the project's own plugin), the mod's item adds the marketplace itself. A second `claude plugin marketplace add` of the same path was checked against the real `claude` 2.1.308 with a throwaway `CLAUDE_CONFIG_DIR`: it exits 0, "already on disk".
- A skip is recorded in the Summary only, not said in the dialogue: the spec asks for the Summary, and the line would print on every run without Claude Code.
- The test's fake `claude` answers `--version` before recording calls, and prints no version unless a test gives one, so every older test takes the "names no version" skip and its expected calls are unchanged.

### Review

Reviewed in a sub-agent against `main`, on the spec and the project's standards. Every criterion holds; the standards axis found nothing.

- Fixed: the guides' later install line works only from the `binnacle` marketplace; both checklists now say `binn init` adds it with the `binnacle` plugin.
- Kept: the mod's item re-adds the marketplace when the `binnacle` plugin is already listed. Checked against the real `claude` 2.1.308: re-adding exits 0.
- Left, for a Product session: `/binnacle:init` from the chat never offers the mod, since `--plan --json` has no `mod.ask` and the skill passes no `--mod`. The spec fixes that `--plan` and `--apply` decline without the flag, so this is new scope: a `mod: { ask }` field beside `autostart` and a step in the init skill and its copy.

### For the next ticket

- The exit demonstration installs the mod from a terminal `binn init` (the chat form declines it, as above), with Claude Code 2.1.308 or later.
- `pnpm test` has one failure that is on `main` too and outside this ticket: `apps/cli/test/pack.test.ts`, "the five reporting skills ... list CONTEXT.md's Russian words", since `CONTEXT.md` gained *Mod — мод* and the five reporting skills do not list it yet.
