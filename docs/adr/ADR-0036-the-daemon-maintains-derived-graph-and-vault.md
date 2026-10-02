# ADR-0036: The Daemon Keeps the Graph and the Vault Current

**Status:** Accepted

**Supersedes:** in part, ADR-0020's "the daemon writes nothing into a repository", for one git-ignored derived directory; and decision 14 of `docs/08-open-questions.md`, "Binnacle never runs `graphify` itself".

## Context

The owner chose, on 2026-10-02, that the daemon updates the Graphify graph itself after changes reach `main`, rather than leaving it to a human or a skill, and that it keeps an Obsidian vault in step with the Project Brain. Both mean the daemon runs an external tool and writes files, which ADR-0020 and decision 14 forbade.

## Decision

- **Graphify.** When `main` of a registered project moves, the daemon runs `graphify` in the background to update the graph. The graph lives in Graphify's own output directory in the repository, which `binn init` adds to `.gitignore`. It is derived: deleting it loses nothing. A failed run is an attention item, never a broken daemon.
- **Obsidian.** The daemon keeps a one-way projection of the Project Brain under `Projects/<Project>/` in a vault whose path is a per-machine setting (decision 13). It writes only files it generated, marked as such, and never touches a note the human wrote. Edits in the vault do not flow back.
- Nothing else changes: the daemon writes no other file into a repository, never into a tracked file, and never commits.

## Considered Options

- **A human or a skill updates the graph**: rejected by the owner; the graph would go stale between runs.
- **Two-way sync with the vault**: rejected; canonical knowledge stays in Git.

## Consequences

- The test that no operation writes into a repository allows exactly the graph directory, and only when it is git-ignored.
- The daemon depends on `graphify` being on its PATH; without it, the graph is reported as not available.
