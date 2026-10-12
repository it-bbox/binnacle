# 10: The current Epic is the one in progress

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** found at the exit demonstration (09, 2026-10-12). The current Epic is the first epic that is not `done`, so with epic 12 `not started` above epic 16 `in progress`, the sidebar, the Overview's epic progress, the Projects table and the board's default tab all show epic 12, with no Tasks, and the Suggested step offers to grill 12 while 16 waits for its demonstration. The current Epic becomes the first epic `in progress`, in the roadmap's order, and the first that is not `done` only when none is in progress.

The rule lives once, beside `suggestedStep` in `packages/core/src/roadmap.ts`, which today reads the first not `done` itself; `task.list`'s default (`apps/daemon/src/board.ts`) uses it, and the dashboard reads the current Epic from the daemon rather than deriving it in `currentEpic` (`apps/dashboard/app/composables/projects.ts`). If that means the snapshot names its current epic, `docs/03-mcp-and-skills.md` says so.

- [x] With an epic `in progress` after one `not started`, the snapshot's alternatives and `task.list` without a spec take the epic in progress; tested through the daemon's HTTP API, as `snapshot.test.ts` does.
- [x] With none in progress, the first epic not `done` is current, as today.
- [x] The sidebar, the Overview, the Projects table and the board's default tab show the same current Epic.
- [x] `docs/04-telemetry-dashboard.md` (and `docs/03-mcp-and-skills.md` where the snapshot changes) define the current Epic by this rule.
- [x] Checked in a browser on this repository: epic 16 is current.

## Comments

`currentEpic` in `packages/core/src/roadmap.ts` holds the rule; `suggestedStep` and `task.list`'s default read it, and the snapshot names the epic as `roadmap.current` (an `Epic` or `null`), which the sidebar, the Overview, the Projects table and the board's default tab read instead of deriving it. The Overview's stepper and the board's tabs match an epic to it by number. Checked in a browser against a temporary daemon on this repository: all four show epic 16, and tab 12, without a spec and no longer current, is disabled.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground.

**Standards.** To fix:

1. **The rule restated in comments** (`apps/daemon/src/snapshot.ts`, `apps/dashboard/app/composables/projects.ts`), so a change to it edits prose in several places. **Fixed** in 5cd75c6: they refer to `currentEpic` and to `docs/04-telemetry-dashboard.md`; the rule stays in core, `docs/03`, `docs/04` and the MCP tool's description.
2. **Comment lines left unwrapped** in `suggestedStep`'s and `taskList`'s doc comments. **Fixed** in 5cd75c6.

Kept:

3. "Current epic" not in `CONTEXT.md`: the ticket names `docs/03` and `docs/04` as where the rule is defined.
4. `Status: DONE` missing at review time: it is this branch's last commit.
5. The repeated `tickets || in progress` test in `roadmap.ts`: older than this change.

**Spec.** No finding to fix. Kept:

6. The MCP tool's description names `current`: the snapshot now names its current epic, which the ticket asks to be said.
7. An epic not started above the current one is a later step on the Overview: the rule's consequence.
8. Epics matched by number, not by object: a duplicate number is a roadmap error already.
9. `docs/specs/minimal-dashboard/spec.md` still says "first not `done`": a past epic's spec is a record; the rule lives in `docs/03` and `docs/04`.
10. Autopilot's own choice of epic (named, else the one `in progress`): it asks when unsure and never used "first not done".
