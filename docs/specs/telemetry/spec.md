# Spec: Telemetry

Status: READY
Triage: ready-for-agent

Epic 4 of v1, as defined in `docs/05-mvp-plan.md` phase 4. Exit criterion, restated while specifying: the Product Snapshot and MCP attribute usage to runs and Tasks for supported paths, and each harness reports the support level it actually reached (ADR-0014). The dashboard that draws this is epic 5.

## Problem Statement

The Product Snapshot has had a `usage` section since epic 2, and it has only ever said "Not available in this version of Binnacle." A Product Steward cannot answer the simplest question about the work: what did a Task cost? How much went into epic 3, how much into Product sessions on `main`, how much into review agents? The answer exists. Claude Code and Codex write every call's token counts to local disk, hundreds of megabytes of them on the owner's machine, and nothing reads them.

So the scope's third success criterion — usage analysed per project, Task and run, with its source quality marked (`docs/00-scope.md`) — is unmet, and the thesis that externalised state and fresh sessions reduce waste cannot be checked against data.

## Solution

The daemon reads the **session artifacts** Claude Code and Codex already write, for registered projects only, and keeps what it parsed in an append-only table (ADR-0011, ADR-0015). It reads incrementally: new files and the new tail of files it has already read. The first read of a project goes back as far as the manifest's import window, 90 days when none is written — the horizon of Git's own reflog.

Each session becomes one or more **observed AgentRuns**: one unbroken stretch of a session in one checkout on one branch. A subagent's session is a run of its own, linked to the run that started it. A run belongs to the Project its `cwd` lies in (ADR-0018), and to the Task its branch maps to by the branch naming convention epic 3 defined. The branch is the one the reflog of the run's checkout gives; where the reflog has no answer, the run has no branch (ADR-0030). A run's role follows from its branch: the default branch is Product work, a Task's branch is implementation, anything else is unknown. No proven mapping means **unassigned**, never a guess.

Only metadata is kept: identities, timestamps, `cwd`, branch, model and token counts. No message content, no tool input, no subagent description.

The Product Snapshot's `usage` section fills in: token totals for today and the last seven days, by model, by Task and unassigned, and the support level each harness reached. A new MCP tool, `usage_get`, returns a project's or one Task's usage with its runs. `binn init` gains the question of how much history to import. Tokens only: no cost is computed, and a cost no provider reported is `null`.

## User Stories

### Seeing usage

1. As a Product Steward, I want the snapshot's `usage` section filled from real data, so that a fresh Product session knows what the work has been consuming.
2. As a Product Steward, I want token totals for today and for the last seven days, so that I see the current burn without asking for it.
3. As a Product Steward, I want those totals split by model, so that I see where an expensive model is being used.
4. As a Product Steward, I want the Tasks that consumed the most in the last seven days listed with their totals, so that an outlier ticket stands out.
5. As a Product Steward, I want unassigned usage shown as its own total, so that I know how much of the picture is not attributed to any Task.
6. As a Product Steward, I want each harness listed with the support level it reached, so that I know whether a harness's silence means no work or no visibility (ADR-0014).
7. As a Product Steward, I want the snapshot to say when the history import is still running, so that a small total is not mistaken for a quiet week.
8. As a Product Steward, I want `/binnacle:product` to present the usage section as compactly as the others, so that it adds a few lines, not a report.
9. As a developer, I want `usage_get` with no argument to return the project's usage by Task and unassigned, so that I can look deeper than the snapshot without reading artifacts.
10. As a developer, I want `usage_get` with a Task id to return that Task's totals and its runs, so that I can see what one ticket cost and how many runs it took.
11. As a developer, I want each run to carry its harness, provider, model, role, branch, Task, start, latest activity and totals, so that I can tell an implementation run from a review agent from a Product session.
12. As a developer, I want a subagent's run to name the run that started it, so that the work an autopilot or a review spawned is traceable to it.
13. As a developer, I want a run shown as active when its latest activity is recent, marked as Binnacle's own reading, so that I see what is running without Binnacle claiming a lifecycle it cannot observe.
14. As a maintainer, I want `usage_get` mapped one-to-one onto a daemon operation `usage.get`, as every other tool is, so that there is no second implementation.

