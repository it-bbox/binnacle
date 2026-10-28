# 03: The context-pressure item names the session's start

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`
Roles: Developer, Reviewer

**What to build:** the context-pressure warning says when the session started, not when its latest run did (spec, *The session's start*; product inbox, *Left after epic 20's tickets*). The item's `params.startedAt` and the time in its message are the earliest start among the stored runs of the same harness session; the start is dated, as `sessionTimes` already does, when it falls on another day than the latest activity.

- [x] Through `project.snapshot`: a session with two runs gives the earlier run's start in the message and in `params.startedAt`.
- [x] A session that started on another day than its latest activity gives the start with its date, in English and, through `wordMessage`, in Russian.
- [x] A session with one run reads as before.

## Comments

- **For the next tickets:** `pressureAttention` in `apps/daemon/src/usage.ts` takes the session's start from the earliest of its stored runs, by `sessionKey` (harness, session, subagent), whatever the run's branch, role or checkout; `lastActivityAt` stays the active Product run's. Ticket 05's threshold per model changes the same item and leaves this alone.
- **Decision:** "a session with one run reads as before" is pinned by the unchanged first test of `apps/daemon/test/context-pressure.test.ts`; no new test for it.

### Review

Reviewed against `main` in a sub-agent, on the project's standards and the ticket's spec. Every criterion holds and is pinned through `project.snapshot`, the Russian through `wordMessage`; the another-day test passed under UTC+14, UTC−11 and New York. Nothing blocks.

- `apps/daemon/src/usage.ts`, `pressureAttention`'s comment: a line far longer than its neighbours, and "its run's latest activity" where the run is the Product run. Fixed: rewrapped, "its Product run's".
- `apps/daemon/src/usage.ts`, the earliest start: `observedRuns` returns runs in start order, so the first seen would do. Kept: the minimum does not depend on that order and costs nothing.
