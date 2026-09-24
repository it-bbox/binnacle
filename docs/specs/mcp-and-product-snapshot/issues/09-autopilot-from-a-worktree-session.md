# 09: `/autopilot` from a worktree session

Status: DONE
Triage: ready-for-agent
Blocked by: 12
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`, `docs/adr/ADR-0022-autopilot.md`

Found by ticket 07's demonstration and ticket 08's hand check.

**What is wrong:** the Claude Code desktop app opens a new session in a worktree under `.claude/worktrees/` by default. `/autopilot` needs the registered main checkout with `main` checked out, so from such a session it refuses — correctly, but with no way forward the owner can follow at a glance. It happened twice in one morning, and a demonstration session ran in a worktree without anyone noticing.

**What to build:** the smallest change that gets the owner from that refusal to a running autopilot.

- [ ] When `/autopilot` refuses because the session is not in the registered main checkout, it names the checkout it is in, the registered checkout's path, and exactly how to start a session there with worktree isolation off.
- [x] The refusal still starts nothing and changes nothing.
- [x] `/product` states plainly when the session is in a linked worktree rather than the registered checkout, so the owner sees it before running anything.

## Comments

- **What changed.** Two skill files, no code. `/binnacle:autopilot`'s step 2 now calls `project_status` first. When its `checkout.registered` is false, it stops before `git pull`, starts nothing, changes nothing, and names this session's checkout (`checkout.root`), the registered checkout (`project.path`), and how to start a session there: in the desktop app, **+ New session**, environment **Local**, that folder, the **worktree** option next to the branch name off; in a terminal, `cd <path> && claude` without `--worktree`. Without Binnacle it compares `git rev-parse --show-toplevel` with the first path `git worktree list` prints. `/binnacle:product` opens with one line when the snapshot's checkout is a linked worktree, naming both paths and that `/binnacle:autopilot` refuses there.
- **Test-first, as read here.** The facts both skills rely on are already pinned by the daemon's tests: from a worktree under `.claude/worktrees/` and from a sibling worktree, `project.status` answers `checkout: { root: <worktree>, registered: false }` with `project.path` the registered checkout (`apps/daemon/test/status.test.ts`), and `project.snapshot` does the same (`apps/daemon/test/snapshot.test.ts`). The skills are procedure text; as for tickets 07 and 08, a test of their wording would test nothing, so none was added.
- **Where the desktop steps come from.** Claude Code's desktop documentation: a new local session gets a worktree when the worktree option next to the branch name is selected. It says that option is off by default, while the finding here is that the app opened worktree sessions by default, so the option may persist from the last session. The skill tells the owner to turn it off either way. Whether the labels match the owner's app is the one thing only a human can check, so the first criterion stays unticked, with its script below.
- **`project_status` beside `project_snapshot`.** The check has to come before `git pull`, and step 3's snapshot after it, so step 2 makes its own read-only call rather than reuse a snapshot taken before the pull.
- **The roadmap's current focus** was already over the 2000 characters a fresh session sees; moving it past ticket 09 also brought it back under the limit.

### Hand check script

1. In the desktop app, start a new session on this repository with the worktree option on (or `git worktree add .claude/worktrees/hc-09 -b feat/hc-09` and `claude` there). Run `/binnacle:product`. Expect its first line to say the session is in a linked worktree at that path, not in the registered checkout, and that `/binnacle:autopilot` refuses there.
2. In the same session, run `/binnacle:autopilot`. Expect it to stop before `git pull`, with the worktree's path, the registered checkout's path and the steps to start a session there with worktree isolation off. `git status` in the main checkout and `git worktree list` are unchanged, and no agent started.
3. Follow those steps exactly as written. Expect a session whose `/binnacle:product` names the registered checkout and shows no linked-worktree line. Do not run `/binnacle:autopilot` there unless an epic is meant to run.
4. Clean up any worktree made in step 1: `git worktree remove .claude/worktrees/hc-09`, then `git branch -D feat/hc-09`.

Tick the first criterion here if the steps in 2 match the app and 3 lands in the registered checkout; correct the labels in `/binnacle:autopilot`'s step 2 if they do not.

### Review

`/code-review` ran against `main` on both axes.

**Standards: no hard violation; six judgement calls.** Findings:

1. "Registered checkout" beside "the main checkout", which the skills also use. **Left**: the spec's *Linked worktrees* and this ticket both say "registered", and renaming across the sibling skills is outside this ticket.
2. Exact desktop-app labels will go stale when the UI changes. **Kept**: the criterion asks for exactly how, and the desktop app is where the refusal happens; the terminal line stands beside it, and the hand check confirms the labels.
3. `/binnacle:product`'s new line repeats its **Checkout** bullet and restates `/binnacle:autopilot`'s precondition. **Kept**: the criterion asks for it before anything else, and the reason the owner needs to see it is that autopilot will refuse.
4. `project_status` duplicates `checkout` from the later snapshot. **Kept**: see *`project_status` beside `project_snapshot`*.
5. "Stop there: start nothing and change nothing" is redundant. **Kept**: it is the second criterion, said where it applies.
6. Without Binnacle, the first worktree path is the repository root, which differs from `project.path` for a project registered in a subdirectory. **Left**: without Binnacle there is no registration, and the repository root is the main checkout.

**Spec: all three criteria met; one partial gap, no scope creep.** Findings:

1. Without Binnacle, the fallback named the registered checkout but never compared it with this session's and refused. **Fixed**: it compares `git rev-parse --show-toplevel` with the first path `git worktree list` prints and refuses the same way.
2. A project registered in a subdirectory: the same as Standards 6. **Left**.