### Attribution

15. As a developer, I want a session attributed to the registered project whose checkout its `cwd` lies in, including a linked worktree of it, so that work in a worktree counts for its project.
16. As a developer, I want a session outside every registered project never read, so that Binnacle does not collect what I did not ask it to watch.
17. As a developer, I want a project I register later to get its history imported under its window, so that registering late loses nothing still on disk.
18. As a developer, I want a run the reflog cannot place left without a branch, whatever its harness recorded, so that a worktree removed before Binnacle read it never credits the wrong Task or the Product role (ADR-0030).
19. As a developer, I want a run's branch recovered from the reflog of its checkout, matched by time, while that checkout exists, so that a harness that records no branch, or records the wrong one, is still attributed rightly (ADR-0029).
20. As a developer, I want a session that switches branch split into one run per branch, so that each part counts for its own Task.
21. As a developer, I want a branch mapped to a Task by the same convention `task_get` gives, so that the branch `/binnacle:task` names is the branch that gets the credit.
22. As a developer, I want a branch that maps to no Task, or to more than one, left unassigned, so that attribution is a fact or nothing.
23. As a developer, I want a run on the default branch to have the role `product`, one on a Task's branch `implementation`, and anything else `unknown`, so that roles come from Git and not from reading my conversations.
24. As a developer, I want Task attribution to be unavailable with a reason when the tracker cannot be read, rather than every run turning unassigned, so that a network problem does not rewrite history.

### Truthful numbers

25. As a developer, I want each token count to be exactly what the harness reported, renamed and nothing more, so that Binnacle's numbers match the harness's (ADR-0011).
26. As a developer, I want Claude Code's repeated records of one message counted once, so that a message split into several content blocks is not counted several times.
27. As a developer, I want Codex's running totals turned into per-call differences, so that summing them does not double-count.
28. As a developer, I want a field no harness reported to be `null` and not zero, so that "not reported" is never read as "none" (ADR-0007).
29. As a developer, I want a total over records of which only some report a field marked partial, so that I know when a sum covers less than its runs.
30. As a developer, I want every value to carry its provenance, and a value Binnacle derives by arithmetic marked `calculated`, so that measured and derived numbers are never confused.
31. As a developer, I want the provider `null` when the artifact does not state it, so that a model name is never taken as proof of who served it (ADR-0004).
32. As a developer, I want no cost computed from a price table, so that a number that depends on my plan is never presented as what I paid.
33. As a developer, I want an artifact line in a shape the adapter does not recognise to stop that file's reading at that line and raise an attention item naming the harness, file and line, so that a format change is loud and never produces wrong numbers (ADR-0011).
34. As a developer, I want a harness whose artifacts cannot be read reported at a lower support level, so that its degradation is visible where its level is shown.

### Import

35. As a developer, I want the first import limited to the manifest's window, 90 days when none is written, so that first use does not parse everything I ever ran.
36. As a developer, I want to set the window to a number of days or to `all`, so that I choose how far back to go.
37. As a developer, I want a larger window to import the older records still on disk, so that widening it later works.
38. As a developer, I want re-reading a file never to count a record twice, so that restarts, rescans and a changed window are harmless.
39. As a developer, I want each call to read only what is new since the last one, so that the snapshot stays fast after the first import.
40. As a developer, I want a call never to wait longer than a fixed budget for the import, with the rest continuing in the background, so that a large first import does not block a Product session.
41. As a developer, I want ingested records kept even after the artifact is deleted, so that the harness cleaning up its logs does not erase my history (ADR-0015).
42. As a developer running `binn init`, I want to be told how many sessions each harness has for this project and how far back they go, and asked how much to import, so that the choice is informed (`docs/04-telemetry-dashboard.md`).
43. As a developer, I want that answer written into the proposed manifest, or printed for me to add when the manifest exists, so that `binn init` keeps its rule of never editing an existing file (ADR-0026).

