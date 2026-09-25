# 05: Codex usage, with the branch from the reflog

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/telemetry/spec.md`

**What to build:** Codex sessions count, with honest arithmetic, and their branch recovered from Git where Codex records none. Decided in the spec, under *Where the artifacts are*, *Normalised record* and *Ingest*, and in ADR-0028.

- [x] The daemon's runtime carries the Codex root: `$CODEX_HOME/sessions`, otherwise `~/.codex/sessions`. A rollout's `cwd` comes from its `session_meta` record.
- [x] A pure Codex reader in `packages/adapters` turns consecutive `total_token_usage` values into differences, `calculated`; input not read from cache is `input_tokens − cached_input_tokens`, `calculated`. A decreasing total is a failure.
- [x] Provider is `session_meta.model_provider`; model is the turn context's.
- [x] The branch is resolved at ingest from the `HEAD` reflog of the checkout the `cwd` names, matched by timestamp, and stored with source `reflog`; with no answer it is `null` and the run is unassigned.
- [x] `harnesses` in the snapshot lists Codex with the level it reached.
- [x] Fixtures are cut from a real rollout, and the ticket's comments say which.

## Comments

- **Fixture.** `apps/daemon/test/fixtures/codex/tool-calls.jsonl` is cut from rollout `01a07cf4-39dc-7d51-8a04-377ab6570e3b`. That rollout is a Codex desktop session of 2026-09-07 (`codex_work_desktop`, Codex 0.153.0-alpha.5, provider `openai`, model `gpt-5.6-sol`) in another of the owner's repositories. The fixture keeps these lines, with their own `ordinal`s:
  - its `session_meta`;
  - the turn context before the first call;
  - a prompt, a tool call and its output;
  - one `token_usage_record`, the per-call usage Codex also writes, which the reader must ignore;
  - all eleven `token_count` events of that turn. The last one repeats the total before it, because the turn was aborted.

  Content, instructions, tool input and tool output became `…MUST-NOT-BE-STORED` markers. `cwd` became a placeholder. `git` (with the repository's URL) and `rate_limits` were dropped. Tests change only `cwd`, the session id, timestamps, and, to switch models, one turn context's `model`.
- **Where it lives.**
  - `packages/adapters/src/codex.ts`: `readCodex(bytes)`, pure, and `codexSession`, the `session_meta` reading that the reader, the daemon and `binn init` share.
  - `packages/adapters/src/artifact.ts`: the JSON Lines loop that both readers now share, moved out of `claude-code.ts` with the position types.
  - `packages/adapters/src/git.ts`: `readHeadHistory` (`git log --walk-reflogs` and `symbolic-ref`, both read-only) and `branchAt`.
  - `apps/daemon/src/usage.ts`: `codexSessions`, the Codex side of `startIngest` and `ingestFile`, `withBranch`, and a `harnesses` entry per harness.
  - `store.usage` now returns every harness's records, so it takes no harness argument.
  - `ArtifactRoots` has `codex`. `binn init` takes it from `resolveArtifactRoots().codex`, and ticket 08's `ponytail:` line and `jsonlFilesUnder` are gone.
- **Decided here, within the spec.**
  - **The natural key is `<session id>:<ordinal>`.** Ordinals restart in every rollout, so the ordinal alone is not unique within the harness. The spec and `docs/06-data-model.md` now say so. The ordinal is Codex's own `ordinal` field, and a token count without one is a failure.
  - **A token count whose total equals the one before it gives no record.** Codex writes one when a turn is aborted, and it is no new call. Neither does a count with `info: null`, which carries only rate limits.
  - **Only a rollout whose `session_meta` names a directory of the project is read.** A rollout's name says nothing of where it ran. The ingest first reads the file's first line, and only for a file that has grown past its cursor. Every rollout under the root is a candidate, since Codex files them by date.
  - **A rollout is read whole whenever it has grown.** Its differences need the totals before them, and its session is on its first line. The unique key absorbs the repeats. This costs about 0.1 s for all 31 of the owner's rollouts, 58 MB in total, and is marked `ponytail:`.
  - **Cache creation is `null` for Codex.** Codex's totals carry `cache_write_input_tokens`, 0 in every rollout on this machine. The spec maps only `input_tokens − cached_input_tokens`, and whether Codex counts cache writes inside `input_tokens` is not known. Mapping it could count the same tokens twice. A question for the owner, below.
  - **The branch at a timestamp** is the one the next `checkout: moving from X` entry after it left, or the checkout's current branch when no switch came after. It is `null` when that was a detached HEAD, or when the timestamp is older than the reflog's oldest entry. The reflog is read once per `cwd` per ingest.
  - **The reflog applies to any record whose harness wrote no branch,** as ADR-0028 states it, so a Claude Code record without `gitBranch` gets one too. Only Codex's case is tested.
- **Checked on the owner's own artifacts.** `readCodex` read all 31 rollouts in `~/.codex/sessions` with no failure, giving 83 records.
  - The rollouts Codex Desktop wrote when it migrated its threads on 2026-09-04 carry token counts with every field 0 and only `total_tokens` set. They give no record, so no imported history is counted as new usage.
  - Codex does write the branch a session started on into `session_meta.git.branch`, in 17 of the 31 rollouts (see the questions below). For each of those 17, `branchAt` over the repository's reflog at the session's start gave exactly that branch.
  - None of these rollouts is in this repository, so the snapshot of this repository still shows Codex with "no session found".
- **Questions for the owner (nothing here blocks the ticket).**
  1. **Codex does record a branch,** contrary to the spec's "There is no branch" and ADR-0028's "Codex writes none". Codex 0.153 writes `session_meta.git` with `branch`, `commit_hash` and `repository_url`. That is the branch at the session's start only, not one per call. This ticket follows its own criterion and uses the reflog alone. Should `session_meta.git.branch` become the answer when the reflog has none, for example for a worktree removed since? It would be wrong after a switch mid-session. ADR-0028 and the spec's *Normalised record* line would need correcting either way.
  2. **Should `cache_write_input_tokens` be mapped** to cache creation, with input then `input_tokens − cached_input_tokens − cache_write_input_tokens`? Nothing on this machine shows whether it is part of `input_tokens`.
- **For later tickets.**
  - **Ticket 07.** A decreasing total already stops the file and drops Codex to level 1: see the test "stops reading a rollout at a total that decreases". Because a rollout is re-read from its start, a failing line blocks everything after it for good, not just until the next read. The attention item should say so.
  - **Ticket 09.** Codex appears in `harnesses`. This repository has no Codex session, so its level there will be "not found".

### Review

`/code-review` against `main`, both axes in foreground sub-agents, after rebasing onto ticket 03.

**Standards** (no hard violations)

1. The spec still gave Codex's natural key as the ordinal alone. **Fixed** in `spec.md`.
2. `isObject` was exported without a doc comment. **Fixed.**
3. `session_meta` was parsed in three places: the reader, the daemon's first-line check (with a double cast), and `binn init`. **Fixed**: `codexSession` in the adapter, used by all three.
4. There are repeated `harness === 'codex'` branches in `startIngest` and `ingestFile`. **Kept**: there are two harnesses, and a table of behaviours for two entries is speculative.
5. `harness.harness` read as a mysterious name. **Fixed**: the table entry is `entry`.
6. The reflog was read once per file, even for records already stored. **Fixed in part**: it is now read once per `cwd` per ingest. Records already stored still get their branch looked up before the store discards them. **Left**: that needs a store lookup per record.
7. A failing Codex line blocks its rollout for good. **Left** for ticket 07, above.
8. A rebase's detached HEAD reads as the branch being rebased. **Kept**, marked `ponytail:` in `branchAt`.

**Spec**

1. The ticket's comments were missing. **Fixed** by this commit.
2. The same finding as Standards 1. **Fixed.**
3. The reflog also fills in Claude Code records without a branch, and no test covers that. **Kept**: ADR-0028 is harness-agnostic, as recorded above.
4. Codex cache creation is `null` although `cache_write_input_tokens` exists. **Kept**, and asked above.
5. `session_meta.git.branch` exists, contradicting the spec and ADR-0028. **Left** for the owner, asked above. The ticket's criterion is followed.
6. A rollout is re-read whole whenever it grows. **Kept**, marked `ponytail:` and recorded in `docs/06-data-model.md`.

Typecheck is clean, and the full suite passes: 293 of 293 before the rebase onto ticket 03, and 299 of 299 after it.
