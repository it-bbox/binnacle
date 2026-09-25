# 04: Subagent runs

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/telemetry/spec.md`

**What to build:** the work a review or an autopilot spawns is counted, as runs of their own linked to the run that started them. Decided in the spec, under *Where the artifacts are* and *Observed runs and attribution*.

- [ ] `<session>/subagents/agent-<id>.jsonl` files are read beside their session; each record carries its subagent id and parent session.
- [ ] A subagent's run names its parent run, and is attributed to its own Task by its own `cwd` and branch.
- [ ] The subagent's `.meta.json` description is never read into a record.
- [ ] Tests through the daemon seam: a subagent on the parent's branch, one in a worktree on a ticket branch, and the parent link in `usage.get` once ticket 03 has landed, otherwise in the stored runs.
