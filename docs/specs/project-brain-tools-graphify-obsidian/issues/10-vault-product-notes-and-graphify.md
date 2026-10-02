# 10: The vault's Product notes and `90-Graphify`

Status: DONE
Triage: ready-for-agent
Blocked by: 05, 09
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** the rest of the vault projection. Product holds the roadmap, the latest snapshot and the latest daily as Markdown, linked to the specs and ADRs they name. The roadmap refreshes with the rest when `main` moves. The snapshot and the daily refresh whenever one is served, from what was just computed, with no extra call to the tracker. `90-Graphify` holds the graph's report, refreshed after each successful graph run (ticket 05). All of it carries the generated marker and follows ticket 09's rules.

- [x] Serving a snapshot writes the Product snapshot note from that snapshot, and serving a daily the daily note.
- [x] The roadmap note refreshes when `main` moves, and links to the projected specs.
- [x] A successful graph run refreshes `90-Graphify`; a failed one leaves it as it was.
- [x] Without a graph, `90-Graphify` has no note, and no attention item is added for it.
- [x] Serving a snapshot with no vault set writes nothing and is no slower.

## Comments

### For the next tickets

- The Product and `90-Graphify` notes are in `apps/daemon/src/vault.ts`. `writeServed` writes the served notes; `project.snapshot` and `daily.get` call it after computing what they serve. The poll's render, `project`, writes the roadmap and the report. `noteOf` maps a source path to its note, and both the render and the served notes' links use it.
- `graph.ts` exports `lastBuild(store, path)`. It returns the last successful run's event id and commit, and whether a failed run came after it. The projector renders a project again when that id changes, as it does when the branch or the vault changes.
- Ticket 11 writes the setting and needs nothing more from this ticket. For ticket 12's demonstration, open `Projects/<Project>/Product/snapshot.md` after a `/binnacle:product`.

### Decisions taken here

- **The served notes** are `Product/snapshot.md` and `Product/daily.md`.
  - Their frontmatter: `source:` is the operation (`project.snapshot` or `daily.get`), `commit:` is the caller's HEAD, and `served:` is the time. Each serve therefore rewrites the note.
  - They hold the next step, the Tasks, the parallel limit and its conflict risk, the ADRs, the graph and the attention. Usage and activity are left to the dashboard.
  - A ticket or ADR path links to its projected note. A remote ticket's URL becomes a Markdown link.
- **A daily served with `since`** also writes the daily note, since it is the latest daily served. `checkpoint.prepare` does not.
- **The cost with no vault** is one read of `settings.json`, the same read the snapshot's `vault.unwritable` check already makes. `writeServed` returns before rendering anything.
  - A write that fails is logged, and never fails what was served.
  - With a vault set, the note is written synchronously before the reply.
- **The roadmap note** is `Product/roadmap.md`. It is rendered with the rest from committed `main`, and removed when the roadmap is removed.
- **The graph report** is `90-Graphify/GRAPH_REPORT.md`.
  - Its source is Graphify's `graphify-out/GRAPH_REPORT.md` in the registered checkout; the file name was checked through Context7. It is the only note read from the working tree: the directory is git-ignored and only Graphify writes to it.
  - Its `commit:` is the commit of the last successful run.
  - It is written only when no failed run came after that successful one, and only when the note is not already that run's. So a failed run leaves the note as it was, and a vault set after a failed run gets no report until the next successful run.
  - "Without a graph" means no successful run recorded, no report file, or `capabilities.graphify: false`. In each case the note is removed.
  - The daemon's PATH is not checked, so a report built before `graphify` left the PATH stays in the vault.

### Review

`/code-review` ran against `main` on both axes. Its two sub-agents ran in the foreground.

**Standards: one defect; the rest were judgement calls.**

- Fixed: a vault set, or a note deleted, after a failed run would have received the report that failed run left behind, labelled with the last good commit. The report is now not projected while a failed run is the latest. A test sets a vault after the failure.
- Fixed: the report text was named `graph`, a name that means the graph section elsewhere. The module header now says the report is the one note read from the working tree.
- Fixed: `BUILT` had been exported so the projector could read the event log. `graph.ts` now exports `lastBuild` instead and keeps its event types private.
- Fixed: a ticket's link label was built in two places.
- Kept: the served notes are rendered in `vault.ts`, not in a module of their own. They belong to the projection and share its marker, links and writes.
- Kept: the `served:` time, which rewrites the note on every serve. That is what "the latest snapshot" means.
- Left: the walk now also lists the subdirectories of the specs and ADR directories, and `noteOf` discards them. This is fine at the current size.

**Spec: no missing requirement; every criterion is met.**

- Kept: `settings.json` is read twice per snapshot, once here and once by `vaultAttention`. Sharing the read would mean passing the setting through the snapshot, to save one failed `open`.
- Kept: a daily with `since` writes the daily note; see *Decisions taken here*.
- Kept: the roadmap and report notes are removed when their source is gone, following ticket 09's rule.
- Left: no test covers a remote tracker's ticket URL rendered as a Markdown link. The local tracker's links are tested.
