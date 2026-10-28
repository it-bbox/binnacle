# ADR-0046: The Dashboard Writes the Context-Pressure Thresholds

**Status:** Accepted. Extends ADR-0041, which opens the Settings page to the Parallel limit only, to a second setting.

## Context

The `context.pressure` attention item warns when an active Product session's latest call read more context than a threshold, `telemetry.context_pressure.tokens` in the project manifest, 150 000 where it sets none. Binnacle works with any harness and model, and their context windows differ: 150 000 is near the edge of a 200K window and early for a much larger one. Like the Parallel limit, the right number depends on the machine's models and subscription, not on the repository, and the owner wants to change it on the dashboard rather than by editing a file (`docs/specs/hygiene-after-0-4-0/brief.md`).

## Decision

- The thresholds live in the machine's settings, `~/.binnacle/settings.json`: a default, 150 000, and a number for a model by name. A run's model picks its number; a model with none takes the default.
- A project manifest that sets `telemetry.context_pressure.tokens` still wins for that project, for every model.
- The Settings page writes the thresholds through the daemon, as it writes the Parallel limit, with the same token. It shows when a project's manifest overrides them.
- Binnacle ships no table of models and their windows.

## Considered Options

- **A share of the model's window.** Rejected for now: no harness Binnacle reads reports a window's size, and an unknown window is not guessed (principle 5).
- **Per-model numbers in the manifest.** Rejected: a change would be a commit in every project, and the dashboard could not make it.
- **A built-in table of known models.** Rejected: it has to follow every provider's releases, and one model's window can differ by subscription.

## Consequences

- The daemon's settings endpoint writes a second setting; every other page stays read-only, and the dashboard still writes nothing into a project's repository (ADR-0020).
- A model the owner has not set warns at the conservative default.
- Any further setting the dashboard writes still needs its own decision.
