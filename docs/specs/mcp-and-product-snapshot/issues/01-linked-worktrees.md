# 01: Status and detect from a linked worktree

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

Formerly ticket 08 of epic 1 (`core-and-persistence`), found by registering this repository in its ticket 07 and moved here when epic 2 was sliced.

**What is wrong:** `project.status` and `project.detect` resolve a path to a project by directory containment and read Git facts at the registered path. A linked worktree is a second working directory of the same repository, with its own branch, HEAD and dirty state, and neither operation knows it exists.

- **A worktree inside the project reports another checkout's Git facts.** With a worktree on `tmp-wt-probe` at `.scratch/wt`, `binn project status` run inside it reported `feat/self-registration`, the branch of the main checkout. That is a wrong fact, not a missing one. Claude Code puts its own worktrees under `.claude/worktrees/`, inside the repository, so this is the ordinary case.
- **A worktree outside the project is not found.** A worktree in a sibling directory answers `project.not_registered`, although Git knows exactly which repository it belongs to.

**What to build:** an agent session started anywhere a harness may start it — the main checkout, a worktree inside the repository, a worktree beside it — detects the right project and gets the Git facts of the checkout it is actually in, labelled as such. This is what every later snapshot and daily in this epic reports as its Git section. Decided in the spec, under *Linked worktrees*.

- [ ] Inside a linked worktree under the repository, `project.status` reports that worktree's branch, HEAD and dirty state, not the main checkout's.
- [ ] The status response names the root of the checkout it describes and whether that checkout is the registered one.
- [ ] `project.detect` from a linked worktree outside the repository finds the project by matching Git's common directory against registered projects.
- [ ] Detect still tries directory containment first, with no Git call; Git is consulted only when no registered project contains the path.
- [ ] A nested directory that is a separate repository, not a worktree, keeps reporting the project's own Git facts.
- [ ] A project outside Git, or a machine with no `git`, still detects by containment and degrades exactly as in epic 1.
- [ ] Only inspecting Git commands are added; the adapter stays read-only by construction.
- [ ] Tests through the daemon seam use real `git worktree add` fixtures for all three cases.

## Comments
