# 07: `/product`, `/daily`, `/checkpoint` and the exit demonstration

Status: READY
Triage: ready-for-agent
Blocked by: 01, 06
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

**What to build:** a brand-new Claude Code session on this repository runs `/product` and `/daily` and understands the project without any earlier chat, then closes with `/checkpoint`. This is epic 2's exit criterion, demonstrated for real, and it retires the manual Product workflow this repository has used until now. Decided in the spec, under *Workspace* and *Further Notes*.

- [x] Three skills are committed in this repository's Claude Code skill directory, each containing procedure only and no project state:
  - `/product` detects the project, loads the snapshot, and presents it;
  - `/daily` requests the delta and presents it, including what can start next and the attention items;
  - `/checkpoint` prepares, drafts the promotions, waits for the human's confirmation, writes and commits them with the session's own tools, and then records.
- [x] None of the skills mutates anything unless the human asked (`docs/03-mcp-and-skills.md`).
- [ ] Demonstrated in a fresh session in the main checkout and in a fresh session in a worktree: `/product` → `/daily` → `/checkpoint`, and the worktree session's Git facts are the worktree's.
- [ ] Every defect the demonstration finds is filed as a ticket in this spec, not fixed in passing.
- [x] *This repository, until epic 2* is removed from `docs/workflow/02-development-workflow.md`, and `CLAUDE.md` stops pointing to it.
- [ ] The roadmap moves the current focus to ticket 08, and epic 2 stays `in progress` (ADR-0022).

## Comments

Found by the hand check of ticket 04, for the exit demonstration to confirm or fix:

- **A merge that adds a workspace package breaks the linked `binn` until the main checkout reinstalls.** Ticket 04 ran `pnpm install` in its own worktree only; after the merge, `binn --help` in the main checkout failed with `ERR_MODULE_NOT_FOUND` for `@binnacle/mcp` until `pnpm install --frozen-lockfile` ran there. The README says `pnpm install` once, before linking, and not after pulling.
- **The desktop app does not read `~/.bashrc`.** `pnpm setup` puts its global bin directory on PATH there, so a Claude Code desktop session could not find `binn` and `.mcp.json` would not start. A symlink from `~/.local/bin` does not help: pnpm's shim resolves the CLI relative to its own location, and through the link that resolves to `/home/Projects/...`. What worked is a two-line wrapper in `~/.local/bin/binn` that execs `$PNPM_HOME/binn`. The README's setup section should say one of these, or `binn` should stop depending on the shim's location.

- **What exists.** `.claude/skills/product`, `daily` and `checkpoint`, each with `disable-model-invocation: true`, so only a human starts them. `/product` calls `project_detect` then `project_snapshot`; `/daily` calls `project_detect` then `daily_get` once (with `since` when given an argument); `/checkpoint` calls `project_detect`, `checkpoint_prepare`, drafts, waits for the human, writes and commits on the current branch, then `checkpoint_record`. Each stops on a failed detect with the fix for the human, and runs nothing itself. *This repository, until epic 2* is gone: the per-epic and per-ticket rules now stand under *Standard task flow* → *On this repository* in `docs/workflow/02-development-workflow.md`, beside one paragraph on Product work through the skills, and `CLAUDE.md` points there.
- **Dry run, not the demonstration.** The tool sequence each skill makes was driven through the real `binn mcp` over stdio against a daemon in a temporary `BINNACLE_HOME`, from this ticket's worktree: detect, snapshot (no attention item, focus not truncated), `daily_get` twice (the second empty), `checkpoint_prepare` (fallback `no_baseline`) and `checkpoint_record` with `[]` and with an uncommitted and a missing path (both diagnostics). The skills themselves were not run by a model; that is the demonstration below.
- **Epic 2 does not end here (ADR-0022).** The owner's ADR-0022 added ticket 08, `/autopilot`, blocked by this one, so this ticket no longer closes the epic: its roadmap criterion now moves the current focus to ticket 08 and leaves epic 2 `in progress`. A consequence of that ADR, not a decision of this ticket. It also resolves the clash this ticket's first review noted, between filing defects in this spec and marking the epic `done`: defects the demonstration finds are filed as tickets 09 onward, and an epic `in progress` with `READY` tickets raises no attention item.
- **Left open for the owner: where a Product commit lands.** `/checkpoint` commits on the current branch and shows that branch before anything is written. In the main checkout that is `main`, which the per-ticket rule forbids for tickets but nothing rules on for Product work.

### Exit demonstration script

Do it in this order; the second session's checkpoint closes the ticket.

**0. Before.**

1. Merge `feat/skills-and-exit` into `main` with a merge commit or a fast-forward, not a squash (a squash makes the next daily fall back as `baseline_diverged`, which is correct but noisy).
2. In the main checkout: `pnpm install --frozen-lockfile`, then `binn --help` answers (first finding above). `binn daemon status` shows it running; `binn project list` shows the main checkout registered.
3. `git status` is clean in the main checkout.

