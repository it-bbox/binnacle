# 08: The dashboard in Russian terms, without codes

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/human-output/spec.md`

**What to build:** the dashboard's Russian is one language (spec, *The dashboard*, *Marks of calculation*). Its Russian dictionary translates every term epic 6 kept English, with the spec's words. Attention items and daemon reasons are worded from core's wording and `params` (ticket 02), and the text-matched `daemonReasons` move there; a message with no wording keeps its English mark. No code is shown, *Full* included. A calculated value is marked by one word, "(оценка)" or "(estimate)", a reading from runs by "(по активности)" or "(from activity)", an unknown is "нет данных" or "no data". `docs/04-telemetry-dashboard.md`'s language paragraph takes ADR-0045's rule in place of epic 6's.

- [x] Through the dashboard's i18n tests: the Russian dictionary holds none of the terms epic 6 kept English; an attention item is worded from its code and `params`; the marks are one word.
- [x] No code in the rendered attention items or reasons.
- [x] Checked in a browser, in Russian and in English.

## Comments

### Decisions

- **The dashboard depends on `@binnacle/core`**, a workspace package, for `wordMessage` alone, as the spec's *Contested points* settles; the page's own text stays in its dictionaries. `DaemonReason` takes what the daemon said (`said`), an item, an error or a section, and words it, marking English what core has no wording for.
- **A reason carries `code` and `params` beside it**, additive, where core words it: an `Unavailable` section, the graph section, a harness's level and Ponytail's comparison. New codes: `ci.no_forge`, `review.remote`, `graph.unavailable` (`kind` `none`, `off`, `no_graphify`, `not_built`, `unreadable`), `usage.import_pending`, `harness.no_export` (`kind` `database`, `session_files`, `encrypted`), `harness.no_sessions` and `ponytail.no_comparison` (`kind` per reason). A tracker that cannot be read gives its one diagnostic's code, `tracker.unavailable` with `kind: 'unreadable'` for none, and no code for several joined. The English messages are unchanged.
- **The marks are bare words in the dictionaries**, `estimate`, `fromActivity` and `noData`, written in brackets beside the value; *partial* stays a mark of its own. A calculated or estimated token total is one mark, the estimate.
- **The longer provenance notes are gone**: "Binnacle's calculation", the readings of running and of In progress from runs, the suggested roles' and the run roles' explanations. The informer's note and the epic's averages keep what they define, without the provenance.
- **States, statuses and roles are words in both languages**: `states`, `roadmapStatuses`, `columns` and `taskRoles` map the markers to words, and a value with no word is shown as written. The harness support levels' names (Context, Attribution, Usage, Live) stay `CONTEXT.md`'s, and pull request stays.

### For the next tickets

- Still English, marked, for want of a code: a suggested role's `reason`, a forge's CI failure, autostart that cannot be read, the registry's `unavailable` for a project, `reworkUnread`, a remote question read, and Graphify's own failure reason. Each needs a code and a wording in core, as `harness.no_sessions` got here.
- The browser check ran against a throwaway repository under `.scratch/` with a temporary `BINNACLE_HOME`: a done, an in-progress and a not-started epic, a ticket in each state, one with an unknown `Status:`, one with an unmet dependency and one with a question. Ticket 11's demonstration can be set up the same way.

### Review

A Reviewer sub-agent ran against `main` on both axes. Typecheck, the dashboard's `nuxt typecheck` and the 894 tests pass. The fields are additive, the `@binnacle/core` dependency is the one *Contested points* settles, no code or English domain label is left in the templates, and the commits carry no attribution.

**Standards:**

1. **`docs/04-telemetry-dashboard.md` still showed codes** on the Attention page and in the Settings diagnostics. **Fixed**: both say the page's language, without the code.
2. **`ponytailUndated` had no `few` form**, so 2 to 4 Tasks read «2 готовых задач». **Fixed**: the `few` form added.
3. **The dictionary lookup was named `said`**, like the `said` prop and `daemonSaid`, which mean what the daemon said. **Fixed**: renamed `wordFor`.
4. **"A kind no record reports is no data"** read oddly. **Fixed**: "is shown as “no data”".
5. **The dashboard's own `daemon.unreachable` has no wording in core**, so it shows in English, marked. **Left**: ticket 02 gives the CLI's own codes to ticket 03, and core's wording of it will cover the page too.

**Spec:**

6. **"The ticket says" translated the ticket's marker** («в тикете: готова»), which story 36 wants quoted as written. **Fixed**: it shows the `Status:` value as written; the badges keep the word.

Every criterion holds; the browser check is recorded under *For the next tickets*.
