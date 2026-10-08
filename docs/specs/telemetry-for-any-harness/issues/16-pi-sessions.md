# 16: pi's sessions read from its files

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** a reader for pi's session files (`@earendil-works/pi-coding-agent`, formerly `@mariozechner/pi-coding-agent`) gives a record per model call with its tokens; the `Harness` union gains `pi`, and the daemon ingests a project's pi sessions (spec, *New artifact readers*, user story 43). pi reaches level 3 if its records carry tokens; it has no built-in OpenTelemetry export, which its support reason and `binn init`'s Summary say, from 03's one place for a harness without export, as opencode's does.

The format is confirmed against pi installed on the owner's machine where it is, else against pi's source at its latest release, as 04 and 05 did, the source named in the ticket's comments.

- [x] Reader tests over a sample file: records, nulls where a count is absent, the reason for an unreadable line.
- [x] Daemon process test: a project's pi sessions appear in `usage.get` and its level is 3, or the level its records allow with the reason.

## Comments

Decisions, recorded on 2026-10-08:

- **Source.** The format is confirmed against pi 1.1.0 (`@earendil-works/pi-coding-agent`) installed on the owner's machine: its `dist/core/session-manager.js`, `dist/config.js` and `dist/core/usage-totals.js`, pi-ai's `Usage` type and its providers' mapping of usage, and the owner's one session file, read for its structure only. The fixture, `packages/adapters/test/fixtures/pi/session.jsonl`, is that file with its content replaced and calls added.
- **Where.** `$PI_CODING_AGENT_DIR/sessions`, otherwise `~/.pi/agent/sessions`, a directory per launch directory named `--<cwd with / and : as ->--`. That name is lossy, so it only selects candidates, as Claude Code's does, and the `cwd` of each file's header decides. A session kept elsewhere with `--session-dir` is not found, marked `ponytail:`.
- **What.** A record per entry that carries a call's usage, the entries pi itself totals: an assistant message, a tool result whose tool called a model, a `usage` entry (a cache-warming call) and a compaction's or branch summary's usage. A file is read whole whenever it grew, since the session's id and `cwd` are on its header line only, as Gemini CLI's is; pi appends an entry once, whole, so nothing waits for a later line.
- **Counts.** pi normalises every provider's usage itself: `input` without what was read from or written to cache, `cacheRead`, `cacheWrite`, and `reasoning`, written only by a provider that reports it, within `output`. They are taken as written, every count `calculated`, and an absent count is null. A call that failed or was aborted with `totalTokens` 0 has every count null, since those zeros are pi's placeholders, not reported counts.
- **Provider and model** are the entry's own, apart (ADR-0004); the model is the one the provider answered with (`responseModel`) where pi wrote it, as pi totals it. A tool result's or summary's entry names neither, so both are null. pi writes no branch and has no subagents.
- **Forks.** A forked or branched session copies the entries before it, ids and timestamps included, so a record's natural key is `<entry id>@<timestamp>`: a copied call is counted once, under whichever session was read first.
- **Level.** 3, with the reason that pi has no built-in OpenTelemetry export. `binn init` names pi, detected by `pi` on PATH or `~/.pi`, among the harnesses without an export, and `binn audit` reports `telemetry.export_pi`, `ok`, from ticket 03's list.
- Compactions give no compaction marker, since pi writes no trigger beside them — marked `ponytail:` for context pressure, if it ever needs pi's.
- Checked read-only against the owner's session: 2 calls, the first failed with null counts, the second 3 143 input and 11 output on `openai`/`gpt-6.1-sol`.

### Review

Code review against `main`, on both axes, after rebasing onto ticket 07's merge.

Standards:

- `piSessions` repeats the listing closure and prefix filter of `claudeCodeSessions` — **kept**: each finder keeps its own, as Gemini CLI's does, and the two differ in what they list under a candidate.
- A harness touches many files, and `ingestFile`'s switch and the harness tables grow by one case — **kept**: as every harness before it.
- The reader's callback did not say what it returns, as Gemini CLI's does — **fixed**.

Spec:

- A tool result's usage, a tool's own call that pi totals, was not read — **fixed**.
- The model was the requested one, though pi totals by the model that answered — **fixed**: `responseModel` where pi wrote it.
- A call aborted before its provider reported anything gave zeros — **fixed**: null, as a failed one.
- The candidate directory's prefix has no trailing `--`, so `/repo-other` is a candidate of `/repo` — **kept**: the header's `cwd` decides, as the daemon test shows.
- The ticket named no source and was not `DONE` — **fixed** by this ticket's last commit.
