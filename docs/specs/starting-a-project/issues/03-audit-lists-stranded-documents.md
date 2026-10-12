# 03: The audit lists stranded documents

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/starting-a-project/spec.md`

**What to build:** `binn audit` names the documents a project keeps outside Binnacle's places, so that an adoption forgets none (spec, *Stranded documents in the audit*). A new check, `docs.stranded`, in the `docs` area, lists from `git ls-files` the Markdown and text files outside Binnacle's places whose name or directory says a plan, a spec, a decision, a TODO, notes, a backlog, a design, an RFC, a PRD or a roadmap, and an ADR directory other than `<knowledge.docs>/adr/`. Binnacle's places are the root's README, licence, changelog, contributing and security files, the instruction files, `CONTEXT.md`, and under `<knowledge.docs>` its `roadmap.md`, `vision.md`, `product-inbox.md`, `specs/`, `adr/` and `agents/`. It is `ok` with none, otherwise `unknown`, each path in the reason and the recommendation to run `/binnacle:roadmap`. It writes nothing. `CONTEXT.md` defines *Stranded document*.

- [ ] Through `binn audit --json` on a fixture with a `TODO.md`, a `plans/` directory, a spec outside `docs/specs/` and a `doc/adr/`: each is listed, status `unknown`.
- [ ] A fixture with only Binnacle's places reports `ok`; untracked and ignored files are never listed.
- [ ] Two runs give the same answer, and the audit writes nothing.
- [ ] `CONTEXT.md` defines *Stranded document*.
