# 06: Domain state machines for Task, AgentRun and Review

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/core-and-persistence/spec.md`

**What to build:** the domain the tracker and telemetry adapters will consume in epics 3 and 4, so that those adapters map into a model rather than inventing one. This is the one ticket in the epic with no path to a user; it is verified by its own tests and by nothing else. No storage is created here — tables arrive with the epics that write to them.

- [x] Types for Project, Task, AgentRun and Review live in the core package and match `docs/06-data-model.md`.
- [x] Three separate transition functions implement the Task, AgentRun and Review state machines from `docs/workflow/03-state-machines.md`.
- [x] There is no combined status enum spanning the three entities.
- [x] A transition returns either the next state or a typed rejection naming why; it never throws.
- [x] States are string-literal unions rather than enums, so the sources run under Node's built-in type stripping.
- [x] The core package has no runtime dependencies.
- [x] No table is created for Task, AgentRun or Review.

## Comments

Implemented on `feat/domain-state-machines`. 98 tests pass, `tsc --noEmit` clean.

What epics 3 and 4 consume, from `@binnacle/core`:

- **Types `Project`, `Task`, `AgentRun` and `Review`**, camelCase, with every field of `docs/06-data-model.md`. A field the model marks optional is `T | null`, never undefined, never a default. Timestamps are ISO 8601 strings. Roles, harnesses, providers, priorities and initiators are plain strings until an adapter has real values to narrow them to.
- **`transitionTask`, `transitionAgentRun`, `transitionReview`**, each `(from, to)` over its own string-literal union. They return `{ ok: true, state }` or `{ ok: false, code, message }` and never throw, including for `undefined`, a number or `toString`. The codes are part of the contract: `transition.unknown_state` (either side is not a state of this machine — what an adapter gets for an unmapped value, or for another machine's state), `transition.terminal` and `transition.not_allowed`.
- **A transition is a target state, not a named event.** The spec says "a current state and a transition". Adapters observe states, not the reasons between them, and the diagram names only one edge ("changes requested"). So `READY_FOR_REVIEW → ACTIVE` is that edge, identified by the pair.

Readings of `docs/workflow/03-state-machines.md` where it is silent, each in a comment beside its table:

- **`CANCELLED` is reachable from every Task state before `MERGED`.** "Applicable pre-completion states" could include `MERGED`, since the doc also says merged is not done. Once code is merged, cancelling would claim it was not. Revisit if epic 3 meets a merged task whose follow-up is abandoned.
- **`FAILED`, `ABORTED` and `BUDGET_EXCEEDED` are reachable from `PLANNED`, `RUNNING` and `WAITING_INPUT`.** The doc lists them as terminal alternatives without an origin.
- **Nothing is added where the doc has no edge.** A reopened issue (`DONE → ACTIVE`) is rejected. The tracker adapter surfaces that rejection. Adding a reopen edge is epic 3's decision, made against real tracker data.
- **`Review.cycle` is a field, not machine behaviour.** A cycle is one `RESOLVED → IN_REVIEW`; the writer in epic 3 or 4 counts it.

Two things a reviewer should know:

- **`packages/core` tests are again a second seam**, as in ticket 03, and here there is no alternative. The ticket says it is "verified by its own tests and by nothing else": nothing in the daemon API touches these entities yet. The test pins every ordered pair of states of each machine, so a missing edge and an extra one both fail. It was checked by adding `MERGED → CANCELLED` and watching it fail.
- **Core's `Project` is the data model's, not the daemon's `ProjectRow`.** It has no consumer yet. The two disagree on purpose. `ProjectRow.id` is nullable because an unreadable manifest yields no id, and a row carries no remote because Git facts are never stored. `Project.name`, `remote` and `trackerType` are nullable although the model does not mark them optional: an undeclared name or tracker comes back null (ticket 03), and no remote is a normal case (ticket 04). Reconciling the two belongs to whichever epic first needs a `Project` over the API.

No table was created: the store still has only `meta`, `project` and `event`. The purity test covers the new source file as it does every file in `src/`.

### Review

Reviewed on both axes. No acceptance criterion was missing. Fixed:

- **Two machines were justified by conflicting arguments.** The AgentRun comment said rejecting an observed state "would drop a fact", while the Task machine rejects a reopened issue. Both now say the same thing: follow the diagram's edges, and choose only where the diagram names no origin.
- The test restated the result type inline instead of using `TransitionResult`, and asserted `ok` twice per case. `LIVE_RUN_ENDS` is now `TERMINAL_ALTERNATIVES`, the doc's own term.

Kept deliberately: the rejection repeats `Diagnostic`'s `{ code, message }` rather than reusing it, so that `code` stays a closed union a caller can switch on.
