# 14: The graph's report is built, so the vault gets 90-Graphify

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** a defect found in epic 8's exit demonstration (2026-10-05). `graphify extract . --code-only`, which `binn init` and the daemon run, writes `graph.json` but no `GRAPH_REPORT.md`; Graphify's own output says `graphify cluster-only <path>` generates it. With no report, the vault never gets `90-Graphify/GRAPH_REPORT.md`, so the demonstration's vault criterion cannot hold. After a successful extract, init and the daemon also build the report, the way Graphify says, as long as that calls no model and needs no API key; a failed report is reported as a failed graph step is today, and the graph itself is kept.

- [ ] After `binn init` with Graphify, and after a daemon rebuild, `graphify-out/GRAPH_REPORT.md` exists.
- [ ] The vault gets `Projects/<Project>/90-Graphify/GRAPH_REPORT.md` from it.
- [ ] No step calls a model or needs an API key; a test with a fake `graphify` on PATH holds the commands run and their order.

## Comments
