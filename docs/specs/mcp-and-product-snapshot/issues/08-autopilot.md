# 08: `/autopilot`

Status: DONE
Triage: ready-for-agent
Blocked by: 07
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`, `docs/adr/ADR-0022-autopilot.md`

**What to build:** a human says `/autopilot` in a Product session, and the current epic's remaining tickets are implemented, verified and merged one after another — or side by side where nothing blocks them — until the epic is done or a question only the owner can answer stops it. The owner gets a push notification and, at the end, a report. Decided in ADR-0022. It is the procedure a Product session followed by hand for epic 2's tickets 06 and 07, written down.

- [x] `.claude/skills/autopilot/SKILL.md` is committed beside `/product`, `/daily` and `/checkpoint`, with `disable-model-invocation: true`, and contains procedure only.
- [x] It refuses to start unless the epic is planned: a spec and tickets exist and the roadmap has the epic at `tickets` or `in progress`. It never runs `/grill-with-docs`, `/to-spec` or `/to-tickets`, and never starts the next epic.
- [x] It picks tickets from the snapshot: `READY` with no Unmet dependency. Tickets with no blocking edge between them may run in parallel, each agent in its own worktree; one ticket never has two agents.
- [x] Each agent follows the per-ticket process: its own `feat/<slug>` branch, test-first, typecheck, `/code-review` on both axes, `### Review` recorded, criteria ticked, `DONE` in its last commit, no attribution lines.
- [x] Before merging, the session verifies the branch itself: typecheck and the full suite green in the agent's worktree, every criterion ticked, `### Review` present, `DONE` last, no attribution lines, no new dependency the ticket did not ask for, and a fast-forward onto `main`. A later parallel branch is rebased by its own agent first.
- [x] After a merge it pushes, removes the worktree and its branches, and brings the main checkout's dependencies up to date.
- [x] A question only the owner can answer stops the ticket it blocks and everything depending on it, sets nothing `DONE`, and sends a push notification naming the question. A question that blocks nothing is answered in the smallest way the spec allows and recorded in the ticket.
- [x] It also stops a ticket on failing checks, an unresolved review finding, a conflict that is not mechanical, or a change outside the ticket; unaffected tickets continue.
- [x] A step that needs a human — a hand check, `/checkpoint`'s confirmation, an exit demonstration — is prepared and left for the human, never simulated.
- [x] It never force-pushes, changes settings, touches another repository, or stops a daemon the human is running.
- [x] It ends with a report — what merged with its commits, what the reviews found, what waits for the owner — and a push notification.
- [x] Verified by hand once: `/autopilot` on a planned epic with at least two tickets runs them to merge, and a planted blocking question stops the dependent ticket and notifies.

## Comments

The overnight run of tickets 06 and 07 found two things this procedure must handle. A review sub-agent's report reached the Product session instead of the agent that requested it, and the agent waited; the session relayed it. And the retired manual workflow section also held the durable per-ticket rules, so retiring it had to move them rather than delete them — a ticket's text alone does not always say which parts of a document are temporary.

- **What exists.** `.claude/skills/autopilot/SKILL.md`, with `disable-model-invocation: true` and an optional argument naming the epic (default: the single epic `in progress`). *Start*: `project_detect` with the same failure step as the other skills; the main checkout with `main` checked out, clean and pulled; `project_snapshot`; refusal unless the epic is planned. *Loop*: one background agent per ready ticket of the epic (`isolation: "worktree"`) with a fixed brief; the session relays stray sub-agent reports, answers what the spec answers, verifies each finished branch itself, then `git merge --ff-only` in the main checkout, pushes, unlocks and removes the worktree, deletes both branches, reinstalls when the lockfile or workspace changed, and snapshots again. *End*: a final snapshot, `daily_get` with `since` set to the run's start (it records nothing, so the owner's next `/daily` is untouched), a report and a push notification. The session writes and commits nothing itself. `docs/workflow/02-development-workflow.md` gains one sentence: starting `/autopilot` is the approval for its agents and merges. `docs/03-mcp-and-skills.md` already listed the skill.
- **The overnight run's lessons, encoded.** Review sub-agents run in the foreground so their reports come back to the agent, and the session still relays any that reach it. A locked agent worktree is unlocked before removal. The merge is a fast-forward from the main checkout, not a fetch into a checked-out `main`. After a merge that changes the lockfile or adds a workspace package, the main checkout reinstalls. The brief forbids merging, pushing, touching `main`, attribution lines and touching the owner's daemon, stops the agent without `DONE` on a genuine product question, and tells it to move a retired section's durable rules rather than delete them.
- **The daemon criterion, as read here.** The skill never stops a daemon the human runs, with one exception the Product session asked for: when a merge changes the code of the Binnacle daemon itself — only on this repository — it restarts it (`binn daemon stop`, then `binn daemon start`) so the owner's daemon runs what was merged, and says so in the report. The criterion is ticked on that reading, and the owner confirmed it on 2026-09-24: the restart stays.
- **Choices the ticket left open.** A failed check goes back to the agent once before the ticket stops, as the standard flow's correction run does. A review finding marked left with a reason counts as resolved, as in every ticket so far. A criterion only a human can verify stays unticked, with its script under `## Comments`, and does not block the merge — the precedent of ticket 04, and of this ticket.
- **Not run by a model here.** The skill is procedure text, and as for ticket 07 a test asserting its wording would test nothing. The hand check below is the verification. It is left for the owner, to run at the end of the epic together with ticket 07's exit demonstration, as ticket 04's hand check was recorded after its merge; this ticket is `DONE` with that one box unticked.
- **For ticket 07's demonstration.** It was written when 08 was still `READY`. With 08 `DONE`, `/product` counts `DONE` for 01 to 06 and 08 and shows no `READY` ticket waiting; and its closing `/checkpoint` moves the current focus to epic 2's close, not to ticket 08. The roadmap's status mismatch appears only once 07 is `DONE` and the epic is still `in progress`, which that same checkpoint should resolve.

