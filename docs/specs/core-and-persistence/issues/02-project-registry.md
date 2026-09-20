# 02: Register, list and unregister a project

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/core-and-persistence/spec.md`

**What to build:** a user can tell Binnacle that a repository exists, see everything this machine tracks, and take a repository back out again without anything in it changing. The manifest is read only as far as registration needs — its version and the project's identity; the full validation surface is ticket 03.

- [ ] `binn project register <path>` records the repository and reports the project it registered.
- [ ] Registering the same path twice succeeds and changes nothing.
- [ ] `binn project list` shows every registered project with its name and path.
- [ ] `binn project unregister` removes the registration and changes nothing inside the repository.
- [ ] Registering a directory with no committed project manifest fails with a message naming the template to copy.
- [ ] A manifest whose `version` is unsupported is a hard error naming the supported version.
- [ ] The list of registered paths is a file under the Binnacle home directory, owner-only where enforced, per ADR-0019. The `Project` table is a projection of it and is never the record of what is registered.
- [ ] The daemon is the only process that opens the database; the CLI reaches state only through the API.
- [ ] Registering and unregistering each append an event carrying provenance.
- [ ] `event.list` returns events newest first, filtered by project and time, with a limit. No aggregation.
- [ ] Deleting the database and starting again loses no registration.
