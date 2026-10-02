# 08: The exit demonstration of audit and adopt

Status: READY
Triage: ready-for-human
Blocked by: 04, 05, 06, 07
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** epic 7's exit criterion, demonstrated by the owner. A large third-party repository stays post-v1 (`docs/00-scope.md`).

- [ ] `binn audit` on this repository gives a report the owner agrees with, with no gap that is not a real one.
- [ ] `binn audit` on a repository of the owner's own, one that has not run `binn init`, gives recommendations the owner agrees with, and the owner changes nothing because of the audit itself.
- [ ] `binn init` on that repository shows one plan, asks once, and Enter accepts it.
- [ ] The owner moves a Product session to another harness from the README section alone, without asking an agent what to type.
- [ ] The owner records under `## Comments` whether the audit is useful. Defects are filed as tickets, and the roadmap marks epic 7 done only when none is open.
