# ADR-0013: Tracker Access Is Read-Only

**Status:** Accepted

## Context

Coding agents already have their own ways to write to GitHub and GitLab. The question was whether Binnacle needs its own write path as well.

Reads cannot be delegated to an agent: the dashboard is opened when no agent is running, a Product Snapshot exists precisely to bootstrap a fresh agent and therefore cannot depend on an agent having fed it earlier, and a daily delta requires polling between sessions. Making tracker access ride on the agent would also raise the bar for harness support level 1.

## Decision

Binnacle **reads** the tracker and **never writes** to it. Tracker credentials are requested with read-only scope. Writing an issue is done by the agent with its own tooling, or by the human in the tracker's own interface.

## Consequences

- Removed from the design: write scopes, conflict resolution between local and remote edits, write error paths, and roughly half of each tracker adapter.
- `docs/03-mcp-and-skills.md` no longer offers task metadata updates as a controlled mutation.
- Detailed Task state from `docs/workflow/03-state-machines.md` lives only in Binnacle's own projection; nothing is mirrored into labels. Losing the local database loses that detail, which is acceptable because it is Layer 3 runtime state under `docs/02-project-brain.md`, not canonical project state.
- A leaked token cannot damage a repository.
