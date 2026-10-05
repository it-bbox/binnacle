# Spec: Project Brain: tools, Graphify, Obsidian

Status: READY
Triage: ready-for-agent

Epic 8 of v1, as defined in `docs/05-mvp-plan.md` phase 8, from the owner's baseline (`docs/baseline.md`) and ADR-0034 to ADR-0036. Exit criterion, restated while specifying: on a fresh machine, one `binn init` and one yes leave a repository with the whole Standard setup installed and registered with every detected harness, and a first graph built; from then on the daemon keeps the graph and an Obsidian vault current as `main` moves, the snapshot says how fresh the graph is, and two ready Tasks come with a conflict risk before anyone starts them together. The phase was grilled on 2026-10-02 with epics 9 to 12; the three questions left for this spec were answered by the owner on 2026-10-02 and are recorded under *Further Notes*.

## Problem Statement

The owner's baseline promises a Standard setup: Matt Pocock Skills, Ponytail, Serena, Graphify, Context7 and ast-grep around every project, and Obsidian as the human view of the Project Brain. Epics 1 to 7 deliver a manifest flag and an audit finding for these tools, and nothing more. Today a developer adopting a repository has to find, install and register each tool by hand, for each harness, from each tool's own README. `binn init` reports what is missing and installs none of it.

Graphify, when someone installs it, builds a graph once and goes stale: nobody reruns it after a merge, and nothing says how old it is. The parallel limit in the snapshot counts free slots, but says nothing about whether the two Tasks that would fill them touch the same code, so the baseline's rule — only low-risk Tasks run in parallel worktrees — cannot be followed except by reading the tickets and guessing. And the owner has no human view of the Project Brain: the roadmap, the snapshot, the specs, the tickets and the ADRs are only readable as files in a repository or through an agent.

## Solution

**`binn init` installs the Standard setup.** In its one plan (ADR-0034) it proposes, for each of Matt Pocock Skills, Ponytail, Serena, Graphify, Context7 and ast-grep that is missing, the commands that install it and register it with every detected harness. MCP servers are registered through each harness's own CLI, outside the repository, as the `binnacle` plugin already is. A tool already installed or registered is reported and left alone. A tool the manifest declares `false` under `capabilities` is not proposed. A prerequisite init cannot install, such as `uv` for Serena and Graphify, is named with the command that installs it, and the tools that need it are left out of the plan. After the one confirmation, init runs the installs and reports each, adds Graphify's output directory to `.gitignore`, and builds the first graph.

**The daemon keeps the graph current** (ADR-0036). Once a minute it reads the commit of each registered project's default branch. When it has moved, and the registered checkout is on the default branch, the daemon runs Graphify's code-only extraction in the background: local syntax trees, no model, no network (ADR-0012). The snapshot gains a `graph` section: whether there is a graph, the commit it was built from, whether `main` has moved past it, and the last run's outcome. A failed run is an attention item, never a broken daemon. A project without Graphify sees the section marked not available, with the reason, as an incomplete Standard setup.

**Ready Tasks come with an impact and conflict analysis.** Beside the parallel limit, the snapshot and the dashboard show the modules each ready or in-flight Task touches and the risk of running two of them together. A Task with a branch touches the files its branch changed from the default branch. A Task without one touches the graph's modules that its ticket names, by path or by name. Two Tasks that touch a module in common are a high risk; two whose modules are neighbours in the graph, a medium risk; otherwise low. A Task whose ticket names no module of the graph is unknown, never guessed low. All of it is labelled as calculated. The Suggested step offers a second Task in parallel only when its risk with the work in flight is low, and autopilot never starts two Tasks together unless their risk is low.

**The daemon keeps an Obsidian vault in step** (ADR-0036). With a vault path set on this machine (decision 13), the daemon writes a one-way projection under `Projects/<Project>/`: Product, with the roadmap, the latest snapshot and the latest daily; Specs, with each spec and its tickets; Decisions, with the ADRs; Research, with the project's other docs; and `90-Graphify`, with the graph's report. Notes link to each other as Obsidian links. Every file the daemon writes is marked as generated, and it never touches a file it did not generate. The vault refreshes when `main` moves, and its Product notes when a snapshot or a daily is served. `binn init` proposes the vault path in its plan when it finds an Obsidian vault on the machine.

## User Stories

### Installing the Standard setup

