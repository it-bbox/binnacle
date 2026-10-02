# 05: The audit reads .scratch, tests, CI and structure

Status: READY
Triage: ready-for-agent
Blocked by: 03
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** two more areas of `binn audit`. `.scratch`: whether it exists and whether Git ignores it, a `.scratch` that is not ignored as a gap, a `.scratch` that holds the only copy of something durable, a spec or a ticket not tracked anywhere else, as a gap (ADR-0005, ADR-0017), and no `.scratch` as an `ok` and nothing more. Tests, CI and structure: whether the repository has a test setup and a CI configuration, and whether it is a workspace of packages or a single package, all from files that are there. Nothing is run: not the tests, not CI.

- [ ] A fixture whose `.scratch` Git does not ignore gets a gap, and one whose `.scratch` is ignored does not.
- [ ] A fixture whose `.scratch` holds the only copy of a spec gets a gap that says what to move into Git.
- [ ] A repository with no `.scratch` gets an `ok`.
- [ ] Test setup, CI configuration and the project's shape are reported from files, and nothing is executed to find them.
