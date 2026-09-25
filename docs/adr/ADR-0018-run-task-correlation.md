# ADR-0018: Run-to-Task Correlation Uses cwd and Git Reflog

**Status:** Accepted. The order of branch sources is superseded by ADR-0028.

## Context

Attributing an agent session to a Task must work for agents that do not exist yet. Harnesses differ: Claude Code records `gitBranch` in its session artifacts, Codex does not. Both record `cwd` and a session identifier.

Explicit registration through an MCP `run.start` call was considered. It fails by construction: Binnacle is manual-first and does not launch runs, so the call depends on an agent remembering to make it.

## Decision

- `cwd` identifies the **Project**. This works for every harness.
- The branch active during the session is recovered from the **repository's own `git reflog`**, matched against the session's timestamps — not from the harness.
- The branch maps to a **Task** by naming convention. No match yields project-level `unassigned`.
- Where a harness does report a branch, it is used as a cross-check.

## Rationale

The reflog is a fact recorded by Git itself, so this works identically for an agent nobody has written yet. Nothing is inferred from content.

## Consequences

- Branch naming convention becomes load-bearing — cheap, and visible to the human.
- Reflog entries expire after 90 days by default and each worktree keeps its own, so historical import beyond that window attributes to the project only.
- `unassigned` remains a first-class outcome, as `docs/operations/02-existing-project-adopt.md` already requires.