### Standing guarantees

44. As a developer, I want no message content, tool input or subagent description stored, so that metadata-only stays true (`docs/01-architecture.md`).
45. As a developer, I want Binnacle to write nothing into the harnesses' directories, so that reading their artifacts cannot damage them.
46. As a developer, I want the daemon still to write nothing into my repository, so that ADR-0020 holds with telemetry on.
47. As a maintainer, I want the harness readers to be pure functions from artifact text to normalised records, so that a format change is fixed and tested in one place.
48. As a maintainer, I want the exit criterion demonstrated on this repository against its own history, so that "works" means it worked.

## Implementation Decisions

### Workspace

- `packages/telemetry` gets its first code: the normalised record and totals types, provenance, and the pure functions that segment records into observed runs, attribute them and sum them. It depends on `packages/core` and on nothing that does I/O.
- `packages/adapters` gains one reader per harness, Claude Code and Codex. Each is a pure function from an artifact's lines, and the position they start at, to normalised records plus the position it stopped at and any failure. Finding and opening the files is the daemon's.
- The daemon gains the ingest, the new table and the `usage.get` operation, and fills the snapshot's `usage` section. `packages/mcp` gains `usage_get`, mapped to it one-to-one.
- `apps/cli`'s `binn init` gains the import-window step.
- The `binnacle` plugin's `product` skill learns to present the usage section.
- `packages/core`'s domain gains the observed run as its own type, without a lifecycle state; the `AgentRun` state machine stays for runs Binnacle will manage, of which there are none yet. `docs/06-data-model.md` is updated to match.

### Where the artifacts are

- Claude Code: under `$CLAUDE_CONFIG_DIR/projects`, or `~/.claude/projects`. A session is `<dir>/<session>.jsonl`; its subagents are `<dir>/<session>/subagents/agent-<id>.jsonl`. A directory's name is derived from the launch `cwd` and is lossy, so it only selects candidates: the directories whose name starts with the one derived from a registered project's path, or from one of its linked worktrees that still exists. Every record's own `cwd` then decides.
- Codex: under `$CODEX_HOME/sessions`, or `~/.codex/sessions`, one rollout file per session. The `cwd` is in its `session_meta` record.
- The daemon's runtime carries both roots, so the offline tests point them at temporary directories.
- A linked worktree outside the project's directory that has since been removed is not found. Worktrees under the project's directory, where Claude Code puts its own, are.

### Normalised record

