# 01: Claude Code usage in the snapshot

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/telemetry/spec.md`

**What to build:** the tracer bullet. The daemon reads the main Claude Code sessions of a registered project, keeps their token counts in a new append-only table, and the Product Snapshot's `usage` section shows real totals instead of "Not available". `/binnacle:product` presents it. Decided in the spec, under *Workspace*, *Where the artifacts are*, *Normalised record*, *Ingest*, *Totals* and *Snapshot `usage` section*.

- [x] `packages/telemetry` holds the normalised record and totals types, provenance, and the pure summing; `packages/adapters` holds a pure Claude Code reader from lines and a start position to records, the position it stopped at, and any failure.
- [x] The daemon's runtime carries the Claude Code artifact root: `$CLAUDE_CONFIG_DIR/projects`, otherwise `~/.claude/projects`.
- [x] Candidate directories are those whose name starts with the one derived from a registered project's path; each record's own `cwd` decides, and a record in no registered project is never stored.
- [x] One message is one record, keyed by its message id: the repeats Claude Code writes per content block are counted once.
- [x] Token fields map as the spec lists, each `provider_reported`, `null` when not reported; reasoning is a subset of output and is never added to it. Provider is `null`.
- [x] No content, tool input or output is read into a record; a fixture carries a content field and the test proves it never reaches the store.
- [x] The ingested-record table is tier 2 (ADR-0015): created if missing, never dropped, unique on harness and natural key, so re-inserting is a no-op. A cursor per file commits in the same transaction as its records, and a call reads only what is new.
- [x] Records older than the window are skipped; the window is `telemetry.import.window_days`, 90 when unwritten. (`all` and widening are ticket 06.)
- [x] Every `project.snapshot` call runs the ingest for its project before answering.
- [x] The `usage` section carries `importing` with the window's start date, `today` and `last7Days` totals in the daemon's local time zone, `byModel` with the section limit and remainder, and `harnesses` with Claude Code's level: 3, 2, 1, or absent with a reason. `tasks` and `unassigned` are unavailable until ticket 02.
- [x] A total's field is `null` when no record reports it, and `partial` when some do.
- [x] The write-guarantee test runs with artifacts present and also checks the artifact directories are unchanged.
- [ ] The `product` skill presents the usage section in a few lines.
- [x] Fixtures are cut from a real session, and the ticket's comments say which.

## Comments

- **Fixtures.** `apps/daemon/test/fixtures/claude-code/grill-on-main.jsonl` is cut from session `37c08d1a-2ddf-4596-8eb9-cd48a5e33f78` of this repository (a `/grill-with-docs` session on `main`, 2026-09-23, Claude Code 2.1.280): its first prompt, the three records of message `msg_011CfLMEGjvuTXtzfiK6XfsV` (one per content block, usage identical) and the `<synthetic>` API-error message after it. `aborted-mid-stream.jsonl` is cut from session `93b57c14-03ec-47f5-96c2-c9b3ae52d3b1` (a `/to-spec` session on `main`, 2026-09-25): the two records of message `msg_011CfQGNrVrPXXM5Kt7SPr4S`, whose usage has no `output_tokens_details`, one of two such messages in this repository's sessions. Every other field was dropped except a few the reader must ignore; content, tool input and tool output were replaced by `…MUST-NOT-BE-STORED` markers. Tests change only `cwd`, `sessionId`, timestamps and, to make several messages, the message id and model.
- **Where it lives.** `packages/telemetry/src/index.ts`: `UsageRecord`, `Totals`, `Provenance` (moved here from the daemon's store), `SUBSET_OF` (reasoning of output), `sum` and `magnitude`. `packages/adapters/src/claude-code.ts`: `readClaudeCode(bytes, { offset, line })`, pure, returning records, the position it stopped at and any failure. `apps/daemon/src/usage.ts`: finding the files, the ingest, and the `usage` section. The runtime (and `daemon.status`) carries `artifacts.claudeCode`; `startTestDaemon` points it at a directory that does not exist unless a test passes one, so no test reads the machine's own artifacts. `containingEntry` moved from `operations.ts` to `registry.ts`, where the ingest shares it.
- **Store.** `ingested_record` and `ingest_cursor` sit in the append-only tier, created with `create table if not exists`, never dropped. The record table already has `branch`/`branch_source` (Claude Code's `gitBranch`, source `harness`, stored now so ticket 02 needs no re-read) and `subagent_id`/`parent_session` (null until ticket 04), so neither needs a migration. It is keyed to the project by `project_path`, since a project's id can be null. The cursor stores size, byte offset, line and the window it was read under, for ticket 06.
- **Decided here, within the spec.**
  - Claude Code's `<synthetic>` messages (written locally for an API error, all zeros) give no record: they are no call to a model.
  - A total's provenance is the least direct of the values it sums, so a sum of reported values stays `provider_reported`, and one that includes a Codex difference will be `calculated`. Provenance is stored once per record, since all of a record's fields share it on both harnesses; `docs/06-data-model.md` says so.
  - The window runs over calendar days like the week: `window_days: 90` starts at local midnight 89 days before today, and `importing.windowStart` is that date. `importing.incomplete` is always false until ticket 06 adds the time budget.
  - `byModel` is ordered by `magnitude`, the sum of every field that is not a subset of another, then by name. Ticket 02 can order `tasks` the same way.
  - `harnesses` items are `{ harness, level, reason }`: `level` 3, 2, 1 or null, `reason` non-null for 1 and null. Level 1 comes from any file of the project's candidates that failed on this call; the failing file is retried from the same line on each call, so no failure is stored. Ticket 07 adds the attention item.
  - A line still being written (no newline yet) is left for the next call, not reported as a failure.
- **For later tickets.** A file under project A's directory prefix can hold records whose `cwd` is in project B (`/x/proj` and `/x/proj-two`); they are stored under B but filtered by A's window (a `ponytail:` comment in `usage.ts`). Ticket 06 (widening) and ticket 03 (`usage.get` over the whole window) should decide whether that matters. A file that shrank is skipped for now; re-reading it is ticket 06. Records are attributed by their `cwd` as Claude Code wrote it, compared with the registry's resolved paths; Claude Code writes the resolved directory, so this holds unless a harness ever records a symlinked `cwd`.
- **Run on the owner's own artifacts.** The branch's daemon, in a temporary Binnacle home with this repository's main checkout registered, read `~/.claude/projects` in 0.3 s on the first snapshot: 197 messages today and 1,439 in the week, on `claude-opus-5-5` and `claude-opus-5`, reasoning `partial` (the two messages without `output_tokens_details`), and Claude Code at level 3.
- **Not verified by a test: the `product` skill's presentation.** The spec leaves it to the exit demonstration (ticket 09). To check it by hand against this branch's daemon, from the branch's checkout, without touching the running one:

  ```sh
  export BINNACLE_HOME=$(mktemp -d) BINNACLE_PORT=0
  node apps/cli/src/bin.ts daemon start
  node apps/cli/src/bin.ts project register
  claude    # a fresh session here, with that environment; then run /binnacle:product
  node apps/cli/src/bin.ts daemon stop && rm -rf "$BINNACLE_HOME"
  ```

  The usage section should take two or three lines: today's and the week's input, cached input, cache creation and output, with reasoning as a part of output; the week's models; Claude Code at level 3; `tasks` and `unassigned` under *Not available*.

### Review

`/code-review` against `main`, both axes in sub-agents.

**Standards**

1. Tests read the store directly (`stored()` in `usage.test.ts`), which the spec's testing section discourages. **Kept.** The no-content check and "provider is `null`" have no other seam until `usage_get` (ticket 03), and "older than the window is never stored" is a fact about the store. The totals themselves are asserted through the HTTP seam. `resolveArtifactRoots` is called directly because the environment it reads is not reachable through the in-process daemon.
2. Ticket not yet `DONE`, no comments or review. **Fixed** by this commit.
3. Claude Code's directory-name rule is written three times, in `usage.ts` and in two tests. **Kept**: the tests state Claude Code's rule on their own rather than reuse the code under test. The "could not be read" message, repeated three times in `ingest`, is **fixed** as one `unreadable` helper.
4. Unused exports (`claudeCodeDirectory`, `DEFAULT_WINDOW_DAYS`, a re-export of `Provenance` from the store). **Fixed**: none is exported now.
5. `HarnessLevel.harness` repeated the literal instead of `Harness`; `used` and `tokens` were unclear names. **Fixed** (`Harness`, `usageSection`, `numberOrNull`).
6. Two tables where ADR-0015 says one. **Kept**: the spec puts the cursor in the same tier, and the data model says so.
7. `readFrom` ignored the byte count `readSync` returns. **Fixed**: the buffer is cut to what was read.
8. Offsets were counted from decoded text, so a line that is not valid UTF-8 would move the cursor off the file's bytes. **Fixed**: the reader takes bytes and counts them.
9. A symlinked `cwd` would not match the registry's resolved path. **Left**: Claude Code records the resolved directory; noted above.

**Spec**

1. No criterion missing.
2. `<synthetic>` messages skipped without a spec line. **Kept**, recorded above as a decision.
3. `docs/06-data-model.md` changed `project_id` to `project_path` and made provenance per record. **Kept**, with the provenance line reworded to "one per record while its fields share it; per field where they differ", and both recorded above.
4. Records of another project found under this one's prefix are filtered by this one's window. **Left** for tickets 03 and 06, noted above.
5. A shrunk file is skipped. **Left** for ticket 06.

Typecheck is clean and the full suite passes, 264 of 264.
