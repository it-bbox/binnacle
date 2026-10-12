# 06: /binnacle:roadmap, from a vision or an existing project

Status: DONE
Triage: ready-for-agent
Blocked by: 03, 04
Spec: `docs/specs/starting-a-project/spec.md`

**What to build:** a skill of Binnacle's own turns a vision or a half-built project into a roadmap of epics (spec, *The roadmap skill*). `/binnacle:roadmap`, in the plugin and the skills copy as `binnacle-roadmap`, needs no daemon and picks its entry from the repository's history and source files, saying which. *New project*: it reads `<knowledge.docs>/vision.md`, or asks what, for whom and what is out, one question at a time, and writes the vision in the owner's words on their yes; then proposes the epics in dependency order, each with a line of scope. *Existing project*: it reads the code, `git log`, the docs and specs and `binn audit --json`, proposes the epics `done`, `in progress` or `not started` with their specs linked, a destination for each stranded document, moved only on the owner's yes, a stale one left unless the owner says delete, and a roadmap not in Binnacle's format rewritten into it, keeping its content. It writes the rows, a `## Epics` section with each line of scope, and a Next action that grills the first epic not done, and commits only what it wrote, on the owner's yes, never pushing. Run again, it proposes additions and reorders among epics not started, never touching a `done` epic or a row that links a spec. `/binnacle:help` lists it; `CONTEXT.md` defines *Vision*; the README's short paths, in both languages, and `docs/operations/01-new-project.md` and `02-existing-project-adopt.md` give both starts: `git init`, `binn init`, `/binnacle:roadmap`, `/binnacle:product`; and `binn audit`, `binn init`, `/binnacle:roadmap`, `/binnacle:product`.

- [x] The skill is in the plugin, the skills copy and the help; the package build's test checks its two entries, the owner's yes before any write and commit, and that the copy matches the plugin.
- [x] What it writes passes `roadmapGaps`: the roadmap stays in ADR-0025's format.
- [x] `CONTEXT.md` defines *Vision*.
- [x] `README.md` and `README.ru.md` give both short paths in that order, and the operations docs match them.

## Comments

- Where the spec is silent: the skill stops without a manifest or a roadmap and sends the owner to `binn init`, which writes both; `[new | existing]` as its argument is how the owner switches entry. An epic `done` or `in progress` that has no spec keeps the Spec `—`, which the snapshot reports as `roadmap.spec_missing`; the skill says so beside it rather than inventing a spec. The format is pinned by the skill's example roadmap, which the package test passes through `roadmapGaps`; what the skill proposes is the exit demonstration's.
- `docs/03-mcp-and-skills.md` and the README's skill lists name `/binnacle:roadmap` and `binnacle-roadmap`; the plugin's description names it.

### Review

Against `main`, on the standards and the spec; the ticket names no role beyond the Developer and the Reviewer.

1. **Status from a spec's tickets** allowed `in progress` with every ticket closed, which the snapshot reports as `roadmap.status_mismatch`. **Fixed**: in *Existing project*, `done` exactly when it has tickets and all are `DONE` or `CANCELLED`, `in progress` while some are open, `not started` only with none.
2. **An epic `done` or `in progress` without a spec** raises `roadmap.spec_missing`. **Fixed**: the skill keeps `—` and says so beside it in the proposal.
3. **The format was checked only after writing** (spec: "which `roadmapGaps` checks before writing"), with nothing said when `binn` is missing. **Fixed**: the draft is checked against the format before it is shown; after writing, a failing `docs.roadmap` is fixed, shown and committed only on a new yes, and a missing `binn` is said.
4. **The vision was asked about twice**: written on a yes in *New project*, then shown again in *Writing*. **Fixed**: written once on its yes, committed with the roadmap.
5. **The command-fence paragraph's examples** differed from every sibling skill's. **Fixed**: `/binnacle:daemon start` and `binn daemon start`, as the others.
6. Step 1 names `/binnacle:init` inline. **Kept**: the fence paragraph above governs how it is given.
7. The example repeats the skeleton's two opening lines. **Kept**: the test runs the example through `roadmapGaps`, so a format drift fails.
8. A new skill touches six lists. **Kept**: the existing pattern, pinned by the tests.
9. The short-path diagrams are repeated in the operations docs. **Kept**: the ticket asks them to match; the test checks the order.
10. In the help, the roadmap bullet comes before *Planning*'s sentence on the grilling. **Kept**: it comes first in the order of work.
11. `01-new-project.md` keeps "invoke logical `/product`", and *Workflow tools* is unnumbered. **Kept**: the wording predates the ticket; the tools are `binn init`'s, not a step.
12. The test pins the example, not every rule. **Kept**: what the agent proposes is the exit demonstration's (spec, *Testing Decisions*).
