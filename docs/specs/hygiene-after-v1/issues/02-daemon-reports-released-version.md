# 02: The daemon reports the released version

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-v1/spec.md`
Roles: Developer, Reviewer

**What to build:** `binn daemon status` gives the version of the Binnacle that runs, from a source checkout as from the npm package (spec, *The daemon's version*; product inbox, *The daemon's own version*). In the source layout the daemon reads the CLI package's version, the one the release bumps, instead of its own workspace package's; in the bundle it keeps reading the published package's `package.json` (ADR-0044).

- [x] From the source checkout, `binn daemon status` reports the CLI package's version, through the CLI's tests.
- [x] In the package build's test, the bundled daemon's reported version equals the bundle's `package.json`.
- [x] The `daemon.started` and `daemon.stopped` events carry the same version.
- [x] `packageVersion`'s other callers are unchanged.

## Comments

- **What changed.** `VERSION` in `apps/daemon/src/version.ts` tells the layouts apart as `daemonEntry` and the dashboard's root already do, by whether the module is a `.ts` file. From source it reads `apps/cli/package.json`; in the bundle it keeps reading the `package.json` one level above `bin/`. `packageVersion`'s code and its other caller, `binn --version` in `apps/cli/src/bin.ts`, are unchanged. `apps/daemon/package.json` stays at `0.1.0`, and nothing reads it for the version any more.
- **The tests.** `apps/cli/test/smoke.test.ts` checks that `binn daemon status` from the source checkout reports the CLI package's version. `apps/daemon/test/rebuild.test.ts` checks that every `daemon.started` and `daemon.stopped` event carries that version. `apps/cli/test/tarball.live.ts` checks that the installed bundle's `binn daemon status` reports the bundle's `package.json` version.
- **A question answered in the smallest way the spec allows.** *Where does the bundle's check live?* The spec names `apps/cli/test/pack.test.ts`, but that test packs `apps/cli` with `pnpm pack` and never builds the bundle. Only `apps/cli/test/tarball.live.ts` builds the package and runs its `binnd`, so the check is there. `pnpm test` does not run it; the workflow's `tarball-live` job does, on Linux, macOS and Windows. It passed locally with `node --test apps/cli/test/tarball.live.ts`.
- **For ticket 09.** The exit demonstration's `binn daemon status` in the clean container should now print the published version, `0.4.0` once the CLI package is bumped.

### Review

A sub-agent reviewed the branch against `main` on both axes.

**Standards: no violation.** The code change is one line, telling the layouts apart as `daemonEntry` and the dashboard's root do; the tests read the version as `tarball.live.ts` already did; the commits follow `AGENTS.md`.

1. `packageVersion`'s comment said it reads the version of the package a module belongs to, while `VERSION` now passes it a directory of another package. **Fixed**: the comment says it reads the `package.json` one level above the URL's directory.

**Spec: every criterion met, no scope creep.** Every other reader of the daemon's version (`/health`, `daemon.status`, the dashboard's settings, `binnd`'s log line, the lifecycle events) takes it from the runtime, so the change reaches them all; the MCP server's version comes from `binn --version`, unchanged.

1. The bundle's check is in `tarball.live.ts`, not in `pack.test.ts` as the spec says. **Kept**, as answered above: `pack.test.ts` builds no bundle.
2. Run with `node --preserve-symlinks`, the daemon would resolve `apps/cli/node_modules/@binnacle/daemon/src/` and not find the CLI's `package.json`. **Left**: nothing runs it so.