- Identity: harness (`claude-code`, `codex`), session id, subagent id or `null`, parent session, and a natural key unique within the harness: Claude Code's message id, Codex's session id and record ordinal.
- Facts: timestamp, `cwd`, branch with its source (`harness` or `reflog`) or `null`, provider or `null`, model or `null`, and the token fields: input not read from cache, cached input read, cache creation, output, reasoning. Each is `null` when the record does not report it.
- Claude Code: `input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `output_tokens`, and the thinking tokens under `output_tokens_details`, all `provider_reported`. The records of one message repeat its usage once per content block — measured: 320 messages, 206 repeats, all identical — so one message is one record, keyed by its id. In a subagent's session the repeats differ: the earlier ones carry the output counted so far and the last the message's own (measured in ticket 04: 1,625 of 1,643 repeated messages), so a message's last record is the one read. Provider is `null`; the artifact does not state it. The harness's branch is `gitBranch`, which is one value per Claude Code process rather than per checkout, so it is stored but attributes nothing (ADR-0030).
- Codex: the difference between consecutive `total_token_usage` values of `token_count` records, which is `calculated`. Codex's `input_tokens` includes the cached part, so input not read from cache is `input_tokens − cached_input_tokens`, also `calculated`. A total that decreases is a failure, not a reset. Provider is `session_meta.model_provider`, model is the turn context's. The harness's branch is `session_meta.git.branch`, the branch the session started on, stored but attributing nothing (ADR-0030). Cache creation stays `null`: `cache_write_input_tokens` is mapped once a real rollout shows it non-zero.
- The adapter contract states, for each field, whether it is a subset of another (reasoning of output, on both harnesses). Totals never add a subset to its superset.
- Content, tool inputs and outputs, and subagent descriptions are never read into a record, whatever `telemetry.privacy` says. Content telemetry is not built in this epic.

### Ingest

- New append-only table of ingested records: tier 2 under ADR-0015, created with `create table if not exists` and never dropped, with a unique constraint on harness and natural key. Inserting an existing record is a no-op, which is what makes re-reading idempotent. `docs/06-data-model.md`'s RawIngestRecord is this table.
- A cursor per artifact file — path, size, the position read to, and the window it was read under — sits in the same tier and commits in the same transaction as the records it produced. A file that has shrunk, or a window that has grown, is re-read from the start; the unique constraint absorbs the repeats.
- The branch is resolved **at ingest**, because the reflog may be gone by the next read, and stored on the record. The Task is resolved **at read**, from the tracker's current contents, as the snapshot resolves everything else.
- Records older than the window are skipped. The window is `telemetry.import.window_days`: a positive integer, or `all`; unwritten, 90. The manifest validator accepts `all`.
- Every `project.snapshot` and `usage.get` call runs the ingest for its project and waits for it up to a fixed time budget. What does not fit continues in the background, one ingest at a time per machine, and the response says the import is incomplete. The daemon also starts one on startup for every registered project.
- A failure stops that file at the failing line: the cursor stays before it, earlier records stay, and `telemetry.unreadable` names the harness, file and line, until a successful read of that file clears it.
- The last message of a Claude Code file may still be being written, and its records repeat with growing usage. It is not stored until a later message has started after it, or the file has gone unwritten for a fixed period of a minute. Until then the cursor stays before its first record. A stored record is never completed from a later one: the table stays append-only.

### Observed runs and attribution

- Records are grouped by harness, session and subagent, in time order. A new run starts wherever the checkout (from `cwd`) or the branch changes. A run's id is derived from its first record's key, so it is stable across calls.
- Project: the registered project whose path contains the `cwd`, or of which the `cwd` lies in a linked worktree. A record in no registered project is never stored.
- Branch: ADR-0029 and ADR-0030. Reflog matching uses the `HEAD` reflog of the checkout the record's `cwd` names: the branch checked out at the record's timestamp. Where it has no answer, no branch: a record stored with a `harness` branch attributes nothing when runs are read.
- Task: the inverse of the branch convention in `packages/core`. On the local tracker, `feat/<slug>` maps to the one ticket whose file name, without its number and extension, is `<slug>`; on a remote tracker, `feat/<number>-…` maps to issue `#<number>` when it exists. Zero matches or several is unassigned. The inverse function lives next to the forward one, with a test that the two agree for a unique slug. A ticket's slug is unique across epics (`docs/agents/issue-tracker.md`); where two tickets share one, `task_get` says so, and their branch credits neither.
- Role: `product` on the repository's default branch — the target of `origin/HEAD`, otherwise `main` — `implementation` on a branch that maps to a Task, `unknown` otherwise.
- Active: the latest record within a fixed recency constant. It is a `calculated` reading and is labelled so.

### Totals

- A total sums each token field over its records. A field is `null` when no record in it reports the field, and `partial` when some do and some do not.
- "Today" and "the last seven days" are calendar days in the daemon's local time zone.

### Snapshot `usage` section

Replaces `Unavailable` with:

- `importing`: whether the import for this project is incomplete, and the date the window starts;
- `today` and `last7Days`: totals;
- `byModel`: last seven days, per model, with the section limit and a remainder;
- `tasks`: last seven days, the Tasks with the largest totals first, each with its id, title and total, with the section limit and a remainder;
- `unassigned`: last seven days, the total;
- `harnesses`: each harness Binnacle has an adapter for, with the level reached for this project — `3` when records with token counts were read, `2` when records were read without any, `1` when the artifacts could not be read, and absent-with-reason when none were found. Level 4 is not reached in this epic.