1. As a developer adopting a repository, I want `binn init` to install what is missing of the Standard setup, so that I do not find, install and register six tools by hand.
2. As a developer, I want each install to appear in init's one plan as the exact commands it will run, so that I confirm what runs on my machine before it runs.
3. As a developer, I want one yes to cover the whole plan, installs included, so that setting up stays one question (ADR-0034).
4. As a developer, I want a tool already installed to be reported as found and left alone, so that init never reinstalls or downgrades what I have.
5. As a developer, I want a tool already registered with a harness to be left registered as it is, so that init never changes how I configured it.
6. As a developer, I want each tool's MCP server registered with every harness init detected, so that Claude Code, Codex, opencode and VS Code all reach it.
7. As a developer, I want the registration done through the harness's own CLI, at user scope, so that init edits no configuration file itself and the repository stays as it was.
8. As a developer using a harness that has no CLI for adding an MCP server, I want init to print the entry to add, so that I can finish by hand.
9. As a developer, I want Graphify's MCP server registered for this project only, where the harness has a per-project scope outside the repository, so that an agent in another project is not pointed at this project's graph.
10. As a developer, I want a prerequisite init cannot install, such as `uv`, named with the command that installs it, so that I know the one thing to do before running init again.
11. As a developer, I want the tools that need a missing prerequisite left out of the plan and named in the Summary, so that the plan never contains a command that cannot work.
12. As a developer, I want init never to download and run an installer script for me, so that nothing from outside a package manager runs on my machine without my reading it.
13. As a developer, I want each install's outcome in the Summary, so that I see which ran, which failed and which were skipped.
14. As a developer, I want one failed install not to stop the rest of the plan, so that a single broken tool does not leave the others missing.
15. As a developer who declared a tool `false` under `capabilities`, I want init not to propose it, so that a replaced part of the Standard setup stays replaced (ADR-0035).
16. As a developer, I want ast-grep detected by its own `ast-grep` executable, so that an unrelated `sg` on my PATH is never taken for it.
17. As a developer who declines the plan, I want nothing installed, registered or written, so that declining means what it says.
18. As a developer running init without a terminal, I want nothing installed, so that no install runs without a human to confirm it (ADR-0034).

### The first graph

19. As a developer, I want init to add Graphify's output directory to `.gitignore` in its plan, so that the graph never shows up as an untracked change.
20. As a developer, I want init to build the first graph after the installs, so that the project has a graph from day one.
21. As a developer, I want the first build to use Graphify's code-only extraction, so that it needs no API key and calls no model (ADR-0012).
22. As a developer, I want a failed first build reported in the Summary with Graphify's reason, so that I can fix it and let the daemon build it next time.

### The daemon keeps the graph current

23. As the owner, I want the daemon to update the graph when the default branch of a registered project moves, so that the graph is never more than a merge behind.
24. As the owner, I want the update to run in the background, so that no snapshot or dashboard call waits for it.
25. As the owner, I want the daemon to build from the registered checkout only while it is on the default branch, so that the graph never describes a ticket branch's work as `main`.
26. As the owner, I want one update at a time per project, with a move during a run followed by one more run, so that a burst of merges costs two runs, not ten.
27. As the owner, I want the daemon to refuse to run Graphify when its output directory is not ignored by Git, and to say so, so that the daemon never leaves untracked files in a repository (ADR-0036).
28. As the owner, I want a project that declares Graphify `false` to have no graph run, so that a replaced tool stays replaced.
29. As the owner, I want a daemon without `graphify` on its PATH to report the graph not available, with that reason, so that a missing tool is visible and nothing breaks.
30. As the owner, I want a failed update to be an attention item with Graphify's reason, so that I see it in the snapshot and on the dashboard.
31. As the owner, I want the graph to stay usable after a failed update, marked as behind, so that the last good graph is still worth reading.

### Graph freshness in the snapshot

32. As a Product session, I want the snapshot to say whether there is a graph, so that I know whether an agent can ask Graphify about architecture.
33. As a Product session, I want the commit the graph was built from and whether `main` has moved past it, so that I know whether its answers are current.
34. As a Product session, I want the last update's outcome and time, so that a failure is not hidden behind an old success.
35. As a Product session, I want the graph section marked not available with a reason when there is none, so that I can tell "not installed", "not built yet" and "not used" apart.
36. As the owner, I want the dashboard's Project page to show the same graph freshness, so that I see it without opening a chat.

### Impact and conflict analysis

