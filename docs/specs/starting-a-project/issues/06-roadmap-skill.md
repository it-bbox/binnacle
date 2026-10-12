# 06: /binnacle:roadmap, from a vision or an existing project

Status: READY
Triage: ready-for-agent
Blocked by: 03, 04
Spec: `docs/specs/starting-a-project/spec.md`

**What to build:** a skill of Binnacle's own turns a vision or a half-built project into a roadmap of epics (spec, *The roadmap skill*). `/binnacle:roadmap`, in the plugin and the skills copy as `binnacle-roadmap`, needs no daemon and picks its entry from the repository's history and source files, saying which. *New project*: it reads `<knowledge.docs>/vision.md`, or asks what, for whom and what is out, one question at a time, and writes the vision in the owner's words on their yes; then proposes the epics in dependency order, each with a line of scope. *Existing project*: it reads the code, `git log`, the docs and specs and `binn audit --json`, proposes the epics `done`, `in progress` or `not started` with their specs linked, a destination for each stranded document, moved only on the owner's yes, a stale one left unless the owner says delete, and a roadmap not in Binnacle's format rewritten into it, keeping its content. It writes the rows, a `## Epics` section with each line of scope, and a Next action that grills the first epic not done, and commits only what it wrote, on the owner's yes, never pushing. Run again, it proposes additions and reorders among epics not started, never touching a `done` epic or a row that links a spec. `/binnacle:help` lists it; `CONTEXT.md` defines *Vision*; the README's short paths, in both languages, and `docs/operations/01-new-project.md` and `02-existing-project-adopt.md` give both starts: `git init`, `binn init`, `/binnacle:roadmap`, `/binnacle:product`; and `binn audit`, `binn init`, `/binnacle:roadmap`, `/binnacle:product`.

- [ ] The skill is in the plugin, the skills copy and the help; the package build's test checks its two entries, the owner's yes before any write and commit, and that the copy matches the plugin.
- [ ] What it writes passes `roadmapGaps`: the roadmap stays in ADR-0025's format.
- [ ] `CONTEXT.md` defines *Vision*.
- [ ] `README.md` and `README.ru.md` give both short paths in that order, and the operations docs match them.