### Hand check script

Run it on a throwaway clone, so the merges and the push land nowhere real.

1. **Set up.** `git clone --bare <main checkout> /tmp/ap-origin.git`, then `git clone /tmp/ap-origin.git /tmp/ap-demo`. In `/tmp/ap-demo`: `pnpm install --frozen-lockfile`, `binn project register`.
2. **Plant an epic** in the clone: a roadmap row numbered 7, "Autopilot demo", at `not started`, its Spec cell linking `specs/autopilot-demo/spec.md` like the other rows; a short `docs/specs/autopilot-demo/spec.md`; and two tickets under its `issues/`, both `Status: READY`:
   - `01-note.md`: add one line to a new `docs/demo.md`. One criterion.
   - `02-flag.md`, `Blocked by: 01`: add a sentence to `docs/demo.md` saying whether a hypothetical `--color` option defaults on or off, and state that this choice is the owner's and in no spec — the planted blocking question.

   Commit to the clone's `main` and `git push`.
3. **Refusal.** A fresh Claude Code session in `/tmp/ap-demo`: `/autopilot 7`. Expect it to refuse, say the epic is not planned and name `/grill-with-docs`, `/to-spec` and `/to-tickets`, and start nothing. Set the row to `tickets`, commit and push.
4. **Run.** Another fresh session: `/autopilot 7`. Expect one agent for 01 only (02 waits on it); 01 verified, fast-forwarded and pushed to `/tmp/ap-origin.git`; its worktree and both branches removed. Then an agent for 02, which stops without `DONE`, and a push notification naming 02 and its question. Nothing depends on 02, so the run ends with a report — 01 merged with its commits and review, 02 waiting with its question, branch and worktree — and a second push notification.
5. **Check.** In the clone, `main` holds 01's `DONE` commit and nothing of 02, and `git -C /tmp/ap-origin.git log` matches. `git worktree list` still shows 02's worktree. This repository's main checkout is unchanged, and `binn daemon status` shows the same daemon, never restarted: the demo changed no daemon code. A `/daily` afterwards is not empty: the run's `daily_get` recorded nothing.
6. **Clean up.** `binn project unregister /tmp/ap-demo`, then delete `/tmp/ap-demo` and `/tmp/ap-origin.git`.

Tick the last criterion here if it passes; file what it finds as tickets in this spec, as ticket 07's demonstration does.

### Review

`/code-review` ran against `main` on both axes.

**Standards: two hard findings, one fixed and one kept.** Findings:

1. The skill names Binnacle's daemon, `BINNACLE_HOME` and a restart that only applies when the project is Binnacle, which the review read as project state. **Kept**: they are conditional procedure, not state, and every sibling skill already names `binn`; the restart is the Product session's explicit requirement, and without `BINNACLE_HOME` an agent's CLI run would write into the owner's daemon.
2. `pnpm install --frozen-lockfile` and "the CLI linked from it breaks" described this repository. **Fixed**: the step says "the project's frozen install", with pnpm's as the example, and gives the general reason. `feat/<slug>` and `### Review` are **kept**: they are conventions the workflow docs define.
3. The ticket had no `### Review`, ticked criteria or `DONE`. **Fixed** by this commit.
4. The brief repeats the authorship rules and per-ticket steps the agent also reads in the instruction files. **Kept**: the session verifies against the same list, and a brief must stand alone.
5. The stop conditions appear in step 7 and again in step 8. **Left**: step 8 is the one list, and step 7 only says where each arises.
6. The relay and the agent's own fallback covered the same failure twice. **Fixed**: the review's sub-agents run in the foreground, so their reports return to the agent, and the session relays any that still reach it.
7. "The worktree's own branch" was undefined. **Fixed**: "the branch the Agent tool created for the worktree".
8. The workflow doc's "steps 1 and 4" would go stale on renumbering. **Fixed**: it names the start and the merge.

**Spec: no missing requirement.** Findings:

1. The daemon restart departs from the daemon criterion's wording. **Kept**, as the Product session required; see *The daemon criterion, as read here*.
2. One retry on a failed check was not asked for. **Kept**: see *Choices the ticket left open*.
3. The run without Binnacle had no source for what changed. **Fixed**: it reads the log.
4. The epic can be named by argument. **Kept**: it defaults to the one `in progress`, and the refusal needs an epic to judge.
5. Step 7 passed a finding left with a reason while step 8 stopped on any unresolved one. **Fixed**: both say "left unresolved without a reason".
6. The agent's own fallback could race the session's relay and run the review twice. **Fixed**, with Standards 6.

### Hand check

Run on 2026-09-24 on a throwaway clone with a bare local origin, following the script above.

- `/autopilot 7` on the planted epic at `not started` refused, named the planning skills and started nothing.
- With the epic at `tickets`: ticket 01 was implemented, reviewed, verified, fast-forwarded and pushed to the throwaway origin, and its worktree and branches removed. Ticket 02 stopped on the planted `--color` question without `DONE`, its worktree kept. Both push notifications reached the owner. The owner's daemon kept its pid.
- The first attempt refused before reading anything, because the desktop app had opened the session in a worktree; that is ticket 09.
