# State Machines

Separate lifecycle entities to avoid a combinatorial status mess.

## Task

```text
BACKLOG
  ↓
READY
  ↓
ACTIVE ↔ BLOCKED
  ↓
READY_FOR_REVIEW
  ├─ changes requested → ACTIVE
  ↓
APPROVED
  ↓
MERGE_READY
  ↓
MERGED
  ↓
DONE
```

`CANCELLED` can be terminal from applicable pre-completion states.

`MERGED` and `DONE` differ intentionally: code may be merged while docs/migration/follow-up requirements remain.

## AgentRun

```text
PLANNED
  ↓
RUNNING ↔ WAITING_INPUT
  ↓
COMPLETED
```

Terminal alternatives:

- `FAILED`
- `ABORTED`
- `BUDGET_EXCEEDED`

A Task may have many AgentRuns: implementation, corrections, QA, review, etc.

## Review

```text
PENDING
  ↓
IN_REVIEW
  ├─ APPROVED
  └─ CHANGES_REQUESTED
        ↓
      RESOLVED
        ↓
      IN_REVIEW
```

Review cycles should remain measurable.

## Release

Not part of v1 kernel. Reserve a future separate entity rather than embedding release states into Task.