**A. Fresh session in the main checkout** (new chat, no history).

1. `/mcp` shows `binnacle` connected. Typing `/` lists `product`, `daily` and `checkpoint`.
2. `/product`. Expect: checkout root is the main checkout, registered, branch `main`, the merge commit, clean. Epic 2 `in progress`; the current focus as written, not truncated, naming this script. Ready to start: `mcp-and-product-snapshot/07`. Counts: `DONE` for 01 to 06 and for epic 1, and `READY` 1 for ticket 08, which waits on 07. Five ADRs, ADR-0022 among them. Attention: none. Pending decisions, CI and usage named as unavailable. Check: only `project_detect` and `project_snapshot` were called, and `git status` is still clean.
3. `/daily`. Expect one `daily_get` call. If this machine never ran a daily, `fallback` is `no_baseline` and its message is quoted; otherwise the range starts at the last daily or checkpoint. Commits include this branch's; `readyToStart` shows 07; attention none. Run `/daily` again: one line saying nothing changed since the new head, plus attention and 07. Optionally `/daily <an older hash>`: a delta from there, and a following `/daily` is still empty.
4. `/checkpoint`. Expect `checkpoint_prepare` with no arguments; `targets` lists `vocabulary` → `CONTEXT.md`, `trade_off` → `docs/adr`, `new_work` → `docs/specs`, `product_rule` → `docs/specs`, `position` → `docs/roadmap.md`. This session decided nothing, so it says there is nothing to promote and asks whether to record an empty checkpoint. Check it writes nothing before you answer. Answer yes: `checkpoint_record` with `[]`, `head` equal to `main`'s HEAD, no diagnostics, nothing committed.

**B. Fresh session in a worktree.** The desktop app's worktree session, or `git worktree add .claude/worktrees/exit-demo -b feat/exit-demo` and a session there.

1. `/product`. Expect: checkout root is the worktree's path, `registered: false`, branch and commit the worktree's own. Compare with `git -C <worktree> branch --show-current`, `git -C <worktree> rev-parse HEAD` and `git -C <worktree> status --short`; they must match, and differ from the main checkout's branch. This is the "worktree Git facts are the worktree's" check.
2. `/daily`. Expect the range to start at A's checkpoint head (source `checkpoint`), and nothing changed.
3. `/checkpoint`. Tell the session what the demonstration found: each defect, including the two findings above if you judge them defects, as a new ticket in this spec, numbered from 09 (`new_work`), and the position: this ticket's `Status: DONE` with its last criteria ticked, and the current focus moved to ticket 08, run through `/autopilot` or a fresh session, with epic 2 left `in progress` (`position`). Check the drafts show type, file, exact text and the worktree's branch, and that nothing is written before you confirm. Confirm: the session writes, commits only those files on the worktree's branch, then records. Expect `head` equal to that new commit and no diagnostics.
4. Merge that branch. Its checkpoint commit is the ticket's `DONE` commit and stays last. A `/product` in the main checkout afterwards shows epic 2 `in progress`, ticket 08 ready to start, any new tickets 09 onward, and no attention item.

### Review

`/code-review` ran against `main` on both axes.

**Standards: one hard violation, fixed.** Findings:

1. The roadmap's next action pointed at a script this ticket did not hold yet, and the ticket had no `### Review` or ticked criteria. **Fixed**: this commit adds them.
2. `/product` listed pending decisions, CI and usage as unavailable by name, which is project state that epic 4 will make wrong. **Fixed**: it names whatever the snapshot marks `available: false`.
3. `/product`'s fallback named `docs/roadmap.md`, and `/checkpoint` named `docs/agents/issue-tracker.md`: this repository's layout, not procedure. **Fixed**: generic wording.
4. `/daily` and `/checkpoint` handled a failed detect "as `/product` does", which a skill run alone cannot see, and dropped two of its cases. **Fixed**: each carries the same full step.
5. `/daily` records a baseline. **Kept**: that is what running it asks for, it says so, and `docs/03-mcp-and-skills.md` lists `daily.get` as a controlled mutation.
6. `/product` and `/daily` repeat the same closing "change nothing" line. **Kept**: skills must stand alone.

**Spec: no blocking findings.** Findings:

1. The retired Product paragraph's manual checkpoint, for a stopped daemon, was lost in the move. **Fixed**: the workflow doc says to promote by hand, and `/checkpoint` offers to when detect fails.
2. `/daily`'s one-line "nothing changed" could drop the attention items and what can start next. **Fixed**: it keeps both.
3. `/daily` attributed every null list to the tracker; `roadmap` and `decisions` are null for their own reasons. **Fixed**.
4. `/checkpoint` commits on the current branch, which may be `main`. **Left** for the human; see above.
5. The demonstration, the defects it files, and the focus moved to ticket 08 are not done here. **Left**: they need the human, and the script above covers them.