37. As a Product session, I want each ready and in-flight Task's touched modules beside the parallel limit, so that I can judge whether two Tasks can run together.
38. As a Product session, I want a Task with a branch read from the files its branch changed against the default branch, so that work already done counts.
39. As a Product session, I want a Task without a branch read from the graph modules its ticket names by path or by name, so that I get an estimate before anyone starts it.
40. As a Product session, I want the risk of each pair of Tasks as high, medium, low or unknown, so that the answer to "can these run together" is one word with its reason.
41. As a Product session, I want a pair that shares a module rated high and the shared module named, so that I see why.
42. As a Product session, I want a pair whose modules are neighbours in the graph rated medium, so that indirect coupling is not missed.
43. As a Product session, I want a Task whose ticket names no module of the graph rated unknown, never low, so that no risk is guessed away.
44. As a Product session, I want every module list and risk labelled as calculated, so that it is never read as a fact a tool reported (ADR-0007).
45. As a Product session, I want the analysis marked not available when there is no graph, so that the parallel limit alone is not mistaken for a risk assessment.
46. As the owner, I want the Suggested step to offer a second Task in parallel only when its risk with the work in flight is low, so that Binnacle's advice follows the baseline's rule.
47. As the owner, I want autopilot to start two Tasks together only when their risk is low, so that the one process that starts agents in parallel follows the same rule.
48. As the owner, I want the dashboard's Overview to show the risk beside the parallel limit, so that I see it where I decide.
49. As the owner, I want the analysis never to block or start anything, so that the decision stays mine (manual-first).

### The Obsidian vault

50. As the owner, I want the daemon to keep a projection of each project's Project Brain in my Obsidian vault, so that I can read the project as linked notes.
51. As the owner, I want the vault path to be a per-machine setting outside every repository, so that my personal path is never committed (decision 13).
52. As the owner, I want `binn init` to propose the vault path in its plan when it finds an Obsidian vault on this machine, so that I set it with the same yes.
53. As the owner, I want init to say how to set the vault path when it finds none, so that I can set it later without reading the docs.
54. As the owner, I want each project under `Projects/<Project>/`, so that several projects share one vault.
55. As the owner, I want a Product folder with the roadmap, the latest snapshot and the latest daily, so that I see where the project stands.
56. As the owner, I want a Specs folder with each spec and its tickets, so that I can read the plan of an epic as notes.
57. As the owner, I want a Decisions folder with the ADRs, so that I can browse why things are as they are.
58. As the owner, I want a Research folder with the project's other docs, so that the rest of the Project Brain is there too.
59. As the owner, I want a `90-Graphify` folder with the graph's report, so that the architecture view sits beside the rest.
60. As the owner, I want links between notes to work as Obsidian links, so that the graph view and backlinks show how specs, tickets and ADRs relate.
61. As the owner, I want every generated note marked as generated, with the file and commit it came from, so that I can tell it from my own notes.
62. As the owner, I want the daemon never to touch a note it did not generate, so that my own notes in the same vault are safe (ADR-0036).
63. As the owner, I want a generated note whose source is gone to be removed, so that the vault does not keep deleted specs.
64. As the owner, I want my edits to a generated note overwritten at the next refresh rather than synced back, so that Git stays the canonical source and the rule is simple.
65. As the owner, I want the vault refreshed when `main` moves, so that it follows what was merged.
66. As the owner, I want the Product notes refreshed when a snapshot or a daily is served, so that they are as fresh as my last Product session without extra calls to the tracker.
67. As the owner, I want a vault path that does not exist or cannot be written to be an attention item, so that a moved vault is noticed.
68. As the owner, I want no vault path to mean no projection and no attention item, so that Obsidian stays optional per machine.

### Staying replaceable

69. As a developer, I want Binnacle's core to work with any of these tools missing, so that the Standard setup is a default, not a requirement (ADR-0035).
70. As a developer, I want deleting the graph directory or the vault folder to lose nothing, so that both stay derived and rebuildable.
71. As a developer, I want the daemon to write into a repository only the git-ignored graph directory, so that ADR-0020 still holds for everything else.

## Implementation Decisions

