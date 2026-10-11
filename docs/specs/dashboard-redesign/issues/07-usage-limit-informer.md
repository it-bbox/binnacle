# 07: How many agents the subscription sustains

Status: READY
Triage: ready-for-agent
Blocked by: 06
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** beside the Parallel limit, the Settings page shows how many runs this machine has carried (spec, *The informer*). Claude Code's synthetic record with `"error":"rate_limit"`, which the adapter drops today with the other synthetic records, is read as a usage-limit marker, as compaction markers are, and stored. Over the import window and every registered project, the informer gives the most runs active at once, active by telemetry's existing recency rule, and each usage-limit marker's time with how many runs were active then, both `calculated`. A harness that records no usage limit is listed as not reporting it, never zero.

- [x] Through the daemon's HTTP API, from Claude Code session fixtures holding `rate_limit` records beside ordinary calls: the markers' times and the runs active at each, and the most runs active at once.
- [x] A synthetic record other than a usage limit still gives no record and no marker.
- [x] A harness that records no usage limit reads as not reporting it.
- [x] The Settings page shows the informer beside the limit, labelled as Binnacle's calculation, in both languages.
- [ ] Checked in a browser, on the owner's daemon with this repository's history.

## Comments

Claude Code's synthetic record with `"error":"rate_limit"` gives a usage-limit marker (`UsageLimitMarker`, with `quotaLimits.rateLimitType` as its `limit`), kept in the store's new `usage_limit` table; every artifact is read again once, as when compaction markers came. `parallel.get` gives beside the limit an `informer`: `mostActive`, `usageLimits` and `notReporting`, computed in `usageLimitInformer` (`apps/daemon/src/usage.ts`) from what is stored, starting no import. The Settings page shows it under the limit's form, the latest limits first, folded after six.

Answered without the owner, as the spec allows:

- Runs are grouped as `observedRuns` groups them, without Tasks, so the informer needs no tracker or Git read; a role then changes only with the branch, so no run's bounds move.
- Each project counts over its own import window, read from its manifest, the default where it cannot be read.
- `notReporting` names the harnesses among the runs counted that record no usage limit, not every harness Binnacle knows.
- The session that hit a limit counts as active then, even with no call in the ten minutes before it.

Checked in a browser against a temporary daemon with this worktree registered, so this repository's whole history through its main checkout: 28 runs at most at once and 13 usage limits, in Russian and English, light and dark, the list unfolded, and a saved limit keeping the informer. The owner's daemon runs `main`, so the last criterion waits for the merge:

1. After the merge, restart the daemon: `binn daemon stop`, then `binn daemon start`.
2. Open `binn dashboard`, then Settings: under the Parallel limit, *What this machine has carried* gives the most runs at once with its time, the usage limits latest first, each with the runs active then, and the harnesses not reporting.
3. Switch to English and back, and to the dark theme: the informer reads in both, its note starting with Binnacle's calculation.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground.

**Standards.** To fix:

1. **`markerPlace` cut the article off its argument** (`claude-code.ts`, `` `a subagent ${what.slice(2)}` ``) **Fixed** in 141fd62: it takes the kind and writes the article itself.
2. **`CompactionMarker` and `UsageLimitMarker` repeated seven fields** (`packages/telemetry/src/index.ts`) **Fixed** in 141fd62: both extend one `Marker`.

Kept:

3. The usage-limit statements in `store.ts` and `keptLimits` in `keep()` beside the compaction ones: one table each, as ADR-0015's append-only tier keeps them.
4. `ingest` and `keep` growing an optional list each: two kinds of marker; an options object when a third comes.
5. `defaultBranch: 'main'` in `usageLimitInformer`: without Tasks it moves no run's bounds, as its comment says.
6. "Ten minutes" in the dictionaries and the docs beside `ACTIVE_WITHIN_MS`: prose, as every limit in them is.
7. The page's `Informer` type beside the daemon's: the dashboard imports no daemon type.

**Spec.** To fix:

8. **A session whose first prompt hit the limit counted 0 runs active then** (`usageLimitInformer`, `activeAt`), seen in the browser on this repository's history **Fixed** in 141fd62: the session that hit the limit counts as active, pinned in `usage-limit-informer.test.ts`.

Kept:

9. The test reading the store for the markers kept and their content: as `context-pressure.test.ts` does, the one way to see that nothing of the message is stored.
10. The limit's type and the time of the most runs at once: one field each, and the type tells a five-hour limit from a weekly one.
11. One session counted twice for up to ten minutes when it changes branch, and a parent beside its subagent: the spec counts runs by the recency rule, as *Running now* does.
12. `parallel.get` recounting every project's records on each poll of the Settings page: 75 ms on this repository's history.

