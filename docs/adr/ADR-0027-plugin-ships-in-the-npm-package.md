# ADR-0027: The `binnacle` Plugin Ships Inside the npm Package

**Status:** Accepted

## Context

ADR-0023 made Binnacle's skills a Claude Code plugin named `binnacle`, and left open how the plugin reaches projects other than this one. The alternatives were:

- **This GitHub repository as a marketplace**, registered in a project's `.claude/settings.json`. The plugin then comes from `main`, while the installed `binn` may be older or newer, so the skills and the tools they call can drift apart.
- **A copy in each project's `.claude/skills/`**, as this repository does. Every copy goes stale and has to be updated per project.

## Decision

The plugin ships inside `@binnacle/cli`, with a marketplace manifest beside it. After confirmation, `binn init` adds the installed package's directory as a user-scope marketplace and installs `binnacle` from it, through Claude Code's own CLI: `claude plugin marketplace add <path>`, then `claude plugin install`. It never edits Claude Code's settings files directly.

This repository keeps its skills-directory plugin at `.claude/skills/binnacle/` (ADR-0023). It is the same plugin, read in place while it is being developed.

## Rationale

- The skills always match the version of the tools they call, because they are the same package.
- No network access is needed, and nothing is written into the project's repository.
- Updating `binn` updates the skills.

## Consequences

- The package's build includes the plugin directory.
- The package's build includes the marketplace manifest.
- The package's build gives the plugin's manifest a version drawn from every file of the plugin (`apps/cli/src/prepare.ts`). Claude Code's `plugin update` refreshes its installed copy only when the version changes, and installs a manifest with none as `unknown`, which no later update replaces.
- `binn init` relies on Claude Code accepting a local path as a marketplace source. Its CLI does: `claude plugin marketplace add` takes a URL, a path or a GitHub repository.
- Command wrappers for other harnesses still wait for a second harness with skills (`docs/03-mcp-and-skills.md`).
