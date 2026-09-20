# 06: Domain state machines for Task, AgentRun and Review

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/core-and-persistence/spec.md`

**What to build:** the domain the tracker and telemetry adapters will consume in epics 3 and 4, so that those adapters map into a model rather than inventing one. This is the one ticket in the epic with no path to a user; it is verified by its own tests and by nothing else. No storage is created here — tables arrive with the epics that write to them.

- [ ] Types for Project, Task, AgentRun and Review live in the core package and match `docs/06-data-model.md`.
- [ ] Three separate transition functions implement the Task, AgentRun and Review state machines from `docs/workflow/03-state-machines.md`.
- [ ] There is no combined status enum spanning the three entities.
- [ ] A transition returns either the next state or a typed rejection naming why; it never throws.
- [ ] States are string-literal unions rather than enums, so the sources run under Node's built-in type stripping.
- [ ] The core package has no runtime dependencies.
- [ ] No table is created for Task, AgentRun or Review.
