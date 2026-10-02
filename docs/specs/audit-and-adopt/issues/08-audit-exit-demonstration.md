# 08: The exit demonstration of audit and adopt

Status: READY
Triage: ready-for-human
Blocked by: 04, 05, 06, 07, 09
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** epic 7's exit criterion, demonstrated by the owner. A large third-party repository stays post-v1 (`docs/00-scope.md`).

- [ ] The owner runs the audit from the chat with `/binnacle:audit` (ticket 09), not from a terminal.
- [ ] `binn audit` on this repository gives a report the owner agrees with, with no gap that is not a real one.
- [ ] `binn audit` on a repository of the owner's own, one that has not run `binn init`, gives recommendations the owner agrees with, and the owner changes nothing because of the audit itself.
- [ ] `binn init` on that repository shows one plan, asks once, and Enter accepts it.
- [ ] The owner moves a Product session to another harness from the README section alone, without asking an agent what to type.
- [ ] The owner records under `## Comments` whether the audit is useful. Defects are filed as tickets, and the roadmap marks epic 7 done only when none is open.

## Comments

- **Decide before the demonstration, found by ticket 04's agent, 2026-10-02.** This repository's `docs/agents/issue-tracker.md` states the ticket-header convention in its bullets but has no section headed "Ticket header", so `binn audit` on this repository reports a `layout.ticket_header` gap, and `binn init` would offer to append the section. The first criterion expects a clean report. Either add the section to that file, or make the detection recognise the existing wording. Neither was done.
- **Open question, found by ticket 02's agent, 2026-10-02.** `binn init` has never had a tracker question: the tracker is proposed from the remote, or `local`, and shown inside the plan. ADR-0034 and the spec mention "the choice of tracker" as a question asked before the plan; none was added, so as not to add one more question. If the owner wants a real choice, between keeping the proposal and choosing `local`, it is a small ticket of its own.
- **The roadmap's Next action is `binn audit`**, set by ticket 06's agent when the last of tickets 02 to 07 merged. It is not a slash command; change it if another form of the step is wanted.
- **Decided by the owner, 2026-10-02.** The ticket-header gap: the section is added to `docs/agents/issue-tracker.md`, in the words `binn init` writes for a local tracker, and `binn audit` on this repository now reports `layout.ticket_header` as `ok`. The tracker question: none is added; the tracker stays proposed from the remote and shown in the plan, and ADR-0034 and the spec's story 53 now say so. The Next action keeps `binn audit`.
- **What the audit still reports here, 2026-10-02.** One gap, `structure.ci`: this repository has no CI configuration. It is a real one; whether it matters is the owner's call during the demonstration. `tracker.token_works` is `unknown`, as it always is offline.

### Steps for the demonstration, 2026-10-03

Before you start, once for all three demonstrations (epics 7, 8 and 9):

1. In a terminal in the main checkout, refresh the `binnacle` plugin so the new skills exist: `pnpm --filter @binnacle/cli run prepare`, then `claude plugin marketplace update binnacle`, then `claude plugin update binnacle@binnacle`. Close every Claude Code session and open a new one.
2. Pick **repository A**: a project of your own that has never run `binn init`. Epics 7 and 8 use it.

Then:

1. **Audit this repository from the chat.** In a Claude Code session in this repository, type `/binnacle:audit`. Expect one gap, `structure.ci` (no CI here). Decide whether it matters; there should be no other gap.
2. **Audit repository A.** Open a session in repository A and type `/binnacle:audit`. Read the recommendations and decide whether you agree. Change nothing by hand.
3. **Init repository A.** In a terminal in repository A, run `binn init`. It shows one plan and asks once; press Enter. This step also counts for epic 8's first criterion.
4. **A Product session in another harness.** Using only the README section *Working from another harness*, start a Product session in Codex without asking anyone what to type.
5. Under `## Comments`, write whether the audit is useful. Tick each criterion that held; for one that did not, write one line on what went wrong, to become a ticket.
