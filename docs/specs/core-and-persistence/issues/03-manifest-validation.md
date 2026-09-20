# 03: Full manifest validation and diagnostics

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/core-and-persistence/spec.md`

**What to build:** a broken `.binnacle/project.yaml` tells its owner everything that is wrong with it in a single run, in terms of the file they wrote — not in terms of Binnacle's internals. A manifest written by a newer Binnacle degrades instead of failing.

- [ ] Every problem in a manifest is reported in one response, so fixing it is one edit rather than one edit per run.
- [ ] Each problem names the exact field path and what was expected there.
- [ ] Unknown keys are reported as warnings and do not fail registration.
- [ ] Validation never throws on invalid input; it returns problems.
- [ ] Validation is a pure function in the core package with no runtime dependencies. Reading the file and parsing YAML happen outside it.
- [ ] No secret is read from the manifest or written to it; tracker credentials never appear there (ADR-0013).
- [ ] A manifest that changed since it was last projected is re-read and the change recorded as an event.
