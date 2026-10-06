# 12: The exit demonstration of epic 8

Status: DONE
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** epic 8's exit criterion, demonstrated by the owner.

- [x] The owner runs `binn init` in a repository of their own on a machine missing some of the tools, sees every install and registration in one plan, and confirms it once.
- [x] The tools are installed and reachable from Claude Code and Codex, and the first graph is built.
- [x] A change merged to `main` updates the graph, and the snapshot says it is current.
- [x] Two ready Tasks show a conflict risk the owner finds plausible, in the snapshot and on the dashboard.
- [x] The vault opens in Obsidian with the project's Product, Specs, Decisions, Research and `90-Graphify`, linked, and the owner's own notes untouched.
- [x] The owner records under `## Comments` whether the Standard setup is worth having as set up. Defects are filed as tickets, and the roadmap marks epic 8 done only when none is open.

## Comments

### Steps for the demonstration, 2026-10-03

Do epic 7's demonstration first: its preparation (refresh the plugin, pick repository A) and its step 3, `binn init` in repository A, are this demonstration's first step too. Then:

1. **One plan.** Check that the plan `binn init` showed in repository A held every install (Serena, Graphify, ast-grep) and every MCP registration, and that you confirmed it once.
2. **The tools are reachable.** Open a new Claude Code session in repository A and ask it which MCP servers it has: Serena, Context7 and Graphify should be listed. Ask Codex the same. Check that `graphify-out/` exists in repository A: that is the first graph.
3. **The graph follows `main`.** Make a small commit on `main` in repository A, such as a README edit, and wait a minute. Run `/binnacle:product`: it should say the graph is current.
4. **Conflict risk.** You need two `READY` tickets. The easiest way: ask an agent in repository A to create two small tickets that change the same file. Then look at `/binnacle:product` and at the dashboard (`binn dashboard`): the pair should show a conflict risk you find plausible.
5. **Obsidian.** Open the vault in Obsidian. It should hold Product, Specs, Decisions, Research and `90-Graphify`, linked, with your own notes untouched.
6. Under `## Comments`, write whether the Standard setup is worth having as set up. Tick each criterion that held; for one that did not, write one line on what went wrong, to become a ticket.

### The demonstration, 2026-10-05

Run by the owner on `it-bbox-site` (GitLab tracker), with a Product session alongside.

- Ticked: init showed one plan and was confirmed once, and the tools were installed and the first graph built. A commit on `main` (`8798779`) was picked up by the daemon, which rebuilt the graph from it; the snapshot's `graph.behind` was `false` and the dashboard's Project page said the main branch is on the graph's commit. Two GitLab issues, `#1` and `#2`, both naming `nuxt.config.ts`, were rated high risk, with that reason, in `/binnacle:product` and on the dashboard's Overview.
- Not ticked, the tools reachable from Codex: Claude Code had Serena, Context7 and Graphify connected; Codex had only Serena and Binnacle, because `codex` is not on `PATH` and init printed the other entries instead of running them, as designed. Serena's Codex entry uses Claude Code's context: ticket 16.
- Not ticked, the vault: with `obsidian.vaultPath` set in `~/.binnacle/settings.json` (it was unset: the owner had opened the repository itself as a vault, which showed Obsidian's own graph of every Markdown file, `node_modules` included), the daemon projected every registered project, with Product, Specs, Decisions and Research, generated notes marked as such. No `90-Graphify`: the code-only graph has no `GRAPH_REPORT.md`, ticket 14.
- Defects also filed: `/binnacle:product` does not show the graph's freshness or the risk, ticket 15; the dashboard shows the daemon's reasons in English on the Russian interface, ticket 17.
- The owner, 2026-10-05: all of the Standard setup is needed ("все нужно").

### The demonstration, 2026-10-06

The two open criteria checked again after defects 14 to 17 were merged, on `it-bbox-site`.

- Ticked, the tools reachable: Claude Code had Serena and Graphify connected (Context7 timed out once while `npx` fetched it). `codex` was on `PATH` and Codex listed Serena, now with `--context=codex` (ticket 16), Context7 and Binnacle, and Graphify, which the owner added to the repository's `.codex/config.toml` as init printed it, as designed. `graphify-out/` held `graph.json` and `GRAPH_REPORT.md`.
- Ticked, the vault: `~/Obsidian/Binnacle` opened in Obsidian with `Projects/it-bbox-site/` holding Product, Research and `90-Graphify/GRAPH_REPORT.md` (ticket 14); the links worked and the owner's own notes were untouched. `it-bbox-site` has no specs or ADRs, so it has no Specs or Decisions; Binnacle's own project in the vault has both.
- The owner, 2026-10-06, a remark and not a defect: every vault note is in English. A product wish for a Product session, a candidate for epic 13, Human output.
- No defect is open: epic 8 is done.
