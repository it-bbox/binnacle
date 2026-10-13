# 07: The exit demonstration of epic 17

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06
Spec: `docs/specs/release/spec.md`

**What to build:** epic 17's exit criterion, by the owner (spec, the exit criterion, *Further Notes*).

- [ ] CI's package job is green on Linux, macOS and Windows at `main`'s head.
- [ ] The owner publishes `@it-bbox/binnacle@0.1.0` from the built package's directory.
- [ ] In a clean environment — a temporary prefix and home, or a container — `npm i -g @it-bbox/binnacle` from the registry, then `binn init` in a new project, `binn daemon start` and the dashboard work.
- [ ] The README and the guides read well on GitHub, in English and in Russian.
- [ ] `it-bbox/binnacle` is public; private vulnerability reporting and Dependabot alerts are on.
