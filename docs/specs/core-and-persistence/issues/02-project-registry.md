# 02: Register, list and unregister a project

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/core-and-persistence/spec.md`

**What to build:** a user can tell Binnacle that a repository exists, see everything this machine tracks, and take a repository back out again without anything in it changing. The manifest is read only as far as registration needs — its version and the project's identity; the full validation surface is ticket 03.

- [x] `binn project register <path>` records the repository and reports the project it registered.
- [x] Registering the same path twice succeeds and changes nothing.
- [x] `binn project list` shows every registered project with its name and path.
- [x] `binn project unregister` removes the registration and changes nothing inside the repository.
- [x] Registering a directory with no committed project manifest fails with a message naming the template to copy.
- [x] A manifest whose `version` is unsupported is a hard error naming the supported version.
- [x] The list of registered paths is a file under the Binnacle home directory, owner-only where enforced, per ADR-0019. The `Project` table is a projection of it and is never the record of what is registered.
- [x] The daemon is the only process that opens the database; the CLI reaches state only through the API.
- [x] Registering and unregistering each append an event carrying provenance.
- [x] `event.list` returns events newest first, filtered by project and time, with a limit. No aggregation.
- [x] Deleting the database and starting again loses no registration.

## Comments

Implemented on `feat/project-registry`. 55 tests pass under `node:test`, `tsc --noEmit` clean.

Decisions worth knowing before tickets 03 to 05:

- **ADR-0019 is executed, not just recorded.** `<home>/projects.json` holds the registered paths; the `project` table is re-derived from it on every daemon start, before the server listens. That is why deleting the database loses no registration, and it is the same code path ticket 05 extends to a schema-version mismatch.
- **A repository is addressed by its real path.** Registration resolves symlinks, so one repository reached two ways is one project. Unregistering tolerates a path that has since disappeared, because that is exactly when it is needed.
- **A project id is read from the manifest or it is not known.** A registered repository whose manifest cannot be read projects with `id: null` and an `unavailable` reason rather than vanishing from the list or having an id guessed from its directory name. That is most of ticket 05's "reported with a reason" criterion; 05 still owns the schema-mismatch rebuild.
- **`schema_version` is written with `insert or ignore`, not `or replace`.** The stored value is what a later Binnacle compares against to decide whether to rebuild. Overwriting it on every open would destroy the one fact that decision needs. Ticket 05 reads it, rebuilds, then writes the new one.
- **The event table is the append-only tier** and the projection never touches it. A test asserts events survive a rebuild of the projection from the registry.
- **Registration wants the manifest at `<path>/.binnacle/project.yaml` and does not walk up.** Walking up from a nested working directory is `project.detect`, which is ticket 04.

Two things a reviewer should look at:

- **The daemon now has one runtime dependency, `yaml`.** Node has no YAML parser and the manifest is YAML; the spec sanctioned "one small YAML dependency". The ADR-0012 test asserted `dependencies === undefined`, which was a proxy for "cannot reach the network" that held only while nothing was needed. It now asserts against a named allowlist, so adding a dependency stays a deliberate act that has to be argued for in a test change. If that reads as loosening someone else's guard, say so and the parser can move behind a package boundary instead.
- **Gap in the slicing, not a defect.** The spec lists `daemon started` and `daemon stopped` among epic 1's events. No ticket carries them: ticket 01 predates the event table and ticket 02's criteria do not mention them. They are not implemented. Place them deliberately rather than letting them arrive by accident.

### Review

Reviewed on both axes. Eight findings fixed, one deferred with a reason, 59 tests passing.

Real defects, all fixed:

- **A relative path resolved against the daemon's own directory.** `project.register` with `"path": "."` from any client other than this CLI would have registered whatever directory `binnd` was started in. The daemon now refuses a relative path outright; resolving against the caller's directory is the caller's job, which is what the CLI already did. This one was invisible through the CLI and would have surfaced first through MCP in epic 2.
- **Re-registering bypassed the version check.** The manifest was read only when the entry was new, so a project whose manifest had since become unsupported answered 200 with a reason attached instead of the hard error the ticket asks for. The manifest is now read on every call.
- **A test claimed more than it proved.** "Survives the database being rebuilt" only restarted the daemon. It now changes the manifest between runs, so the projection has to be re-derived to pass, and asserts the event history did not move — which is the property that was being claimed.
- **`RegistryUnreadableError` never reached its reader.** It carried a repair instruction that the server turned into a bare 500, on the one file here that is canonical. It is now an `OperationError` with code `registry.unreadable`.
- **`event.list` named a bound it did not enforce**, clamping silently while the message promised rejection. It rejects.
- **`binn project list` printed the id where the criterion asks for the name.**

Scope and smells, fixed:

- Deleted `store.project(path)` (no callers; it is `project.status`, ticket 04) and `pragma foreign_keys = on` (no foreign keys).
- Stopped re-exporting `readRegistry`, `RegistryUnreadableError`, `RegistryEntry` and `SCHEMA_VERSION`, which nothing outside the daemon consumes.
- The CLI reuses the exported `ProjectRow` instead of redeclaring it, and both command groups share one token step rather than two copies of the same message.
- Renamed `project(entry)` to `deriveProject(entry)`: the old name collided with the table, `store.projects()` and the `project.*` operation names all at once.

Deferred, deliberately:

- **Manifest reading lives in the daemon, not in `packages/core`,** where the spec puts validation. Ticket 03 rewrites this code and its criteria already require the core package, so moving it now would be churn. It is staging, and it is recorded here so it does not become permanent by silence.

Merged to `main` in `0951197`, review included.
