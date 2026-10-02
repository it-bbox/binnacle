# 10: The vault's Product notes and `90-Graphify`

Status: READY
Triage: ready-for-agent
Blocked by: 05, 09
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** the rest of the vault projection. Product holds the roadmap, the latest snapshot and the latest daily as Markdown, linked to the specs and ADRs they name. The roadmap refreshes with the rest when `main` moves. The snapshot and the daily refresh whenever one is served, from what was just computed, with no extra call to the tracker. `90-Graphify` holds the graph's report, refreshed after each successful graph run (ticket 05). All of it carries the generated marker and follows ticket 09's rules.

- [ ] Serving a snapshot writes the Product snapshot note from that snapshot, and serving a daily the daily note.
- [ ] The roadmap note refreshes when `main` moves, and links to the projected specs.
- [ ] A successful graph run refreshes `90-Graphify`; a failed one leaves it as it was.
- [ ] Without a graph, `90-Graphify` has no note, and no attention item is added for it.
- [ ] Serving a snapshot with no vault set writes nothing and is no slower.

## Comments
