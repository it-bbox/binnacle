# 02: Tasks in the Product Snapshot

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

**What to build:** a `project.snapshot` operation that tells a fresh Product session which Tasks are in flight, which can start now and how many sit in every other state, read live from the project's tracker. It introduces the Task-reading half of the tracker contract and the local Markdown tracker as its first adapter; later tickets add the snapshot's other sections to the same operation. Decided in the spec, under *Task-reading contract*, *Local Markdown adapter* and *Product Snapshot*.

- [ ] The Task-reading contract is defined in core, as types and pure functions with no dependencies, before the adapter that implements it: identity, title, state, declared dependencies, spec reference, triage role, ticket path.
- [ ] The local Markdown adapter reads every ticket under the manifest's `tracker.local.issues`, with identity `<spec-slug>/<NN>` and the title taken from the first heading without its number.
- [ ] `Status:`, `Triage:`, `Blocked by:` and `Spec:` are read from the header lines; `Blocked by: None`, with or without a parenthetical, means no dependencies; numbers refer to tickets in the same spec directory.
- [ ] A `Status:` value that is not a Task state gives the Task a `null` state and an attention item. Nothing is guessed.
- [ ] Unmet dependencies are computed by the contract, not the adapter: a declared dependency whose Task is not `DONE`. A dependency naming no known Task is an attention item, not an Unmet dependency.
- [ ] The snapshot lists by name every Task in `ACTIVE`, `BLOCKED`, `READY_FOR_REVIEW`, `APPROVED` and `MERGE_READY`, and every `READY` Task with no Unmet dependencies; every other state, `null` included, appears as a count.
- [ ] Each listed Task carries identity, title, state, Unmet dependencies and ticket path. Each section holds at most ten items and reports a remainder count.
- [ ] `BLOCKED` and an Unmet dependency are reported separately.
- [ ] Tickets are read on every call; an edit to a ticket file shows in the next snapshot. No Task table is created.
- [ ] The response is deterministic: the same files give the same snapshot, in a stable order.
- [ ] Tests through the daemon seam use a fixture with tickets in every Task state, including the limits, the remainder counts and both attention items.

## Comments
