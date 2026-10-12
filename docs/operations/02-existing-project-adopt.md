# Existing Project Adoption

## Goals

Adopt without destructive restructuring. Existing conventions/docs/tracker should be discovered first.

## Commands

The short path, as the README gives it:

```text
binn audit
    ↓
binn init
    ↓
/binnacle:roadmap
    ↓
/binnacle:product
```

There is no `binn adopt`: adopting is the audit, which reads, followed by `binn init`, which writes, and `/binnacle:roadmap` (`binnacle-roadmap` in another harness), which plans. `/binnacle:roadmap` needs no daemon. It reads the code, `git log`, the docs and specs and `binn audit --json`, and proposes the epics as `done`, `in progress` or `not started` with their specs linked; a destination for each stranded document — a spec, an ADR, `CONTEXT.md`, the product inbox, the roadmap, or stale — moved only on the owner's yes, a stale one left in place unless the owner says delete; and a roadmap not in Binnacle's format rewritten into it, keeping its content. On the owner's yes it writes the rows, a `## Epics` section with each epic's line of scope and a Next action that grills the first epic not done, and commits only what it wrote, never pushing. Run again, it proposes additions and reorders among the epics not started, and never touches a `done` epic or a row that links a spec. Then `/binnacle:product` starts the first Product session.

`binn init` should:

- register repository;
- detect remote and tracker;
- detect languages/package manager;
- detect Matt Pocock layout/config;
- inspect `.scratch` usage;
- detect Serena/Graphify/Context7 where possible;
- configure telemetry adapters when supported;
- create only minimal Binnacle manifest/config after one confirmation of the plan `binn init` shows (ADR-0034), at a terminal or, through `binn init --apply <id>`, as the human's yes in the chat (ADR-0037).

## Audit

`binn audit [path]` (`specs/audit-and-adopt/spec.md`) needs no registration or daemon, and recommends `binn init` for each Binnacle file that is missing.

Audit is read-only by default and reports findings grouped by severity/type rather than an arbitrary single health score.

Initial audit areas:

- Git state/branch conventions;
- tracker presence/config;
- docs/ADR/CONTEXT coverage and duplication;
- durable knowledge stranded in `.scratch`;
- Serena memory duplication risks;
- Graphify readiness/ignore rules;
- tests/typecheck/lint presence;
- CI visibility;
- secrets/basic security hygiene;
- telemetry readiness;
- project structure.

## Output

Audit should produce a migration plan, e.g.:

1. Git/tracker safety;
2. knowledge normalization: the audit's list of stranded documents (`docs.stranded`), and `/binnacle:roadmap`'s proposal of a place for each;
3. context tooling;
4. telemetry;
5. snapshot/product workflow;
6. optional worktree parallelism.

No automatic large-scale rewrite.

## Historical telemetry

Historical sessions may be imported where supported. If exact task attribution cannot be established, preserve them as project-level/unassigned rather than guessing.
