# 04: A new session's run at once

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/hygiene-after-0-7/spec.md`
Roles: Developer, Reviewer, Architect

**What to build:** a new Claude Code session's run, with its Task and role, reaches the snapshot and the mod's status line within seconds of its first turn, not a minute later (spec, *A new session's run at once*; product inbox, *Left after epic 22's tickets*). The adapter holds a file's last message until the file has gone `SETTLED_AFTER_MS` unwritten, so that a message still being written is never counted; a session with one message therefore has no run until then. The reading of an unsettled file still holds back that message's token counts, but yields the session's run, its session id, working directory, branch and timestamps, with token counts null; the ingest stores it and replaces it when the message settles. A run with null counts is in progress from activity and attributed to its Task like any other, and every total reads null as no data, never zero. `SETTLED_AFTER_MS` is unchanged.

- [ ] Through `project.snapshot` with a Claude Code session file written just now, on a Task's branch: its run is in `activity.running` with its Task and role, and its tokens are null.
- [ ] The same Task is in progress from activity in the snapshot and on the board.
- [ ] Once the file is older than the settling time, `usage.get` counts the message's tokens once, with no second run for the session.
- [ ] A file with settled messages and an unsettled last one reads as today: the settled messages counted, the last one held.
- [ ] Every reader of runs takes a run with null tokens: usage by role and by Task, the dashboard's activity, the vault and the mod's line say no data, never zero.
- [ ] `docs/04-telemetry-dashboard.md`, where the settling rule is described, says a run is known before its tokens are.

## Comments
