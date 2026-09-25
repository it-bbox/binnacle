# 08: `binn init` asks for the import window

Status: DONE
Triage: ready-for-agent
Blocked by: 06
Spec: `docs/specs/telemetry/spec.md`

**What to build:** adopting Binnacle includes an informed choice of how much history to import. Decided in the spec, under *`binn init`*.

- [x] A step after the manifest step counts, per harness, the sessions whose `cwd` lies in this repository and the oldest date, reading only each file's first record.
- [x] It asks for the window: `90` (default), a number of days, or `all`. End of input is the default and writes nothing on its own.
- [x] With a new manifest the answer goes into it; with an existing one the `telemetry.import.window_days` line is printed, not written (ADR-0026).
- [x] Tests through the subprocess seam with `HOME` and the artifact roots in temporary directories: counts and dates shown, 90 written by default, `all` and a number accepted, the line printed for an existing manifest.

## Comments

- **Where it lives.** Everything is in `apps/cli/src/init.ts`:
  - `windowStep` is step 2, between the manifest and registration, so the window is in the manifest before the project is registered.
  - `manifestStep` now returns a `ManifestState`: `created`, `valid`, `invalid` or `missing`.
  - `Session.answer` reads a free-text answer, and `ask` is built on it.
  - `sessionHistory` does the counting and `sessionStart` reads a file's start.
  - From the daemon, `binn init` reuses `claudeCodeSessions` (the old `candidates` in `usage.ts`, which now takes the root as an argument), `projectCheckouts`, `containingEntry`, `resolveArtifactRoots` and `DEFAULT_WINDOW_DAYS`. All five are now exported from `@binnacle/daemon`.
- **Decided here, within the spec.**
  - **"Each file's first record" means the first record that names a `cwd`.** A real Claude Code session never has one on its literal first line. On the owner's 24 sessions of this repository, the first lines are `queue-operation`, `custom-title` or `bridge-session` records, and the first `cwd` comes on line 3 at the earliest and line 29 at the latest. A Codex rollout names it on its first line, in `session_meta`. That record's `timestamp` is the session's start.
  - **The spec's "never parses whole sessions" is kept by a cap.** A file is read to at most `START_LINES` (100) lines. A file with no `cwd` within them is not counted.
  - **"Lies in this repository" means what the daemon attributes.** That is the checkout itself or the same directory in one of its linked worktrees (ticket 02's `projectCheckouts`). A subagent's file is part of its session, not a session of its own.
  - **With a new manifest, the answer is offered through `offerFile`.** It is shown as an addition to the file and needs its own yes, like every other write (ADR-0026). So the default takes an Enter and then a `y`. The spec's "the answer goes into it" did not say whether that write needed a separate confirmation. The review found that writing it straight away broke the ADR.
  - **Three cases the spec left open:**
    - No manifest (declined): the counts are still shown, but nothing is asked. There is no manifest to take the answer.
    - A valid manifest that already declares a window: it is reported and not asked again, as the other steps do with what already exists.
    - An answer that is not a window: the question is asked again.
  - **The Codex root is resolved in `init.ts`,** with the daemon's rule (`$CODEX_HOME/sessions`, otherwise `~/.codex/sessions`). The daemon does not carry it yet.
- **For ticket 05.** When `ArtifactRoots` gains `codex`, replace the `ponytail:` line in `HISTORIES` in `init.ts` with `resolveArtifactRoots().codex`.
- **Run on the owner's artifacts.** `binn init` on the main checkout, with empty stdin and a temporary `BINNACLE_HOME`, showed "Claude Code: 30 sessions, the oldest from 2026-09-18" and "Codex: no sessions". It wrote nothing. This repository's own manifest still declares no window. The owner's answer goes there, by hand, since the manifest exists.
- **Rebased onto `main` after ticket 02 merged.** The conflict was in `usage.ts`, where `candidates` had gained linked worktrees. `claudeCodeSessions` keeps ticket 02's signature (several directories), and `binn init` now counts linked worktrees. A test covers one beside the repository.

### Review

`/code-review` against `main`, both axes in sub-agents.

**Standards**

1. **Fixed.** With a new manifest, the window section was appended without being shown and without a yes, which breaks ADR-0026. It now goes through `offerFile`.
2. **Kept, and marked `ponytail:`.** The Codex root lookup copies the daemon's rule. Adding `codex` to `ArtifactRoots` is ticket 05's first criterion. It would also change the daemon's runtime and its tests.
3. **Kept.** `HISTORIES` is a two-entry table whose Codex `files` ignores the directories. It is what "per harness" needs, and the next harness is one more entry.
4. **Kept.** `registrationStep` still takes a boolean derived from `ManifestState`, because registration only cares whether the manifest is usable.
5. **Fixed.** A mysterious name: `places` and `counted` became `checkouts` and `histories`.
6. **Left.** The step numbers in the doc comments are renumbered when a step is added.
7. **Kept.** `windowStep` reads the manifest again through `declaredManifest`, as the file already does before the ticket-header step.

**Spec**

1. **Kept, and recorded above.** Counting reads down to the first record naming a `cwd`, not the literal first line.
2. **Fixed.** A file with no `cwd` was read to its end. It is now capped at `START_LINES`.
3. **Kept.** The Codex root is resolved in the CLI. This is the same finding as Standards 2.
4. **Kept, and recorded above.** With no manifest, nothing is asked.
5. **Kept, and recorded above.** A declared window is not asked again, and a bad answer is asked again.
6. **Fixed.** `docs/04-telemetry-dashboard.md` had gained a sentence about the ingest's time budget, which is ticket 06's subject. It is removed.
7. **Fixed.** This is the same ADR-0026 point as Standards 1.

`docs/04-telemetry-dashboard.md` and `docs/operations/01-new-project.md` offered "a recent window, everything, or nothing". They now give the spec's choices: a number of days, 90 by default, or everything.

Typecheck is clean and the full suite passes, 289 of 289.
