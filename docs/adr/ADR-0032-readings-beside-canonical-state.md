# ADR-0032: Binnacle's Own Readings Stand Beside the Canonical State and Are Never Written Back

**Status:** Accepted

## Context

A binnacle does not steer and does not choose the course (ADR-0009). In v1, Binnacle analyses and recommends; the human decides (`CONTEXT.md`, *Manual-first*).

On 2026-09-26 the owner reported that the process was hard to follow: a next action written as a paragraph left them asking what to type. Epic 5's grilling found two places where the canonical sources alone cannot say what the owner needs to see:

- **The course.** The roadmap's current focus names the Next action, but it can lag behind the work, or end without a command.
- **The work.** A ticket's `Status:` reads `READY` for as long as a session works on it. The implementation session sets `DONE` in its last commit, on its own branch, so the header alone cannot say which ticket is being worked on, or by whom.

## Decision

- Binnacle shows two readings of its own, each labelled as its calculation and each beside the canonical source it reads:
  - the **Suggested step**, computed from the Tasks, their AgentRuns and the roadmap's epic statuses, beside the roadmap's Next action;
  - **In progress**, which covers a `READY` Task with an AgentRun attributed to it, beside the ticket's `Status:`.
- The canonical source leads. The Next action is shown first and is the course. A reading never replaces it.
- Binnacle never writes a reading back: not to the roadmap, not to a ticket, not to the tracker (ADR-0013, ADR-0020).
- Where the two disagree in a way that is a fact, the disagreement is itself shown. A Next action with no command, or whose command names a Task that is already `DONE` or `CANCELLED`, is an attention item.
- The daemon computes the readings once. The dashboard and the Product Snapshot both show them.

## Considered Options

- **The Next action alone.** Rejected: it is exactly what left the owner asking what to type whenever the focus lagged or had no command.
- **The Suggested step alone.** Rejected: Binnacle would then choose the course, against ADR-0009, and the course would be whatever its rules encode.
- **The implementation session writing `Status: ACTIVE` to `main` when it starts.** Rejected: an implementation session never commits a ticket to `main` (`docs/workflow/02-development-workflow.md`), and every start would cost a commit.

## Consequences

- The Suggested step's rules follow this repository's workflow: the Matt Pocock chain, then `/binnacle:autopilot` or one ticket at a time. Where they do not fit a project, its Next action still leads.
- In progress is only as good as run attribution (ADR-0018, ADR-0030). Work whose checkout Binnacle cannot read does not show as In progress.
- The kanban can show a ticket In progress while its file still says `READY`. That is by design, and the card says the reading comes from runs.
