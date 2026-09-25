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

## Observed run

An AgentRun Binnacle reads out of a session artifact rather than one it manages: one unbroken stretch of one session in one checkout on one branch (`CONTEXT.md`). It has no lifecycle state, because an artifact cannot tell a finished run from an abandoned one. It is derived from ingested records on every read and is not stored.

```text
id                 derived from its first record, stable across reads
project_path       as the ingested records it is read from are keyed
task_id?           null is unassigned
role               product | implementation | unknown, from the branch
harness
provider?          its latest record's
model?             its latest record's
branch?
branch_source?     reflog | harness (ADR-0029)
parent_run_id?     a subagent's: its parent session's run that had started when the subagent's first record was written
started_at
last_activity_at
active             calculated: last_activity_at within a fixed ten minutes of now
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

The normalised record parsed out of a harness artifact, with its provenance: metadata and token counts only, never content. This table (`ingested_record`) is append-only and is migrated rather than rebuilt (ADR-0015), because the artifact it came from may no longer exist. The branch is resolved when the record is ingested, because the reflog it may come from can disappear; the Task is resolved on read.

```text
id
project_path       the registered project its cwd lies in; a record in none is never stored
harness
natural_key        unique per harness: Claude Code's message id, Codex's session id and record ordinal
session_id         Claude Code writes a subagent's records under the session that started it
subagent_id?       a subagent's id, null in a main session
parent_session?    the session that started a subagent
source_ref         the artifact file
timestamp
cwd
branch?
branch_source?
provider?
model?
input?             each token field null when not reported
cached_input?
cache_creation?
output?
reasoning?
provenance         one per record while its fields share it, as they do on both harnesses; per field where they differ
ingested_at
```

Beside it, in the same tier, one cursor per artifact file (`ingest_cursor`): its path, its size, the byte offset and line read to, and the import window it was read under, a number of days or `all`. A file's records and its cursor commit in one transaction, so a call reads only what was appended since the last. A file that shrank, or a window wider than its cursor's, is read again from the start, and the unique key absorbs what was already stored. A Codex rollout is read again from its start whenever it has grown, because each of its records is the difference from the running total before it. A Claude Code file's cursor stays before its last message until a later one has started or the file has gone unwritten for a minute, because that message may still be being written.

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
