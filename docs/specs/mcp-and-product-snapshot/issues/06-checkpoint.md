# 06: Checkpoint prepare and record

Status: DONE
Triage: ready-for-agent
Blocked by: 05
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

**What to build:** before a Product session closes, it asks Binnacle what changed since the last checkpoint and where each kind of durable decision belongs in this project, promotes what the human confirms with its own tools, and then records that the checkpoint happened. Binnacle computes and records; it writes nothing into the repository (ADR-0020). Decided in the spec, under *Checkpoint*.

- [x] `checkpoint.prepare` returns the delta since the most recent `checkpoint` event, computed by the same code as the daily and with the same fallback.
- [x] It returns the promotion targets — vocabulary, trade-off, new work, product rule, position — each with this project's path from the manifest's `knowledge` section and tracker.
- [x] It returns the attention items, and records nothing.
- [x] `checkpoint.record` takes the promoted items as `{ type, path }` pairs and records a `checkpoint` event carrying the caller's HEAD and those items.
- [x] For each listed path with uncommitted changes, `checkpoint.record` returns a diagnostic.
- [x] The next `checkpoint.prepare`, and the next `daily.get`, start from the recorded head.
- [x] No file is written and no commit is made by Binnacle anywhere in this flow.
- [x] `checkpoint_prepare` and `checkpoint_record` are exposed over MCP, mapped one-to-one.
- [x] The `checkpoint` event is tier 2 and survives a schema rebuild.
- [x] Tests through the daemon seam cover the targets and their paths, a record, a record with an uncommitted promoted path, and the next prepare starting from the recorded head.

## Comments

- **What exists.** `checkpoint.prepare` takes `{ path }` and returns the daily's response, with `targets` added: `{ project, checkout, head, dirty, from, fallback, commits, transitions, newTickets, readyToStart, roadmap, decisions, attention, targets }`. The delta is `daily(...)` in `daily.ts` with a baseline read from `checkpoint` events alone, so a daily never moves it; `from.source` is `checkpoint` or `fallback`, and the no-baseline fallback says "No checkpoint has been recorded". `checkpoint.record` takes `{ path, promoted: [{ type, path }] }` and returns `{ project, checkout, head, promoted, diagnostics }`; it appends a `checkpoint` event with payload `{ head, promoted }`, which `daily.get` already treated as a baseline. The code is in `apps/daemon/src/checkpoint.ts`; the two operations are in `operations.ts`.
- **Promotion types** are `vocabulary`, `trade_off`, `new_work`, `product_rule` and `position`, in that order, snake_case like the other codes. `targets` always lists all five; `path` is relative to the project directory and comes from `knowledge.context`, `knowledge.adr`, `tracker.local.issues`, `knowledge.specs` and `<knowledge.docs>/roadmap.md`. It is `null` when the manifest does not declare it, and for `new_work` and `position` on a tracker other than the local one: there tickets and the roadmap are not files (ADR-0017), and saying where they go is epic 3's.
- **What `promoted` accepts.** An array, empty when nothing was promoted — that is still a checkpoint. Each `type` is one of the five, and each `path` is a file or directory relative to the project directory in the caller's checkout; an absolute path or one that climbs out with `..` is `request.invalid`. Nothing is recorded on a 400, or when Git fails (503), since a checkpoint whose check failed would look clean.
- **Diagnostics.** `checkpoint.uncommitted` for a promoted path with staged, unstaged or untracked changes; `checkpoint.path_missing`, not in the spec, for a path that names nothing in the checkout, so a typo is not recorded as a clean promotion. The checkpoint is recorded either way; the diagnostic tells the session to commit and record again. The Git adapter gained `hasUncommittedChanges`, one `git status --porcelain -- :(literal)<path>`, which stays read-only.
- **For ticket 07.** The `/checkpoint` skill's order is: `checkpoint_prepare` → draft promotions against `targets` → the human confirms → write and commit with the session's own tools → `checkpoint_record` with what was committed. Record after the commit, from the same checkout: it records that checkout's HEAD. `checkpoint_record` has a required `promoted` argument (pass `[]` when nothing was promoted); `checkpoint_prepare` takes none. If `diagnostics` is not empty, the skill should show it and not claim the checkpoint is clean.
- **Known limits, kept.** As for the daily, the baseline is per project, not per checkout. A promoted path that exists but is ignored by Git and never committed passes as clean: `git status` does not report ignored files.

### Review

`/code-review` ran against `main` on both axes.

**Standards: no hard violations.** Judgement calls:

1. The Git adapter's header said only commit hashes reach Git from callers, and `hasUncommittedChanges` now passes a caller's path. **Fixed**: the header names the `--` and `:(literal)` guard.
2. `daily()` typed its baseline event types as `string[]`, `recordedBaseline` as the union. **Fixed**: both use `BaselineEvent`.
3. `baseline` and `recorded` travel together into `daily()` only to word the no-baseline message. **Left**: a defaulted parameter, and the message is what tells a checkpoint's fallback from a daily's.
4. `<knowledge.docs>/roadmap.md` is built in `checkpoint.ts` and `snapshot.ts`. **Left**: one `posix.join` each, and the snapshot's also reports its absence.
5. The MCP schema types `promoted[].type` as a string and lists the five in prose, where `z.enum` would be stricter. **Left**: the daemon validates it, and importing the list would load the daemon into the MCP process.
6. `promotedItems` validates in `checkpoint.ts`, where its neighbours validate in `operations.ts`. **Kept**: it owns the promotion types.
7. `git.no_commits` said "so nothing has changed", which reads wrong for a record. **Fixed**: "This checkout has no commits yet."
8. `committedHead` could live beside `CallerCheckout` in `snapshot.ts`. **Left**: the daily and the checkpoint use it, the snapshot does not.

**Spec: every acceptance criterion implemented and tested.** Findings:

1. `new_work` on a remote tracker has a `null` path and nothing saying where it goes. **Left** for epic 3; see *Promotion types*.
2. Validation of `promoted`, the 503, the record's fuller response and the `committedHead` extraction go beyond the spec. **Kept**, as graceful degradation that guesses nothing.
3. A promoted path that does not exist produced no diagnostic, so a typo recorded as a clean promotion. **Fixed**: `checkpoint.path_missing`, tested.
4. `position` has a path only on the local tracker with `knowledge.docs`. **Kept**: that is where the snapshot reads the roadmap (ADR-0017).
