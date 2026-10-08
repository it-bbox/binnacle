# 07: Antigravity's sessions read from its files

Status: DONE
Triage: ready-for-agent
Blocked by: 06
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** a reader for Antigravity's sessions, built from ticket 06's sample, attributes them to the project and gives what they carry; the `Harness` union gains `antigravity` (spec, *New artifact readers*). Without per-call tokens it reaches level 2 and its reason says so.

- [x] Reader tests over ticket 06's sample: records with what the sample carries, nulls for the rest.
- [x] Daemon process test: a project's Antigravity sessions appear as runs, with its level and reason.

## Comments

### Decisions

- **Not verified**, as the owner decided while recording ticket 06: no Antigravity session got an answer on the owner's machine, so the reader is built from ticket 06's description and tested against samples made to it. Ticket 06 gives the summaries' shape, not their field numbers or bytes, so the samples' field numbers are made up (`packages/adapters/test/fixtures/antigravity.ts`).
- **The reader**, `readAntigravity` in `packages/adapters/src/antigravity.ts`, is a pure function from the window state's summaries and the conversations' ids and times to records, as `readOpencode` is from its rows: Antigravity keeps no file to read from a position. `readAntigravityState` beside it reads the value under `antigravityUnifiedStateSync.trajectorySummaries` from `state.vscdb`, read-only, through `node:sqlite`. No dependency was added.
  - Without field numbers, an entry of the summaries is searched for the strings it holds, through nested messages and base64. Its id is the string that names a conversation's `.pb` file; its directory the first `file://` URI, decoded. A `ponytail:` comment names the ceiling: read the fields by their numbers once a working Antigravity confirms them.
  - The value is read whether VS Code wrote it bare or as a JSON string. Summaries that are not base64 of a protobuf are the reason the reading stops.
- **A record is a conversation**, not a call: Antigravity's conversations are encrypted, so a record says only that a session ran in a directory from a time. Its model, provider and every count are null (ADR-0007), its provenance `calculated`, and its natural key and session id the conversation's id. A conversation with no workspace in its summary, or no file, gives none.
  - Its time is the earliest its `.pb` file gives: its birth time where the file system keeps one, else its modification time. A `ponytail:` comment on `ingestAntigravity` names the ceiling: a run shows no activity after its start, and is running only just after it began; key a record per change of the file if Antigravity's running sessions should show as running.
- **The ingest** reads the window state and the conversations whole whenever the state, its `-wal` or the conversations directory changed, as opencode's database is read; the cursor's `size` holds that mark. The window state names every project's sessions, so one that cannot be read puts every project at level 1, as opencode's database does. Rebased onto ticket 08, Antigravity stays out of its `DATABASES` table: it reads two places, its mark takes the conversations directory too, and it has no row that stops one session only, so `ingestAntigravity` sits beside `ingestDatabase` and shares `databaseMark`, `databaseChanged` and `databaseFailure`.
- **Where Antigravity lives**, two artifact roots: `antigravity`, `~/.gemini/antigravity`, and `antigravityState`, `Antigravity/User/globalStorage/state.vscdb` in VS Code's user data directory (`$XDG_CONFIG_HOME`, else `~/.config`; `~/Library/Application Support` on macOS, as VS Code keeps it, unconfirmed there).
- **Its reason**, `ANTIGRAVITY_NO_TOKENS` in `apps/daemon/src/usage.ts`, is given at level 2 as opencode's is at 3: no export and encrypted conversations, so only sessions and their directories, no model or tokens. The dashboard has it in English and Russian, and its i18n test checks it against the daemon's. `binn init`'s Summary and `binn audit` name Antigravity with it too, as ticket 03 left to this ticket.
- **For the exit demonstration**, on the owner's machine, after an Antigravity conversation in a registered project:

  ```sh
  ls ~/.gemini/antigravity/conversations/            # <uuid>.pb per conversation
  sqlite3 -readonly ~/.config/Antigravity/User/globalStorage/state.vscdb \
    "select length(value) from ItemTable where key = 'antigravityUnifiedStateSync.trajectorySummaries';"
  binn call project.snapshot '{}'                     # in the project: its Antigravity runs, level 2, and the reason
  ```

  If the session is missing, the summary may hold its workspace in a field the search does not reach, or the value may not be base64: `readAntigravity` needs the real field numbers then.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation of a documented rule.** Findings:

1. **`noExport` now also holds why Antigravity never reaches 3.** **Kept**: one reason field per harness; the doc comments of `HARNESSES` and `HarnessLevel.reason` say so. Renaming it touches opencode's code, outside this ticket.
2. **Repeated switches on the harness** in `startIngest` and `ingestFile`, and two roots travelling together. **Kept**, as ticket 05 kept them: a database is not read from a position as a file is.
3. **The level's "no session found" names `~/.gemini/antigravity`, though sessions are attributed from the window state.** **Kept**: both are needed, and the conversations are where a user looks for sessions.
4. **A conversations directory that cannot be listed was reported as the window state.** **Fixed**: it is named itself.
5. **A conversation already read was looked up in the records, quadratic.** **Fixed**: a set.
6. **The search's depth was an unnamed 8, and its work can double per level.** **Fixed**: `DEPTH`, with a `ponytail:` comment naming the ceiling.
7. **Daemon test helpers copied from the other daemon tests.** **Kept**: the existing convention.
8. **The mark takes the conversations directory's time, which changes only when a conversation is added or removed.** **Kept**: a record is a conversation's start, which a later write does not change.

**Spec: both criteria met.** Findings:

1. **Antigravity was not in `binn init`'s and `binn audit`'s harnesses without export**, which ticket 03 left to this ticket. **Fixed**: `NO_EXPORT` names it with `ANTIGRAVITY_NO_TOKENS`, and `init.test.ts` checks the Summary.
2. **The ticket was not closed and not marked not verified.** **Fixed** in this commit: see *Decisions*.
3. **The macOS path is unconfirmed.** **Kept**: it is VS Code's, and costs one line.
4. **The fields are searched for rather than read by number, so a `file://` URI before the workspace's would attribute the session wrongly.** **Left** to the exit demonstration, which the owner marked not verified: see *Decisions*.
5. **Without a birth time, the record's time is the file's latest modification.** **Kept**: provenance `calculated` says it is Binnacle's reading.
