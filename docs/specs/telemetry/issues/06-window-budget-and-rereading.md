# 06: Import window, time budget and re-reading

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/telemetry/spec.md`

**What to build:** the first import of a large history never blocks a Product session, and the window can be widened later without double counting. Decided in the spec, under *Ingest*.

- [x] The manifest validator accepts `telemetry.import.window_days: all`.
- [x] A file whose size shrank, or a window that grew beyond the one its cursor was read under, is re-read from the start; the unique constraint absorbs the repeats.
- [x] A call waits for its project's ingest up to a fixed budget; the rest continues in the background, one ingest at a time per machine, and `importing` says so.
- [x] The daemon starts an ingest for every registered project on startup.
- [x] A project registered later gets its history under its window.
- [x] Records whose artifact was deleted are still counted.
- [x] Tests through the daemon seam: `all`, widening without duplicates, a budget exceeded then completed, and a deleted artifact.

## Comments

- **Where it lives.** `apps/daemon/src/usage.ts`:
  - `startIngest` decides at once which files have anything to read. A project with nothing new settles immediately. Anything else is queued behind the machine's other ingests on the daemon's `Importer` (`OperationContext.importer`), with a yield between files.
  - `usage` waits for the run up to `INGEST_BUDGET_MS`.
  - `readPosition` decides where a file is read from.
  - `forgetRead` runs when a project is newly registered.
  - `stopImporting` runs when the daemon stops: the running ingest ends after its current file and the store closes after it.
  - `projectRegistry` now returns what it projected, so the start can queue an ingest for each project with its manifest.
  - `ImportWindow` (`number | 'all'`) is exported from `packages/core`.
- **Decided here, within the spec.**
  - **The budget is 1 second** (`INGEST_BUDGET_MS`). On the owner's artifacts the whole 90-day import of this repository took 0.4 s on the first snapshot and 0.05 s on the next. `DaemonOptions.ingestBudgetMs` overrides it, and `0` never waits. The budget test uses that override.
  - **`importing.windowStart` is `null` for `all`.** There is no start date to give.
  - **`importing.incomplete` is true exactly while this project's ingest is still queued or running when the call answers.** A failure found by a run that has not finished is reported by the next call that sees it finish.
  - **While an incomplete import has stored nothing yet,** Claude Code's level is `null` with the reason "The import of this project has not reached a record yet.", not "no session was found", which would be false.
  - **The cursor stores `all` as text in its `window_days` column.** SQLite keeps a value its column's type cannot convert as it is, so no migration of the append-only tier was needed. `docs/06-data-model.md` says the column holds a number of days or `all`.
  - **A narrowed window keeps what was imported** (append-only). It is recorded on the cursor, so widening again re-reads from the start, which is harmless.
  - **A call joins the project's running ingest only if it was started under the same window.** Otherwise it starts its own, for example after the startup ingest, when the manifest has changed since. No test covers this: the startup ingest finishes before any call can arrive, so no test can deterministically catch a stale run in flight.
  - **A project registered later gets its history on its first call.** The spec starts ingests on calls and on startup only, so registering does not start one. Registering does forget the cursors of the files the new project's import will read. An earlier project whose Claude Code directory name is a prefix of the new one's (`/x/proj` and `/x/proj-later`) has already read those files and moved their cursors past records that belonged to no registered project at the time.
- **Ticket 01's hand-offs, answered.**
  - A shrunk file is now re-read from the start.
  - The `ponytail:` note on records of another project read under this one's window stays, reworded. That project's own ingest re-reads the file when its window is wider, so nothing is lost. The cost: two such projects with different windows take turns re-reading the files they share.
- **Run on the owner's own artifacts.** The branch's daemon ran in a temporary Binnacle home with this repository's main checkout registered and the default window. It gave `importing: { incomplete: false, windowStart: "2026-06-28" }`, 205 messages today and 1,447 in the week, with Claude Code at level 3.

### Review

`/code-review` against `main`, both axes in sub-agents.

**Standards**

1. Ticket not yet `DONE`. **Fixed** by this commit.
2. `all` stored as text in the `window_days integer` column of a table in the migrated tier. **Kept**: SQLite's column types are affinities in a table that is not `STRICT`, the value round-trips exactly, and a real migration of the append-only tier for one sentinel is more risk than it removes. Recorded above and in the data model.
3. "A number of days or `all`" was written three times. **Fixed**: `ImportWindow` in `packages/core`.
4. `server.ts` set the importer's state directly on stop. **Fixed**: `stopImporting` beside the importer.
5. `positiveInteger` gained an `alternative` parameter for one caller. **Kept**: it keeps the problem message honest ("expected a positive integer or all") without a second copy of the check.
6. `readPosition` is called both when queuing and when reading a file. **Kept**, with a comment: the file or its cursor may have moved while the ingest was queued.
7. A call joined a run started under an older window and reported it complete. **Fixed** (see above).
8. A run cut short by the daemon stopping settles as complete. **Left**: it only happens during shutdown, and every file it did read committed whole.
9. A failure found by a run still going is not reported until a later call sees the run finish. **Left**, as decided above.
10. The budget's timer is not cancelled when the ingest wins. **Left**: it is unreferenced and ends within the budget.

**Spec**

1. A project registered later whose Claude Code directory name starts with an already-registered project's never got its history: the earlier project's import had moved the shared files' cursors past it. **Fixed**: registering forgets those cursors. A test registers `project` and then `project-later`.
2. A nested project registered later (`/x/proj/sub` inside a registered `/x/proj`) gets its files re-read, but the records already stored under `/x/proj` stay there. **Left**: the spec attributes a record to its project at ingest, and the append-only tier never rewrites a record. Two projects registered in one repository are already a noted edge case (`operations.ts`).
3. `windowStart: null` for `all` and the level reason while importing were not in the spec. **Kept**, recorded above.
4. The budget test uses a budget of `0`, which never waits, so a nonzero budget expiring between files is not tested directly. **Kept**: a real expiry depends on timing, and every other usage test answers `incomplete: false` with the real budget.
5. Two projects sharing files with different windows take turns re-reading them. **Kept**, as the `ponytail:` note says.

A known race is also **left**: a project registered while another project's ingest is reading one of its files can have that file's cursor moved past it again. Registering it again after unregistering, or widening its window, re-reads the file.

Typecheck is clean and the full suite passes, 274 of 274.
