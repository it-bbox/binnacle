# 05: opencode's sessions read from its files

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** a reader for opencode's local message records gives a record per model call with its tokens; the `Harness` union gains `opencode`, and the daemon ingests a project's opencode sessions (spec, *New artifact readers*). opencode reaches level 3; it exports no OpenTelemetry, which its support reason and `binn init`'s Summary say.

- [x] Reader tests over sample records: tokens mapped, nulls where absent, the reason for an unreadable record.
- [x] Daemon process test: a project's opencode sessions appear in `usage.get` and its level is 3.

## Comments

### Decisions

- **The format, from opencode's source.** No opencode was installed where this ticket was built, so the format comes from opencode v1.18.35, its latest release (`anomalyco/opencode`, formerly `sst/opencode`): `packages/core/src/session/sql.ts`, `packages/schema/src/v1/session.ts`, `packages/core/src/database/database.ts` and `packages/opencode/src/session/processor.ts`. The exit demonstration (ticket 15) confirms it on the owner's Mac. The format as read:
  - Since opencode 1.2, its sessions are not files but one SQLite database, `opencode.db`, in its data directory: `$XDG_DATA_HOME/opencode`, otherwise `~/.local/share/opencode`, on macOS too. It runs in WAL mode.
  - The `session` table has each session's `directory` and `parent_id`, the session that started it, for a subagent's. `message` and `part` hold each message and part as JSON in `data`.
  - Each model call writes one `step-finish` part with its tokens once the call has finished. The assistant message's own `tokens` are overwritten by each step, so they are only the last call's.
  - A step's tokens are `input`, `output`, `reasoning` and `cache.read` and `cache.write`. opencode writes input without what was read from or written to cache, and output without reasoning. It writes a count its provider did not give as 0.
  - The assistant message names `modelID`, `providerID` and `path.cwd`.
- **The reader**, `readOpencode` in `packages/adapters/src/opencode.ts`, is a pure function from the database's steps to records. It gives one record per `step-finish` part.
  - The spec's reader takes bytes and a position. A database has no bytes to read from a position, so the rows are the input. `readOpencodeSteps` beside it selects them, read-only, through `node:sqlite`, which the store already uses. No dependency was added.
  - The record's natural key is the part's id, and its time is the time the part's row was written.
  - Its directory is the message's `path.cwd`. Its provider is opencode's `providerID`: opencode names who served the call, which ADR-0004 asks for.
  - A subagent's records go under the session that started it, as Gemini CLI's do.
- **The counts**, all `calculated`:
  - input is opencode's input;
  - cached input is `cache.read`, cache creation is `cache.write`;
  - output is `output + reasoning`, since reasoning is a part of output in Binnacle, and null when either is missing;
  - a count opencode does not have is null.
- **The ingest.** The daemon reads the whole database whenever it or its `-wal` file has changed since the last reading, and the unique key absorbs what was already stored.
  - The cursor's `size` holds the latest modification time of the two files, and its offset and line hold nothing.
  - The database holds every project's sessions, so `forgetRead` forgets its cursor when a project is registered.
  - A `ponytail:` comment on `ingestDatabase` names the ceiling: every step of every project is read on each change.
- **A step that cannot be read stops its own session only.** Its project, if registered, is at level 1 with the database, the step and the reason. Other sessions and projects are read on. A database that cannot be opened or read puts every project at level 1, with SQLite's reason.
- **"Its support reason and `binn init`'s Summary say it exports no OpenTelemetry"** is one sentence, `OPENCODE_NO_EXPORT` in `apps/daemon/src/usage.ts`:
  - The daemon's `HARNESSES` entry for opencode gives it as its `noExport`. At level 2 or 3, `HarnessLevel.reason` says why opencode never reaches 4, and its doc comment says so. The dashboard has the sentence in English and Russian, and its i18n test checks it against the daemon's.
  - Ticket 03, merged first, already named opencode in `binn init`'s Summary and in `binn audit`, from `NO_EXPORT` in `apps/cli/src/export.ts`. That entry's reason now is `OPENCODE_NO_EXPORT`, and it names the database, no longer "session files".
  - A first version of this ticket said it in init's next step for opencode too. That copy was dropped in the rebase onto 03.
