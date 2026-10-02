# 02: binn init shows one plan and asks once

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** `binn init` works out every write it would make first, shows them together as one plan, and asks once for the whole plan (ADR-0034, which supersedes ADR-0026 in part). Enter accepts the plan when stdin is a terminal; `n` declines it and nothing is written; with stdin not a terminal nothing is written. The questions that are not about a write, the history import window and the choice of tracker, are asked before the plan, because the plan depends on them. Init still never overwrites a file, never commits, and extends a file only by a section the human has seen.

- [ ] Init shows every file, and every addition to an existing file, in one plan before it writes anything, and asks once.
- [ ] Enter at a terminal accepts the plan, and exactly the planned files are written.
- [ ] `n` declines it, and nothing is written.
- [ ] With stdin not a terminal, the plan is shown and nothing is written.
- [ ] The import window and the tracker choice are asked before the plan, and the plan reflects them.
- [ ] A write outside the repository, such as a user-scope harness configuration, is in the plan and covered by the same confirmation.
- [ ] The existing init tests are updated to the new prompts instead of kept beside them, and a test checks the no-terminal case.
- [ ] `docs/03-mcp-and-skills.md`, `docs/operations/05-installation-checklist.md` and any other doc that describes the per-write prompts are corrected in the same change.
