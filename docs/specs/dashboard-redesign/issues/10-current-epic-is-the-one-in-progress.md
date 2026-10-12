# 10: The current Epic is the one in progress

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** found at the exit demonstration (09, 2026-10-12). The current Epic is the first epic that is not `done`, so with epic 12 `not started` above epic 16 `in progress`, the sidebar, the Overview's epic progress, the Projects table and the board's default tab all show epic 12, with no Tasks, and the Suggested step offers to grill 12 while 16 waits for its demonstration. The current Epic becomes the first epic `in progress`, in the roadmap's order, and the first that is not `done` only when none is in progress.

The rule lives once, beside `suggestedStep` in `packages/core/src/roadmap.ts`, which today reads the first not `done` itself; `task.list`'s default (`apps/daemon/src/board.ts`) uses it, and the dashboard reads the current Epic from the daemon rather than deriving it in `currentEpic` (`apps/dashboard/app/composables/projects.ts`). If that means the snapshot names its current epic, `docs/03-mcp-and-skills.md` says so.

- [ ] With an epic `in progress` after one `not started`, the snapshot's alternatives and `task.list` without a spec take the epic in progress; tested through the daemon's HTTP API, as `snapshot.test.ts` does.
- [ ] With none in progress, the first epic not `done` is current, as today.
- [ ] The sidebar, the Overview, the Projects table and the board's default tab show the same current Epic.
- [ ] `docs/04-telemetry-dashboard.md` (and `docs/03-mcp-and-skills.md` where the snapshot changes) define the current Epic by this rule.
- [ ] Checked in a browser on this repository: epic 16 is current.