Task attribution unavailable (tracker unreadable) leaves `tasks` and `unassigned` unavailable with the tracker's reason, and the totals still answer.

### `usage.get` and `usage_get`

- Input: the caller's path and an optional Task id, in the same forms `task.get` takes.
- Without a Task: the project's totals over the whole ingested window, per Task and unassigned, with a limit and remainder, and `byRole`: the totals per role, `product`, `implementation` and `unknown`, over the same window. `byRole` is unavailable with the tracker's reason when the tracker cannot be read, like `tasks`.
- With a Task: its totals and its runs, newest first, with a limit and remainder. Each run carries its id, harness, provider, model, role, branch and its source, Task, parent run, start, latest activity, whether it is active, and its totals.
- An unknown Task id is `task.not_found`. A Task with no runs is an empty list, not an error.
- `usage_get` takes one optional argument, `task`, and returns compact JSON, like every other tool.

### `binn init`

- A new step after the manifest step. It counts, per harness, the sessions whose `cwd` lies in this repository and the date of the oldest, and asks for the window: `90` (the default), a number of days, or `all`.
- With a new manifest the answer goes into it. With an existing one the `telemetry.import.window_days` line is printed for the human to add; nothing is edited (ADR-0026).
- Counting reads only each file's first record; it never parses whole sessions.

### Documents this epic changes

- `docs/05-mvp-plan.md` phase 4: the exit criterion as restated above, and OpenTelemetry moved out.
- `docs/roadmap.md`, Later: OpenTelemetry as a live path (ADR-0011); calculated cost; context pressure (`docs/04-telemetry-dashboard.md`).
- `docs/06-data-model.md`: the observed run and the ingested record.

### Standing guarantees this epic must not break

- No model invocation (ADR-0012).
- No writes into the repository by the daemon or the MCP server (ADR-0020), and none into a harness's directories.
- No network traffic added. Artifacts are local files.
- Binnacle is not a required runtime (`AGENTS.md` §3). Nothing in a harness is configured by this epic.
- Same state, same answer. The ingested records are part of the state.

## Testing Decisions

### What a good test is here

As in epics 1 to 3: a test states an externally observable fact — a total, a run and its attribution, an attention item, a file `binn init` wrote or did not write. It does not assert which function ran or how the ingest is structured.

### Seam 1: the daemon's HTTP API, offline

The main seam, through the existing in-process test daemon helper. The runtime's artifact roots point at temporary directories holding artifacts cut from real Claude Code and Codex sessions, reduced to the fields the adapters read plus the ones they must ignore, including a content field that must not reach the store. Fixture repositories are real, with real branches, worktrees and commits, as before.

Through this seam: a Claude Code session with repeated message records counted once; subagent runs linked to their parent; a session split at a branch switch; Codex running totals turned into differences and its cached input subtracted; a Codex branch recovered from the reflog, or taken from its session where the reflog has no answer; a Claude Code branch taken from the reflog over the one Claude Code wrote; a branch from a worktree that no longer exists, attributed through the harness; a file's unfinished last message held back; a branch mapping to no Task and to a Task on each tracker; roles from the default branch, through `byRole`; `null` fields and partial totals; a session outside every registered project not stored; the window, `all`, and widening it; re-reading without duplicates; a deleted artifact's records still counted; an unrecognised line stopping its file with `telemetry.unreadable` and the level dropping; the tracker unreadable leaving totals and making Task attribution unavailable; the snapshot's `usage` section; `usage.get` with and without a Task, and `task.not_found`; and no content in the store.

Also through this seam, the existing **write guarantee** now runs with artifacts present, and additionally checks that the artifact directories are unchanged.

### Seam 2: the MCP smoke test

The existing single smoke test also lists `usage_get` and calls it once. It stays one test.

### Seam 3: `binn init` as a subprocess

As in epic 3, with `HOME` and the artifact roots pointed at temporary directories. Through it: the counts and oldest date shown per harness, the default of 90 written into a new manifest, `all` and a number accepted, and the line printed, not written, for an existing manifest.

