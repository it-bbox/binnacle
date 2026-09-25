# 05: Remote Task transitions in the daily and the checkpoint

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** on a remote tracker, `/binnacle:daily` shows which Tasks changed state and which issues are new since the previous daily, and the checkpoint's delta does the same since the last checkpoint. Where that cannot be known, the answer says so. Decided in the spec, under *Daily delta and checkpoint on a remote tracker*.

- [x] On a remote tracker, `daily` and `checkpoint` events record `{ id → state }` for every Task beside the head commit. On the local tracker they record nothing new.
- [x] Transitions are Tasks whose state differs from the baseline event's record; new tickets are Tasks absent from it. Both share the existing limits and remainder counts.
- [x] With no recorded states — no baseline, the fallback window, an explicit `since`, an event recorded before this ticket or while the tracker was unreadable — transitions and new tickets are unavailable with the reason, never empty.
- [x] An unreadable tracker at the time of a daily records no states, and the daily still answers its other sections.
- [x] The recorded states survive a projection rebuild. No new table and no migration.
- [x] Tests through the daemon seam: two dailies across a change served by the loopback stand-in (an issue closed, one moved to `ACTIVE`, one filed), the first daily's unavailability, `since`, and a checkpoint followed by `checkpoint.prepare`.

## Comments

- **What changed.** On a remote tracker, `daily.get` and `checkpoint.record` add `states`, `{ id → state }` for every Task, to their event's payload beside `head`. They add nothing when the tracker cannot be read, and nothing on the local tracker. `recordedBaseline` in `apps/daemon/src/operations.ts` reads `states` back with the head. `recordedStates` in `apps/daemon/src/daily.ts` returns those states for comparison with the Tasks read now, or the reason there are none. `daily()` now returns `{ delta, states }`, so `daily.get` records the same reading the delta used, and the tracker is read once. `readTasks` in `snapshot.ts` is exported for `checkpoint.record`. The tests are in `apps/daemon/test/github.test.ts`, under *Task transitions on a GitHub tracker*.
- **The response shape.** `transitions` and `newTickets` are one of three things:
  - the usual `{ items, remainder }`;
  - `{ available: false, reason }`, the snapshot's existing `Unavailable` shape, when there are no recorded states to compare with;
  - `null`, as before, when the tracker cannot be read now. Then `readyToStart` is `null` too, and the attention items say why.

  The daily skill now quotes the `reason` of an unavailable list instead of leaving the list out.
- **GitLab.** This branch was rebased onto ticket 04, which had merged in the meantime. GitLab needed no code change. `isRemoteTracker` treats every provider other than `local` as remote, and `readTasks` reads GitLab through the same path as GitHub, so GitLab's states are recorded and compared the same way. One test through the GitLab stand-in shows it, in `apps/daemon/test/gitlab.test.ts`, under *Task transitions on a GitLab tracker*. It covers a daily and a checkpoint recording states, and then `daily.get` and `checkpoint.prepare` listing a closed issue, a started one and a filed one. Every unavailable case is tested once, on GitHub.
- **Questions answered in the smallest way the spec allows.**
  - *Is a remote baseline whose head was rewritten away still used for Task states?* No. The spec lists "the fallback window" among the unavailable cases, so any fallback makes transitions unavailable, even when the baseline event did record states.
  - *Does a Task whose recorded state was `null`, meaning no usable `Status:`, count as a transition once it has one?* Yes. The states differ, and the local tracker already counts that change.
  - *Does `checkpoint.record` report an unreadable tracker?* No. It records no states, and the next `checkpoint.prepare` gives the reason. Its `diagnostics` stay about the promoted paths.
  - *Are recorded states validated when they are read back?* Only as an object. Binnacle writes them itself, to its own tier-2 store.

### Review

`/code-review` ran against `main` on both axes. Neither axis found a hard violation.

**Standards: one gap in the test list, and six judgement calls.**

1. No test covered a fallback from an existing baseline on a remote tracker, although the spec's Seam 1 names "their unavailability after a fallback". **Fixed**: a test rewrites the recorded head away and asserts the fallback's reason.
2. Recorded states took two shapes, a `Record` and a `Map`, each with its own conversion. **Fixed**: `TaskStates` is used throughout, and one `taskStates` builds it.
3. Whether the tracker is remote was checked in two inverted forms. **Fixed**: one `isRemoteTracker` now serves both the daily and the checkpoint.
4. A long inline expression fed `taskChanges`. **Fixed**: it is now the named local `was`.
5. `checkpoint.record` read the tracker on a local project and threw the result away. **Fixed**: it now reads only a remote tracker. Its tracker diagnostics are still dropped. **Kept**, as answered above.
6. A dense ternary in `recordedBaseline`. **Fixed**: the check is split out and commented.
7. A double cast in the tests, `codes(down as unknown as Snapshot)`. **Fixed**: `codes` now takes anything with `attention`.

**Spec: every criterion is met.**

1. The fallback case was untested, as in standards item 1. **Fixed**.
2. The ticket did not ask for the daily skill's edit. **Kept**: user story 24 asks the daily to "say plainly when transitions cannot be computed", and without the edit the skill would leave the reason out.
3. The wasted tracker read on a local checkpoint, as in standards item 5. **Fixed**.
4. The values of recorded states are not validated. **Left**, as answered above.
