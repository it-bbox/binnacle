# 05: Usage brief or full, and by epic

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** `usage.get` and `usage_get` take an optional epic, by its number in the roadmap, and the usage page offers the roadmap's epics with a spec (spec, *Usage by epic*). With an epic, its Tasks are those of the spec the roadmap names; tokens per completed Task, rework share and first-pass acceptance list every one of them, with no remainder, and the epic's averages, each `calculated`. An epic the roadmap does not list, or one with no spec, is an error with its reason. The page's widgets go into the shared frame, *Brief* as the spec's stories say (21 to 24), and no Task id is cut.

- [x] Through the daemon's HTTP API, on a Git repository with tickets and session artifacts: `usage.get` with an epic lists every Task of it and the epic's averages; an unknown epic, and one with no spec, are refused with a reason.
- [x] `usage_get`'s description and `docs/03-mcp-and-skills.md` name the epic.
- [x] The usage page picks an epic and shows the same figures as `usage_get`, labelled as Binnacle's calculation.
- [x] Each widget has the control, *Brief* as the stories say; Task ids are never cut.
- [x] `docs/04-telemetry-dashboard.md` describes usage by epic.
- [x] Checked in a browser: epic 11's Tasks together, both levels, in light and dark, English and Russian.

## Comments

`usage.get` takes `epic`, a positive integer, never with `task`; `usage_get` takes the same. The daemon reads the roadmap from the caller's checkout as the snapshot does (`readRoadmap`, now exported), refuses an epic the roadmap does not list (`epic.unknown`, 404), one with no spec (`epic.no_spec`, 409) and a project without a roadmap (`roadmap.missing`, 409), and an unreadable tracker as `task.get` does. Runs are attributed against every Task first, then kept to the epic's, so an epic's figures are the ones its Tasks have in the project's; every per-Task list is whole, and the answer names its `epic`, null for the whole project.

Readings taken where the stories leave room: "every Task" of a metric is every Task of the epic that metric counts, those with runs, `DONE` ones for tokens per completed Task and the rework share, reviewed ones for first-pass acceptance, as in the project's; context growth, a list of runs, keeps its ten largest; with an epic, by Task and by role count only its Tasks' runs, so nothing is unassigned, while tokens by kind, by model and by provider stay the project's, the import window's line under tokens by kind being the epic's and saying so. The page's picker lists the roadmap's epics with a spec and the whole project, and falls back to the whole project when the roadmap stops listing the picked one. *Brief*: tokens by kind shows input and output (`BRIEF_FIELDS`); each breakdown its three largest rows by the picked kind (`BRIEF_ROWS`) and how many more; the derived metrics their headline figures and Ponytail's reason; the harnesses name and level. `BarList` folds after six rows in *Full*, as ticket 02's lists do, and wraps a label instead of cutting it. Cost has no control: it has nothing to fold.

Checked in a browser against a temporary daemon whose home held a copy of the owner's store, its project paths moved to this worktree, which was registered: epic 11 lists its 13 Tasks in by Task and in every derived list, with a rework share of 41 % and first-pass acceptance of 0 %, the figures `usage_get` gives with `"epic":11`; both levels, light and dark, English and Russian; a level survives a reload; the folded lists unfold in place; no Task id is cut, no text is below 13 px, nothing scrolls sideways at 1024 px. The review's two fixes on the page, the error cleared with the scope and the fallback, were read in the code.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground. The ticket names no role beyond the Developer and the Reviewer.

**Standards: no hard violation.** To fix:

1. **Two doc comments on `ProjectUsage`** **Fixed** in ab44f2d. (`apps/daemon/src/usage.ts`): the old one-liner stayed above the new one, and the new one said "nothing unassigned" of the whole project too. Fix: one comment, the epic's case said apart.
2. **A scope's error outlived it** **Fixed** in ab44f2d. (`pages/usage.vue`, `watch(scope)`): the data was cleared, the error not, so a failure of the last scope showed instead of the skeleton. Fix: the error is cleared too.
3. **A picked epic the roadmap drops is refused on every poll** **Fixed** in ab44f2d. (`pages/usage.vue`): Fix: the scope falls back to the whole project when the roadmap no longer lists the epic with a spec.
4. **`own` named two things in one function** **Fixed** in ab44f2d. (`usageGet`): Fix: the epic's ids are `epicTasks`.

Kept:

5. Unfolding a list with `last` adds rows above the unassigned row, the toggle below it: the daemon's remainder must stay before `last`.
6. *Brief* re-sorts the daemon's rows by the picked kind: it picks the ten largest by every kind, and the three shown are the largest of those.
7. `BarList`'s fold beside `FoldedList`: its rows, remainder and `last` keep their order only inside the one list.
8. Four `epicTasks === null` ternaries in `usageGet`: four lines, each read on its own.
9. `scope` a string: the select's items need a value that is not null.
10. `usageGet`'s six parameters, `task` and `epic` exclusive: the operation refuses both together.

**Spec: nothing missing.** To fix:

11. **"Every Task" read narrower than the doc said** **Fixed** in ab44f2d. (`docs/04-telemetry-dashboard.md`): each list holds the epic's Tasks its metric counts, `DONE` ones, reviewed ones, those with runs, as for the project. Fix: the doc says so.
12. **The doc said tokens by kind stays the project's** **Fixed** in ab44f2d. (`docs/04-telemetry-dashboard.md`): its import window's line is the epic's, labelled so. Fix: the doc says it.

Kept:

13. Context growth keeps its ten largest runs with an epic: the spec makes whole the per-Task lists, and it lists runs.