### Not automated

The `product` skill's presentation of the usage section, as before: the exit demonstration verifies it. There is no live suite: the artifacts are local, and the demonstration reads the owner's real ones.

### Prior art

`apps/daemon/test/snapshot.test.ts`, `task.test.ts` and `write-guarantee.test.ts` for the daemon seam; `apps/cli/test/` for the CLI as a subprocess; `packages/mcp/test/smoke.test.ts` for the MCP smoke test; `packages/core/test/` for pure functions.

## Out of Scope

- OpenTelemetry and every live path; support level 4 (ADR-0011, ADR-0014).
- Cost, whether computed from a price table or provider-reported; no harness in scope reports one. The field exists and is `null`.
- Context pressure and its attention item (`docs/04-telemetry-dashboard.md`).
- Derived metrics — tokens per completed Task, runs per Task, rework share, first-pass review acceptance, context growth, usage before first edit, weekly trend: epic 5, on top of this epic's totals and runs.
- The dashboard: epic 5.
- Harnesses other than Claude Code and Codex; Gemini CLI and a generic adapter come when there is a user.
- Content telemetry, whatever `telemetry.privacy` says.
- Distinguishing review runs from implementation runs on the same branch; both are `implementation` here.
- Usage in the daily delta or the checkpoint.
- Linked worktrees outside the project's directory that were removed before their first import.
- A background watcher on the artifact directories; the ingest runs on calls and on startup only.

## Further Notes

- **Decided while specifying this epic.**
  - ADR-0028: the harness's recorded branch comes first, the reflog second. Measured here: the registered checkout's reflog holds about thirty branch switches; epics 1 to 3 were built in removed worktrees on deleted branches.
- **Decided while building it.** The owner's decisions of 2026-09-25, on ticket 04's questions:
  - ADR-0029 supersedes ADR-0028's order: the reflog while the checkout exists, the harness otherwise. Claude Code's `gitBranch` turned out to be one value per process, and Codex does write the branch its session started on.
  - A Claude Code file's unfinished last message is held back rather than stored early, so the table stays append-only.
  - `usage.get` gains `byRole`, which is where the exit demonstration sees the `product` role.
  - Codex's `cache_write_input_tokens` stays unmapped until a real non-zero example exists.
  - The observed run: a stretch of one session in one checkout on one branch, with no lifecycle state (`CONTEXT.md`).
  - The default window of 90 days, and `all`.
  - The exit criterion names the snapshot and MCP instead of the dashboard.
- **Decided on the exit demonstration's findings.** The owner's decisions of 2026-09-25, on tickets 09 to 12:
  - ADR-0030 drops ADR-0029's fallback to the harness's branch: the reflog, or no branch (ticket 10).
  - A ticket's slug is unique across epics, and `task_get` says when two tickets share a branch. The two that share `feat/exit-demonstration` keep their names, so that branch credits neither (ticket 11).
  - Autopilot runs the ingest before it removes a worktree, and starts no more agents at once than the manifest allows (ticket 12).
  - The exit demonstration reads the owner's running daemon, the only store that read worktrees before their removal. Its criterion on runs reads tickets 10 and 11, built by autopilot after ticket 12, instead of epic 3's.
- **The documents listed above were updated** in the Product session that sliced this spec, so they agree with it before code lands.
- **Fixtures are cut from real artifacts**, never written from memory of the format. The ticket that adds a harness reader should say which session it cut them from and strip every content field it does not need to prove is ignored.
- **Format drift.** Claude Code's artifact format already carries fields that did not exist a few versions ago. The readers match on the fields they need and ignore the rest; a missing needed field is the failure, not an unknown extra one.
- **Exit demonstration.** The closing ticket runs `/binnacle:product` in a fresh session on this repository and checks that the usage section shows today's and the week's totals, that `usage_get` for tickets built by autopilot after ticket 12 returns their runs with implementation roles and their subagents linked, that Product sessions on `main` carry the `product` role, and that whatever is unassigned is explained and little of the new work is. Defects are filed as tickets.
