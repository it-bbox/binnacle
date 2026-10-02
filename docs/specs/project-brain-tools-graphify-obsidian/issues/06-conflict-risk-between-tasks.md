# 06: Conflict risk between Tasks

Status: DONE
Triage: ready-for-agent
Blocked by: 05
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** the impact and conflict analysis beside the parallel limit. A pure function in the core package, beside the Suggested step's, takes the graph's modules and edges and each ready or in-flight Task's touched files or ticket text. It returns each Task's modules and each pair's risk with its reason. A module is a file node of the graph, and its neighbours are the files one edge away. A Task with a branch touches the files its branch changed against the default branch, read through the Git adapter. A Task without one touches the modules its ticket names by path or by name (the owner, 2026-10-02). The risk of a pair is high when they share a module, which is named; medium when their modules are neighbours; low otherwise; unknown when either ticket names no module of the graph. The snapshot's `tasks.parallel` gains `impact`, marked `calculated`, or `available: false` with a reason when there is no graph. The Suggested step's `parallel` alternative is offered only for a Task whose risk with every Task in flight is low.

- [x] With a fixed `graph.json`, two tickets naming the same module are high, naming that module.
- [x] Two tickets naming neighbouring modules are medium.
- [x] Two tickets naming unrelated modules are low.
- [x] A ticket naming no module of the graph is unknown with any other, never low.
- [x] A Task on a branch is read from its diff against the default branch, not from its ticket.
- [x] Without a graph, `impact` is `available: false` with its reason, and the Suggested step is unchanged from today.
- [x] The `parallel` alternative appears for a low pair and not for a medium, high or unknown one.
- [x] Every module list and risk is labelled `calculated`.
- [x] `docs/03-mcp-and-skills.md` describes `impact`; `CONTEXT.md` gains **conflict risk**.

## Comments

### For the next tickets

- The analysis is `conflictRisk` in `packages/core/src/impact.ts`, with `moduleGraph`, which reads `graph.json`'s node-link form (`nodes`, and `links` or `edges`), and `pairRisk`. The daemon's side is `impactSection` in `apps/daemon/src/graph.ts`, which the snapshot calls with every Task in flight and ready to start (`taskSections(...).inFlightAndReady`, none left out by the section limit).
- The snapshot gives `tasks.parallel.impact`: `available: false` with a reason, or `tasks` (`id`, `modules`, `from`: `branch` or `ticket`) and `pairs` (`tasks`, `risk`, `modules`, `reason`), each labelled `calculated`. Ticket 07 reads a pair's `risk` there; ticket 08 shows it beside the parallel limit.
- `suggestedStep` takes an optional `impact`; null keeps the parallel limit alone, as before.
- The Git adapter gained `readChangedFiles`, `git diff --name-only --no-renames -z <base>...<head>` over two hashes.

### Decisions taken here

- **A module is a distinct `source_file` of the graph's nodes**, a leading `./` dropped, and two modules are neighbours when an edge joins a node of one to a node of the other. Graphify's nodes are files and the symbols in them, each naming its file, so this reads "a file node and the files one edge away" on any node the graph has; edges inside one file are not neighbours.
- **A Task "has a branch" when its branch (`taskBranch`, as `task.get` names it) has changed files since it left the default branch.** A branch that does not exist, points at the default branch's commit, or has changed nothing yet is read from its ticket, so a Task just started is still estimated rather than unknown. Its modules are only the changed files that are modules of the graph; a branch that changes none is unknown with any other, as a ticket that names none is.
- **"By name" is the file name with its extension**, `graph.ts`, as a whole word; "by path" is the repository-relative path. The ticket's text is its title and its body, which stops at `## Comments`. A name such as `index.ts` names every `index.ts`, which errs towards a higher risk (`ponytail:` in the code).
- **Medium pairs name their neighbouring modules too**, not only high ones, so that the reason can be checked.
- **A `graph.json` that cannot be read as a graph** makes `impact` unavailable with that reason, as no graph does.
- **"Every Task in flight"** is every Task the board places In progress, not only those with an active run, so a Task paused mid-work still counts against a second one.

### Review

`/code-review` ran against `main` on both axes, its two sub-agents in the foreground.

**Standards: no hard violation; one comment gap and several judgement calls.**

- Fixed: the snapshot's comment on `impact` named only the graph's reason for being unavailable, not an unreadable `graph.json`.
- Fixed: `impactSection` restated the snapshot's `Unavailable` type; it now imports it.
- Fixed: names. `considered` is `inFlightAndReady`; a closure's parameter that shadowed the function `named` is `involved`; `lines` is `joins`.
- Fixed: every snapshot reads `graph.json` and runs two git calls per Task, uncached. Marked `ponytail:` with the upgrade, a cache by commit.
- Kept: `moduleGraph` reads `links` or `edges`, since NetworkX has written both.

**Spec: no missing requirement; every criterion met.**

- Fixed: a changed file was matched to the graph's `source_file` exactly, so a graph that wrote `./src/a.ts` would have left every branch unknown. A leading `./` is now dropped, and the test's graph writes one path that way. Absolute paths are not expected: Graphify writes `source_file` relative to the directory it runs in.
- Kept: `from`, the medium pair's `modules` and the unreadable-graph reason, which the spec does not name. See *Decisions taken here*.
- Left: autopilot (story 47) is ticket 07, the dashboard (story 48) ticket 08.
