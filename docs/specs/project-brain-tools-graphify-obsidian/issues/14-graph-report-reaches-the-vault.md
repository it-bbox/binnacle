# 14: The graph's report is built, so the vault gets 90-Graphify

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** a defect found in epic 8's exit demonstration (2026-10-05). `graphify extract . --code-only`, which `binn init` and the daemon run, writes `graph.json` but no `GRAPH_REPORT.md`; Graphify's own output says `graphify cluster-only <path>` generates it. With no report, the vault never gets `90-Graphify/GRAPH_REPORT.md`, so the demonstration's vault criterion cannot hold. After a successful extract, init and the daemon also build the report, the way Graphify says, as long as that calls no model and needs no API key; a failed report is reported as a failed graph step is today, and the graph itself is kept.

- [x] After `binn init` with Graphify, and after a daemon rebuild, `graphify-out/GRAPH_REPORT.md` exists.
- [x] The vault gets `Projects/<Project>/90-Graphify/GRAPH_REPORT.md` from it.
- [x] No step calls a model or needs an API key; a test with a fake `graphify` on PATH holds the commands run and their order.

## Comments

Implemented on `feat/graph-report-reaches-the-vault`. After a successful `graphify extract . --code-only`, `binn init` (step 12) and the daemon's run both run `graphify cluster-only . --no-label`, exported as `GRAPH_CLUSTER` from `@binnacle/daemon` beside `GRAPH_EXTRACT`. `--no-label` is what keeps Graphify from calling a model to name the communities; without it `cluster-only` auto-detects a model backend. A failed extract runs no report. A failed report is, in init, a `failed` line in the Summary with Graphify's reason, after the extract's `ran`; in the daemon, a failed run (`graph.update_failed`) whose reason names `cluster-only`. Either way the graph the extract wrote is kept. The vault already projected `graphify-out/GRAPH_REPORT.md` after a successful run (ticket 10), so it now gets `90-Graphify/GRAPH_REPORT.md`.

Checked by hand against the real Graphify on this machine, in a scratch directory with no API key in the environment (`env -i HOME=$HOME PATH=$PATH`): `extract . --code-only` wrote `graph.json` and no report, and named `cluster-only` as the step that writes it; `cluster-only . --no-label` then wrote `GRAPH_REPORT.md` and `graph.html` and exited 0.

Answered without the owner, as the smallest the ticket allows:

- `graph.html` is still written: only `--no-label` departs from Graphify's own `graphify cluster-only <path>`; `--no-viz` would also delete a `graph.html` the owner may have.
- The ten-minute ceiling (`GRAPH_RUN_TIMEOUT_MS`) holds per Graphify step, so one run with its report can take up to twenty minutes.
- A failed report is not retried until the default branch moves, as a failed extract is not; until then `builtFrom` stays on the last run that built both.

The real run through the daemon into an Obsidian vault is epic 8's exit demonstration, ticket 12. A short check for the owner, after a merge to `main` in a registered project with Graphify, the daemon running and a vault set:

```sh
ls graphify-out/GRAPH_REPORT.md
ls "<vault>/Projects/<Project>/90-Graphify/GRAPH_REPORT.md"
```

### Review

Reviewed against `main` on both axes, with the code review skill's sub-agents.

- **Standards**: no hard violation. Fixed: the daemon's run function, which now extracts and builds the report, is named `build` rather than `extract`; the `ponytail:` ceiling comment and `03-external-tools.md` say the ten-minute ceiling holds per step; `GRAPH_CLUSTER` keeps the import's alphabetical order; a missing space in a test signature. Kept: the command line `graphify <args>` is built in each place it is shown, as it was before; the daemon prefixes only a report failure's reason with its command, so an extract failure's reason reads as it did.
- **Spec**: every criterion holds. Fixed: init's failed-report line says the daemon builds the report with its next graph run, not at its next poll. Kept: a failed report waits for the next move of the default branch, as a failed graph step does today, which is what the ticket asks; the per-step ceiling, recorded above. Left: the live run into a vault, to ticket 12.
