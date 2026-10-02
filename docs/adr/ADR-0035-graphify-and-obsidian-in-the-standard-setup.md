# ADR-0035: Graphify and Obsidian Are Part of the Standard Setup

**Status:** Accepted

**Supersedes:** ADR-0006, and the non-goal "mandatory Obsidian/Graphify dependency" in `docs/00-scope.md` as it was read: as a reason to leave both out of v1.

## Context

ADR-0006 made Graphify and Obsidian "recommended capabilities, not kernel dependencies", and `docs/05-mvp-plan.md` moved their integration to phase 7, "only after real data". Epics 1 to 7 therefore delivered a manifest flag and an audit finding for Graphify and nothing for Obsidian. The owner's baseline (`docs/baseline.md`) has both in the Standard setup: Graphify as the architecture graph of the Project Brain, Obsidian as its human view. On 2026-10-02 the owner restored the baseline as the floor for v1.

## Decision

- Graphify and Obsidian are **part of the Standard setup**. `binn init` installs and configures them by default, and Binnacle uses them: the snapshot, the audit, the dashboard, the worktree conflict analysis and the Obsidian projection.
- They stay **replaceable**: Binnacle's core works without them, and a project without them is shown as an incomplete Standard setup, not as broken.
- Canonical knowledge stays in Markdown, Git and the tracker. The graph and the vault are derived and can be rebuilt.

## Considered Options

- **Keep ADR-0006**: rejected by the owner; it is how the baseline was lost.
- **Make them required for Binnacle to run**: rejected; the baseline calls Graphify replaceable and forbids lock-in.

## Consequences

- `docs/00-scope.md` drops the non-goal; `docs/05-mvp-plan.md` replaces phase 7's deferral with epic 8.
- Decision 14 of `docs/08-open-questions.md`, "detection and a staleness signal only", is superseded by ADR-0036.
