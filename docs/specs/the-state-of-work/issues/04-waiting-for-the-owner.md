# 04: What waits for the owner, everywhere

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer

**What to build:** the snapshot's `pendingDecisions` section, replacing its placeholder, lists what only the owner can move: the unanswered questions, the Tasks in `READY_FOR_REVIEW`, and the `ready-for-human` Tasks ready to start (spec, *Waiting for the owner*). Each Task item of the snapshot gains `questions: { asked, unanswered }`. The daily carries the same section; `/binnacle:product` and `/binnacle:daily` present it; the vault's snapshot and daily notes carry it; the dashboard's project page shows it and the board marks a card with an unanswered question.

- [ ] Daemon tests: each of the three lists filled and empty, with the snapshot's limit and remainder, a question read from a branch named with it, and the section unavailable with the tracker's reason when Tasks cannot be read.
- [ ] Each snapshot Task item has `questions: { asked, unanswered }`.
- [ ] `daily_get` carries the section as of now; `daily.test.ts` covers it.
- [ ] `/binnacle:product` and `/binnacle:daily` (plugin and copy) present it as *Waiting for the owner*.
- [ ] The vault's snapshot and daily notes carry it; `vault.test.ts` covers it.
- [ ] The project page shows it in place of *Not available*, the board marks a card with an unanswered question; strings in English and Russian; checked in a browser.

## Comments

- **Where it lives.** `pendingDecisions`, `readQuestions` and `questionCount` are in `apps/daemon/src/snapshot.ts`, which the snapshot, the daily (`daily.ts`), the board (`board.ts`) and `task.get` (`task.ts`, whose `taskQuestions` is now `readQuestions` over one Task) share. Every Task's questions are read with one `git for-each-ref` over the local branches (`readBranches` in the Git adapter) and one read of the default branch's commit, then an ancestor check and a read of the ticket only for a Task whose branch exists, as ticket 02's Review asked. The vault's notes write the section in `vault.ts` (`waiting`); the project page and the board in `apps/dashboard/app/pages/project.vue`.
- **Decided here, where the spec does not say:**
  - **A Task item's `questions` is `null` on GitHub or GitLab**, where no question is read until ticket 05, rather than a count of zero, which would be a guess (ADR-0007). The section's `questions` list is unavailable there with the same reason as `task_get`'s, and the approvals and the owner's Tasks are listed.
  - **The questions list is cut at the snapshot's limit by question**, not by Task, in tracker order and then the ticket's.
  - **A `DONE` or `CANCELLED` Task's unanswered question is not listed**: no answer moves a closed Task, so it waits for no one. Its count and `task_get` still show it.
  - **The owner's Tasks are ready to start as the snapshot's Ready to start reads them**: `READY`, no Unmet dependency and no attributed run.
  - **The board's cards carry `questions` too** (`task.list`), since the board marks a card from it; the daily's own lists (`newTickets`, `readyToStart`) do not, as they are not the snapshot's Task items.
  - **The daily's section is read over the Tasks at HEAD**, as its other lists are, with their questions from an unmerged branch as the snapshot reads them.
  - **The dashboard's *Pending decisions* title becomes *Waiting for the owner*** («Ждёт владельца»), the section moves above the board, and the reason `questions` is unavailable on a remote tracker is translated, as the page's other known reasons are.
- **Test-first, as read here.** `apps/daemon/test/pending.test.ts` drives the snapshot against real repositories: the three lists filled from a branch and the checkout, a merged branch read from the checkout, the lists empty, cut at the limit with their remainders, and unavailable with the tracker's reason; `daily.test.ts` the daily's section on an empty delta and unavailable; `vault.test.ts` both notes; `board.test.ts` a card's count from its branch; `github.test.ts` the remote tracker; `i18n.test.ts` the new reason.
- **Verified in a browser.** The generated dashboard ran against a daemon on a temporary `BINNACLE_HOME` under this worktree's `.scratch/`, with `BINNACLE_PORT=0`, and a scratch repository there with three tickets: one `READY` whose unmerged `feat/asked` branch asks a two-line question, one `READY_FOR_REVIEW`, one `ready-for-human`. The project page showed *Waiting for the owner* with each in its list, the question with its branch, and the board marked the first card "1 unanswered question"; the same in Russian: «Ждёт владельца», «Вопросы без ответа», «Ждут одобрения», «Начать вам», «1 вопрос без ответа». The daemon was stopped, and the owner's daemon was not touched.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** The Git adapter's read-only contract holds (`readBranches` runs `for-each-ref` over the constant `refs/heads/`, added to the commands its header lists), ADR-0007 holds (`questions: null` and the unavailable section with its reason), and so do the authorship and the documentation's language. Findings, all judgement calls:

1. **Divergent Change**: `snapshot.ts` now reads Git for the questions (`readQuestions`), and `task.ts`, `board.ts` and `daily.ts` take them from it. **Kept**: `snapshot.ts` already holds the tracker's reading every one of them shares (`readTracker`, `readState`); `task.ts`, where `taskQuestions` lived, imports `snapshot.ts`, so the snapshot could not take it from there without a cycle, and a module of its own would be a fourth for one function.
2. **Duplicated Code**: the unanswered filter, `item.answer === null`, is written in `questionCount` and in `pendingDecisions`. **Kept**: one comparison each; a helper would be a third name for it.
3. **Duplicated Code**: the project page's questions column repeats the markup of the two Task columns. **Kept**: a question shows its text, its branch and an unavailable reason the Task columns have not; epic 16's redesign restyles the section.
4. **Duplicated Code / Primitive Obsession**: the page spells `PendingDecisions` and the card's question count by hand, as the daemon's types are. **Kept**: the dashboard spells the daemon's answers locally throughout, as ticket 03's Review kept for the brief.
5. **Mysterious Name**: `owner` for the `ready-for-human` Tasks ready to start, worded "The owner’s to start" in the vault, "Yours to start" on the page and "the human's to start" in the skills. **Kept**: `owner` is the spec's name for the list, and each surface words it for its reader.
6. **Speculative Generality**: the approvals' and the owner's items carry `questions`, which no surface reads. **Kept**: the ticket asks it of each Task item of the snapshot, and autopilot (ticket 11) reads the counts.
7. **A redundant check**: `questions &&` before `withStartAndParallel`, never falsy once `tasks` is read. **Kept**: TypeScript does not narrow `questions` from `listed`, and the check is what tells it.

**Spec: every criterion is implemented, with no scope creep beyond what *Comments* records.** Findings:

8. **The project page does not name an item's ticket**, where story 18 asks each item to name "its Task, its title and its ticket". **To fix**: the page shows the ticket's path beside each item.
9. **`/binnacle:daily`'s description does not say it presents what waits for the owner**, though its text does. **To fix**: the description says so.
10. **An unanswered question of a `DONE` or `CANCELLED` Task is listed**, and stays listed for good. **To fix**: a closed Task's question waits for no one, since no answer moves it; the list leaves out `DONE` and `CANCELLED` Tasks, while their counts and `task_get` still show the question. Decided here, under *Comments*.
