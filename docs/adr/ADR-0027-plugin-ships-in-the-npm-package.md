# ADR-0027: The `binnacle` Plugin Ships Inside the npm Package

**Status:** Accepted

## Context

ADR-0023 made Binnacle's skills a Claude Code plugin named `binnacle`, and left open how the plugin reaches projects other than this one. The alternatives were:

- **This GitHub repository as a marketplace**, registered in a project's `.claude/settings.json`. The plugin then comes from `main`, while the installed `binn` may be older or newer, so the skills and the tools they call can drift apart.
- **A copy in each project's `.claude/skills/`**, as this repository does. Every copy goes stale and has to be updated per project.

## Decision

The plugin ships inside `@binnacle/cli`. `binn init` registers the installed package's plugin directory as a local marketplace in the user's Claude Code settings and enables `binnacle` from it, after confirmation.

This repository keeps its skills-directory plugin at `.claude/skills/binnacle/` (ADR-0023). It is the same plugin, read in place while it is being developed.

## Rationale

- The skills always match the version of the tools they call, because they are the same package.
- No network access is needed, and nothing is written into the project's repository.
- Updating `binn` updates the skills.

## Consequences

- The package's build includes the plugin directory.
- `binn init` needs Claude Code to accept a local directory as a marketplace source in its settings. This is checked before the spec is written, and if it does not hold, this ADR is revisited.
- Command wrappers for other harnesses still wait for a second harness with skills (`docs/03-mcp-and-skills.md`).
