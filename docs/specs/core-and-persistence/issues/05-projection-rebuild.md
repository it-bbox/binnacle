# 05: Projections rebuild on schema change

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/core-and-persistence/spec.md`

**What to build:** a user upgrades Binnacle without reading a changelog, and nothing is asked of them and nothing of theirs is lost. The projections are dropped and re-derived; the registry and the history survive. This is the ADR-0015 rule executed while the only thing at stake is a project row — deliberately before there is telemetry to lose.

- [x] Starting a daemon whose stored schema version differs from the running one drops and re-derives the projections.
- [x] The registry file and the event history survive untouched.
- [x] Every previously registered project is listed after a rebuild, with manifest facts re-read from each repository.
- [x] The rebuild is recorded as an event, so "rebuilt" is distinguishable from "lost".
- [x] A rebuild needs no command from the user and no migration step.
- [x] A repository that has disappeared from disk since registration is reported with a reason rather than dropping the registration.
- [x] `project.status` and `project.detect` on a registered repository that has disappeared answer with the project and the reason, as `project.list` does. A missing path no registration contains is still `project.path_not_found`. Today both refuse it with `project.path_not_found` before the registry is read (ticket 04, comments).
- [x] Daemon start and stop are recorded as `daemon.started` and `daemon.stopped` events. The spec lists both among epic 1's events and no ticket carried them until now (ticket 02, comments).

## Comments

Implemented on `feat/projection-rebuild`. 104 tests pass, `tsc --noEmit` clean.

Decisions worth knowing before ticket 07 and epic 2:

- **The rebuild lives in `openStore`.** The version is read inside a `begin immediate` transaction. When a stored version exists and differs from `SCHEMA_VERSION`, the `project` table is dropped and recreated empty. The new version and a `store.rebuilt` event, with `{ from, to }`, commit in that same transaction. The daemon then re-derives the projection from the registry file, as it does on every start. A fresh or deleted database has no stored version, so it records no rebuild. A deleted database has lost its history, which is the known cost (ADR-0002).
- **`store.rebuilt` records the drop, not the re-derivation.** If re-deriving fails right after it, for example because the registry is unreadable, the start fails loudly and the next start re-derives without a second event. The alternative was to record the event after re-deriving, but then a crash in between would bump the version with no event at all. That is the "lost" this ticket exists to tell apart.
- **A new projection table must be added to the drop.** The drop names `project` explicitly. Epics 3 and 4 add their tables there too.
- **A downgrade rebuilds like any mismatch.** An older Binnacle meeting a newer store drops the projections and assumes the event table is still readable. The first migration of the event table is where a downgrade has to be refused instead. A `ponytail:` comment in `store.ts` records this.
- **`daemon.started` and `daemon.stopped`** carry `pid` and `version`, and `daemon.started` also carries the bound `port`. A start is recorded only once the daemon is listening, and a stop only when it is clean. A killed daemon leaves a start with no stop after it, which is the honest record. Tests that asserted a project's whole history now filter `event.list` by `path`, since those events have no project.
- **A disappeared repository is answered, not refused.** `readManifest` reports a missing repository directory as `project.path_not_found` ("No directory at …") rather than as a missing manifest, and that message becomes the projection's `unavailable` reason. `project.status` and `project.detect` read the registry before the disk. A missing path that a registration contains is answered with the project, and `project.status` then reports Git as unavailable. A missing path that no registration contains is still `project.path_not_found`. A missing path is resolved through its nearest existing ancestor, so a symlinked prefix still matches.
- **`project.list` now re-derives, as detect and status already did.** Without that, a repository that disappeared while the daemon ran would show its reason only after the next start. A list call can therefore record `project.manifest_changed`, the same as the other two.
- **The rebuild test fabricates an older store.** It opens the database with `node:sqlite`, sets `schema_version` to `0` and gives `project` an older shape. That is a fixture, like a manifest file. The alternative was a test-only override of the schema version, which is exactly the injection seam the spec rules out. It does couple the test to the store's table names.

### Review

Reviewed on both axes. No acceptance criterion was missing. Fixed:

- **Two starts racing on one store could both rebuild.** The version was read before a deferred `begin`. It is now read inside `begin immediate`.
- **A failed open could mask its own error.** The rollback ran even after SQLite had already rolled back, and threw over the original error. It now runs only while a transaction is open.
- **The store leaked when re-deriving failed at start.** This predates this ticket. It is now closed.
- **A repository that disappeared from under a symlinked prefix read as not found**, because the missing path could not be resolved to the registered real path. It is now resolved through its nearest existing ancestor, and a test covers it.
- A one-entry list of projection tables was inlined, and the fixture no longer inserts a row that proved nothing.

Kept deliberately: the `store.rebuilt` placement above, and `project.list` re-deriving, which reads every manifest on each call. There is no data volume to optimise against yet (spec, Out of Scope).
