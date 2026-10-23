# 07: `/binnacle:roadmap` proposes epics from the product inbox

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-v1/spec.md`
Roles: Developer, Reviewer

**What to build:** `/binnacle:roadmap`, run again on a roadmap that lists epics, reads `<knowledge.docs>/product-inbox.md` too (spec, `/binnacle:roadmap`'s *Again*). Each entry not marked "Planned as epic N" or "Planned into epic N" is proposed as a new epic with its line of scope, as part of an existing `not started` epic, or named as left out, each with its reason. On the owner's yes, beside the roadmap's change, each entry taken gets `**Planned as epic N on YYYY-MM-DD.**` or `**Planned into epic N on YYYY-MM-DD.**` under its heading and stays in the inbox. *New project* and *Existing project* do not read it.

- [ ] The skill's *Again* reads the inbox, proposes, names what it leaves out, and marks the entries taken only on the yes.
- [ ] An entry already marked is never proposed again.
- [ ] In the package build's test, the skill's text and its copy carry it.
