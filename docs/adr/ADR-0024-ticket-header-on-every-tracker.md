# ADR-0024: A Ticket Carries the Same Header on Every Tracker

**Status:** Accepted

## Context

The local Markdown tracker reads a Task's state, dependencies and spec from `Status:`, `Blocked by:` and `Spec:` lines near the top of each ticket. A GitHub or GitLab issue has none of that natively: it is open or closed, and GitHub adds a close reason, `completed` or `not_planned`. The Task state machine (`docs/workflow/03-state-machines.md`) is far richer. Binnacle cannot write the state anywhere (ADR-0013), and an adapter may not guess one.

Considered and rejected:

- **`state:*` labels.** They are visible and filterable in the tracker's UI, but labels already carry the triage role, and ADR-0017 keeps state and triage on separate axes.
- **Open and closed only.** No convention is needed, but every open issue then has a `null` state, and the snapshot's in-flight and ready-to-start sections are always empty.
- **Native boards**: the Status field of GitHub Projects v2, `workflow::` scoped labels in GitLab. They are the most familiar to a human, but they are two mechanisms, GitHub's needs GraphQL and a wider token scope, and each project would need its own mapping onto Task states.
- **Native dependency links** in GitHub, and GitLab's blocking links, which exist only on paid tiers.

## Decision

A remote issue carries the same **ticket header** as a local ticket: `Status:`, `Blocked by:` and `Spec:` lines at the top of its body. One parser serves every tracker.

- **Closing is a fact.** A closed issue is `DONE`, or `CANCELLED` when GitHub reports `not_planned`, whatever its body says.
- An open issue takes its state from `Status:`. With no `Status:` line, its state is `null` with a diagnostic.
- Any disagreement between the two, such as a closed issue whose body says `ACTIVE` or an open one whose body says `DONE`, is an attention item, `tracker.state_mismatch`. It catches both "forgot to close" and "forgot to update the line".
- A remote Task's identity is its issue number, `#42`. The tracker is always a single repository, declared in the manifest.
- `Blocked by:` lists issue numbers. Native dependency links and sub-issues are not read, and there is no parent or subtask relation in the tracker contract.

## Consequences

- `/to-tickets` has to write the header. It learns the convention from the project's `docs/agents/issue-tracker.md`, which `binn init` offers to extend (ADR-0026).
- An issue filed by hand without a header shows up with a `null` state and a diagnostic, never with a guessed one.
- Someone who records dependencies only through GitHub's native links will not see them in Binnacle. Reading them is a change to this decision, made when someone actually relies on them.