- **The tool table.** `binn init` gains one table of the Standard setup's tools, beside its harness table: for each tool, how it is detected (an executable on PATH, a plugin Claude Code lists, an MCP server already registered — the audit's capability reading, shared, not copied), its prerequisite, its install command, and its MCP registration per harness. Supporting another tool or harness is adding a row. The exact commands are taken from each tool's current docs through Context7 when the ticket is built, not fixed here.
- **Install channels.** Package managers and harness CLIs only: `uv tool install` for Serena and Graphify, npm for ast-grep, the Claude Code plugin CLI for Matt Pocock Skills and Ponytail where they ship as plugins, and each harness's `mcp add` for the servers. A harness or tool with no such channel gets its step printed. `uv` itself is never installed; it is named with its command. No `curl | sh`.
- **MCP registration scope.** User scope through the harness's own CLI (the owner, 2026-10-02), as the `binnacle` plugin already is. Graphify's server, which serves one project's graph, is registered at the harness's per-project scope outside the repository where one exists (Claude Code's local scope), and printed otherwise. Init writes no MCP entry for these tools into the repository.
- **The plan's order.** Prerequisite check before the plan; in the plan, after the existing writes: the installs, the registrations, the `.gitignore` append for Graphify's output directory, the vault setting, then the first graph build. Each item reports its own outcome; one failing does not stop the rest (as today).
- **The manifest.** A manifest init creates declares `capabilities` for each tool it installs or finds. A declared `false` is respected by init, the daemon and the snapshot. No new manifest key.
- **The per-machine settings file.** A new owner-only file in the Binnacle home, `settings.json`, holding `obsidian.vaultPath`. Init proposes it in the plan from Obsidian's own list of vaults when there is exactly one, or says how to set it. The daemon reads it on every refresh, so a change needs no restart. The `credentials.json` pattern is the precedent.
- **The graph runner in the daemon.** A poll once a minute per registered project reads the default branch's commit (`readDefaultBranch`, already used for run attribution). On a move, with the registered checkout on the default branch, the capability not `false`, `graphify` on the daemon's PATH and the output directory ignored by Git, it runs `graphify extract . --code-only` in the registered checkout, and after a successful extract `graphify cluster-only . --no-label` for Graphify's report, with no model (ticket 14), one run per project at a time, with at most one queued. The outcome — commit, time, success or Graphify's reason — is stored as an event, so it survives a restart and the snapshot reads it.
- **The snapshot's `graph` section**: `available`, with a reason when false; `builtFrom` (commit and time); `behind` (whether the default branch has moved past it); `lastRun` (outcome, time, reason). Attention items: `graph.update_failed` and `graph.not_ignored`. A missing tool is the section's reason, not an attention item.
- **The impact analysis.** A pure function in the core package, beside `suggestedStep`: given the graph's modules and edges, each Task's touched files or ticket text, it returns each Task's modules and each pair's risk with its reason. A module is a file node of the graph; its neighbours are the files one edge away. The daemon reads `graph.json` from the output directory and the branch diffs through the existing Git adapter. The snapshot's `tasks.parallel` gains `impact`, marked `calculated`, or `available: false` with a reason when there is no graph. The `parallel` alternative of the Suggested step is offered only for a Task whose risk with every Task in flight is low.
- **Autopilot** reads the same risk from the snapshot and starts a second Task only when the pair is low; otherwise it runs them one after the other.
- **The vault projection.** A daemon module that renders the Project Brain into `Projects/<Project>/` under the vault path: Product (roadmap, snapshot, daily as Markdown), Specs (`<slug>/spec` and `<slug>/<NN>-<ticket>`), Decisions, Research (the other Markdown under `knowledge.docs`), `90-Graphify` (Graphify's report). Each file carries frontmatter naming it generated by Binnacle, with its source path and commit; the daemon writes, rewrites and deletes only files with that marker. Relative Markdown links between projected files become Obsidian links. Writes are whole-file, to a temporary name then renamed. The source is the registered checkout's default branch as committed, read through the Git adapter, so a dirty checkout never leaks into the vault. Attention item: `vault.unwritable`.
- **The write guarantee.** The test that no operation writes into a repository allows exactly Graphify's output directory, and only when Git ignores it (ADR-0036).
- **The dashboard.** The Project page shows the graph section; the Overview shows the impact beside the parallel limit, in English and Russian. Read-only, as the rest.
- **No new dependency.** The settings file, the poll, the graph reading and the vault rendering are Node standard library. Graphify, Serena and the rest stay external tools, run as processes.
- **Documentation is updated with the code**: `docs/operations/03-external-tools.md` and `05-installation-checklist.md` (what init installs, the settings file, the vault), `docs/03-mcp-and-skills.md` (the snapshot's new sections), `CONTEXT.md` once the code uses the words, and the README with `README.ru.md` where they describe init.

## Testing Decisions

- **Two seams** (the owner, 2026-10-02):
  1. **The `binn` process**, as `apps/cli/test/init.test.ts` runs it: a temporary Git repository and home, a PATH holding only `git` and fake `uv`, `claude`, `codex`, `npm`, `graphify` and `obsidian`-less or Obsidian-configured homes. Tests check stdout, the exit code, the files written and the arguments each fake was called with.
  2. **A running daemon**, as `apps/daemon/test/snapshot.test.ts` and `write-guarantee.test.ts` start it: a fake `graphify` on PATH that writes a small `graph.json`, a commit made to the default branch, and the snapshot, the vault directory and the repository's files checked after the poll.
- **A good test checks what a person or an agent could see**: the plan text, the Summary, the files, the fake's recorded calls, the snapshot's JSON. Never the order of internal steps or a private function.
- **Init**: a missing tool is proposed with its command and installed after a yes; an installed one is left alone; a `false` capability is not proposed; a missing `uv` names its command and leaves Serena and Graphify out; a failed install is reported and the rest run; a declined plan and a non-terminal stdin run nothing; the vault path is proposed from a fake Obsidian vault list and written to the settings file only after a yes; `.gitignore` gains the graph directory; the first build calls `graphify` code-only.
- **The daemon's graph**: a move of the default branch runs one build; a checkout on another branch runs none; a burst of moves runs at most two; a not-ignored output directory runs none and is `graph.not_ignored`; a failing fake is `graph.update_failed` with the old graph kept and `behind` true; no `graphify` on PATH is `available: false` with its reason.
- **The impact analysis** is checked through the snapshot, with a fixed `graph.json` and tickets that name modules, one Task on a branch with a diff: shared module high, neighbours medium, unrelated low, a ticket naming nothing unknown; the Suggested step's `parallel` alternative appears only for low.
- **The vault**: the projection's folders and links; the generated marker; a human's note in the same folder left byte for byte; a deleted spec's note removed; a dirty checkout's uncommitted change absent; an unwritable path an attention item; no setting, no writes.
- **The write guarantee** is extended, not duplicated: `write-guarantee.test.ts` allows the ignored graph directory and nothing else.
- **No test reaches the network or runs a real installer.** Every external tool is a fake on PATH.
- **The exit demonstration**: the owner runs `binn init` in a repository of their own on a machine missing some of the tools, confirms the plan, merges a change to `main`, and sees the graph update, the snapshot's freshness, a conflict risk between two ready Tasks, and the vault in Obsidian.

## Out of Scope

- Installing `uv`, Obsidian, Node or a harness. Init names them and installs only tools.
- Graphify's semantic extraction, which calls a model (ADR-0012). The daemon runs code-only.
- Two-way sync with the vault, and any edit in the vault flowing back (ADR-0036).
- An Obsidian plugin, or configuring Obsidian itself.
- Running Graphify on ticket branches or in linked worktrees.
- Blocking, starting or reordering work from the conflict analysis. It advises.
- New audit checks for Ponytail, Matt Pocock Skills, ast-grep or Obsidian; epic 12 completes the audit.
- Skills that run `binn init` from the chat; epic 9.
- Roles suggested from the graph (Architect when many modules are touched); epic 11.
- A `Touches:` line in the ticket header: the owner chose the ticket text and the graph instead (2026-10-02).

## Further Notes

- **Decisions taken while specifying, by the owner on 2026-10-02**: tests at two seams, the `binn` process and a running daemon; a ready Task's modules read from its ticket text against the graph, a started Task's from its branch diff; MCP servers registered at user scope through each harness's CLI.
- **Defaults taken from the docs and Ponytail, not asked**: code-only extraction (ADR-0012); a one-minute poll rather than a filesystem watcher or a Git hook, which would write into the repository; the settings file in the Binnacle home, after `credentials.json`; no `uv` install (no installer scripts); one queued run per project; the vault read from committed `main`, never the working tree; Research holding the docs that are not the roadmap, ADRs or specs, since this repository has no research folder of its own.
- ADR-0035 and ADR-0036 are the decisions behind this epic. No new ADR is needed: the settings file and the poll implement decision 13 and ADR-0036 as written.
- Vocabulary for `CONTEXT.md`, once the code uses it: **conflict risk**, and the **vault projection**.
