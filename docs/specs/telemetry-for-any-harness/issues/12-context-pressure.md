# 12: Context pressure and its attention item

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** the Claude Code and Codex readers report compaction markers — Claude Code's compaction boundaries with their trigger, Codex's change of context-window identifier — beside their records, never content. Each session carries its context pressure: its latest call's context and its compactions, with provenance. The manifest gains `telemetry.context_pressure.tokens` (default 150 000). The snapshot raises `context.pressure` for an active Product run whose session crosses it or has compacted since the last recorded checkpoint, suggesting `/binnacle:checkpoint` (spec, *Context pressure*).

- [x] Reader tests: the compaction markers of Claude Code and Codex.
- [x] Daemon process tests: `context.pressure` raised by the threshold and by a compaction after the last checkpoint; not raised for a harness with no signal; the manifest's threshold read.
- [ ] The dashboard shows the attention item as any other.

## Comments

### Decisions

- **The formats, from this machine's own sessions.** Both were read from real artifacts on the machine where this ticket was built.
  - **Claude Code 2.1** writes a `system` record with `subtype: compact_boundary` where it compacted. It carries its `uuid`, `timestamp`, `cwd` and `sessionId`, and `compactMetadata.trigger`, `auto` or `manual`.
  - **Codex 0.155** names the session's window in `session_meta.payload.context_window.window_id`. Each `compacted` record names, in `payload.window_id`, the window it continues in.
  - The reader takes only those fields. The boundary's content, its counts before and after, its tool list and preserved messages are never read. Neither is Codex's replacement history.
- **The markers.**
  - `CompactionMarker` is in `@binnacle/telemetry` beside `UsageRecord`. `readLines` gives markers beside records in `ArtifactReading.markers`, telling the two apart by `trigger`.
  - A Claude Code marker's key is the boundary's `uuid`. It is `provider_reported`, and a subagent's boundary names its subagent.
  - A Codex marker's key is the session id and the record's ordinal. It is `calculated`, with a null trigger: Codex writes no compaction, and the change of window is Binnacle's reading of one.
  - A `compacted` record naming the window already in force gives none. Neither does one that follows no named window, since no change is seen there; the signal is absent rather than guessed.
  - A boundary or a rotation without the fields it needs stops the reading with its reason, as a record does.
- **The store.**
  - Markers go in a `compaction` table of the append-only tier, committed with the records and the cursor of their file. They are attributed to a project by their `cwd` and kept within the import window, as records are.
  - A store opened without that table yet forgets every cursor once, so that each artifact is read again from its start for the boundaries its cursor had passed. Its records were stored already, and the unique key leaves them as they were. A daemon test drops the table from a store and shows the marker read and no record counted twice.
- **Context pressure** is per session, a subagent's its own. It is on every run, `contextPressure`, in `usage.get` and the snapshot's `activity` alike, so that both give a run the same shape.
  - `context`: the latest call's input, cached input and cache creation together (`callContext`, the counts the call reports). It is Binnacle's sum, so `calculated`, or `estimated` when the call's counts are. It is null when the call reports none of the three.
  - `compactions`: their count, and the latest with its time, trigger and provenance.
  - The whole is null when a harness reveals neither, as for a Gemini CLI call written without tokens. Silence is not shown as health.
  - The snapshot stays compact: a fixed-size field on each of at most twenty runs.
- **The manifest** gains `telemetry.context_pressure.tokens`, a positive integer, null when unwritten. `DEFAULT_PRESSURE_TOKENS`, 150 000, is applied where it is used, as the import window's default is. The template states it with its default.
- **The attention item.** `context.pressure` is raised once per session, for an active Product run of a main session. Active is within telemetry's recency; Product is the default branch. It is raised when that session's latest call read at least the threshold, or when its latest compaction is after the project's last recorded `checkpoint` event.
  - It names the session id and the harness, the latest call's context when known, and the compaction with its trigger and time, and that of the checkpoint. It ends with "Run /binnacle:checkpoint, then go on in a fresh session."
  - Questions that blocked nothing, answered in the smallest way the spec allows:
    - With no checkpoint ever recorded, every compaction counts as after it, and the item says so.
    - A subagent's session raises nothing: the Product session is the main one, and a checkpoint is its to run.
    - Without a readable tracker, runs are still grouped, with no Tasks, so a Product session on the default branch still raises it. Activity and the Task sections stay unavailable as before.
- **The dashboard** needs no change: its attention page and the overview list every item of the snapshot's `attention`, with its message and code.
- **Out of this ticket:** the documents (`docs/04-telemetry-dashboard.md` still says "cumulative input over the session" where the spec says the latest call's context, and `CONTEXT.md`) are ticket 14's. Each run's context growth is ticket 11's. `callContext` in `@binnacle/telemetry` is the sum it can reuse.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: one hard finding.** Findings:

1. **The context was labelled with its call's provenance**, `provider_reported` for Claude Code, though it is Binnacle's sum (AGENTS.md 5, ADR-0007). **Fixed**: it is `calculated`, or `estimated` when the call's counts are.
2. **Compactions an existing store's cursors had already passed would never be read.** **Fixed**: a store opened without the `compaction` table forgets its cursors once. See *Decisions*, and the daemon test.
3. **`readBoundary` repeats `readRecord`'s checks.** **Kept**: each check gives its own reason, naming what is missing.
4. **A marker is told from a record by `'trigger' in result`.** **Kept**: no record has a trigger. `LineReading`'s doc comment says so.
5. **The function type `(session) => ContextPressure` recurs in three signatures.** **Fixed**: `PressureOf`.
6. **`Ingested` and `IngestedMarker` have the same shape.** **Kept**: one carries a record, the other a marker, and the store writes them to different tables.
7. **Grouping markers copied the array for each one.** **Fixed**: they are pushed.
8. **`markers = []` defaults on `ingest` and `keep`.** **Kept**: opencode's database gives no markers.

**Spec: no requirement missing.** Findings:

1. **The item did not always name the context**, when only a compaction raised it. The spec says "naming the session, its context and the marker". **Fixed**: the context is named whenever the call reports one.
2. **`contextPressure` on every run of the snapshot's `activity`.** **Kept**: "Each session carries its context pressure", and the activity's runs are `usage.get`'s. It is a fixed-size field on at most twenty runs.
3. **Pressure is raised without a readable tracker.** **Kept**, and recorded in *Decisions*: a Product session is the default branch's, whatever the tracker.
4. **A Codex compaction following no named window was taken as a change.** **Fixed**: no change is seen there, and no marker is given. The format was read from this machine's Codex 0.155 rollouts; the exit demonstration confirms it on the owner's machine.
5. **Every compaction counts when no checkpoint was ever recorded.** **Kept**, and recorded in *Decisions*: nothing has been checkpointed since it.
6. **`docs/04-telemetry-dashboard.md` describes pressure as cumulative input.** **Left** to ticket 14.

### For the owner

The third criterion is the dashboard's, and only a person can see it. With a daemon whose dashboard is generated, in a registered project whose manifest sets a low threshold:

```sh
# .binnacle/project.yaml, under telemetry:
#   context_pressure:
#     tokens: 1000
# then work for a minute in a Claude Code or Codex session on main in that project, and:
binn call project_snapshot | grep -A2 '"context.pressure"'      # the item, naming the session
binn dashboard                                                  # the Attention page lists it, with its code, like any other
```

Remove the threshold afterwards, or set it back to 150000.
