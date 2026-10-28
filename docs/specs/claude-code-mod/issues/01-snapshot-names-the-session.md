# 01: The snapshot names this session and its checkout's Task

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/claude-code-mod/spec.md`
Roles: Developer, Reviewer

**What to build:** a caller of `project_snapshot` that names its harness session learns which run is its own, and every caller learns the Task its checkout's branch maps to. This ticket covers the spec's *The snapshot names this session* and *The snapshot names the checkout's Task*.

`project_snapshot` gains an optional `session` argument, a harness session's id, passed on to `project.snapshot`, which already reads `session` from its body. With it, `activity` gains `own`: this session's latest run with its Task id and title (or null), its role, and its tokens summed over the session's runs. `own` is null when Binnacle has stored no run of that session. `checkout` gains `taskId`: the Task whose branch name maps to the checkout's current branch, by the rule that attributes runs to Tasks, or null. `binn mcp` still sends no session of its own.

- [ ] Through `project.snapshot`, as `apps/daemon/test/snapshot.test.ts` builds it:
  - `session` naming a stored session gives `activity.own` with its Task, title, role and summed tokens;
  - an unknown session gives `own: null`;
  - no `session` leaves `activity` as before.
- [ ] `checkout.taskId` is the Task of a ticket's branch, and null on the default branch and on a branch that maps to no Task.
- [ ] Through `toolRequest` in `packages/mcp/test/smoke.test.ts`: `project_snapshot` takes `session` and passes it on, and still takes no argument at all.
- [ ] The context-pressure item's `own` reads the same with `session` passed through the tool as through `binn call`.
- [ ] `docs/03-mcp-and-skills.md` describes the argument and both new fields, and the tool's description names them.
