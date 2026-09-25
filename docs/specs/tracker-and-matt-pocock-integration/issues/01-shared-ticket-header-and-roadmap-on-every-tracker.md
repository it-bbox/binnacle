# 01: One ticket-header parser, the roadmap on every tracker, and the write guarantee

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** the prefactoring every remote tracker needs, verifiable on its own. A project whose manifest declares `github` or `gitlab` gets the roadmap section of its snapshot and daily, not only `tracker.unavailable`; the roadmap consistency checks link an epic to its Tasks by spec slug rather than by the local id prefix; and one parser reads the ticket header for every tracker. A test states that no daemon operation writes into a repository. Decided in the spec, under *Workspace*, *Remote adapters* (spec slug), *Roadmap on every tracker* and *Testing Decisions* (the write guarantee).

- [x] The ticket-header parser is a pure function in core over text. The header block is the first run of non-blank lines at the top, after one leading heading if the text starts with one. The local Markdown adapter uses it, and its behaviour on existing tickets is unchanged.
- [x] A Task carries the slug of its spec. On the local tracker it is the spec directory the ticket lives in.
- [x] The roadmap checks (status disagreement, `not started` with tickets) link an epic to its Tasks by that slug. Existing roadmap tests stay green unchanged.
- [x] The roadmap is read from `<knowledge.docs>/roadmap.md` whatever `tracker.provider` is. A fixture declaring `github` shows the roadmap in the snapshot and its changes in the daily, with Tasks still unavailable.
- [x] A test calls every operation the daemon exposes against a fixture repository and asserts that the working tree and the index are unchanged afterwards. It iterates the operation table, so an operation added later is covered without editing the test.
- [x] Typecheck and the full suite stay green.

## Comments

- **What changed.** `parseTicketHeader` in `packages/core/src/tracker.ts` returns the leading heading and the `Status:`, `Triage:`, `Blocked by:` and `Spec:` values as written, or `null` for a line that is absent. The local adapter calls it. `TrackerTask` gains `specSlug`, which on the local tracker is the spec directory, and `roadmapAttention` links an epic to its Tasks through it instead of through the identity prefix. `readRoadmap` no longer checks for the local tracker; it returns `null` only when there is no readable manifest.
- **Checked unchanged on existing tickets.** The old and new local adapters ran side by side over this repository's 31 tickets. The readings are identical apart from the new field, and every `specSlug` equals its Task's identity prefix. The rule differs only in cases no ticket here has: text before the heading is now read as the header block, and a heading of any level counts. The spec's rule for issue bodies asks for exactly this.
- **The checkpoint's `position` target** is now `<knowledge.docs>/roadmap.md` on every tracker, not only on the local one. It was the same local-only condition on the roadmap. The spec says the checkpoint works on a remote tracker as it does on the local one, and no later ticket owns this change.
- **One existing assertion changed.** A snapshot test outside the roadmap block covers a manifest warning and a remote mismatch. It declares `github` and no `knowledge.docs`, so now that the roadmap is read on every tracker it also gets `roadmap.missing`. The roadmap tests are untouched.
- **The write guarantee** is `apps/daemon/test/write-guarantee.test.ts`. It iterates the daemon's operation table and sends each operation the fixture's `path`, plus the operation's entry in the test's `INPUT` table when it needs more. Before and after each call it hashes every file in the repository, including `.git` and its index. It also asserts a 200 response. A later operation that needs more than a `path` therefore fails there until its input is added; it can never pass without having run. The fixture has a staged change, an unstaged change, an untracked file, and a tracked file whose timestamp moved after it was indexed. With `--no-optional-locks` removed from the Git adapter, the test fails on `project.status`, which then rewrites the index.

### Review

`/code-review` ran against `main` on both axes.

**Standards: no hard violations; six judgement calls.**

1. The core-level test of `roadmapAttention` had no justification for a second seam. **Fixed**: its comment now gives the reason. Through the daemon, a local Task's identity starts with its slug, so linking by slug and linking by prefix look the same until the remote adapters land.
2. The write-guarantee test imports the operation table, going past the HTTP seam. **Kept**: iterating the table is what the criterion asks for, and the file explains why.
3. The header's field names were written twice, once in a map and once in a regex. **Fixed**: there is one map now, looked up from a generic `Name: value` match.
4. Fixture helpers are repeated across the daemon's test files. **Left**: every existing test file does the same, and a shared fixture module is outside this ticket.
5. `TrackerTask` has both `spec` and `specSlug`. **Kept**: `spec` is the `Spec:` line as written, which the task brief in ticket 06 returns. The slug is derived from it, and it is what the spec asks the Task to carry.
6. Minor items: a redundant `status` alias in the local adapter, and a fixture manifest in the daily test edited by regex. **Fixed**: the header is destructured, and the manifest is a literal. A type local to the daily test is **kept**.

**Spec: every criterion met, no scope creep, nothing implemented wrongly.**

1. The reviewer judged two changes in scope: the checkpoint's `position` target on every tracker, and the changed snapshot assertion (both explained above). **Kept**.
2. Two behaviour differences follow the spec's rule and affect no existing ticket: text before the heading, and headings of any level. **Kept**.
