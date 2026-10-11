# 04: A lean per-ticket process

Status: READY
Triage: ready-for-agent
Blocked by: 01, 02
Spec: `docs/specs/lean-flow/spec.md`

**What to build:** the per-ticket process, under autopilot and by hand, without the rituals epic 11's run paid for (spec, *Autopilot*, *The development workflow*, and the decisions after them). In autopilot's skill text, plugin and skills copy alike:

- the brief no longer asks the agent to edit the roadmap, and says not to; it no longer asks for the Review's commit order; it asks for a short Review (to fix in full, kept in one line each), short commit messages, a question with its options as ticket 02 describes, and a browser check only when the ticket changes the dashboard;
- step 8 drops the Review-order check; when `main` is not an ancestor of the branch, autopilot runs `git rebase main` in the agent's worktree, aborts and sends the branch back on a conflict, and after a clean rebase runs the typecheck and the full suite there, a failure being the one return to the agent;
- the frozen install, the plugin refresh with the skills copy's reinstall, the dashboard's regeneration and the daemon's restart move to the end of the run, after the last merge, each when one of the run's merges touched what it serves; the report says which ran, which were skipped and why, and which failed;
- the end of the run proposes the whole current focus, the epic's status and the Next action, written only on the owner's yes.

And in the documents: *Per ticket* in `docs/workflow/02-development-workflow.md` (last commit sets `DONE` and nothing in the roadmap, no Review order, the short Review and commits, browser only for dashboard tickets, upkeep by hand still per merge); the roadmap's *Keeping this current* (who writes the current focus and an epic's status); `AGENTS.md` (an English subject of at most 72 characters, a body only when needed, for every commit); `docs/agents/issue-tracker.md` (the short Review, the browser criterion only for dashboard tickets); and the checkpoint skill, which also offers the current focus as a candidate when the tickets' statuses moved past it. `CLAUDE.md`'s line on an implementation session moving the current focus goes too.

- [ ] The package build's test checks autopilot's text: no roadmap edit and no Review order in the brief; the rebase in step 8 and no Review-order check; upkeep at the end of the run; the copy matches the plugin.
- [ ] No document or skill still tells a ticket to edit the roadmap or to commit its Review before its fixes (a search over the repository finds none outside specs and tickets of past epics).
- [ ] `AGENTS.md`, the workflow, the roadmap's rules and the issue-tracker conventions say the same rules as autopilot's brief.
- [ ] The checkpoint skill offers the current focus as a candidate.
