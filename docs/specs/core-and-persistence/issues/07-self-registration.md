# 07: Binnacle registers itself

Status: READY
Triage: ready-for-agent
Blocked by: 03, 04
Spec: `docs/specs/core-and-persistence/spec.md`

**What to build:** the epic's exit criterion demonstrated on a real project rather than a fixture — this repository, which `docs/00-scope.md` names as project number one. Registering it is the first honest test of whether the operations answer anything worth having.

- [ ] A project manifest for this repository is committed, derived from the template and reflecting the local Markdown tracker it actually uses.
- [ ] `binn project register .` followed by `binn project status` reports this repository's real manifest facts and real Git facts.
- [ ] Stopping the daemon leaves this repository fully workable: Git, docs, ADRs, specs and tickets unaffected.
- [ ] The roadmap records epic 1 as done.
- [ ] Whatever the exercise reveals about the operations is either fixed here or filed as a ticket, not silently accepted.
