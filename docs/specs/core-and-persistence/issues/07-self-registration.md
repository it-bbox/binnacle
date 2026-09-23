# 07: Binnacle registers itself

Status: DONE
Triage: ready-for-agent
Blocked by: 03, 04
Spec: `docs/specs/core-and-persistence/spec.md`

**What to build:** the epic's exit criterion demonstrated on a real project rather than a fixture — this repository, which `docs/00-scope.md` names as project number one. Registering it is the first honest test of whether the operations answer anything worth having.

- [x] A project manifest for this repository is committed, derived from the template and reflecting the local Markdown tracker it actually uses.
- [x] `binn project register .` followed by `binn project status` reports this repository's real manifest facts and real Git facts.
- [x] Stopping the daemon leaves this repository fully workable: Git, docs, ADRs, specs and tickets unaffected.
- [x] The roadmap records epic 1 as done.
- [x] Whatever the exercise reveals about the operations is either fixed here or filed as a ticket, not silently accepted.

## Comments

Implemented on `feat/self-registration`. 106 tests pass, `tsc --noEmit` clean.

What the exercise showed, run with `binn` against a throwaway `BINNACLE_HOME`:

- **Register, status and list work on a real repository.** `binn project status` reports `binnacle`, tracker `local`, the live branch, HEAD, dirty state and the GitHub remote, from the root and from `docs/adr`. It raises no tracker diagnostic, because a `local` tracker never disagrees with a remote (ticket 04). With the daemon stopped, `binn` exits 4 and names the next move, and nothing in the checkout changed at any point.
- **Linked worktrees are not understood.** It is filed as ticket 08 and not fixed. Inside a worktree, status reports the main checkout's branch, and a worktree outside the project is not found. Fixing it means deciding which checkout a status describes, which is a decision for epic 2's spec, not a patch here. The roadmap lists it among the questions to settle before epic 2.
- **The manifest states only what is true.** Every section except `project` and `tracker` started as a copy of the template, and review caught two claims in it that were false. `graphify` and `ast_grep` are `false`, because neither is installed, even though `CLAUDE.md` routes to both. `telemetry.import.window_days` is omitted, because it is `binn init`'s question and nobody has asked it yet. A capability is a fact about the machine (`packages/core/src/manifest.ts`), which a committed file can only approximate. `binn init` in epic 3 is where that tension gets settled.
- **The CLI prints a subset of the manifest.** It shows the id, name and tracker. The API returns the whole validated manifest. This is accepted, not filed: the knowledge paths and capabilities are for epic 2's snapshot to read, not for a person to scan, and printing them now would be output with no consumer.

`apps/daemon/test/self-registration.test.ts` registers this checkout through the harness. It asserts no warnings, the `local` tracker, and that every declared tracker and knowledge path exists. A manifest that drifts from the tree it describes fails a test instead of misleading a snapshot.

### Review

Reviewed on both axes. No acceptance criterion was missing. Fixed:

- The manifest's false `graphify` and `ast_grep` capabilities and its unasked import window, as above.
- The test typed a response through `src` instead of locally, as its siblings do, and dereferenced a possibly null manifest with `!` instead of asserting it.
- Ticket 08 now says plainly that epic 1 closes with it as a known limitation, since the spec is `DONE` while it stays open.
