# 06: `binn init` offers the mod, and the guides say how to turn it off

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/claude-code-mod/spec.md`
Roles: Developer, Reviewer

**What to build:** `binn init` asks whether to install `binnacle-mod`, "no" by default, and installs it on a yes. The guides give the install line and how to disable or remove the mod. This ticket covers the spec's *`binn init`'s mod step* and *Docs*.

The question is asked before the plan, as the autostart question is. It is asked only where Claude Code is detected, `claude --version` is at least the mod's minimum version, and `claude plugin list --json` does not list `binnacle-mod`. It reads "[y/N]": Enter, an empty answer or the end of input declines. `--mod yes|no` answers it, and `--plan` and `--apply` without the flag decline it.

A yes plans `claude plugin install binnacle-mod@binnacle --scope user` through `planClaude`, after `claude plugin marketplace add` of the package when the plugin step did not add it. Each skip is recorded with its reason in the Summary.

- [ ] Through `apps/cli/test/init.test.ts` with its fake `claude`:
  - asked and declined by Enter;
  - a yes plans and runs the install;
  - `--mod yes` and `--mod no`;
  - `--plan` without the flag declines.
- [ ] Not asked with no Claude Code, with a version below the minimum, or with `binnacle-mod` already listed; each skip is in the Summary in English and Russian.
- [ ] `binn --help` lists `--mod`.
- [ ] The README, the installation checklist in `docs/operations/` and their Russian twins give the install line, `claude plugin disable binnacle-mod` and `claude plugin uninstall binnacle-mod`; `pnpm test`'s guide check passes.
