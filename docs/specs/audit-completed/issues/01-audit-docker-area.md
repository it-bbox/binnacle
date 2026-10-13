# 01: Docker in the audit

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** `binn audit` gains the `docker` area, after the existing areas (spec, *Docker*). With no container file tracked, one `ok` finding says the project has no container setup. Each build context with a `Dockerfile`, `Dockerfile.*`, `*.Dockerfile`, `Containerfile`, `compose.yaml`, `compose.yml`, `docker-compose.yml` or `docker-compose.yaml`, at the root or in a tracked subdirectory, is one finding: a `gap` when `.dockerignore` is missing beside it, or when it does not exclude `.env` or `.git` (naming which), `ok` when it excludes both; a pattern that covers them, such as `.env*` or `**/.git`, counts. Each finding names the files it read. Read-only, offline, nothing but Git run, from `git ls-files`.

This ticket also adds the test that runs the audit on this repository's own tree and expects no gap in the `docker`, `secrets` and `security` areas, so that tickets 02 and 03 inherit it.

- [ ] Through `binn audit --json`: no container file gives one `ok`; a Dockerfile with no `.dockerignore` is a `gap`; a `.dockerignore` leaving `.env` in is a `gap` naming `.env`; one excluding both is `ok`.
- [ ] A Dockerfile in a subdirectory is read against the `.dockerignore` beside it; untracked container files are never read.
- [ ] The audit on this repository gives no gap in the new areas.
- [ ] The existing tests that the audit writes nothing and runs offline still pass with the new area.
