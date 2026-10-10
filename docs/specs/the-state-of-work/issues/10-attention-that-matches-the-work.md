# 10: Attention that matches the work

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer

**What to build:** two attention items corrected (spec, *The stale Next action* and *`review.missing`*). A Next action of `/binnacle:autopilot` or `binnacle-autopilot` naming an epic, by number or spec slug, whose spec has tickets and none left for an agent — every Task `DONE`, `CANCELLED` or `ready-for-human` — is `next_action.stale`, saying why. A `DONE` Task whose `Triage:` is `ready-for-human` is not `review.missing`. Both items leave `docs/product-inbox.md` with this spec.

- [ ] Tests as `next.test.ts` sets up a roadmap: stale by number and by slug; not stale while one Task is left for an agent, one with an unanswered question included; not stale for an epic with no tickets; the existing `DONE`-Task rule unchanged.
- [ ] Tests as `snapshot.test.ts`: a `DONE` `ready-for-human` ticket without a Review raises nothing; a `DONE` `ready-for-agent` one still does.
- [ ] On this repository, `project_snapshot` no longer raises `review.missing` for `skills-in-any-harness/08` and `telemetry-for-any-harness/15`.
