# 07: `/product`, `/daily`, `/checkpoint` and the exit demonstration

Status: READY
Triage: ready-for-agent
Blocked by: 01, 06
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

**What to build:** a brand-new Claude Code session on this repository runs `/product` and `/daily` and understands the project without any earlier chat, then closes with `/checkpoint`. This is epic 2's exit criterion, demonstrated for real, and it retires the manual Product workflow this repository has used until now. Decided in the spec, under *Workspace* and *Further Notes*.

- [ ] Three skills are committed in this repository's Claude Code skill directory, each containing procedure only and no project state:
  - `/product` detects the project, loads the snapshot, and presents it;
  - `/daily` requests the delta and presents it, including what can start next and the attention items;
  - `/checkpoint` prepares, drafts the promotions, waits for the human's confirmation, writes and commits them with the session's own tools, and then records.
- [ ] None of the skills mutates anything unless the human asked (`docs/03-mcp-and-skills.md`).
- [ ] Demonstrated in a fresh session in the main checkout and in a fresh session in a worktree: `/product` → `/daily` → `/checkpoint`, and the worktree session's Git facts are the worktree's.
- [ ] Every defect the demonstration finds is filed as a ticket in this spec, not fixed in passing.
- [ ] *This repository, until epic 2* is removed from `docs/workflow/02-development-workflow.md`, and `CLAUDE.md` stops pointing to it.
- [ ] The roadmap marks epic 2 `done` and moves the current focus to epic 3.

## Comments

Found by the hand check of ticket 04, for the exit demonstration to confirm or fix:

- **A merge that adds a workspace package breaks the linked `binn` until the main checkout reinstalls.** Ticket 04 ran `pnpm install` in its own worktree only; after the merge, `binn --help` in the main checkout failed with `ERR_MODULE_NOT_FOUND` for `@binnacle/mcp` until `pnpm install --frozen-lockfile` ran there. The README says `pnpm install` once, before linking, and not after pulling.
- **The desktop app does not read `~/.bashrc`.** `pnpm setup` puts its global bin directory on PATH there, so a Claude Code desktop session could not find `binn` and `.mcp.json` would not start. A symlink from `~/.local/bin` does not help: pnpm's shim resolves the CLI relative to its own location, and through the link that resolves to `/home/Projects/...`. What worked is a two-line wrapper in `~/.local/bin/binn` that execs `$PNPM_HOME/binn`. The README's setup section should say one of these, or `binn` should stop depending on the shim's location.
