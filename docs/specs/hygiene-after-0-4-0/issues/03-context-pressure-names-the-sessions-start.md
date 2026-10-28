# 03: The context-pressure item names the session's start

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`
Roles: Developer, Reviewer

**What to build:** the context-pressure warning says when the session started, not when its latest run did (spec, *The session's start*; product inbox, *Left after epic 20's tickets*). The item's `params.startedAt` and the time in its message are the earliest start among the stored runs of the same harness session; the start is dated, as `sessionTimes` already does, when it falls on another day than the latest activity.

- [ ] Through `project.snapshot`: a session with two runs gives the earlier run's start in the message and in `params.startedAt`.
- [ ] A session that started on another day than its latest activity gives the start with its date, in English and, through `wordMessage`, in Russian.
- [ ] A session with one run reads as before.
