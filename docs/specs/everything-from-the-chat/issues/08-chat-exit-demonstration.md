# 08: The exit demonstration of epic 9

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** epic 9's exit criterion, demonstrated by the owner.

- [ ] In a Claude Code chat, with the daemon stopped and no terminal opened, the owner runs `/binnacle:init` on a fresh repository, reads the whole plan in the chat, and confirms it with one yes.
- [ ] The owner runs `/binnacle:daemon start`, `/binnacle:register`, `/binnacle:status` and `/binnacle:dashboard`. The dashboard opens, and no token appears in the chat.
- [ ] An autopilot run merges a ticket that changes a skill, and the next session runs the changed skill without anyone running `pnpm install`.
- [ ] The owner records under `## Comments` whether setup from the chat is good enough to replace the terminal. Defects are filed as tickets, and the roadmap marks epic 9 done only when none is open.

## Comments
