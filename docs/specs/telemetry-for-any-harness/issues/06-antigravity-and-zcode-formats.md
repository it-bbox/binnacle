# 06: Antigravity's and ZCode's session formats, on the owner's machine

Status: DONE
Triage: ready-for-human
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** the owner, on the owner's machine with Antigravity and ZCode installed, records where each keeps its sessions and a redacted sample of their records — the field names and shapes, with every prompt, response and path replaced — and whether they carry a working directory, a session id, a model and token counts (spec, *New artifact readers*). The samples go under this ticket's `## Comments`, from which tickets 07 and 08 build their readers.

- [x] Antigravity: its session location and a redacted sample, with which of directory, session id, model and tokens it carries.
- [x] ZCode: the same.

## Comments

Recorded on 2026-10-08 on the owner's machine, Ubuntu 24.04, from one session in each in this repository. Every prompt, response, path and id below is replaced; field names, shapes and counts are as found.

### ZCode 3.14.4 (Linux AppImage)

ZCode's agent is a fork of opencode: its sessions live in one SQLite database, `~/.zcode/cli/db/db.sqlite` (WAL mode), with opencode's `session`, `message` and `part` tables and, beside them, usage tables of its own. The reader needs two:

- `session`: `id` (`sess_<uuid>`), `parent_id` (a subagent's parent, else null), `directory` (the working directory, absolute), `time_created`, `time_updated` (milliseconds), `task_type` (`interactive`).
- `model_usage`, one row per model call, metadata and counts only:

```json
{"id":"usage_model_main_turn_msg_<id>_0","session_id":"sess_<uuid>","turn_id":"<id>","query_source":"main_turn",
 "provider_id":"account:zai-individual-coding-plan","model_id":"GLM-5.3","variant":"max","agent":"zcode-agent",
 "mode":"build","status":"completed","started_at":1791463527894,"completed_at":1791463531195,"finish_reason":"tool-calls",
 "input_tokens":24244,"output_tokens":59,"reasoning_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":19456,
 "provider_total_tokens":24303,"computed_total_tokens":24303,"context_exceeded":0,
 "raw_usage_json":"{\"inputTokens\":24244,\"outputTokens\":59,\"totalTokens\":24303,\"cacheReadTokens\":19456,\"cacheWriteTokens\":0}"}
```

So ZCode carries a working directory, a session id, a provider and a model kept apart (ADR-0004), and token counts per call: level 3. `input_tokens` includes the cached input (24244 = 4788 uncached + 19456 cached, as the provider's own usage in the rollout file shows), so input less cached input is calculated. `query_source` is `main_turn` for the agent's calls and `session_title` for the title it generates; both are calls and both count. `turn_usage` and `tool_usage` hold the same counts per turn and per tool; the reader takes `model_usage` alone. ZCode also writes `~/.zcode/cli/rollout/model-io-<session>.jsonl`, one line per call with the same usage, but each line carries the full request, prompts included, so the reader must not read it. The desktop app's own index, `~/.zcode/v2/tasks-index.sqlite`, has a `tasks` row per conversation with its `workspace_path`, and no counts. ZCode exports no OpenTelemetry.

### Antigravity 1.23.2 (Debian package, VS Code 1.107.0)

- Its conversations are `~/.gemini/antigravity/conversations/<uuid>.pb`, one file per conversation, with `~/.gemini/antigravity/brain/<uuid>/` beside each. The `.pb` files are encrypted: 8.0 bits of entropy per byte, no readable field. They give a session id (the file name) and times (the file's), nothing else.
- Its window state, `~/.config/Antigravity/User/globalStorage/state.vscdb` (SQLite, VS Code's `ItemTable`), has the key `antigravityUnifiedStateSync.trajectorySummaries`: base64 of a protobuf whose entries hold the conversation id, a nested base64 summary with a short title, a longer string, and the workspace's `file://` URI. So a conversation's working directory can be read there. The summary holds no model and no token counts.
- So Antigravity carries a session id and a working directory, and neither a model nor tokens: level 2 at most, as the spec expected. It has no exporter.
- **Not verified.** The session in this repository got no answer: first Antigravity's Git library refused the repository's `extensions.worktreeconfig` (`core.repositoryformatversion does not support extension: worktreeconfig`), which was unset, since no `config.worktree` used it; then Google's model API answered `RESOURCE_EXHAUSTED (code 429)` on every try. The owner decided to build its reader from what is above and leave it marked not verified.

### Gemini CLI

Not part of this ticket, found while doing it: signing in to Gemini CLI with a personal Google account fails with "This client is no longer supported for Gemini Code Assist for individuals", pointing to Antigravity. An API key from Google AI Studio still works. The owner decided to leave Gemini CLI, as Antigravity, built and marked not verified.

