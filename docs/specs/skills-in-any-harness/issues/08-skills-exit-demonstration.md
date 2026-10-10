# 08: The exit demonstration of epic 14

Status: DONE
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 09, 10
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** epic 14's exit criterion, demonstrated by the owner.

- [x] On the owner's machine with Codex, Antigravity and ZCode, `binn init` on a repository, confirmed once, names the three in its Summary.
- [x] `binnacle-product` in each of the three shows the Product Snapshot; in one of them without the `binnacle` MCP server, through `binn call`.
- [x] `grill-with-docs` and Ponytail are available in the three.
- [x] `binnacle-autopilot` in a harness without background agents in worktrees of their own refuses at its first step and changes nothing.
- [x] Claude Code installed afterwards, `binn init` again: Claude Code lists `/binnacle:product` once, and no `binnacle-product`.

## Comments

- On 2026-10-09 the owner ran part of the demonstration, with Antigravity left unverified, as agreed for this epic and for epic 10's 15:
  - **Criterion 1 holds.** `binn init` on this repository named Antigravity, Codex and ZCode in its Summary. Each `skills add` was `ran`, with `failed <set> for a harness: PromptScript does not support global skill installation` beside it, and `~/.claude/skills` held no symlink afterwards. This also confirms ticket 10.
  - **Criterion 2, partly.** Codex showed the Product Snapshot. ZCode reached the daemon through `binn call`, since it has no `binnacle` MCP server. ZCode's `binnacle-product` itself is still to show.
  - **Criterion 3 holds** on disk. `grill-with-docs` and `ponytail` are in `~/.agents/skills`, which Codex and Antigravity read, and in ZCode's `~/.zcode/skills`.
  - **Criterion 4 failed in ZCode.** It passed autopilot's first step without a worktree the harness creates (ticket 11). The criterion waits on 11.
  - **Criterion 5, partly.** After `binn init` no `binnacle-*` copy is left in Claude Code. It is still to show that `/` lists `/binnacle:product` once.
- On 2026-10-10 the owner showed the rest, with Antigravity left unverified as agreed, so every criterion is ticked for Codex and ZCode:
  - **Criterion 2 holds.** ZCode's `binnacle-product`, in a new task, showed the whole Product Snapshot: roadmap and current focus, Tasks ready to start, the runs, usage and attention items.
  - **Criterion 4 holds** once 11 was merged and the package's copy reinstalled. ZCode's `binnacle-autopilot 14` stopped at its first step: its agent tool starts background agents but takes no parameter that has the harness create the agent's worktree, and a worktree it would create itself does not count. It started nothing; `main`'s HEAD, `git status`, `git worktree list` and the branches were as before.
  - **Criterion 5 holds.** In a new Claude Code session, `/binnacle` listed each of the twelve `/binnacle:<action>` once, `/binnacle:product` among them, and no `binnacle-<action>`.
