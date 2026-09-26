# 11: Ready to start leaves out a Task the board shows In progress

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** a defect the owner filed from the exit demonstration, ticket 09, on 2026-09-26. While ticket 09's session ran, the Overview listed `minimal-dashboard/09` under *Ready to start*, with its start command, and at the same time under *Running now*, with the Suggested step saying to wait for it and the board placing it In progress. *Ready to start* is the snapshot's `tasks.readyToStart`, which `taskSections` in `apps/daemon/src/snapshot.ts` reads from the ticket's state alone. The board reads In progress from runs, through `boardColumn` in `packages/core/src/tracker.ts` (ADR-0032). A list that offers to start a Task already being worked on answers "what do I type" wrongly.

- [x] A `READY` Task that the board places In progress, because a run is attributed to it, is not in the snapshot's *Ready to start*, and so not on the Overview's. It is read by the same rule as the board, not a second one.
- [x] The Task stays reachable from the Overview, as a Task in flight or under *Running now*, whichever the change settles on; the ticket's `Status:` is still never written (ADR-0032).
- [x] The daily's `readyToStart` agrees with the snapshot's, or the ticket's Comments say why it does not.
- [x] A test through the daemon seam covers a `READY` Task with a run on its branch and one without.

## Comments

- **The rule.** `taskSections` in `apps/daemon/src/snapshot.ts` now places each Task by `boardColumn`, the board's own rule, given the ids of the Tasks with attributed runs: In progress goes to `inFlight`, Ready with no Unmet dependency to `readyToStart`, the rest to the counts. The snapshot takes those ids from the runs it already groups for `activity`; the board and the daily take them from `latestRuns`. Both group every stored record through the same `runs`, so they agree.
- **Criterion 2: settled as a Task in flight.** *Running now* lists only runs active in the last ten minutes, so a Task whose session went idle would drop off the Overview. The snapshot's `tasks.inFlight` now holds a `READY` Task with an attributed run, and the Overview gained an *In progress* list of `tasks.inFlight`, each linking to its Task page, a `READY` one marked `runs`, with the board's label (`RUNS_READING`, ADR-0032). It shows no start command: resuming is the Suggested step's (rule 2). The list is provisional: the Overview's design goes to grilling (ticket 09's Comments).
- **Criterion 3: the daily agrees.** `daily.get` and `checkpoint.prepare` now read the attributed runs too, so both wait on the usage ingest, within its budget, as the snapshot does. The runs are the one thing in the daily not read from Git; `Daily.readyToStart` says so. The daily still reads the Tasks at HEAD and the snapshot the working tree, so an uncommitted ticket edit can still make them differ, as before.
- **Autopilot** reads `readyToStart` to start tickets. Its skill now says a ticket with an attributed run is not in it, and its remainder fallback leaves out what the snapshot lists in flight. A `READY` ticket with any attributed run, even an old one, is therefore never started by autopilot; the Suggested step offers to resume it.
- **Skill and docs.** The `product` skill says a `READY` Task in flight is In progress from its runs. `docs/03-mcp-and-skills.md` and `docs/04-telemetry-dashboard.md` say where such a Task is listed.
- **Test.** `Ready to start beside the board` in `apps/daemon/test/board.test.ts`, through the daemon's HTTP API: two `READY` tickets, one with a Claude Code session on its branch. The board, the snapshot and the daily agree, and the ticket still says `READY`. The branch was rebased onto `main` after ticket 10 merged; the typecheck and the full suite (364 tests) pass.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violations.** Judgement calls:

1. **The counts' cast.** `counts[(task.state ?? 'unknown') as keyof TaskCounts]` trusts `boardColumn` to put every in-flight state In progress, where the old type guard was checked. **Fixed** as far as it goes: a `ponytail:` comment names the invariant and the upgrade. Deriving `TaskCounts` from `boardColumn` is kept for when they drift.
2. **Duplicated code: the attributed ids derived twice**, from the snapshot's runs and from `latestRuns`. **Kept**: each uses the runs it already has, and both come from the same grouping.
3. **Mysterious name: `attributedTo`, and `attributed` as both a function and a set.** **Fixed**: the reader is `readAttributed`.
4. **Long parameter list: `daily()` takes seven.** **Kept**: it follows the existing positional style.
5. **Duplicated code: the Overview's *In progress* list repeats *Ready to start*'s shape.** **Kept**: two uses, and the Overview's design is going to grilling.
6. **The dashboard infers `runs` from `state === 'READY'`** in the snapshot's `inFlight`, where the board carries `source`. **Kept**: in `inFlight`, `READY` only ever comes from runs, as `Snapshot.tasks.inFlight` documents; adding `source` would widen the snapshot's contract for one label.

**Spec: all four criteria hold.** Findings:

7. **Autopilot still read `readyToStart` as "`READY`, no Unmet dependency", and its remainder fallback applied a second rule.** **Fixed** in its skill (see Comments).
8. **The Overview's *In progress* list is more than criterion 2 asked**, listing every in-flight Task, and settles part of the Overview's design ahead of its grilling. **Kept**, recorded as provisional above: *Running now* alone would lose an idle Task.
9. **The daily now waits on the usage ingest, and still reads Tasks at HEAD.** **Left**, recorded above.
10. **The ticket was not yet closed.** **Fixed** by the commit that marks it `DONE`.
