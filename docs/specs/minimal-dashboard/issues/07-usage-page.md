# 07: The Usage page, and a Task's runs

Status: READY
Triage: ready-for-agent
Blocked by: 02, 03
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** the Usage page shows a project's tokens by model, provider, Task and role, and each harness's level. The main screen gains a usage line, and the Task page shows the Task's runs and usage. Decided in the spec, under *The snapshot* and *The pages*.

- [x] The snapshot's `usage` gains `byProvider`: the last seven days per provider, with the runs whose artifacts state no provider in a row of their own.
- [x] The Usage page shows, field by field:
  - today and the last seven days;
  - by model and by provider, over the last seven days;
  - by Task, unassigned and by role, over the window;
  - each harness's level, or the reason it has none;
  - cost, as not available.
- [x] The Overview shows each project's usage today and this week in one line, linking to its Usage page.
- [x] The Project page shows the project's usage by role, and unassigned.
- [x] The Task page shows its runs — harness, model, role, branch, checkout, start, latest activity and tokens — and its implementation usage.
- [x] On the Task page, review usage, rework usage, and questions and answers are shown as not available, with the reason.
- [x] Fields are never added to one another. `null` is shown as not reported, and a `partial` total as partial.
- [x] The Usage page's figures equal those of `usage_get` and the snapshot for the same window.
- [x] Tests through the daemon seam cover `byProvider`, including the row for no stated provider.

## Comments

- **What exists.**
  - The snapshot's `usage.byProvider` is `{ items: { provider, totals }[], remainder }`, built in `apps/daemon/src/usage.ts` by `grouped`, which `byModel` now shares: the last seven days, largest first, with the section limit. `provider` is null for the records whose artifacts state none, which today is every Claude Code record.
  - The dashboard gains `app/composables/usage.ts` (the usage types, `FIELDS`, `tokens`, `fieldsLine`, `windowLabel`), `app/components/UsageTable.vue` (totals field by field, a row each), `app/components/RoleUsage.vue` (`usage.get`'s by role and unassigned), `app/pages/usage.vue` and `app/pages/project.vue`.
  - The Usage page, `/usage?project=<path>`, reads `project.snapshot` for today, the last seven days, by model, by provider and the harnesses, and `usage.get` for the total over the import window, by Task, unassigned and by role. It renders both answers as they come, so its figures are theirs.
  - The Overview ends each project with one line of usage, today and the last seven days, linking to the Usage page. Each project's name links to the Project page.
  - The Task page reads `usage.get` with the Task apart from `task.get`, so a failing usage leaves the brief standing. It lists the runs, newest first, and the implementation usage, then review usage, rework usage, and questions and answers as not available, with the reasons `docs/04-telemetry-dashboard.md` gives.
- **Decided while building, within the spec.**
  - **`byProvider` groups records, not runs**, as `byModel` does. The spec's "runs whose artifacts state no provider" reads the same today: Claude Code states none on any record, and a Codex rollout states its provider once, for every record. A run is only split across rows if its records disagree, which no harness writes today.
  - **The Project page is a minimal page**, `/project?project=<path>`, holding only the usage by role and unassigned, because ticket 04, which builds the page with its board, ran at the same time. The query key is `project`, as on the Task and Usage pages. Whichever branch merges second keeps ticket 04's page and adds `<RoleUsage :usage="…" />` from a `usage.get` call to it.
  - **A total says when it is calculated or estimated**, beside `partial`: Codex's totals are Binnacle's differences of its running totals (ADR-0007).
  - **"This week" is the last seven days**, the snapshot's window, and says so.
  - **The Usage page adds a row for the import window's total**, `usage.get`'s `totals`, which `docs/04-telemetry-dashboard.md` lists and the figures of the exit criterion are checked against.
  - **Each table shows its records count** beside the token fields.
  - **Cost** says why it is not available: no artifact reports it, and a cost from a price table is under *Later* on the roadmap.
- **For the next tickets.**
  - Ticket 08 adds the derived metrics to `usage.get`; the Usage page already holds that answer as `data.overWindow`, and `UsageTable` renders any totals.
  - Ticket 04: see the Project page above.
- **Checked by hand on 2026-09-26**, with a daemon on a temporary `BINNACLE_HOME` and an ephemeral port, this worktree registered and the dashboard generated, in the built-in browser. The Overview ended the project with its usage line and the link. The Usage page showed today, the last seven days and the import window; `claude-opus-5-5` by model; one provider row, `Provider not reported by the artifacts`; `minimal-dashboard/07` and `minimal-dashboard/04` by Task; product, implementation and unknown by role; unassigned; `claude-code` at level 3 and `codex` with no level and its reason; and cost as not available. The Task page of this ticket listed this session's run and its review sub-agents' runs on `feat/usage-page` in this worktree, the implementation usage, and the three elements not available. The Project page showed the usage by role and unassigned. The console showed no errors.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: one hard finding, fixed; the rest judgement calls.**

1. **The pages dropped provenance** (ADR-0007): a Codex total is calculated, and the page said the artifacts reported it. **Fixed**: `tokens` marks a calculated or estimated total, and the Usage page's line says so.
2. **Nothing linked to the Project page.** **Fixed**: the Overview links each project's name to it.
3. **One failing call blanks a whole page.** **Fixed** on the Task page, which reads its usage apart from its brief. **Kept** on the Usage page, whose every section is usage.
4. **Mysterious names**: `window` shadowed the global, `week` held more than the week, and `grouped` had opaque names inside. **Fixed**: `overWindow`, `snapshot`, and named sort arguments.
5. **Duplicated code**: the `Unavailable` type. **Fixed**: exported from `projects.ts`. Reading `project` from the query on three pages. **Left**: one line each.
6. **`grouped` returns tuples its callers turn into objects.** **Left**: typing an object keyed by `model` or `provider` costs more than the two maps.
7. **`COST_UNAVAILABLE` exported for one page.** **Fixed**: it is local to the Usage page, as `NOT_AVAILABLE` is to the Task page.
8. **`FIELDS` and the usage types repeat the daemon's.** **Left**: the dashboard imports nothing from the daemon, as ticket 03's review kept.

**Spec: every criterion holds**, and the daemon tests pass. Findings:

1. **The Usage page did not show the total over the window**, which `docs/04-telemetry-dashboard.md` lists. **Fixed**: a row of the first table.
2. **A run's null branch or checkout vanished on the Task page.** **Fixed**: "no branch", "a checkout Binnacle cannot name".
3. **The records column** was not asked for. **Kept**: it tells an empty total from a small one.
4. **The minimal Project page will collide with ticket 04's.** **Kept**, recorded above.
5. **`byModel` moved into `grouped`.** **Kept**: the same behaviour, shared with `byProvider`.
6. **`byProvider` groups records where the spec says runs.** **Kept**, recorded above.
7. **The Task page failing whole** (as Standards 3). **Fixed**.
8. **A line of "not reported"** when records report no field. **Kept**: that is the rule.
