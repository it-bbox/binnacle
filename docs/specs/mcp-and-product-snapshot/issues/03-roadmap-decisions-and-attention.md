# 03: Roadmap, decisions, Git and attention in the snapshot

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

**What to build:** the Product Snapshot becomes complete for this epic. Besides Tasks, a fresh Product session sees where the project stands on its roadmap, what the last session recorded as its focus, which decisions are fresh, the Git facts of its own checkout, and every deterministic inconsistency between the roadmap and the tickets. The sections Binnacle cannot fill yet say so. Decided in the spec, under *Roadmap*, *Product Snapshot* and *Attention items*.

- [x] The roadmap is read from `<knowledge.docs>/roadmap.md` on the local tracker; a missing roadmap leaves its section absent with a diagnostic.
- [x] The epic table (`# | Epic | Status | Spec`) is parsed strictly against the roadmap's status vocabulary; a row that does not parse produces a diagnostic and is left out, never repaired.
- [x] `## Current focus` is returned as written, cut at a fixed character limit with an explicit truncation marker; every other `##` section is returned as its heading only.
- [x] An epic row is linked to its tickets through the spec slug in its Spec cell.
- [x] The five most recent ADRs by last commit date are listed with title and path.
- [x] The Git section carries the facts of the caller's checkout. Once ticket 01 lands it describes a worktree correctly; this ticket does not depend on it.
- [x] Pending decisions, CI state and usage are present as sections with an explicit unavailable marker and no content.
- [x] Attention items: an epic whose roadmap status disagrees with its tickets (each of the three cases in the spec); an epic at `spec` or later with no spec link; manifest warnings and `tracker.remote_mismatch`. Together with ticket 02's two, that is the whole list, and nothing heuristic is added.
- [x] Attention items are computed on every call and never stored.
- [x] `docs/roadmap.md` says, under *Keeping this current*, that its table header and `Current focus` heading are read by Binnacle (already added at `/to-spec`; confirm it still matches what is parsed).
- [x] Tests through the daemon seam cover a roadmap row that does not parse, a missing roadmap, a focus over the limit, each roadmap attention case, and the unavailable sections.

## Comments

- **What exists.** `project.snapshot` returns `{ project, checkout, git, roadmap, tasks, decisions, pendingDecisions, ci, usage, attention }`. `roadmap` is `{ epics, focus, sections }`: each epic is `{ number, title, status, spec }`, where `spec` is the slug or `null` for `—`; `focus` is `{ text, truncated }`, cut at 2000 code points; `sections` are the other `##` headings. `decisions` is `{ items: [{ title, path }], remainder }`. The three unavailable sections are `{ available: false, reason }`. The code is in `apps/daemon/src/snapshot.ts`.
- **The roadmap contract** is in `packages/core/src/roadmap.ts`: `parseRoadmap(text)` returns `{ roadmap, diagnostics }` and takes text, not a path, so ticket 05 can parse the roadmap at two revisions. `roadmapAttention(epics, tasks)` holds the four roadmap checks. An epic reaches its Tasks through the prefix of their identity, `<spec-slug>/`. The status vocabulary is a constant, not read from the file's prose.
- **Git.** `readLastCommitTimes` is new in the Git adapter: one `git log --relative --name-only`, newest first. Ticket 05's `log` may absorb it. `core.quotePath=false` now applies to every Git call, which affects only how paths are printed.
- **Whose files.** Ticket 02 left this open. The snapshot now reads tickets, the roadmap and ADRs from the caller's checkout, the same one its `git` section describes. A snapshot taken in a linked worktree shows that branch's position. `callerCheckout` in `operations.ts` is shared with `project.status`.
- **Attention**, in this order: `manifest.warning`, `tracker.remote_mismatch`, `tracker.unavailable` or `tracker.issues_missing`, `task.unknown_state`, `task.dangling_dependency`, `roadmap.missing`, `roadmap.focus_missing`, `roadmap.table_missing`, `roadmap.row_invalid`, `roadmap.status_mismatch`, `roadmap.spec_missing`, `adr.missing`. A roadmap on a tracker other than the local one, and a project that declares no `knowledge.adr`, give a `null` section and no item: the first is already covered by `tracker.unavailable`, and the second is the project's choice.
- **For ticket 05.** The daily's roadmap status changes can compare `parseRoadmap(...).roadmap.epics` at the baseline and at HEAD, and its attention items can reuse `roadmapAttention`.

### Review

`/code-review` ran against `main` on both axes.

**Standards: no hard violations.** Judgement calls:

1. `snapshot.ts` imported the type `CallerCheckout` from `operations.ts`, which imports `snapshot.ts`. **Fixed**: the type now lives in `snapshot.ts`.
2. `ROADMAP_STATUSES`, `Roadmap` and `RoadmapStatus` were exported from core but not used outside it. **Fixed**: only `parseRoadmap`, `roadmapAttention` and `Epic` are exported.
3. `at` in `roadmapAttention` was a mysterious name. **Fixed**: it is now `rank`.
4. Without Git, ADRs are ordered by path and nothing flags it. **Kept**: the `git` section already says Git is unavailable. The fallback is now documented on the type.
5. `absentAsNull` in `snapshot.ts` repeats `listing` in `local-tracker.ts`. **Left**: it is a few lines, and moving roadmap reading into the adapter would only move it.
6. `readTasks`, `readRoadmap` and `recentDecisions` share the shape "declared? read : report". **Left**: the three differ in what they report.
7. `snapshot(projected, caller, remoteMismatch(...))` passes a value derived from the other two arguments. **Left**: `project.status` computes it the same way, and it is one line.

**Spec: every acceptance criterion implemented.** Findings:

1. The decisions this ticket made were not recorded. **Fixed**: they are recorded above.
2. The roadmap epics, the section headings and the attention list have no item limit. **Kept**: the first two are bounded by a file a human writes, and truncating the attention list would hide exactly what it exists to show.
3. This repository's own current focus (2776 characters) was cut before its next action. **Fixed**: the focus was shortened to fit.
4. `adr.unavailable`, and `roadmap.unavailable` on a tracker other than the local one, were permanent noise for valid projects. **Fixed**: removed, as described under *Attention*.
5. An ADR never committed sorts as newest, and every `.md` in the ADR directory counts as one. **Kept**: the first is the freshest decision there is, and a README there costs one slot. It is one filter to add if that bites.
6. The third roadmap check treats `DONE` or `CANCELLED` as finished, where the spec says "all `DONE`", and it needs at least one ticket. **Kept**: this mirrors the first check, where `done` allows `DONE` and `CANCELLED`, and an epic with no tickets is not finished. An epic at `tickets` with no tickets is not flagged, because the spec does not list that check.
7. Truncation could split a surrogate pair. **Fixed**: the cut is now by code point.
8. Only the roadmap was tested from a worktree. **Fixed**: that test now reads a ticket from the worktree too.
9. *Keeping this current* did not say that `#` must be a number. **Fixed**.

