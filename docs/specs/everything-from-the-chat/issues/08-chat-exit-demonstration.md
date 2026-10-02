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

### Steps for the demonstration, 2026-10-03

Refresh the plugin first, as in epic 7's demonstration (`docs/specs/audit-and-adopt/issues/08-audit-exit-demonstration.md`). Make **repository B**, new and empty: `mkdir ~/demo-chat && cd ~/demo-chat && git init && git commit --allow-empty -m init`. From here on, open no terminal; everything happens in a Claude Code chat.

1. **Stop the daemon.** In any session, type `/binnacle:daemon stop`, then `/binnacle:daemon`: it should say the daemon is not running.
2. **Init from the chat.** Open a new session in repository B and type `/binnacle:init`. Read the whole plan in the chat and answer yes in one message. The plan is written.
3. **Daemon and registration.** In the same session, type in turn `/binnacle:daemon start` (it says the daemon started), `/binnacle:register` (the project is registered), `/binnacle:status` (a summary of the project) and `/binnacle:dashboard` (the dashboard opens in the browser). No long token string appears in any reply.
4. **The same session sees the daemon.** Ticket 04's hand check: right after `/binnacle:daemon start`, in that same session, type `/binnacle:product`. It shows the snapshot, not `daemon.unreachable`.
5. **Autopilot refreshes the plugin itself.** Ticket 07's hand check. It needs one small ticket that changes the text of a skill, set up first in a Product session on this repository. Run `/binnacle:autopilot` to merge it, then open a new session and check that the skill is the new one, with nobody having run `pnpm install`.
6. Under `## Comments`, write whether setup from the chat is good enough to replace the terminal. Tick each criterion that held; for one that did not, write one line on what went wrong, to become a ticket.
