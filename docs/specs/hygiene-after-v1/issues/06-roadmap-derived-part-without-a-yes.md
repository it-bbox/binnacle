# 06: The roadmap's derived part written without a yes

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-v1/spec.md`
Roles: Developer, Reviewer

**What to build:** after an autopilot run, a checkpoint or a Product session, an epic's status from `tickets` on and the focus's *Done* line are right with no question to the owner (spec, *The derived part of the roadmap*, *Where the rule is written*). The writer takes progress and `roadmap.status_mismatch` from `project_snapshot`, or the tickets' `Status:` lines without the daemon, counts nothing itself, and commits `docs/roadmap.md` alone, on its branch, with a subject that says it is derived from the tickets, only when something changed, never pushed. The focus's other prose and the `Next action:` stay on the owner's yes, in a commit of their own; `not started` and `spec` stay a Product session's to write on that yes; a ticket still never touches the roadmap.

- [ ] `/binnacle:autopilot`'s report writes the derived part at the run's end without a yes, and still asks for the focus's prose and the `Next action:`.
- [ ] `/binnacle:checkpoint` writes a `position` draft that is only derived without a yes, and shows it as written.
- [ ] `/binnacle:product`'s guidance says the same for a Product session.
- [ ] The roadmap's *Keeping this current*, *Who writes what*, `docs/workflow/01-product-workflow.md`, `02-development-workflow.md` and `CLAUDE.md`'s *Project operating model* state the rule.
- [ ] In the package build's test, the three skills' texts and their copies carry it.
