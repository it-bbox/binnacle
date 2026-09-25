# 08: `binn init` asks for the import window

Status: READY
Triage: ready-for-agent
Blocked by: 06
Spec: `docs/specs/telemetry/spec.md`

**What to build:** adopting Binnacle includes an informed choice of how much history to import. Decided in the spec, under *`binn init`*.

- [ ] A step after the manifest step counts, per harness, the sessions whose `cwd` lies in this repository and the oldest date, reading only each file's first record.
- [ ] It asks for the window: `90` (default), a number of days, or `all`. End of input is the default and writes nothing on its own.
- [ ] With a new manifest the answer goes into it; with an existing one the `telemetry.import.window_days` line is printed, not written (ADR-0026).
- [ ] Tests through the subprocess seam with `HOME` and the artifact roots in temporary directories: counts and dates shown, 90 written by default, `all` and a number accepted, the line printed for an existing manifest.
