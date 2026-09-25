# 10: The `binnacle` plugin in the package, installed by `binn init`

Status: DONE
Triage: ready-for-agent
Blocked by: 08
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`, `docs/adr/ADR-0027-plugin-ships-in-the-npm-package.md`

**What to build:** the packed CLI carries the `binnacle` plugin and a marketplace manifest, and `binn init` installs the plugin from the installed package through Claude Code's own CLI, so a project's skills always match the `binn` that serves their tools. Decided in ADR-0027 and in the spec, under *Workspace* and *`binn init`*, step 4.

- [x] The CLI package's packed contents include the plugin directory, its skills, and a marketplace manifest listing `binnacle`. The source stays at `.claude/skills/binnacle/`; how it reaches the package is this ticket's choice, recorded in its comments.
- [x] One test packs the CLI package and asserts those files are in it.
- [x] Only when Claude Code is detected, after confirmation: `claude plugin marketplace add <the package's directory>`, then `claude plugin install` of `binnacle` from that marketplace at user scope. Claude Code's settings files are never edited.
- [x] Skipped and reported when Claude Code already lists the plugin, and when the project itself provides a plugin named `binnacle` (this repository), with that reason.
- [x] Subprocess tests with a fake `claude` first on PATH recording its arguments: both commands in order with the package path, the skip when listed, the skip for a project with its own plugin, nothing run when declined or when Claude Code is absent.

## Comments

- **How the plugin reaches the package.** A `prepare` script in `apps/cli/package.json` deletes `apps/cli/plugin/` and copies `.claude/skills/binnacle/` there. pnpm runs `prepare` on `pnpm install` in the workspace, so the linked CLI has the plugin, and on `pnpm pack`, so the tarball has it. `apps/cli/plugin/` is ignored by Git, and the source stays where it is. The marketplace manifest is committed at `apps/cli/.claude-plugin/marketplace.json`: a marketplace named `binnacle` that lists the plugin `binnacle` with source `./plugin`. `claude plugin validate apps/cli` passes it, warning only that `plugin.json` has no `version` or `author`. A symlink was tried first and rejected: neither `pnpm pack` nor `npm pack` includes a symlinked directory.
- **What changed.** The plugin step is `pluginStep` in `apps/cli/src/init.ts`, run after registration. It runs, in this order:
  1. A project with `.claude/skills/binnacle/.claude-plugin/plugin.json` is skipped with that reason, and `claude` is never called.
  2. `claude plugin list --json` is run in the repository. A missing `claude` means Claude Code is not detected, and any plugin id starting with `binnacle@` means the plugin is already listed. Both are reported as skipped.
  3. After a yes, `claude plugin marketplace add <package dir> --scope user` runs, then `claude plugin install binnacle@binnacle --scope user`. stdin is not passed to them, and their output is shown. The first failure stops the step and is listed as `failed`.

  The tests are the `the plugin:` tests in `apps/cli/test/init.test.ts` and the pack test in `apps/cli/test/pack.test.ts`. Every `binn init` test now runs with a PATH that holds only `git` and, when the test adds one, a fake `claude`. The machine's own Claude Code is never run.
- **For ticket 09.** Claude Code is detected here by `claude` answering. Ticket 09's detector (executable or user configuration directory) can replace that check. The step still needs the executable to run anything, so a configuration directory without an executable should still skip the plugin. The harness step goes before `pluginStep` in `init`.
- **For ticket 12.** Nobody has run the two real commands. They could not be run against a throwaway `HOME` from this session. In the exit demonstration, on a fresh clone, confirm the plugin step, then check:
  1. `claude plugin list --json` lists `binnacle@binnacle`.
  2. `claude plugin marketplace list` shows `binnacle` at the linked `apps/cli`.
  3. A new session offers `/binnacle:product` and `/binnacle:task`.
  4. Undo with `claude plugin uninstall binnacle@binnacle` and `claude plugin marketplace remove binnacle`.
- **Questions answered in the smallest way the spec allows.**
  - *Does "nothing run when declined" count the listing?* No. `claude plugin list --json` is read-only, and it is the only way to know whether to ask at all. The tests check that only that listing runs when the step is declined or stdin is closed.
  - *How is "a project that provides its own plugin named `binnacle`" recognised?* By the skills-directory plugin path, `.claude/skills/binnacle/.claude-plugin/plugin.json`. ADR-0023 says such a plugin loads as `<directory>@skills-dir`.
  - *Which scope?* The scope is `--scope user` for both commands. It is passed explicitly, although it is Claude Code's default.

### Review

`/code-review` ran against `main` on both axes, after rebasing onto `main` with ticket 06's `task` skill. The pack test copies every file of the source, so the `task` skill is covered too.

**Standards: no hard violations, and six judgement calls.**

1. Claude Code is detected by `ENOENT` rather than by the harness detector. **Kept**: ticket 09 has not landed. It is marked `ponytail:` in the code and noted above for ticket 09.
2. `prepare` runs on every workspace install, and it relies on pack not applying `.gitignore`. **Kept**: the pack test fails if that ever changes.
3. The `commands` and `shown` arrays were matched by index. **Fixed**: each shown line is derived from its arguments.
4. A `throw` inside its own `try` only to reach the `catch`. **Fixed**: `pluginIds` parses the list or answers `null`.
5. The package path was computed differently in the tests and the source. **Fixed**: `init.test.ts` uses `dirname(dirname(BINN))`. `pack.test.ts` only uses its path as a working directory. **Left**.
6. The test did not check that the commands are shown before the question. **Fixed**: it checks the order.

**Spec: no blocking gaps.**

1. The copy mechanism was not recorded in the ticket. **Fixed**: see above.
2. Closed stdin did not reach the plugin question in any test. **Fixed**: the closed-stdin test puts a fake `claude` on PATH and checks that only the listing ran.
3. Detection is narrower than "executable on PATH or user configuration directory". **Kept**, as in Standards 1.
4. The own-plugin check tests a path, not the name in `plugin.json`. **Kept**, as answered above.
5. Any `binnacle@*` counts as listed, including a stale one from an older package path. **Kept**: the spec says to skip when Claude Code lists the plugin. Updating a stale copy is `claude plugin update`, which is Claude Code's job.
6. The workspace copy is refreshed only on `pnpm install` or `pnpm pack`. **Kept**: Claude Code copies a plugin into its own cache at install time, so an installed plugin is a snapshot whatever the source. This repository reads its plugin in place.
7. Scope creep: the list-failure branch, the failed-add test, and the reduced PATH for older tests. **Kept**: each is small, and each stops a real failure from passing silently.
