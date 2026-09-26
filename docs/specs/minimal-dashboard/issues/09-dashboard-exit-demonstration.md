# 09: The exit demonstration

Status: DONE
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** epic 5's exit criterion, demonstrated by the owner on their running daemon: the next step is taken from the dashboard alone. Decided in the spec, under *Further Notes*.

- [x] `binn dashboard` opens the main screen, which shows this repository's position, its Next action and the Suggested step.
- [x] The owner starts this ticket by copying a command the dashboard shows into a fresh session, without asking an agent what to type. The command may be the Next action's, the Suggested step's, or the ticket's own.
- [x] Within one refresh, this ticket's card is In progress, read from runs, and names that session's harness and model.
- [x] The Usage page's figures equal `usage_get`'s for the same window.
- [x] Every element that is not available gives its reason.
- [x] Once this ticket is merged, its card is Done.
- [x] The owner records under `## Comments` whether the dashboard answered "what do I type" at every step.
- [x] Defects are filed as tickets. The roadmap marks epic 5 done only when none of them is open.

## Comments

- **Checked by the implementation session, 2026-09-26.** The session was started with `/mattpocock-skills:implement docs/specs/minimal-dashboard/issues/09-dashboard-exit-demonstration.md`, the command the Overview lists under *Ready to start* and the Task page under *Start it*. Whether the owner copied it from the dashboard is the owner's to record below. The session branched `feat/dashboard-exit-demonstration` from `main` at `49e1419`, then read the dashboard served by the daemon, `binnd` 0.1.0 on port 7717, generated after the last change to `apps/dashboard`.
  - **The main screen** shows *Epic 5, Minimal dashboard: in progress*, the Next action from the roadmap's current focus with `binn dashboard` and a copy button, and the Suggested step beside it: `minimal-dashboard/09` is being worked on, wait for it.
  - **In progress, from runs.** The first `task.list` after the branch was created put `minimal-dashboard/09` in *In progress*, source `runs`, with `claude-code`, `claude-opus-5-5`, implementation role, active. The Project page's board, *Running now* on the Overview and the Attention page, and the Task page's *Runs* say the same.
  - **Usage.** `usage.get` over the daemon's HTTP, which the Usage page calls, and `usage_get` over MCP, asked at the same moment, returned the same figures: 5,955 records, input 12,212, cached input 946,580,862, cache creation 27,485,239, output 5,373,216, reasoning 2,269,310 (partial), since 2026-06-29. The page, read a minute later, showed 5,963 records, since this session kept writing.
  - **Not available, each with its reason:** on the Task page, review usage and rework usage (their runs are not told apart from implementation runs) and questions and answers (not yet explicit artifacts); on the Project page, pending decisions and CI (not in this version of Binnacle); on the Usage page, cost (no artifact reports it, and a cost from a price table is left for later), and the Codex harness (no Codex session of this project was found).
  - **For the owner to judge as a defect:** the Overview's *Ready to start* still lists `minimal-dashboard/09` while the board, *Running now* and the Suggested step show it in progress. *Ready to start* is the snapshot's `tasks.readyToStart`, read from the ticket's state alone (`taskSections` in `apps/daemon/src/snapshot.ts`); only the board reads In progress from runs.
  - **Left to the owner:** that `binn dashboard` opens the main screen in their browser (the session opened the address `binn dashboard --print` gives), that the ticket was started from a copied command, the card reading Done once merged, the record below of whether the dashboard answered "what do I type" at every step, and any defects filed.
- **The owner's record, 2026-09-26**, given in this session:
  - **Started from the dashboard:** yes. The owner copied the command from the dashboard into a fresh session.
  - **Did the dashboard answer "what do I type" at every step?** Not entirely. The dashboard is in English only, which made it hard to follow; it needs i18n, with English and Russian to begin with. And it needs a design: today it is one long sheet of text.
  - **Ready to start listing a Task in progress** is a defect, filed as ticket 11.
- **What follows.** Ticket 11 keeps epic 5 `in progress`, with ticket 10. The dashboard's languages and its design change what the spec decided, English with no UI kit (*Further Notes*), so they are not filed as defects of this spec: they go to `/grill-with-docs` in a Product session, recorded in the roadmap's current focus.

### Review

None: this ticket changed no code, only this ticket, ticket 11 and the roadmap.
