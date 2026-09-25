# 04: Subagent runs

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/telemetry/spec.md`

**What to build:** the work a review or an autopilot spawns is counted, as runs of their own linked to the run that started them. Decided in the spec, under *Where the artifacts are* and *Observed runs and attribution*.

- [x] `<session>/subagents/agent-<id>.jsonl` files are read beside their session; each record carries its subagent id and parent session.
- [x] A subagent's run names its parent run, and is attributed to its own Task by its own `cwd` and branch.
- [x] The subagent's `.meta.json` description is never read into a record.
- [x] Tests through the daemon seam: a subagent on the parent's branch, one in a worktree on a ticket branch, and the parent link in `usage.get` once ticket 03 has landed, otherwise in the stored runs.

## Comments

- **Owner decisions, 2026-09-25.** The owner made these in the orchestrating session, on the questions this ticket raised, and this ticket implements them:
  1. **Branch source.** A record's branch comes from the reflog of the checkout its `cwd` names, while that checkout exists at ingest. The branch the harness wrote is used only when the checkout is gone or its reflog has no answer. ADR-0029 records this and supersedes ADR-0028's order; ADR-0028's Status line says so.
  2. **The same rule for Codex.** Codex's harness branch is `session_meta.git.branch`, the branch its session started on, with source `harness`. It is used only when the reflog has no answer. The spec's *Normalised record* no longer says Codex has no branch.
  3. **The unfinished tail.** A Claude Code file's last message is not stored until a later message has started after it, or the file has gone unwritten for a minute (`SETTLED_AFTER_MS`). Until then the cursor stays before it. The table stays append-only, and a re-insert stays a no-op. The spec's *Ingest* says so. The earlier `ponytail:` ceiling in the reader is gone.
  4. **Roles for ticket 09.** `usage.get` without a Task gains `byRole`, the totals for `product`, `implementation` and `unknown` over the same window. Roles are now asserted through it at the HTTP seam, and the direct call to the daemon's `runs` is gone from the tests. The spec's *`usage.get` and `usage_get`* and ticket 09's `product` criterion say so. The ticket-09 question is gone from the roadmap.
  5. **Codex cache writes.** `cache_write_input_tokens` stays unmapped, so cache creation stays `null`, until a real rollout shows it non-zero. This is one sentence in the spec's *Normalised record*.
- **What was found, which led to those decisions.** Claude Code's `gitBranch` behaves as one value per Claude Code process, not one per checkout.
  - The subagent that built ticket 03 worked in its own worktree on `feat/usage-get`. Its records say `main` 189 times, then `feat/usage-get` twice, then `main` 76 times.
  - The autopilot session `1e870ea0` stayed on `main`, but wrote `feat/task-brief` for four minutes while six subagents on different ticket branches were writing the same value.
  - `HEAD` shows up during a rebase. It is now read as no branch.
  - In subagent sessions, the repeated records of one message differ in 1,625 of 1,643 cases. Only the last carries the message's own output. Keeping the first would have lost about 1.55 million output tokens. So a reading keeps each message's last record.
- **Where it lives.**
  - `packages/adapters/src/claude-code.ts`:
    - `subagentId` is the record's `agentId`, read only on a sidechain record, and a failure when missing there.
    - `parentSession` is the record's `sessionId`, which for a subagent is the session that started it.
    - A message is its last record.
    - `readClaudeCode(bytes, start, settled)` holds back the last message; `readLines` in `artifact.ts` gained an optional `seen` callback that gives each record's line position.
  - `packages/adapters/src/codex.ts`: `codexSession` returns `branch`.
  - `packages/telemetry/src/index.ts`: `UsageRecord` has `subagentId` and `parentSession`, and `observedRuns` sets `parentRunId`.
  - `apps/daemon/src/usage.ts`:
    - `claudeCodeSessions` also lists `<session>/subagents/agent-*.jsonl`, never `.meta.json`, and `binn init` still counts main sessions only.
    - `withBranch` asks the reflog first for every record.
    - `ingestFile` passes whether the file has settled.
    - `usageGet` adds `byRole`.
  - The daemon takes `settledAfterMs`; the test daemon sets it to `0`, as it sets its own budget, so a file a test has just written is read to its end, and the tail test sets it to an hour.
  - The fixture `apps/daemon/test/fixtures/claude-code/subagent-in-worktree.jsonl`, with its `.meta.json`, is cut from subagent `aa8633a64ffc4a92a` of session `8380ce0f-22a4-4126-a14e-d1bc77ea4701`. That subagent built `feat/checkpoint` in a worktree on 2026-09-23. The fixture holds its task and the four records of message `msg_011CfM38sqJQkJUVVYv1KJgk`. Content, tool input and the description are `…MUST-NOT-BE-STORED` markers.
  - The write-guarantee test now has a subagent session and its `.meta.json` among the artifacts.
- **Decided here, within the spec.**
  - **Parent run.** All of a subagent's runs name the same parent run: the run of the parent session that had started by the subagent's first record. The artifact records no link from a subagent to the message that spawned it, so the link is by time. A parent session with no record among those read gives `null`. A nested subagent links to its session's run, because only `.meta.json`, which is not read, names the subagent that spawned it.
  - **`byRole` needs the tracker.** It is unavailable with the tracker's reason when the tracker cannot be read, like `tasks`, because `implementation` and `unknown` depend on it.
  - **A read failure does not finish the last message.** The last message is held back when a later line cannot be read, since that line is no later message.
- **Run on the owner's own artifacts.** An in-process daemon ran with a temporary Binnacle home, read `~/.claude/projects`, registered this worktree, and used the one-minute settle.
  - The first snapshot, including the whole import, took 1.2 s. After it, `usage.get` took 59 ms.
  - The 90-day window holds 4,038 records, of which 2,774 are unassigned. `byRole`: `product` 2,355, `implementation` 1,264, `unknown` 419.
  - `telemetry/04`, this ticket's live worktree, gets 185 records in 5 runs through its reflog. Each run links to its parent run in the orchestrating session.
  - `usage_get` for `telemetry/03` still returns no runs. Its worktree was removed at its merge, so its records keep the branch Claude Code wrote, mostly `main`. That is ADR-0029's accepted loss for history in worktrees removed before Binnacle read them. It applies to most of epics 1 to 3's subagent work.
- **For ticket 09 and the owner.**
  - The demonstration's check that "`usage_get` for tickets of epic 3 returns their runs" will find a Task's runs only where its work ran in a main session launched in its worktree. Work its subagents did in worktrees removed since then reads as `main`.
  - A record is ingested once. A store that ingested this repository under ADR-0028's order keeps those branches. The owner's running daemon may have done so, if it runs tickets 01 to 03's code. Its live checkouts' records would be read differently now.

### Review

`/code-review` against `main`, both axes in foreground sub-agents, run twice.

**First round, before the owner's decisions**

- **Standards.**
  - A bare store-record alias. **Fixed**: removed.
  - The local variable `agentId`. **Fixed**: renamed `subagentId`.
  - The listing of subagent directories nested four calls deep. **Fixed.**
  - `parentSession` repeats `sessionId`. **Kept**: the spec names the field.
- **Spec.**
  - The spec's line on identical repeats. **Fixed**: it now gives the subagent measurement.
  - The parent link by time. **Fixed**: recorded above.
  - An ingest between a message's records kept its early output. **Fixed** by owner decision 3.

**Second round, after them**

- **Standards** (no hard violations).
  1. `claudeCodeFiles` only joins main and subagent files. **Kept**: `binn init` counts main sessions only.
  2. `parentSession` equals `sessionId` on Claude Code. **Kept**, as above.
  3. `readLines`'s optional `seen` callback has one caller. **Kept**: it is how the reader learns where a message starts.
  4. `byRole` names the three roles. **Kept**: `Record<RunRole, Totals>` makes a new role a type error there.
  5. `runs` was still exported, with no importer left. **Fixed**: now private.
  6. `settledAfterMs` is configurable although the spec says a fixed minute. **Kept**: it follows `ingestBudgetMs`, and production always uses the minute.
  7. The names `claudeCodeSessions` and `claudeCodeFiles`. **Kept**, with doc comments that say which gives what.
  8. The fixture's comment on its branch was misleading. **Fixed.**
- **Spec.** No requirement missing.
  1. The reader keeps a message's last record. **Kept**: the spec's *Normalised record* now says so.
  2. A failing line let the unfinished last message through. **Fixed**: the message is held back then too.
  3. A worktree directory left behind after its removal would read as a subdirectory of the main checkout, and take that checkout's reflog. **Left**: Git removes the directory with the worktree, and nothing in Git tells the two apart.
  4. Claude Code's `HEAD` was kept as a branch name. **Fixed**: it is no branch.
  5. `byRole` is unavailable when the tracker is. **Kept**, recorded above.

Typecheck is clean, and the full suite passes: 307 of 307.
