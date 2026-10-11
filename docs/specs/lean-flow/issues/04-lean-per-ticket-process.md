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

## Comments

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground. The ticket names no role beyond the Developer and the Reviewer. Neither axis found a hard violation or a missing requirement; the criterion 2 search finds nothing outside the specs.

To fix:

1. **"The one write you make besides a merge"** (`autopilot/SKILL.md`, opening): the upkeep, the worktree removal and the roadmap commit on the owner's yes write too. Fix: the one change to a branch besides a merge is step 8's rebase.
2. **Whether a conflict sent back spends the one return** (`autopilot/SKILL.md`, step 8; both axes): only a failure after a clean rebase is called the one return, so an agent could come back twice. Fix: sending a branch back for a conflict is that one return too, as before.
3. **The brief no longer asks to mark findings** (`autopilot/SKILL.md`, step 6): it says "fix or keep each", while the workflow and step 8 read each finding fixed, kept or left. Fix: the brief asks to mark each one so.
4. **"Nothing is left to edit afterwards"** (`02-development-workflow.md`, step 4): the current focus now lags until a Product session or a checkpoint. Fix: say nothing is left for the merge to edit, and who catches the focus up.
5. **Duplicated reader in the test** (`pack.test.ts`): the new `doc` helper repeats the README reader and `workflowText`. Fix: one `docText` beside `workflowText`, used by all three.

Kept:

6. The short-Review and commit wording repeats in `AGENTS.md`, the workflow, the conventions and the brief: each reader reads its own document, and the test pins them alike (criterion 3).
7. The conventions say `/to-tickets` writes the browser criterion only for dashboard tickets: the spec's story 27 asks the conventions to say so.
8. The checkpoint also offers the epic's status: the roadmap's rule has the checkpoint write it.
9. The workflow's paragraph on parallel branches says autopilot rebases itself: that paragraph says who rebases.
10. `CLAUDE.md`'s line is rewritten, not removed: it holds the durable rule that a ticket touches nothing in the roadmap.
