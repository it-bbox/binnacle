# 07: Unreadable artifacts are loud

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/telemetry/spec.md`

**What to build:** a harness format change shows up as an attention item and a lower support level, never as wrong numbers. Decided in the spec, under *Ingest* and *Snapshot `usage` section*.

- [x] A line missing a field the reader needs stops that file at that line: the cursor stays before it and earlier records stay. An unknown extra field is ignored.
- [x] `telemetry.unreadable` names the harness, file and line, and is cleared by a later successful read of that file.
- [x] The harness's level drops to 1 in `harnesses` while any of its files is unreadable.
- [x] Tests through the daemon seam for a Claude Code line with no usage where one is required, and, once ticket 05 has landed, a decreasing Codex total.

## Comments

- **Where it lives.** `apps/daemon/src/usage.ts`:
  - `Importer.unreadable` maps each artifact file whose last reading failed to where and why. A successful reading of the file removes its entry. So does finding the file read to its end and openable again.
  - `unreadableArtifacts` gives, per harness, one sentence for the project. It names the first unreadable file with its line, or a directory that could not be listed, and counts the rest.
  - `level` puts a harness with such a sentence at 1, with the sentence as its reason. `apps/daemon/src/snapshot.ts` turns each level-1 harness into one `telemetry.unreadable` attention item with the same message.
  - The reader's stop-at-line behaviour and the cursor are ticket 01's, unchanged. The tests are the `unreadable artifacts` suite and the Codex test "stops reading a rollout at a total that decreases…" in `apps/daemon/test/usage.test.ts`.
- **Decided here, within the spec.**
  - **Failures are held in the daemon's memory, not stored.** Before this ticket, a failure counted only on a call whose ingest finished within the budget, so the level went back to 3 while the import was still running. The level now stays at 1 until a later reading succeeds, as the criteria ask. Ticket 01's "no failure is stored" still holds for the store. After a restart, the startup ingest finds the failure again, since a failing file always has something left to read. Until it does, `importing.incomplete` says the answer is provisional.
  - **One item per harness, not one per file.** It names the harness, the first file (in path order) and its line, and says how many other files or directories could not be read. A format change can make every active session fail at once, and the snapshot is compact by contract (ADR-0012). Once the first file is repaired, the next one is named.
  - **The message says nothing after the line is counted, however the file grows.** This answers ticket 05's review item 7, and it holds for both harnesses. Claude Code resumes from the cursor and Codex re-reads a rollout from its start, but both stop at the same line until Binnacle can read it. For Codex's decreasing total, that line never becomes readable.
  - **A rollout that cannot be opened counts against every project**, since its first line, which says whose it is, cannot be read. Ticket 05's ingest already did this.
- **Ticket 05 landed during this ticket.** The branch was rebased onto it, so the Codex half of the last criterion is covered. Codex needed no change of its own: its failures go through the same map and message.
- **Checked on the owner's own artifacts.** A test daemon with a temporary Binnacle home registered the main checkout and read `~/.claude/projects` and `~/.codex/sessions` in 0.34 s. No file was unreadable: Claude Code is at level 3, and Codex has no session here. That run counted 235 records today and 1,477 this week.
- **For ticket 09.** The exit demonstration should see no `telemetry.unreadable` item. If one appears, it names the file and line to cut a fixture from.

### Review

`/code-review` against `main`, both axes in foreground sub-agents. There were two rounds: one before the rebase onto ticket 05, and one on the rebased diff.

**Standards** (no hard violations)

1. The level-1 test for `telemetry.unreadable` is in the snapshot, not next to `level`. **Kept**: level 1 has one cause.
2. The artifact directories are listed a second time, after the wait. **Kept**: `readdir` is cheap, and a call that joins a running ingest has no listing of its own.
3. `unreadable` became the map, and the helper that describes an open failure was named `failed`. **Fixed**: it is `openFailure`.
4. The map holds preformatted strings, and the sentence is built in three places. **Kept**: the tests pin the result.
5. A failed file that is then deleted keeps its entry. **Kept**, marked `ponytail:`. No answer shows it, since only files still there are looked up.
6. The tests rewrote a session by hand and repeated the attention helpers. **Fixed**: they use `session()`, and the helpers are at file scope. The polling loop, a third copy of `untilImported`'s shape, is **kept**: its condition differs.
7. `unreadableNow` and `Failures` were misleading names. **Fixed**: they are `unreadableArtifacts` and `Unreadable`.
8. The check "whose rollout is this" is written in both `startIngest` and `unreadableArtifacts`. **Kept**: each handles a file that cannot be opened in its own way, and both count it for this project.

**Spec**

1. The one item names only the first unreadable file. **Kept**, and recorded above. The test title now says "names the first … and counts the others".
2. A file whose `stat` failed once stayed unreadable after it could be opened again with nothing new to read. **Fixed**: that case clears its entry.
3. The message said "until it can be read", which reads as a promise for Codex. **Fixed**: it now says nothing after the line is counted however the file grows.
4. After a restart the item is absent until the startup ingest reaches the failing file. **Kept**: `importing.incomplete` is true meanwhile, as recorded above.
5. A permanently failing file is read again on every call, so with a zero budget `importing.incomplete` stays true. **Left**: the real budget of one second covers it. A failing Codex rollout is re-read whole each time, as ticket 05's `ponytail:` says.
6. A rollout that cannot be opened puts Codex at level 1 for every project. **Kept**, recorded above.

Typecheck is clean, and the full suite passes, 301 of 301, after the rebase onto ticket 05.
