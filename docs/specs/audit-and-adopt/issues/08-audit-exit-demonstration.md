# 08: The exit demonstration of audit and adopt

Status: READY
Triage: ready-for-human
Blocked by: 04, 05, 06, 07
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** epic 7's exit criterion, demonstrated by the owner. A large third-party repository stays post-v1 (`docs/00-scope.md`).

- [ ] `binn audit` on this repository gives a report the owner agrees with, with no gap that is not a real one.
- [ ] `binn audit` on a repository of the owner's own, one that has not run `binn init`, gives recommendations the owner agrees with, and the owner changes nothing because of the audit itself.
- [ ] `binn init` on that repository shows one plan, asks once, and Enter accepts it.
- [ ] The owner moves a Product session to another harness from the README section alone, without asking an agent what to type.
- [ ] The owner records under `## Comments` whether the audit is useful. Defects are filed as tickets, and the roadmap marks epic 7 done only when none is open.

## Comments

- **Decide before the demonstration, found by ticket 04's agent, 2026-10-02.** This repository's `docs/agents/issue-tracker.md` states the ticket-header convention in its bullets but has no section headed "Ticket header", so `binn audit` on this repository reports a `layout.ticket_header` gap, and `binn init` would offer to append the section. The first criterion expects a clean report. Either add the section to that file, or make the detection recognise the existing wording. Neither was done.
- **Open question, found by ticket 02's agent, 2026-10-02.** `binn init` has never had a tracker question: the tracker is proposed from the remote, or `local`, and shown inside the plan. ADR-0034 and the spec mention "the choice of tracker" as a question asked before the plan; none was added, so as not to add one more question. If the owner wants a real choice, between keeping the proposal and choosing `local`, it is a small ticket of its own.
- **The roadmap's Next action is `binn audit`**, set by ticket 06's agent when the last of tickets 02 to 07 merged. It is not a slash command; change it if another form of the step is wanted.
