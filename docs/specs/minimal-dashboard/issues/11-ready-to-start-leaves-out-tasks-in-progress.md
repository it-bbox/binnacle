# 11: Ready to start leaves out a Task the board shows In progress

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** a defect the owner filed from the exit demonstration, ticket 09, on 2026-09-26. While ticket 09's session ran, the Overview listed `minimal-dashboard/09` under *Ready to start*, with its start command, and at the same time under *Running now*, with the Suggested step saying to wait for it and the board placing it In progress. *Ready to start* is the snapshot's `tasks.readyToStart`, which `taskSections` in `apps/daemon/src/snapshot.ts` reads from the ticket's state alone. The board reads In progress from runs, through `boardColumn` in `packages/core/src/tracker.ts` (ADR-0032). A list that offers to start a Task already being worked on answers "what do I type" wrongly.

- [ ] A `READY` Task that the board places In progress, because a run is attributed to it, is not in the snapshot's *Ready to start*, and so not on the Overview's. It is read by the same rule as the board, not a second one.
- [ ] The Task stays reachable from the Overview, as a Task in flight or under *Running now*, whichever the change settles on; the ticket's `Status:` is still never written (ADR-0032).
- [ ] The daily's `readyToStart` agrees with the snapshot's, or the ticket's Comments say why it does not.
- [ ] A test through the daemon seam covers a `READY` Task with a run on its branch and one without.
