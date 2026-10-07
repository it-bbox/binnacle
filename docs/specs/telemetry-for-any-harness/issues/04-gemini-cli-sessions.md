# 04: Gemini CLI's sessions read from its files

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** a reader for Gemini CLI's local session files, a pure function as the Claude Code and Codex readers are, gives a record per model call with its metadata and counts, nulls for counts it lacks, and the reason where a file cannot be read (spec, *New artifact readers*). The daemon finds a project's Gemini CLI sessions and ingests them, so history from before the export counts, and Gemini CLI's support level follows from them.

- [x] Reader tests over a sample file: records, nulls, and the reason for an unreadable line.
- [x] Daemon process test: a project's Gemini CLI sessions appear in `usage.get` and its level is 3.

## Comments

- **From 02.** Gemini CLI's OpenTelemetry names no working directory, so its events wait in no project until a record of their session is stored; this reader is what attributes them to a project (`attributeSessions`), with no change there. Its level is already 4 while its events arrive. Map Gemini's counts as 02's `geminiCli` does (input = prompt − cached + tool-use prompt, output = candidates + thoughts), so that a call read from both is counted once. Gemini CLI is in `HARNESSES` with no artifact root; give it one.

### Decisions

- **The format, from Gemini CLI's source.** No Gemini CLI was installed where this ticket was built, so the format comes from `packages/core/src/services/chatRecordingService.ts` and `config/storage.ts` on Gemini CLI's `main`. The sample in `packages/adapters/test/fixtures/gemini-cli` is built from it. The exit demonstration (ticket 15) confirms it on the owner's Mac. The format as read:
  - Each launch directory has a temp directory `~/.gemini/tmp/<slug>/` (`$GEMINI_CLI_HOME/.gemini/tmp` when that is set). Its `.project_root` holds the launch directory.
  - A main session is `chats/session-<time>-<id>.jsonl`. A subagent's is `chats/<parent session id>/<id>.jsonl`.
  - The first line is the session's metadata, `sessionId` among it. Then come the messages. Gemini CLI appends a message again, whole and with the same id, when it gains its tokens or its tool results. `$patch`, `$set` and `$rewindTo` lines may sit in between.
- **The reader** is `readGeminiCli` in `packages/adapters/src/gemini-cli.ts`. It gives one record per `gemini` message, its last line. Like Claude Code's, the last message waits until the file settles. That logic now lives in one place for both readers, `readMessages` in `artifact.ts`.
  - The file is read from its start every time, as a Codex rollout is, because the session id is on its first line.
  - The directory a session ran in comes from the `.project_root` of its temp directory. The parent session of a subagent's file comes from the name of the directory the file is in.
- **The counts**, all `calculated`:
  - input not read from cache is `input − cached + tool`: Gemini's prompt count includes the cached part and leaves out the tool-use prompt;
  - output is `output + thoughts`, with thoughts as reasoning, since reasoning is a part of output in Binnacle;
  - cache creation is null;
  - a message with no tokens has every count null.

  Gemini CLI writes a count its API did not give as 0, and that cannot be told from a reported 0. Provider and branch are null; the branch comes from the reflog, as for every harness.
- **With 02's events.** Rebased onto 02, Gemini CLI keeps its one entry in `HARNESSES`, now with its artifact root, and its level reason when nothing is found names that root. The reader's counts are the same arithmetic as 02's `geminiCli` event mapping, and a session's id is the event's `session.id`, so a call read from both is counted once by the store's match on model and counts within a few seconds; a daemon test posts a call that is also in its session file, and one that is not, and finds the one counted once and the other attributed with it. A subagent's call is under its parent's session in the file; whether its event names the parent's session or its own is not known, and the exit demonstration shows it.
- **A rewound call still counts**: its tokens were spent. Prompts, notices, patches and metadata updates give no record.
- **Older formats are not read.** A temp directory with no `.project_root`, as an older Gemini CLI named by a hash of the path, belongs to no project. A `.json` session from before the JSON Lines format is not read either; Gemini CLI converts one when it resumes it. `geminiCliSessions`'s doc comment says both, the second as a `ponytail:` ceiling.
- **Out of this ticket:** `binn init`'s session history (`apps/cli/src/history.ts`) and `binn audit`'s telemetry readiness still name only Claude Code and Codex. The audit and the export are ticket 03's, and the documents ticket 14's.
- **For the exit demonstration**, on the owner's Mac, after a Gemini CLI session in a registered project:

  ```sh
  ls ~/.gemini/tmp/*/.project_root ~/.gemini/tmp/*/chats/
  head -c 400 ~/.gemini/tmp/*/chats/session-*.jsonl | head -20
  binn call usage.get '{}'   # in the project: the Gemini CLI records
  ```

  If a subagent's directory under `chats/` turns out to carry a short id rather than the parent's full session id, its records will not name their parent run, and `geminiCliSession` in `apps/daemon/src/usage.ts` needs changing.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation of a documented rule.** Findings, all judgement calls:

1. **A made-up `ENOENT`:** a `.project_root` that could not be read during ingest was reported as missing, whatever the real error was. **Fixed**: the read's own error is reported.
2. **Repeated switches:** `ingestFile` branched on the harness three times, the last one on a variable standing in for it. **Fixed**: one `switch` picks the reader.
3. **`?? ''` as a stand-in for no project root.** **Fixed**: the check for null is now explicit.
4. **A missing `tool` count makes the whole of input null.** **Kept**: a sum missing one of its parts would be wrong, and the reader's doc comment now says so. Gemini CLI always writes the field.
5. **That a 0 cannot be told from an unreported count belongs in a `ponytail:` comment.** **Kept** in the reader's doc comment instead: it is Gemini CLI's limit, not a simplification taken here.
6. **Duplicated code:** the directory listing in `geminiCliSessions` resembles the one in `claudeCodeSessions`. **Kept**: they differ in which failures they report, and each is a few lines.
7. **Shotgun surgery:** a harness touches `HARNESSES`, `forgetRead`, `unreadableArtifacts`, `startIngest` and `ingestFile`. **Left** for when a fourth harness lands (tickets 05, 07, 08): gather the file finding into `HARNESSES` then, if it still pays.
8. **The daemon test restates the fixture's numbers.** **Kept**: each test shows the arithmetic it checks.

**Spec: both criteria met, nothing beyond the ticket.** Findings:

1. **History in older formats is not read** (story 15). **Kept** as a marked ceiling; see *Decisions*.
2. **The token arithmetic was checked** against Gemini's usage metadata, and the fixture's sums match its `total`. **No change.**
3. **Provenance is one value per record**, so `cachedInput` and `reasoning`, taken as given, are labelled `calculated` with the rest. **Left**: this is how the data model works, and Codex does the same.
4. **Counting rewound calls is not in the spec.** **Recorded** under *Decisions*.
5. **The subagent directory's name is unconfirmed.** **Left** to the exit demonstration; see *Decisions*.
