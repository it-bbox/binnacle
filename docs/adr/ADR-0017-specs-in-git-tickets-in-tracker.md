# ADR-0017: Specs Live in Git, Tickets Live in the Tracker

**Status:** Accepted. The roadmap point is superseded by ADR-0025.

## Context

The `grill-with-docs → to-spec → to-tickets` chain produces two different kinds of output, and they were both being routed into `.scratch/`, which is git-ignored and declared disposable by ADR-0005. A spec written in one session and consumed by another in a later session cannot live there.

## Decision

- A **spec is a document**: `docs/specs/<slug>/spec.md`, committed to Git.
- A **ticket is a work item**: an issue in the project's tracker, referencing the spec by a commit-pinned permalink. Projects on the local Markdown tracker keep tickets as files at `docs/specs/<slug>/issues/NN-<slug>.md`; the path is configurable in `.binnacle/project.yaml`.
- The **roadmap has exactly one home, chosen by tracker type**: tracker milestones where a remote tracker exists, `docs/roadmap.md` where the local Markdown tracker is used.
- `.scratch/` keeps only genuinely disposable working material, as ADR-0005 intends.

## Rationale

A spec belongs next to the code it describes: versioned with it, reviewable in a pull request, and surviving a change of tracker. A ticket belongs where pull requests, CI and assignment already live. Giving the roadmap one home per tracker type is what removes the duplication the question was about.

## Consequences

- `docs/agents/issue-tracker.md` points at `docs/specs/` instead of `.scratch/`.
- Task state and triage role are separate fields; they are orthogonal axes and must not share one `Status:` line.
