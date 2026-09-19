# Core Data Model

This is a conceptual model, not a final database schema.

## Project

```text
id
name
repo_path
remote
tracker_type
manifest_version
created_at
```

## Task

Represents canonical project work, normally mirrored from a GitHub/GitLab issue or work item. The mirror is one-directional: Binnacle reads and never writes back (ADR-0013). Detailed state from `docs/workflow/03-state-machines.md` exists only in this projection.

```text
id
project_id
external_id?
title
state
priority?
parent_id?
created_at
updated_at
```

## TaskDependency

```text
blocking_task_id
blocked_task_id
source
```

## AgentRun

```text
id
project_id
task_id?
role
harness
provider
model?
profile?
branch?
worktree?
state
started_at
finished_at?
initiator
budget_policy?
```

## Review

```text
id
project_id
task_id
run_id?
reviewer_run_id?
state
cycle
created_at
resolved_at?
```

## Question / Answer

Explicit inter-role communication.

```text
Question:
id, task_id, run_id, status, body_ref/body, created_at

Answer:
id, question_id, author_role, body_ref/body, created_at
```

## RawIngestRecord

The verbatim normalised record parsed out of a harness artifact, with its provenance. This table is append-only and is the only one that is migrated rather than rebuilt (ADR-0015), because the artifact it came from may no longer exist.

```text
id
project_id
harness
source_ref
ingested_at
payload
provenance
```

## TelemetryRecord

```text
id
run_id?
project_id
timestamp
metric/event type
value/payload
source
provenance
```

## Checkpoint

```text
id
project_id
run_id?
role
prepared_at
committed_at?
proposed_changes
committed_changes
```

## AttentionItem

Derived, non-canonical projection:

```text
id
project_id
task_id?
type
severity
status
source_event
```

## Important distinction

Task, AgentRun and Review have separate state machines. Do not encode all lifecycle combinations in one giant status enum.
