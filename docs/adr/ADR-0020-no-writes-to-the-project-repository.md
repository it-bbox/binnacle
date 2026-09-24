# ADR-0020: Binnacle Does Not Write to a Project's Repository

**Status:** Accepted. ADR-0026 makes one exception: `binn init`, after confirmation.

## Context

A checkpoint ends in writes to canonical sources: a term in `CONTEXT.md`, a new ADR, a ticket's status, the roadmap. ADR-0012 already settles that the prose comes from the calling session and that nothing is written before the human confirms. It leaves open who performs the write once confirmed: Binnacle, Binnacle with a Git commit, or the calling session with its own tools.

## Decision

Binnacle **writes nothing into a project's repository** — no files, no commits. The calling session writes and commits with its own tooling after the human confirms, exactly as it closes an issue under ADR-0013.

`checkpoint.prepare` returns the computed delta and typed promotion candidates. The second step records that a checkpoint happened — at which commit, and what was promoted — as an event in Binnacle's own store. Because it commits nothing, it is named `checkpoint.record`, not `checkpoint.commit`.

## Rationale

- The Git adapter stays read-only by construction, not by care, and Binnacle gains no write path into someone else's repository: no merge conflicts with the session's own edits, no commit authorship, no hooks run on its behalf.
- The session that wrote the prose is already editing the repository and already holds the human's confirmation; a second writer adds a failure mode and no capability.
- Harness support level 1 (ADR-0014) stays an MCP call: a harness that can read Binnacle and edit files has everything a checkpoint needs.

## Consequences

- `docs/03-mcp-and-skills.md` renames `checkpoint.commit` to `checkpoint.record`.
- Binnacle cannot check that a confirmed promotion was actually written except by reading the repository afterwards, like anything else it reads.
- The only state Binnacle writes remains its own: the registry file and the machine store under `~/.binnacle/`.
