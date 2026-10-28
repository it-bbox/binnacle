# 01: The snapshot names this session and its checkout's Task

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/claude-code-mod/spec.md`
Roles: Developer, Reviewer

**What to build:** a caller of `project_snapshot` that names its harness session learns which run is its own, and every caller learns the Task its checkout's branch maps to. This ticket covers the spec's *The snapshot names this session* and *The snapshot names the checkout's Task*.

`project_snapshot` gains an optional `session` argument, a harness session's id, passed on to `project.snapshot`, which already reads `session` from its body. With it, `activity` gains `own`: this session's latest run with its Task id and title (or null), its role, and its tokens summed over the session's runs. `own` is null when Binnacle has stored no run of that session. `checkout` gains `taskId`: the Task whose branch name maps to the checkout's current branch, by the rule that attributes runs to Tasks, or null. `binn mcp` still sends no session of its own.

- [x] Through `project.snapshot`, as `apps/daemon/test/snapshot.test.ts` builds it:
  - `session` naming a stored session gives `activity.own` with its Task, title, role and summed tokens;
  - an unknown session gives `own: null`;
  - no `session` leaves `activity` as before.
- [x] `checkout.taskId` is the Task of a ticket's branch, and null on the default branch and on a branch that maps to no Task.
- [x] Through `toolRequest` in `packages/mcp/test/smoke.test.ts`: `project_snapshot` takes `session` and passes it on, and still takes no argument at all.
- [x] The context-pressure item's `own` reads the same with `session` passed through the tool as through `binn call`.
- [x] `docs/03-mcp-and-skills.md` describes the argument and both new fields, and the tool's description names them.

## Comments

Decisions taken here, none of them the owner's:

- `activity.own` covers the session's own runs: a subagent is a session of its own, as `usage.ts`'s `Session` reads one, so neither its run nor its tokens are the caller's. Under autopilot the agents' tokens stay with their Tasks.
- `activity.own` is `{ taskId, taskTitle, role, totals }`: what the spec names, nothing of the run beside it. It is absent without `session`, and absent too when the tracker cannot be read, with the rest of `activity`.
- A `session` the tool's arguments name wins over the one `binn call` reads from its environment, so that an explicit session is never overridden.
- The `activity.own` tests live in `apps/daemon/test/context-pressure.test.ts`, beside the `context.pressure` item's own, whose Claude Code session helpers they reuse; `checkout.taskId`'s in `apps/daemon/test/snapshot.test.ts`.

For the next ticket: the mod calls `project_snapshot` with `{ "session": $.session.id() }`. The status line reads `activity.own` (`totals` is a `sum` of `Totals`, each field `{ tokens, partial, provenance }`, `tokens` null when no record reported it), and the session-start lines and the checkpoint button read `checkout.taskId`. `own` is null for a session Binnacle has not ingested yet, as on its first refresh.

Known outside this ticket: `apps/cli/test/pack.test.ts`'s "the five reporting skills ... list CONTEXT.md's Russian words" fails on `main` already, since `CONTEXT.md` gained *Mod — мод* in the epic's grilling commit and no skill lists it yet.

### Review

Reviewed in a sub-agent against `main`, on the standards and the spec. Every criterion holds; no must-fix finding.

- Fixed: the `own` test did not tell the latest run from the first, both on the Task's branch. A second session ending on `main` now gives `[null, null, 'product']` (`context-pressure.test.ts`).
- Fixed: leaving subagents out of `own` was untested. A subagent of the session now runs beside it, and the test fails when its run is counted.
- Fixed: the `session` argument's description said omitting it asks as no session, wrong under `binn call`. It now says what each caller sends (`packages/mcp/src/index.ts`).
- Fixed: `toolRequest`'s comment now says an argument's `session` wins, and the body sets `path` last, whatever a schema names.
- Fixed: the tool's description says subagents are left out, as the docs do. `project.snapshot`'s comment in `operations.ts` names `activity.own`.
- Fixed: the Task title lookup, written twice in `activityOf`, is one `titleOf`.
- Kept: subagents left out of `own.totals`, against the reviewer's question whether the session's spend should include them. A subagent is its own session in Binnacle's model, and under autopilot its tokens are its Task's.
