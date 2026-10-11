# 07: How many agents the subscription sustains

Status: READY
Triage: ready-for-agent
Blocked by: 06
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** beside the Parallel limit, the Settings page shows how many runs this machine has carried (spec, *The informer*). Claude Code's synthetic record with `"error":"rate_limit"`, which the adapter drops today with the other synthetic records, is read as a usage-limit marker, as compaction markers are, and stored. Over the import window and every registered project, the informer gives the most runs active at once, active by telemetry's existing recency rule, and each usage-limit marker's time with how many runs were active then, both `calculated`. A harness that records no usage limit is listed as not reporting it, never zero.

- [ ] Through the daemon's HTTP API, from Claude Code session fixtures holding `rate_limit` records beside ordinary calls: the markers' times and the runs active at each, and the most runs active at once.
- [ ] A synthetic record other than a usage limit still gives no record and no marker.
- [ ] A harness that records no usage limit reads as not reporting it.
- [ ] The Settings page shows the informer beside the limit, labelled as Binnacle's calculation, in both languages.
- [ ] Checked in a browser, on the owner's daemon with this repository's history.
