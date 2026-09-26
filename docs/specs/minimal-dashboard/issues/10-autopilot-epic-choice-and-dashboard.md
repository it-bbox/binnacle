# 10: Autopilot picks a sliced epic, and regenerates the dashboard it merges

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** two gaps the first autopilot run of epic 5 hit on 2026-09-26. Its step 3 chooses only the single epic `in progress`, but `/to-tickets` leaves an epic at `tickets`, so a run started right after slicing has no epic to choose; step 4 already accepts `tickets`. And after a merge that changes the dashboard, the daemon keeps serving the dashboard generated before it.

- [x] `.claude/skills/binnacle/skills/autopilot/SKILL.md`, step 3: without an argument, the epic is the single one `in progress`, or else the single one at `tickets`. None or several still stop and ask.
- [x] Step 7: when the merge changed `apps/dashboard` and this project is Binnacle itself, the session runs `pnpm dashboard:generate` in the main checkout, after any frozen install, and says so in the report.
- [x] `docs/specs/mcp-and-product-snapshot/issues/08-autopilot.md`'s record of the skill is left as history; `docs/workflow/02-development-workflow.md` changes only if it states the epic choice.

## Comments

- **No test.** The change is prose in one skill, which no test reads; the typecheck and the full suite (363 tests) pass on the branch.
- **The daemon needs no restart** after `pnpm dashboard:generate`: it reads the dashboard's files on every request (`serveStatic` in `apps/daemon/src/server.ts`), and sends HTML with `no-store`. Step 7 runs the generation only.
- **Criterion 3.** `docs/workflow/02-development-workflow.md`, the READMEs, `CONTEXT.md` and ADR-0022 do not state the epic choice (ADR-0022 already names `tickets` or `in progress`), so none changed. Ticket 08 of `mcp-and-product-snapshot` keeps its record as history.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violations; the commit's authorship holds.** Judgement calls:

1. **"The dashboard regenerated" is listed under *Waiting for the owner***, where the owner has nothing to do. **Kept**: it follows "a daemon restarted" in the same list, the report's place for what the run did to the owner's running setup.
2. **Duplicated code**: "(only when this project is Binnacle itself)" now appears twice in one bullet of step 7. **Kept**: the restart and the generation are separate conditions, each read on its own.
3. **Divergent change**: step 7's last bullet carries three triggers, install, restart and generation. **Kept**: at three sentences, splitting it adds structure for no gain.

**Spec: no gaps, no scope creep, nothing implemented wrong.** One note:

4. **A request that arrives while `nuxt generate` rewrites the directory may briefly get the page naming the command.** **Left**: it lasts a moment, and the spec asks for nothing more.
