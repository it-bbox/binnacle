# 06: Import window, time budget and re-reading

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/telemetry/spec.md`

**What to build:** the first import of a large history never blocks a Product session, and the window can be widened later without double counting. Decided in the spec, under *Ingest*.

- [ ] The manifest validator accepts `telemetry.import.window_days: all`.
- [ ] A file whose size shrank, or a window that grew beyond the one its cursor was read under, is re-read from the start; the unique constraint absorbs the repeats.
- [ ] A call waits for its project's ingest up to a fixed budget; the rest continues in the background, one ingest at a time per machine, and `importing` says so.
- [ ] The daemon starts an ingest for every registered project on startup.
- [ ] A project registered later gets its history under its window.
- [ ] Records whose artifact was deleted are still counted.
- [ ] Tests through the daemon seam: `all`, widening without duplicates, a budget exceeded then completed, and a deleted artifact.
