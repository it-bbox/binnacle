# ADR-0041: The Dashboard Writes the Machine's Parallel Limit

**Status:** Accepted. Narrows epic 5's "a page's only action is copying a command" (`specs/minimal-dashboard/spec.md`) for one setting.

## Context

The number of agents autopilot runs at once is `automation.max_parallel_development_tasks` in the project manifest. It depends on the machine and the subscription, not on the repository, and the owner wants to change it without editing a file (`docs/05-mvp-plan.md`, *Phase 16*; the owner, 2026-10-11). The dashboard has been read-only since epic 5: its only action is copying a command.

## Decision

- The parallel limit lives in the machine's settings, `~/.binnacle/settings.json`, 2 by default. A project manifest that sets it still wins for that project.
- The dashboard's Settings page writes it, and nothing else: a number, or *auto*, which starts every ready Task whose pairs are all at low conflict risk, at most 4. The write goes through the daemon, with the token every dashboard call carries.
- Every other page stays read-only, and the dashboard still writes nothing into a project's repository (ADR-0020).

## Considered Options

- **Keep it in the manifest only.** Rejected: it is a property of the machine, and a change to it would be a commit in every project.
- **A command to copy, such as `binn settings set`.** Keeps the dashboard read-only, but the owner asked for the setting on the page.

## Consequences

- The daemon gains its first write endpoint for the dashboard, limited to this one setting.
- The Settings page shows when a project's manifest overrides the machine's value.
- Any further setting the dashboard writes needs its own decision; this ADR does not open the page to others.
