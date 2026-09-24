# ADR-0025: The Roadmap Lives in `docs/roadmap.md` on Every Tracker

**Status:** Accepted

**Supersedes:** the third point of ADR-0017's decision, which put the roadmap in tracker milestones where a remote tracker exists.

## Context

ADR-0017 gave the roadmap one home per tracker type: milestones on GitHub and GitLab, `docs/roadmap.md` on the local Markdown tracker. Epic 2 then made the roadmap file a contract. The Product Snapshot reads its epic table, with the status vocabulary `not started` → `spec` → `tickets` → `in progress` → `done` and a spec link on each row, and its `## Current focus` section.

A milestone has none of that. It is open or closed, it has no status vocabulary, no spec link and no place for a current focus. Reading the roadmap from milestones would mean inferring an epic's status from its open and closed state and its issues, which is close to a guess, keeping the current focus somewhere else, and maintaining two roadmap parsers.

An epic is already linked to its tickets on every tracker through the spec slug. The `Spec:` line in the ticket header (ADR-0024) carries it on a remote issue.

## Decision

The roadmap lives in `<knowledge.docs>/roadmap.md` whatever the tracker is. Binnacle does not read milestones. A project may use them for its own purposes.

## Consequences

- There is still exactly one home, so the duplication ADR-0017 removed does not come back.
- One roadmap parser and one set of roadmap consistency checks serve every tracker.
- The roadmap is versioned with the code and read without a token or a network call.
- A team that plans in milestones keeps `docs/roadmap.md` in step by hand. That is the cost of this decision.
