# 10: binn init leaves a layout Binnacle can read

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** two defects found in the exit demonstrations of epics 7 and 9 (2026-10-05).

1. On an empty repository, `binn init` wrote a manifest whose local tracker reads `docs/specs`, but created no `docs/specs/`, and declared no `knowledge.docs`, so the first `/binnacle:product` showed `tracker.issues_missing` and `roadmap.missing` and had no Next action.
2. On an existing repository whose `docs/roadmap.md` is not in Binnacle's format (no `| # | Epic | Status | Spec |` table, no `## Current focus` ending with a `Next action:`), init proposed nothing, and the dashboard showed three attention items.

When they are missing, init's plan proposes the issues directory the manifest names, `knowledge.docs`, and a `docs/roadmap.md` skeleton in Binnacle's format: the table's header with no rows, and a `## Current focus` whose `Next action:` is the planning step, `/grill-with-docs`. An existing roadmap is never rewritten: `binn audit` reports one not in the format as a gap naming what is missing, and init's Summary points to it.

- [x] On an empty repository, after init's plan is confirmed, `/binnacle:product` shows no `tracker.issues_missing` and no `roadmap.missing`, and its Next action is the skeleton's.
- [x] An existing roadmap is left byte for byte; `binn audit` reports one not in the format, and init's Summary says so.
- [x] Tests in `apps/cli/test/init.test.ts` and the audit's tests hold both.

## Comments

### Decisions

- **The issues directory** is kept in Git by an empty `<issues>/.gitkeep`, the plan's item `Create docs/specs/.gitkeep`: an empty directory would vanish at the first clone, and `tracker.issues_missing` with it. It is proposed only on the local tracker.
- **A new manifest** always declares `knowledge.docs: docs`, and on the local tracker `knowledge.specs: docs/specs`, since the plan creates them. The paths are one constant, `NEW_LAYOUT`, which the manifest and the layout step share.
- **An existing manifest** gets the issues directory it names and `<knowledge.docs>/roadmap.md` when they are missing. One that declares no `knowledge.docs` is not extended: ADR-0026 allows only a pure append, and a second `knowledge:` key would be invalid YAML. init says so and the Summary records `skipped the roadmap: .binnacle/project.yaml declares no knowledge.docs`. A manifest with problems gets no layout step, as it gets no registration.
- **The skeleton** is `ROADMAP_SKELETON` in `apps/cli/src/layout.ts`: the table's header with no rows, the status vocabulary, and a `## Current focus` whose Next action is `/grill-with-docs`.
- **Format** is read once, `roadmapGaps` in `layout.ts`, by both commands: core's `parseRoadmap` diagnostics and its `nextActionAttention` with no Tasks. `binn audit`'s new check is `docs.roadmap` in the docs area: `gap` for a missing roadmap (recommending `binn init`), for one not in the format (naming what is missing, and that init never rewrites it) and for a manifest with no `knowledge.docs`; `unknown` under a manifest with problems.
- **Criterion 1** is checked on the data `/binnacle:product` presents: the test reads `project.snapshot` from a temporary daemon after the confirmed plan.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards:**

1. **`roadmapGaps` wrote its own Next action check beside core's `nextActionAttention`.** **Fixed**: it uses core's.
2. **The new manifest's layout was written twice**, in `proposeManifest` and at the layout step's call. **Fixed**: `NEW_LAYOUT`.
3. **`roadmap()` in the audit and `layoutStep` in init share a decision tree.** **Kept**: one renders findings, the other plan items and outcomes; the format itself is shared.
4. **The audit read `docs/roadmap.md` under a manifest with problems** and could report `ok`. **Fixed**: `unknown`, with a test.
5. **Two wordings for "declare knowledge.docs".** **Kept**: one sentence each, in a finding and in init's output.

**Spec:**

1. **An existing manifest without `knowledge.docs` is not offered it.** **Kept**: ADR-0026's pure append cannot add a key to an existing section; recorded under Decisions.
2. **The audit also reports a missing roadmap and a manifest without `knowledge.docs`.** **Kept**: the same reasons the snapshot gives `roadmap.missing`, so the audit and the snapshot agree.
3. **`knowledge.specs` and `.gitkeep` were not asked for.** **Kept**: both follow from creating the directory the manifest names.
4. **A file at the issues path is left alone, and the tracker still reports it.** **Left**: a manifest naming a file is the owner's to fix, and the snapshot says so.
