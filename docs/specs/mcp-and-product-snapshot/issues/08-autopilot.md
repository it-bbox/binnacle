# 08: `/autopilot`

Status: READY
Triage: ready-for-agent
Blocked by: 07
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`, `docs/adr/ADR-0022-autopilot.md`

**What to build:** a human says `/autopilot` in a Product session, and the current epic's remaining tickets are implemented, verified and merged one after another — or side by side where nothing blocks them — until the epic is done or a question only the owner can answer stops it. The owner gets a push notification and, at the end, a report. Decided in ADR-0022. It is the procedure a Product session followed by hand for epic 2's tickets 06 and 07, written down.

- [ ] `.claude/skills/autopilot/SKILL.md` is committed beside `/product`, `/daily` and `/checkpoint`, with `disable-model-invocation: true`, and contains procedure only.
- [ ] It refuses to start unless the epic is planned: a spec and tickets exist and the roadmap has the epic at `tickets` or `in progress`. It never runs `/grill-with-docs`, `/to-spec` or `/to-tickets`, and never starts the next epic.
- [ ] It picks tickets from the snapshot: `READY` with no Unmet dependency. Tickets with no blocking edge between them may run in parallel, each agent in its own worktree; one ticket never has two agents.
- [ ] Each agent follows the per-ticket process: its own `feat/<slug>` branch, test-first, typecheck, `/code-review` on both axes, `### Review` recorded, criteria ticked, `DONE` in its last commit, no attribution lines.
- [ ] Before merging, the session verifies the branch itself: typecheck and the full suite green in the agent's worktree, every criterion ticked, `### Review` present, `DONE` last, no attribution lines, no new dependency the ticket did not ask for, and a fast-forward onto `main`. A later parallel branch is rebased by its own agent first.
- [ ] After a merge it pushes, removes the worktree and its branches, and brings the main checkout's dependencies up to date.
- [ ] A question only the owner can answer stops the ticket it blocks and everything depending on it, sets nothing `DONE`, and sends a push notification naming the question. A question that blocks nothing is answered in the smallest way the spec allows and recorded in the ticket.
- [ ] It also stops a ticket on failing checks, an unresolved review finding, a conflict that is not mechanical, or a change outside the ticket; unaffected tickets continue.
- [ ] A step that needs a human — a hand check, `/checkpoint`'s confirmation, an exit demonstration — is prepared and left for the human, never simulated.
- [ ] It never force-pushes, changes settings, touches another repository, or stops a daemon the human is running.
- [ ] It ends with a report — what merged with its commits, what the reviews found, what waits for the owner — and a push notification.
- [ ] Verified by hand once: `/autopilot` on a planned epic with at least two tickets runs them to merge, and a planted blocking question stops the dependent ticket and notifies.

## Comments

The overnight run of tickets 06 and 07 found two things this procedure must handle. A review sub-agent's report reached the Product session instead of the agent that requested it, and the agent waited; the session relayed it. And the retired manual workflow section also held the durable per-ticket rules, so retiring it had to move them rather than delete them — a ticket's text alone does not always say which parts of a document are temporary.
