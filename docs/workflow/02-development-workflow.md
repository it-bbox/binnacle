# Development Workflow

## Standard task flow

```text
Tracker Task
    ↓
Execution plan (manual approval)
    ↓
branch/worktree if needed
    ↓
Developer AgentRun
    ↓
self checks: tests/lint/typecheck
    ↓
Review
    ↓
changes requested? ── yes → new correction AgentRun
    ↓ no
CI / PR/MR
    ↓
merge
    ↓
Task done after durable follow-ups are complete
```

## Developer context routing

Use the smallest suitable source:

- task/spec first;
- Serena for symbol-level code understanding;
- Graphify for unknown architecture/impact;
- Context7 for external version-specific APIs;
- ast-grep for structural pattern search;
- source files for exact local implementation context.

## Roles

### Persistent logical roles

- Product Steward — owns project state/priorities/spec acceptance;
- Developer — implements one task at a time.

### On-demand roles

- Architect — new subsystem/boundary/schema/event/security-sensitive architecture;
- Analyst — unclear business/integration/research requirements;
- Reviewer — substantial diff/spec compliance;
- QA — medium/high risk behavior validation;
- Security — auth/permissions/secrets/payment/security boundaries;
- DevOps — infra/deploy/CI/runtime changes.

Roles are capabilities, not permanently running agents.

## Manual-first execution

The system may recommend:

```text
Developer: REQUIRED
Reviewer: REQUIRED
QA: RECOMMENDED
Architect: NOT NEEDED
```

But v1 does not automatically start them.

## One primary active agent

Default policy: one primary active AgentRun per Task. Parallelism should occur across genuinely independent tasks, not as multiple agents simultaneously editing the same task.

## Questions and answers

Developer must not invent product/architecture rules missing from the task. Create explicit Question → Product/Architect Answer. Promote durable decisions to spec/ADR/CONTEXT.

## This repository, until epic 2

Binnacle is built by being used on itself (`docs/00-scope.md`), but until epic 2 lands there is nothing of it to use: no MCP server, no snapshot, no `/product` or `/daily`. Until then the flow above runs by hand, like this.

### Per epic

`/grill-with-docs` when questions remain open, then `/to-spec`, then `/to-tickets`. The human invokes each. They are reserved for explicit invocation, and an agent does not run their steps on its own initiative.

### Per ticket

1. The human starts a fresh session with `/mattpocock-skills:implement docs/specs/<epic>/issues/NN-<slug>.md`, and does nothing else. That skill commits to the current branch and creates none, so the session does the rest.
2. The session branches from an up-to-date `main` as `feat/<slug>`, implements test-first through the seam the spec fixes, typechecks, runs `/code-review`, and writes whatever the next ticket needs to know under the ticket's `## Comments`.
3. **The session's last commit sets the ticket's `Status:` to `DONE`**, and moves the roadmap's current focus if the frontier moved. The status then reaches `main` in the same step as the merge — not later, and not by whoever happens to notice — and a branch that is not merged never marks anything done. The roadmap and the next Product session read position from these files, and a merged ticket still marked `READY` is exactly the failure this project exists to prevent. It happened three times in epic 1 before this rule existed.
4. The human reviews, merges and pushes. Nothing is left to edit afterwards.

One primary session per ticket. Subagents only with the human's explicit approval of that plan.

### Product work

Dailies, decisions and planning happen in a separate session and are done by hand. That session reads the repository — `git log`, ticket statuses, the roadmap — and never relies on the history of a chat. Before it closes, whatever it decided goes into a ticket, an ADR or the roadmap, because the session is disposable (`docs/workflow/01-product-workflow.md`). That is a `/checkpoint` performed by hand.

`/product`, `/daily` and `/checkpoint` will do exactly this once epic 2 lands, and this section is retired then.

