# 12: The Suggested step waits on a Task already done

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** a defect seen at the end of the autopilot run of 2026-09-26. With tickets 10 and 11 merged and `DONE`, and `tasks.inFlight` and `readyToStart` empty, the snapshot's Suggested step still said, by rule 1, that both "are being worked on: an implementation run is active. Wait for them". Rule 1 in `suggestedStep` (`packages/core/src/roadmap.ts`) takes every Task with an active implementation run, whatever its state; a run stays active for ten minutes after its last activity, and an orchestrator's checks in a ticket's worktree extend it. Rule 2, beside it, already reads the Task through `boardColumn` (ADR-0032).

- [x] Rule 1 names only a Task the board places In progress (`boardColumn`), so a Task that is `DONE`, `MERGED` or `CANCELLED` is not waited on, whatever its runs; the step falls through to the next rule.
- [x] A test covers a `DONE` Task with an active implementation run, beside one In progress.

## Comments

- **The rule.** Rule 1 in `suggestedStep` (`packages/core/src/roadmap.ts`) now keeps, of the Tasks with an active implementation run, only those `boardColumn` places In progress, read with runs, so a `READY` one still counts. `DONE` and `MERGED` go to Done and `CANCELLED` to no column, so none is waited on and the step falls through. The description, its singular or plural and the Task it names are taken after the filter.
- **A run naming no known Task** is now not waited on either, since the board places it nowhere. Runs are attributed through the same Task list, so this should not arise; the code comment says so.
- **Spec.** Rule 1 in `docs/specs/minimal-dashboard/spec.md` now says it waits only on a Task the board places In progress.
- **Test.** `1 waits only on a Task the board places In progress` in `apps/daemon/test/next.test.ts`, through the daemon's HTTP API: a `DONE` Task and an `ACTIVE` one, each with an active session on its branch, the `DONE` one's the latest. Rule 1 names only the `ACTIVE` one. A second project with only the `DONE` Task falls through to rule 5. The typecheck and the full suite (365 tests) pass.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violations.** Judgement calls:

1. **A bare `true` passed to `boardColumn`.** **Fixed**: it is the named `hasRuns`, with a comment on why a `READY` Task stands In progress.
2. **The docstring said "done or cancelled"** where the spec names the states. **Fixed**: `DONE`, `MERGED` or `CANCELLED`.
3. **Duplicated code: `boardColumn(...)?.column === 'inProgress'`** now appears in rules 1 and 2 and in `taskSections`. **Kept**: a one-line reading of the board's rule, not worth a helper yet.

**Spec: both criteria hold.** Findings:

4. **A run whose Task is unknown is no longer waited on**, a change the ticket does not name. **Fixed** as far as it goes: the code comment and the Comments above record it; it follows from "a Task the board places In progress".
5. **The test's `step.task` assertion passed without the fix**, since the In progress Task's run was the latest. **Fixed**: the `DONE` Task's run is now the latest, and the test fails on the named Task without the rule.
6. **`MERGED` and `CANCELLED` are not exercised.** **Left**: the ticket asks for `DONE`, and all three go through `boardColumn`.
7. **The ticket was not yet closed.** **Fixed** by the commit that marks it `DONE`.
