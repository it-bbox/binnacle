# Existing Project Adoption

## Goals

Adopt without destructive restructuring. Existing conventions/docs/tracker should be discovered first.

## Commands

```bash
binn audit
binn init
```

There is no `binn adopt`: adopting is the audit, which reads, followed by `binn init`, which writes. `binn init` should:

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
2. knowledge normalization;
3. context tooling;
4. telemetry;
5. snapshot/product workflow;
6. optional worktree parallelism.

No automatic large-scale rewrite.

## Historical telemetry

Historical sessions may be imported where supported. If exact task attribution cannot be established, preserve them as project-level/unassigned rather than guessing.
