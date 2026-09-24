# 10: The `binnacle` plugin in the package, installed by `binn init`

Status: READY
Triage: ready-for-agent
Blocked by: 08
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`, `docs/adr/ADR-0027-plugin-ships-in-the-npm-package.md`

**What to build:** the packed CLI carries the `binnacle` plugin and a marketplace manifest, and `binn init` installs the plugin from the installed package through Claude Code's own CLI, so a project's skills always match the `binn` that serves their tools. Decided in ADR-0027 and in the spec, under *Workspace* and *`binn init`*, step 4.

- [ ] The CLI package's packed contents include the plugin directory, its skills, and a marketplace manifest listing `binnacle`. The source stays at `.claude/skills/binnacle/`; how it reaches the package is this ticket's choice, recorded in its comments.
- [ ] One test packs the CLI package and asserts those files are in it.
- [ ] Only when Claude Code is detected, after confirmation: `claude plugin marketplace add <the package's directory>`, then `claude plugin install` of `binnacle` from that marketplace at user scope. Claude Code's settings files are never edited.
- [ ] Skipped and reported when Claude Code already lists the plugin, and when the project itself provides a plugin named `binnacle` (this repository), with that reason.
- [ ] Subprocess tests with a fake `claude` first on PATH recording its arguments: both commands in order with the package path, the skip when listed, the skip for a project with its own plugin, nothing run when declined or when Claude Code is absent.