- **Not read:**
  - the JSON files under `storage/` of an opencode older than 1.2, which opencode migrates into the database on its first launch;
  - a channel's own database (`opencode-<channel>.db`) or `OPENCODE_DB`, used by opencode's development builds;
  - the `session_message` table, opencode's next message format. The released CLI writes steps to `part`.
- **Out of this ticket:** `binn init`'s session history (`apps/cli/src/history.ts`) still names only Claude Code and Codex. The documents are ticket 14's.
- **Against ticket 04, merged before this branch:** Gemini CLI keeps its entry and artifact root in `HARNESSES`; opencode is a fourth beside it. The reader does not use `readMessages` in `artifact.ts`: opencode writes a step once, when its call has finished, so no record waits to settle. It shares `count` and `isObject`.
- **For the exit demonstration**, on the owner's Mac, after an opencode session in a registered project:

  ```sh
  ls ~/.local/share/opencode/                       # opencode.db, -wal and -shm
  sqlite3 -readonly ~/.local/share/opencode/opencode.db \
    "select count(*) from part where instr(data, 'step-finish') > 0;"
  sqlite3 -readonly ~/.local/share/opencode/opencode.db \
    "select json_extract(data, '$.tokens') from part where instr(data, 'step-finish') > 0 limit 3;"
  binn call usage.get '{}'                          # in the project: the opencode records, level 3
  ```

  If the database turns out to be `opencode-<channel>.db`, or the steps are in `session_message` rather than `part`, `readOpencodeSteps` and `opencodeDatabase` need changing.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation of a documented rule.** Findings:

1. **One bad step stopped the whole database**, every project's sessions with it, and put every project at level 1. **Fixed**:
   - a step that cannot be read now stops only its own session;
   - it is reported only for the registered project the session was launched in;
   - the reading is retried until the step can be read.

   A daemon test shows the other project read on at level 3.
2. **The `like '%"type":"step-finish"%'` filter assumed JSON without spaces.** **Fixed**: `instr(data, 'step-finish')` narrows the rows, and the reader checks each part's type.
3. **Repeated switches:** `startIngest` and `ingestFile` each check for opencode outside the switch that picks a reader. **Kept**: a database is not read from a position as a file is, so it has its own reading.
4. **A modification time kept in the cursor's `size`.** **Kept**: the cursor table needs no change for one harness. `ingestDatabase`'s doc comment says what the field holds for it.
5. **The no-export sentence is written twice**, in the daemon's level reason and in `binn init`'s Summary. **Fixed** in the rebase onto ticket 03: there is one sentence, `OPENCODE_NO_EXPORT`, see *Decisions*. The dashboard's copy follows the existing convention for daemon reasons.
6. **Helpers without doc comments.** **Fixed**.
7. **A subagent started by a subagent goes under the middle session.** **Kept**: a record names the session that started it, as Claude Code's and Gemini CLI's do.

**Spec: both criteria met.** Findings:

1. **The reader is not a function from bytes and a position.** **Kept**: opencode keeps no files to read that way. The reader is still pure, over the database's rows. See *Decisions*.
2. **A reason at level 2 or 3 changes what `reason` means.** **Kept**: the ticket asks for opencode's support reason to say it exports no OpenTelemetry. `reason`'s doc comment states the new meaning.
3. **One bad step blocked every project.** **Fixed**: see Standards 1.
4. **Nested subagents.** **Kept**: see Standards 7.
5. **Every count is `calculated`, though input and cache are opencode's as written.** **Left**: provenance is one value per record, and output is derived, as for Gemini CLI.
6. **The token semantics could not be checked by the reviewer.** **Left** to the exit demonstration. `getUsage` in `packages/opencode/src/session/session.ts` (v1.18.35) subtracts cache read and write from input and reasoning from output.
