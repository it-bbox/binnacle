# 08: The dashboard shows graph freshness and conflict risk

Status: READY
Triage: ready-for-agent
Blocked by: 06
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** what the snapshot now says about the graph and the conflict risk, shown on the dashboard, read-only and in English and Russian. The Project page shows the `graph` section (ticket 05): whether there is a graph, the commit it was built from, whether `main` is past it, the last run, or the reason it is not available. The Overview shows, beside the parallel limit, each ready and in-flight Task's modules and the risk of each pair with its reason, labelled as calculated, or that the risk is not available and why.

- [ ] The Project page shows the graph's commit, freshness and last run, and the not-available reason when there is no graph.
- [ ] The Overview shows the risk of each pair beside the parallel limit, with its reason and a calculated label.
- [ ] Without a graph, the Overview says the risk is not available, with the reason.
- [ ] Every new string is in both languages; the i18n test passes.
- [ ] The dashboard stays read-only.

## Comments
