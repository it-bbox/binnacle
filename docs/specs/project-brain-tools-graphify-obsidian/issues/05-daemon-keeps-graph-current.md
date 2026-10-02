# 05: The daemon keeps the graph current

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** the graph updated by the daemon when `main` moves (ADR-0036), and its freshness in the snapshot. Once a minute the daemon reads the commit of each registered project's default branch. When it has moved, the daemon runs Graphify's code-only extraction in the background in the registered checkout, under four conditions: the checkout is on the default branch, the capability is not `false`, `graphify` is on the daemon's PATH, and Git ignores the output directory. It runs one build per project at a time, with at most one queued. Each run's outcome — commit, time, success or Graphify's reason — is an event in the store, so it survives a restart. The snapshot gains a `graph` section: `available`, with a reason when false; the commit and time it was built from; `behind`, whether the default branch has moved past it; and the last run. A failed run is the attention item `graph.update_failed` and keeps the last good graph. An output directory Git does not ignore is `graph.not_ignored`, and nothing runs. A missing tool is the section's reason, not an attention item. The write guarantee allows the ignored graph directory and nothing else.

- [ ] A commit to the default branch, with the fake `graphify` on PATH, leads to one code-only build, and the snapshot's `graph` names that commit.
- [ ] A registered checkout on another branch runs no build, and `behind` is true.
- [ ] Several commits during a run lead to at most one more run.
- [ ] A failing fake is `graph.update_failed` with its reason; the previous graph is kept and `behind` is true.
- [ ] An output directory not ignored by Git runs nothing and is `graph.not_ignored`.
- [ ] No `graphify` on PATH, or the capability `false`, is `available: false` with a reason that tells them apart, and no attention item.
- [ ] The last run's outcome survives a daemon restart.
- [ ] The write-guarantee test allows the ignored graph directory and fails on any other write into the repository.
- [ ] `docs/03-mcp-and-skills.md` describes the `graph` section; `docs/operations/03-external-tools.md` says the daemon keeps the graph current.

## Comments
