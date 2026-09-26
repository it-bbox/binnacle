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

### On this repository

Binnacle is built by being used on itself (`docs/00-scope.md`). The flow above runs here as follows.

**Per epic.** `/grill-with-docs` when questions remain open, then `/to-spec`, then `/to-tickets`. The human invokes each. They are reserved for explicit invocation, and an agent does not run their steps on its own initiative.

**Per ticket.**

1. The human starts a fresh session with `/mattpocock-skills:implement docs/specs/<epic>/issues/NN-<slug>.md`, and does nothing else. It is the command `/binnacle:task` ends with, and the one the dashboard shows beside the ticket. That skill commits to the current branch and creates none, so the session does the rest.
2. The session branches from an up-to-date `main` as `feat/<slug>`, implements test-first through the seam the spec fixes, typechecks, runs `/code-review`, and writes whatever the next ticket needs to know under the ticket's `## Comments`. The review's findings, and what was fixed or kept, go under `### Review` there, and every acceptance criterion that holds is ticked. A ticket without them is not ready to be marked done, however green its tests.
3. **The session's last commit sets the ticket's `Status:` to `DONE`**, and moves the roadmap's current focus if the frontier moved. The status then reaches `main` in the same step as the merge — not later, and not by whoever happens to notice — and a branch that is not merged never marks anything done. The Product Snapshot and the next Product session read position from these files, and a merged ticket still marked `READY` is exactly the failure this project exists to prevent. It happened three times in epic 1 before this rule existed.
4. The human reviews, merges and pushes. Nothing is left to edit afterwards.

One primary session per ticket. Subagents only with the human's explicit approval of that plan. Starting `/binnacle:autopilot` for one planned epic is that approval (ADR-0022): a Product session then runs the epic's remaining tickets through one agent each, by this same process, starting each ticket's session and merging its branch in the human's place, after verifying it.

Tickets with no blocking edge between them may run at the same time, one session each, but never two in one working directory: the first runs in the main checkout and every other one in its own worktree (`.claude/worktrees/`, ignored by Git). Whichever branch is merged second is first rebased onto `main` by its own session, which resolves the conflicts, checks that its code still fits what the first ticket changed, and reruns the tests. Its `DONE` commit stays last.

**Product work** — dailies, decisions, planning — happens in its own disposable session, which starts with `/binnacle:product` and `/binnacle:daily` and closes with `/binnacle:checkpoint` (`docs/workflow/01-product-workflow.md`). With the daemon stopped, the same session reads the repository instead — `git log`, the tickets' `Status:` lines and the roadmap — and before it closes promotes what it decided into a ticket, an ADR or the roadmap by hand. A Product session commits to `main` directly, and only documentation: specs, tickets, ADRs, the roadmap, `CONTEXT.md` and the instruction files. A Product session in a linked worktree cannot check out `main`: it commits on its own branch, then fast-forwards `main` in the registered checkout with `git merge --ff-only <branch>`, which refuses rather than touch uncommitted work there. Anything that changes code goes through a ticket and its branch. Run `/binnacle:checkpoint` whenever the work reaches a logical end — an epic closed, a spec or its tickets written — and before leaving a long session for a fresh one because of its context. Never while `/binnacle:autopilot` still has agents running: they report to the session that started them, and only that session verifies and merges their branches, so wait until the run ends. An implementation session needs no checkpoint: its ticket and branch hold its state.

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
