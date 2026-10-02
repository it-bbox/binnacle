# ADR-0026: `binn init` Writes Into the Repository Only After Confirmation

**Status:** Accepted. Superseded in part by ADR-0034: `binn init` shows one plan and asks once, and Enter accepts it at a terminal. Extended by ADR-0037: a confirmation in the chat counts as the human's.

**Supersedes:** in part, ADR-0020's "no files" for the one command a human runs to adopt Binnacle. Everything else in ADR-0020 stands.

## Context

ADR-0020 says Binnacle writes nothing into a project's repository. That was decided for the daemon and the MCP surface, and in practice for the checkpoint. `binn init` has to produce files that live in the repository: `.binnacle/project.yaml`, a project-scoped MCP registration such as `.mcp.json`, and the ticket-header section of `docs/agents/issue-tracker.md` (ADR-0024).

Having `binn init` only print those files keeps ADR-0020 literal, but it turns setup into copy and paste, including for the first harness.

## Decision

`binn init` is a CLI command started by a human. It may create or extend files in the repository, on these terms:

- it shows each file, or each addition to an existing file, and writes it only after the human confirms;
- it never overwrites an existing file, and extends one only by a section the human has seen;
- it never commits.

The daemon, the MCP server and every other command keep writing nothing into a repository.

## Consequences

- `binn init` is the only path that writes into a project's repository. A test states that no other operation does.
- The human commits what `binn init` wrote, like any other change, and can review it first.
- Writes outside the repository, such as user-scope harness configuration or Binnacle's own home directory, require confirmation too (`docs/operations/05-installation-checklist.md`).
