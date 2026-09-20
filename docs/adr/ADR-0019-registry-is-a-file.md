# ADR-0019: The Machine Project Registry Is a File

**Status:** Accepted

## Context

ADR-0015 splits local storage into exactly two tiers: projections, dropped and rebuilt from canonical sources whenever the schema version changes, and one append-only table of ingested records, migrated properly and never recreated.

Specifying epic 1 surfaced something that fits neither tier — the set of repository paths a user has registered on this machine. Nothing outside Binnacle records it. Git does not know it, the tracker does not know it, and the repository's own `.binnacle/project.yaml` says what the project is but not that this machine tracks it. So it cannot be re-derived after a drop, and dropping it silently unregisters the user's projects on an upgrade they did not read about.

The alternative was to keep it in the append-only tier. That tier exists for records parsed out of third-party artifacts that may no longer be on disk; a list of paths the user typed is not that. Putting it there to gain the migration guarantee would widen the tier until the one-sentence rule stops being a rule.

## Decision

- The **project registry** — the list of repository paths registered on this machine — is a JSON file under the Binnacle home directory, written owner-only where the platform enforces file modes. It holds paths and when each was registered, and nothing else.
- The `Project` table is a **projection** of that file plus each repository's manifest plus live Git facts. It stays in the tier that is dropped and rebuilt.
- ADR-0015's two tiers are unchanged. The registry is not a third tier of database storage; it lives outside the database, and therefore outside that ADR's subject.

## Rationale

ADR-0002 already places canonical state in portable sources. A list of paths in a text file is as portable as that gets: readable, editable by hand, backed up by copying it, and repairable when the database is gone — which is exactly the state it has to survive.

It also keeps the rebuild honest. With the registry outside, "drop the projections and re-derive them from canonical sources" is a complete sentence. With it inside, the sentence needs an exception, and an exception inside a one-sentence rule is how a per-table migration suite starts.

It is less code than the alternative, not more: no migration path for the one table that would have needed one.

## Consequences

- Registration survives a deleted database and an upgrade that changes every table. Deleting the database costs runtime history only, as ADR-0002 intends.
- The single daemon per Binnacle home is what excludes concurrent writers, for this file exactly as for the database.
- Editing the file by hand while no daemon is running is a supported repair, not a private format. A path that is not a repository projects as a project whose Git facts are unavailable, with a reason — the same handling any non-repository gets.
- On Windows, owner-only file modes are not enforced. The file is protected by the user profile's ACL and by nothing Binnacle does, and the documentation says so rather than implying otherwise.
