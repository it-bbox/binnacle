# ADR-0034: `binn init` Shows One Plan and Asks Once, and Enter Means Yes at a Terminal

**Status:** Accepted

**Supersedes:** in part, ADR-0026: how `binn init` asks, and what a bare Enter means. Everything else in ADR-0026 stands.

## Context

ADR-0026 lets `binn init` write into the repository only after the human confirms, and says it shows each file, or each addition to an existing file, and asks about each one. Its eight steps therefore ask eight separate questions, and every question defaults to no, so that a run without a terminal writes nothing.

The owner ran `binn init` in another project and found two things (`specs/audit-and-adopt/brief.md`, 2026-09-27): it asks too many questions, and an Enter that means no makes the common case, "yes, do what you showed", the one that needs typing.

## Decision

- `binn init` works out **every write it proposes first**, then shows them together as one plan: each file, or each addition to an existing file, in full.
- It asks **once** for the plan as a whole. It does not ask again for each write.
- When stdin is a terminal, **Enter accepts the plan**. Typing `n` declines it, and nothing is written.
- When stdin is not a terminal, **nothing is written**. Without a human to read the plan there is no confirmation to give.
- The one question that is not about a write, the history import window (`specs/telemetry/spec.md`), stays a question of its own, asked before the plan, because the plan depends on it. The tracker is not asked: it is proposed from the remote, or `local`, and shown in the plan, and a human who wants another declines the plan and edits `.binnacle/project.yaml` (the owner, 2026-10-02).

ADR-0026's other terms are unchanged: `binn init` never overwrites an existing file, extends one only by a section the human has seen, and never commits. It is still the only path that writes into a project's repository, and a write outside the repository is still shown and confirmed.

## Considered Options

- **One plan, Enter means no.** Fewer questions, and the default stays cautious. Rejected: it fixes only half of the owner's complaint, and a human who has just read the whole plan is the one who should not have to type to accept it.
- **Keep each write's own confirmation, with Enter meaning yes.** Rejected: eight questions are still eight interruptions, and a default of yes on a single file shown alone is a weaker confirmation than yes on the whole plan.

## Consequences

- The confirmation is wider: one yes covers every write in the plan. The plan is therefore shown in full before the question, and a write that depends on an answer is never added after it.
- The ADR-0026 invariant that a run without a terminal writes nothing holds, now by the terminal check instead of by a default of no. A test runs `binn init` with stdin not a terminal and checks that nothing is written.
- ADR-0026's list of steps and their prompts changes in the epic that builds this. Docs that describe the old per-write prompts are corrected in the same change.
