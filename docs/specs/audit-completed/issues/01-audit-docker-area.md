# 01: Docker in the audit

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** `binn audit` gains the `docker` area, after the existing areas (spec, *Docker*). With no container file tracked, one `ok` finding says the project has no container setup. Each build context with a `Dockerfile`, `Dockerfile.*`, `*.Dockerfile`, `Containerfile`, `compose.yaml`, `compose.yml`, `docker-compose.yml` or `docker-compose.yaml`, at the root or in a tracked subdirectory, is one finding: a `gap` when `.dockerignore` is missing beside it, or when it does not exclude `.env` or `.git` (naming which), `ok` when it excludes both; a pattern that covers them, such as `.env*` or `**/.git`, counts. Each finding names the files it read. Read-only, offline, nothing but Git run, from `git ls-files`.

This ticket also adds the test that runs the audit on this repository's own tree and expects no gap in the `docker`, `secrets` and `security` areas, so that tickets 02 and 03 inherit it.

- [x] Through `binn audit --json`: no container file gives one `ok`; a Dockerfile with no `.dockerignore` is a `gap`; a `.dockerignore` leaving `.env` in is a `gap` naming `.env`; one excluding both is `ok`.
- [x] A Dockerfile in a subdirectory is read against the `.dockerignore` beside it; untracked container files are never read.
- [x] The audit on this repository gives no gap in the new areas.
- [x] The existing tests that the audit writes nothing and runs offline still pass with the new area.

## Comments

- Codes: `docker.setup` (no container file tracked, `ok`; `unknown` when `git ls-files` fails) and `docker.ignore`, one per directory holding a container file. The directory stands for the build context; a `docker build -f` from elsewhere or a compose `build.context` is not followed (a `ponytail:` comment in `apps/cli/src/audit-files.ts` says so).
- Decisions where the ticket is silent: the `.git` directory counts as excluded when `.git/config` is, so `.git/**` counts; a `<Dockerfile>.dockerignore` beside a Dockerfile is read for it instead of the directory's `.dockerignore`, as BuildKit does; a `[...]` class in a pattern is read as literal text, which can give a false gap but never stops the audit; a `.dockerignore` must itself be tracked to count.
- For tickets 02 and 03: `tracked(root)` in `apps/cli/src/audit-files.ts` is the `git ls-files` list both new areas read; `AUDIT_AREAS` in `packages/core/src/audit.ts` takes `secrets` and `security` after `docker`; the test "binn audit on this repository's own tree gives no gap in the docker, secrets and security areas" in `apps/cli/test/audit.test.ts` already filters on both, and the first test's list of areas needs them added.

### Review

Against `main`, in a sub-agent, on the standards and the spec; the ticket names no role beyond the Developer and the Reviewer, and Binnacle's Security suggestion was covered as a note.

1. **A malformed pattern crashed the audit**: a class such as `[z-a]` made `new RegExp` throw, and `binn audit` died with a stack trace. **Fixed**: `[` is literal text; the test plants `[z-a]`.
2. **A `<Dockerfile>.dockerignore` was not read** (security): BuildKit uses it instead of `.dockerignore`, so a lax one beside a correct `.dockerignore` read `ok`. **Fixed**: each Dockerfile is read against its own ignore file when tracked; a test covers it.
3. **`Dockerfile.dev.dockerignore` was taken for a container file.** **Fixed**: the name pattern refuses any `*.dockerignore`.
4. **"no .dockerignore" when an untracked one exists.** **Fixed**: the reason says "no tracked".
5. `.git` is probed through `.git/config` only, so a file excluding only `.git/config` counts. **Kept**: the config is what can carry credentials, and the probe lets `.git/**` count.
6. `#` is a comment after trimming, where Docker takes it at column 0 only. **Kept**: no difference for `.env` and `.git`.
7. Lower-case `dockerfile`, `Containerfile.*` and `compose.override.yaml` are not matched. **Left**: the ticket lists the names; add them when an adoption misses one.
8. The build context is the file's directory, not a compose `build.context` or a `-f` from the root. **Kept**: the spec says "beside it"; a `ponytail:` comment names the ceiling.
9. `git ls-files` now runs twice per audit. **Kept**: cheap, and caching it is surface for nothing.
