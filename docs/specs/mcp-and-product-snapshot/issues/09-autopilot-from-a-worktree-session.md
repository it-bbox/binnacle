# 09: `/autopilot` from a worktree session

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`, `docs/adr/ADR-0022-autopilot.md`

Found by ticket 07's demonstration and ticket 08's hand check.

**What is wrong:** the Claude Code desktop app opens a new session in a worktree under `.claude/worktrees/` by default. `/autopilot` needs the registered main checkout with `main` checked out, so from such a session it refuses — correctly, but with no way forward the owner can follow at a glance. It happened twice in one morning, and a demonstration session ran in a worktree without anyone noticing.

**What to build:** the smallest change that gets the owner from that refusal to a running autopilot.

- [ ] When `/autopilot` refuses because the session is not in the registered main checkout, it names the checkout it is in, the registered checkout's path, and exactly how to start a session there with worktree isolation off.
- [ ] The refusal still starts nothing and changes nothing.
- [ ] `/product` states plainly when the session is in a linked worktree rather than the registered checkout, so the owner sees it before running anything.

## Comments
