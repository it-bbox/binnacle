# 06: Conflict risk between Tasks

Status: READY
Triage: ready-for-agent
Blocked by: 05
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** the impact and conflict analysis beside the parallel limit. A pure function in the core package, beside the Suggested step's, takes the graph's modules and edges and each ready or in-flight Task's touched files or ticket text. It returns each Task's modules and each pair's risk with its reason. A module is a file node of the graph, and its neighbours are the files one edge away. A Task with a branch touches the files its branch changed against the default branch, read through the Git adapter. A Task without one touches the modules its ticket names by path or by name (the owner, 2026-10-02). The risk of a pair is high when they share a module, which is named; medium when their modules are neighbours; low otherwise; unknown when either ticket names no module of the graph. The snapshot's `tasks.parallel` gains `impact`, marked `calculated`, or `available: false` with a reason when there is no graph. The Suggested step's `parallel` alternative is offered only for a Task whose risk with every Task in flight is low.

- [ ] With a fixed `graph.json`, two tickets naming the same module are high, naming that module.
- [ ] Two tickets naming neighbouring modules are medium.
- [ ] Two tickets naming unrelated modules are low.
- [ ] A ticket naming no module of the graph is unknown with any other, never low.
- [ ] A Task on a branch is read from its diff against the default branch, not from its ticket.
- [ ] Without a graph, `impact` is `available: false` with its reason, and the Suggested step is unchanged from today.
- [ ] The `parallel` alternative appears for a low pair and not for a medium, high or unknown one.
- [ ] Every module list and risk is labelled `calculated`.
- [ ] `docs/03-mcp-and-skills.md` describes `impact`; `CONTEXT.md` gains **conflict risk**.

## Comments
