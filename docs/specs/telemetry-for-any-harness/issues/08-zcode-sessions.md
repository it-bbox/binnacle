# 08: ZCode's sessions read from its files

Status: DONE
Triage: ready-for-agent
Blocked by: 06
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** a reader for ZCode's sessions, built from ticket 06's sample; the `Harness` union gains `zcode`, and its provider and model are kept apart (ADR-0004) (spec, *New artifact readers*). Its level follows from what the files carry.

- [x] Reader tests over ticket 06's sample.
- [x] Daemon process test: a project's ZCode sessions appear as runs, with provider and model apart, and its level.

## Comments

Decisions, recorded on 2026-10-08:

- **Where.** The daemon reads ZCode's one database, `~/.zcode/cli/db/db.sqlite`, read-only, whenever it or its write-ahead log changed, as it reads opencode's; the artifact root is `~/.zcode/cli/db`, with no environment override, since ZCode documents none. The rollout files, which hold every prompt, are never read.
- **What.** A record per `model_usage` row with a `completed_at`, joined to its `session` for the directory and the parent: the agent's calls and the one that titles a session alike, as ticket 06 says both count. A subagent's calls go under the session that started it, one level up, as opencode's do. Provider and model are what ZCode writes, `account:zai-individual-coding-plan` and `GLM-5.3` apart (ADR-0004).
- **Counts.** Input is `input_tokens` less the cached input and the input written to cache, null when either is unknown or they exceed it; output is `output_tokens`, reasoning within it; every count `calculated`. That cache writes are within `input_tokens` is read from ZCode's usage naming them beside its input, as the AI SDK it builds on does; ticket 06's sample wrote none, so the exit demonstration confirms it, and the reader marks it `ponytail:`.
- **Level.** 3, with the reason that ZCode documents no OpenTelemetry export. As ticket 03 asked, `binn init` names ZCode, detected by `~/.zcode`, among the harnesses without an export, and `binn audit` reports it as `telemetry.export_zcode`, `ok`.
- **Shared with opencode.** The loop that stops one session at a row it cannot read and reads the others on is `readSessionRows` in the adapters, and the daemon reads both databases through one `ingestDatabase`, by a table of the harnesses that keep one.
- Checked read-only against the owner's database: its 3 calls read with no failure, the first as ticket 06's sample, 4 788 input, 19 456 cached.

### Review

Code review against `main`, on both axes.

Standards:

- The daemon's `DatabaseHarness`, `DATABASE_HARNESSES` and `isDatabase` had no doc comment, as the module's other items have — **fixed**.
- A database reading's failure named its row `step`, opencode's word, though ZCode's row is a call — **fixed**: it is `id`, and the daemon's message names a step or a call.
- `ZCODE_NO_EXPORT` repeats opencode's sentence with another name, and the dashboard repeats both — **kept**: the dashboard matches a reason by its exact text to translate it.
- `readCall` builds its record as `readStep` does, the tokens apart — **kept**: two readers, and their tokens differ.
- A harness touches many files, `~/.zcode` written in both the daemon and the CLI — **kept**: as every harness before it.

Spec:

- Cache writes are subtracted from input, which ticket 06 does not show — **kept**, as decided above, marked `ponytail:` for the exit demonstration.
- Rows are chosen by `completed_at`, not by `status = 'completed'`, so a call that failed after it finished counts — **kept**: it is a call, and its tokens were spent.
- A `model_usage` row without its session is dropped without a reason — **kept**: it has no directory, so it is no project's to report.
- A subagent's subagent goes under its parent, not the root session — **kept**: as opencode's.
- `Status: DONE` and the roadmap were not yet set — **fixed** by this ticket's last commit.
