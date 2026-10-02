# 08: The dashboard shows graph freshness and conflict risk

Status: DONE
Triage: ready-for-agent
Blocked by: 06
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** what the snapshot now says about the graph and the conflict risk, shown on the dashboard, read-only and in English and Russian. The Project page shows the `graph` section (ticket 05): whether there is a graph, the commit it was built from, whether `main` is past it, the last run, or the reason it is not available. The Overview shows, beside the parallel limit, each ready and in-flight Task's modules and the risk of each pair with its reason, labelled as calculated, or that the risk is not available and why.

- [x] The Project page shows the graph's commit, freshness and last run, and the not-available reason when there is no graph.
- [x] The Overview shows the risk of each pair beside the parallel limit, with its reason and a calculated label.
- [x] Without a graph, the Overview says the risk is not available, with the reason.
- [x] Every new string is in both languages; the i18n test passes.
- [x] The dashboard stays read-only.

## Comments

### For the next tickets

- The dashboard's types for the two sections are `GraphSection`, `Impact` and `ConflictRisk` in `apps/dashboard/app/composables/projects.ts`, copied from the daemon's, as the dashboard's other types are. The Project page's Graph card is in `pages/project.vue`; the Overview's conflict risk sits under the parallel line in Ready to start, `pages/index.vue`.
- `isUnavailable` now reads `available`'s value, not only its presence, since `impact` carries `available: true`; a section that carries the key only when unavailable reads as before.

### Decisions taken here

- **The risk words are translated, the reasons are not.** `high`, `medium`, `low` and `unknown` are the page's own words, in both dictionaries; a pair's `reason` and the graph's reasons are the daemon's messages, shown as given and marked English, as the rest of the dashboard shows them (`docs/04-telemetry-dashboard.md`).
- **Unknown is never coloured as low:** high is red, medium amber, low green, unknown neutral.
- **The conflict risk shows even when the parallel line does not**, since the line appears only when a place is free; with a graph and no Task in flight or ready, the block is left out, and without a graph it always says why.
- **The Graph card shows what it has, whatever `available` says**: a graph made unavailable by a removed `graphify` still shows the commit it was built from and the last run, under the reason.
- **No automated test for the pages**, as the dashboard spec decided (`specs/dashboard-design-and-languages`, *Testing Decisions*); the typecheck holds the Russian dictionary to the English one. The pages were checked by hand against a daemon in a temporary home, on a temporary project with a fake `graphify`: before the first build, both pages said not available with the graph's reason; after it, the Project page showed the commit, `the default branch is at it` and the last run, and the Overview each Task's modules and a high, two medium and three unknown pairs, in Russian.

### Review

`/code-review` ran against `main` on both axes, its two sub-agents in the foreground.

**Standards: no hard violation; one formatting slip and several judgement calls.**

- Fixed: two unrelated hunks lost the space after `=` (`isUnavailable`, `lastActivity`).
- Fixed: `isUnavailable` answered true for `impact` and `graph`, which always carry `available`; a comment warned of it. It now reads the value, and the comment is gone.
- Fixed: a run's outcome was two flat keys picked by a ternary; it is one map, `runOutcomes`, as `risks` is.
- Kept: `commit.slice(0, 12)` written twice more beside `gitLine`'s; a helper for one slice is more surface than it saves.
- Kept: `snapshot.graph.…` spelled out in the template, as the page spells out its other sections, and `{ commit, at }` unnamed, as the daemon leaves it.

**Spec: no missing requirement; every criterion met.**

- Fixed: with a graph and no Task, the block was a heading with nothing under it; it is now left out.
- Kept: one Task and no pair shows the Task's modules and no pair, which is all there is to say.
- Kept: a pair's `modules` are not listed apart, since its reason names them.
