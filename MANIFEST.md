# Package Manifest

## Start here

- `LICENSE` — Apache-2.0.
- `README.md` — product concept and repository entry point.
- `README.ru.md` — Russian duplicate of `README.md`; keep both in sync.
- `CONTEXT.md` — canonical vocabulary and current product boundary.
- `AGENTS.md` — cross-agent engineering rules.
- `CLAUDE.md` — Claude-specific workflow additions.

## Product and architecture

- `docs/00-scope.md`
- `docs/01-architecture.md`
- `docs/02-project-brain.md`
- `docs/03-mcp-and-skills.md`
- `docs/04-telemetry-dashboard.md`
- `docs/05-mvp-plan.md`
- `docs/roadmap.md` — current position: epic status and spec links.
- `docs/06-data-model.md`
- `docs/07-initial-repository-layout.md`
- `docs/08-open-questions.md`
- `docs/09-references.md`

## Workflow

- `docs/workflow/01-product-workflow.md`
- `docs/workflow/02-development-workflow.md`
- `docs/workflow/03-state-machines.md`
- `docs/workflow/04-git-tracker-worktrees.md`

## Operations

- `docs/operations/01-new-project.md`
- `docs/operations/02-existing-project-adopt.md`
- `docs/operations/03-external-tools.md`
- `docs/operations/04-security-resilience.md`
- `docs/operations/05-installation-checklist.md`

## Accepted ADRs

- ADR-0001 — local control plane, not autonomous orchestrator.
- ADR-0002 — canonical project state stays outside Binnacle.
- ADR-0003 — fresh Product sessions use Product Snapshot.
- ADR-0004 — harness/provider/model/role are separate dimensions.
- ADR-0005 — `.scratch` is ephemeral and worktree-local.
- ADR-0006 — Graphify and Obsidian are recommended but replaceable.
- ADR-0007 — telemetry preserves uncertainty/provenance.
- ADR-0008 — TypeScript/Node/Nuxt stack.
- ADR-0009 — product name Binnacle, CLI `binn`, daemon `binnd`.
- ADR-0010 — Apache-2.0 licence.
- ADR-0011 — session artifacts are the primary telemetry source.
- ADR-0012 — Binnacle never invokes a model.
- ADR-0013 — tracker access is read-only.
- ADR-0014 — harness support levels 1 to 4.
- ADR-0015 — local storage and migration policy.
- ADR-0016 — platform support and distribution.
- ADR-0017 — specs live in Git, tickets live in the tracker.
- ADR-0018 — run-to-task correlation uses `cwd` and git reflog.

## Bootstrap/config skeleton

- `templates/project/project.yaml.example`
- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `.nvmrc`
- `.gitignore`

## Empty implementation boundaries

- `apps/daemon/`
- `apps/dashboard/`
- `apps/cli/`
- `packages/core/`
- `packages/mcp/`
- `packages/telemetry/`
- `packages/adapters/`

These are intentionally empty. `grill-with-docs` on this package is complete: every question in `docs/08-open-questions.md` is resolved and recorded in the ADRs above. The next step is `to-spec`.
