# 05: Remote Task transitions in the daily and the checkpoint

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** on a remote tracker, `/binnacle:daily` shows which Tasks changed state and which issues are new since the previous daily, and the checkpoint's delta does the same since the last checkpoint. Where that cannot be known, the answer says so. Decided in the spec, under *Daily delta and checkpoint on a remote tracker*.

- [ ] On a remote tracker, `daily` and `checkpoint` events record `{ id → state }` for every Task beside the head commit. On the local tracker they record nothing new.
- [ ] Transitions are Tasks whose state differs from the baseline event's record; new tickets are Tasks absent from it. Both share the existing limits and remainder counts.
- [ ] With no recorded states — no baseline, the fallback window, an explicit `since`, an event recorded before this ticket or while the tracker was unreadable — transitions and new tickets are unavailable with the reason, never empty.
- [ ] An unreadable tracker at the time of a daily records no states, and the daily still answers its other sections.
- [ ] The recorded states survive a projection rebuild. No new table and no migration.
- [ ] Tests through the daemon seam: two dailies across a change served by the loopback stand-in (an issue closed, one moved to `ACTIVE`, one filed), the first daily's unavailability, `since`, and a checkpoint followed by `checkpoint.prepare`.
