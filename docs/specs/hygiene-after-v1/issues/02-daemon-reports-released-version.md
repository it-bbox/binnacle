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
