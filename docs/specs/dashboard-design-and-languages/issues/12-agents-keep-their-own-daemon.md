# 12: Each autopilot agent keeps its own daemon

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** found while autopilot ran tickets 07 to 10 on 2026-09-27: agents checking their work in a browser each started a temporary daemon, and two of them chose the same `BINNACLE_HOME` in the session's shared scratchpad and the same port, so ticket 08's agent registered its worktree in ticket 10's daemon. A daemon from a worktree no longer listed by `git worktree list` was also left running. Each agent's temporary daemon is its own, and it is gone when the agent reports.

- [ ] Autopilot's brief tells each agent to keep any temporary `BINNACLE_HOME` inside its own worktree, where `git worktree remove` takes it away, and to start any temporary daemon on a port no other daemon listens on.
- [ ] The brief tells the agent to stop every daemon it started before it reports, and to say in its report that it did.
- [ ] Autopilot's step 7, before `git worktree remove`, checks that no daemon runs from the worktree, and names any it finds in its report under *Waiting for the owner*, without stopping it.
- [ ] The owner's daemon stays untouched, as today.
