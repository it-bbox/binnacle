# 08: Status and detect from a linked worktree

Status: BACKLOG
Triage: needs-triage
Blocked by: None
Spec: `docs/specs/core-and-persistence/spec.md`

**What is wrong:** found by registering this repository (ticket 07). `project.status` and `project.detect` resolve a path to a project by directory containment and read Git facts at the registered path. A linked worktree is a second working directory of the same repository, with its own branch, HEAD and dirty state, and neither operation knows it exists.

- **A worktree inside the project reports another checkout's Git facts.** With a worktree on `tmp-wt-probe` at `.scratch/wt`, `binn project status` run inside it reported `feat/self-registration`, the branch of the main checkout. That is a wrong fact, not a missing one. Claude Code puts its own worktrees under `.claude/worktrees/`, inside the repository, so this is the ordinary case, not an exotic one.
- **A worktree outside the project is not found.** A worktree in a sibling directory answers `project.not_registered`, although Git knows exactly which repository it belongs to.

Both matter once something consumes them: epic 2's `project.detect` is called from wherever a harness started a session, and ADR-0018 identifies a run's project from its `cwd` and reads its branch from the reflog, which each worktree keeps separately. `docs/workflow/04-git-tracker-worktrees.md` makes task worktrees part of the intended workflow.

Open questions, to settle before this is `ready-for-agent`:

- Which checkout's Git facts does `project.status` report: the caller's worktree, the registered one, or both? The caller's is closer to what an agent session needs; the response shape then has to say which worktree it describes.
- Is a sibling worktree resolved to its project through Git's common directory, and does that make detect depend on Git for a case that is otherwise Git-free?
- A nested directory that is a separate repository, not a worktree, must keep reporting the project's own facts. Telling the two apart needs a comparison of Git common directories, which is an extra read-only `git` call per status.

Candidate for epic 2's `/to-spec`, which is where its first consumer is specified.

## Comments
