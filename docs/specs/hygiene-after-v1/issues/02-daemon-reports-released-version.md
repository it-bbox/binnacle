# 02: The daemon reports the released version

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-v1/spec.md`
Roles: Developer, Reviewer

**What to build:** `binn daemon status` gives the version of the Binnacle that runs, from a source checkout as from the npm package (spec, *The daemon's version*; product inbox, *The daemon's own version*). In the source layout the daemon reads the CLI package's version, the one the release bumps, instead of its own workspace package's; in the bundle it keeps reading the published package's `package.json` (ADR-0044).

- [ ] From the source checkout, `binn daemon status` reports the CLI package's version, through the CLI's tests.
- [ ] In the package build's test, the bundled daemon's reported version equals the bundle's `package.json`.
- [ ] The `daemon.started` and `daemon.stopped` events carry the same version.
- [ ] `packageVersion`'s other callers are unchanged.

## Comments

- **What changed.** `VERSION` in `apps/daemon/src/version.ts` tells the layouts apart as `daemonEntry` and the dashboard's root already do, by whether the module is a `.ts` file. From source it reads `apps/cli/package.json`; in the bundle it keeps reading the `package.json` one level above `bin/`. `packageVersion` itself and its other caller, `binn --version` in `apps/cli/src/bin.ts`, are unchanged. `apps/daemon/package.json` stays at `0.1.0`, and nothing reads it for the version any more.
- **The tests.** `apps/cli/test/smoke.test.ts` checks that `binn daemon status` from the source checkout reports the CLI package's version. `apps/daemon/test/rebuild.test.ts` checks that every `daemon.started` and `daemon.stopped` event carries that version. `apps/cli/test/tarball.live.ts` checks that the installed bundle's `binn daemon status` reports the bundle's `package.json` version.
- **A question answered in the smallest way the spec allows.** *Where does the bundle's check live?* The spec names `apps/cli/test/pack.test.ts`, but that test packs `apps/cli` with `pnpm pack` and never builds the bundle. Only `apps/cli/test/tarball.live.ts` builds the package and runs its `binnd`, so the check is there. `pnpm test` does not run it; the workflow's `tarball-live` job does, on Linux, macOS and Windows. It passed locally with `node --test apps/cli/test/tarball.live.ts`.
- **For ticket 09.** The exit demonstration's `binn daemon status` in the clean container should now print the published version, `0.4.0` once the CLI package is bumped.
