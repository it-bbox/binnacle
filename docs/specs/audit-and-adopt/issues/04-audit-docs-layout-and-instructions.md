# 04: The audit reads docs, the Matt Pocock layout and agent instructions

Status: READY
Triage: ready-for-agent
Blocked by: 03
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** three more areas of `binn audit`. Docs, ADRs and context: whether the repository has a `CONTEXT.md`, an ADR directory and `docs/`. The Matt Pocock layout: `docs/agents/issue-tracker.md`, `triage-labels.md` and `domain.md`, and `docs/specs/<slug>/`, a partial layout reported as partial with the missing parts named, and a missing ticket-header convention in `docs/agents/issue-tracker.md` as a gap that names `binn init` (ADR-0024). Agent instructions: `AGENTS.md` and `CLAUDE.md` read as one set when one imports the other (`instructionSets`), two files that do not import each other as a recommendation to decide which is canonical, and no instructions at all as a finding. The detection of the layout moves out of init so that the audit and init read it the same way.

- [ ] A fixture with a context file and an ADR directory but no ticket-header convention gets a gap that names `binn init`.
- [ ] A partly present layout names what is missing, and a complete one is `ok`.
- [ ] A `CLAUDE.md` that holds `@AGENTS.md` is one set and gets no finding about two files; two files that do not import each other get the recommendation.
- [ ] A repository with no agent instructions says so.
- [ ] The layout detection is shared with `binn init`, not copied.
