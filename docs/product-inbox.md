# Product inbox

Ideas the owner wants a Product session to weigh. None is decided: each goes to `/grill-with-docs` before it becomes a spec, a ticket, a *Later* item in `docs/roadmap.md` or a rejection, and is removed from here when it does (`docs/workflow/01-product-workflow.md`).

## Ideas from nick-vels/skills (2026-10-09)

**Planned on 2026-10-22:** ideas 1 and 2, and items 4 and 6 below, into epic 23; items 1, 2, 3, 5 and 8 into epic 22; item 7 into epic 21.

[nick-vels/skills](https://github.com/nick-vels/skills) is a single `/autopilot` skill that builds a project from a brief: rounds of questions at the brief's forks, a spec, tasks built by parallel agents, an offline HTML dashboard, and a final acceptance. It aims at an owner who reads neither the spec nor the code; Binnacle keeps the human in control of a long-lived project (ADR-0022). Two of its ideas could close a gap here, where a spec's link to its brief and its tickets is prose:

1. **Requirements traced end to end.** The brief is split into numbered requirements, recorded word for word. Every requirement has a section of the spec and a task, every task a requirement, which catches work nobody asked for, and only the owner can drop a requirement. Here a story of a spec could carry a number that its tickets and their criteria name, and the snapshot or `binn audit` could report a story with no ticket and a ticket with no story.
2. **Blind acceptance.** At the end, a separate agent checks the result against the owner's original words only, without the spec, so that what was lost on the way from brief to spec to tickets shows. Here an epic's exit demonstration could start from such a check against the grilling's record.

### Revisited on 2026-10-22, version 2.2.0

Versions 2.1.0 and 2.2.0 tuned the process by measuring their own runs (`docs/autopilot/design.md`, `tools/measure-run.py`). Both ideas above gained a detail: commits carry a `Requirements: R02` trailer, so `git log --grep="R02"` finds every change a requirement caused, and the blind acceptance runs from a clean clone, which catches an unrecorded dependency or a step only this machine knows. What else could apply here, the cost levers first:

1. **A model per ticket.** A ticket says `Model: strong` or `ordinary`, and an ordinary one runs on a cheaper model. In the week to 2026-10-22, 1795 of Binnacle's 1797 usage records were `claude-opus-5-5`. A `Model:` line that `/binnacle:autopilot` passes to the agent it starts may be the largest saving available; usage by Task shows it.
2. **Review where it pays.** Their review took up to half a run's spend. Now a point review runs only for the foundation ticket and tickets whose own code is sign-in, keys, money or deleting data, after the commit and without holding the next tickets, and one review of the whole branch runs at the end. Review fell by 51%. Here every ticket is reviewed before `DONE`; in the same week review and rework took about 26% of cached input, rework (47M) more than review (37M). Measure per epic before changing anything.
3. **Ticket size by volume.** About 3,000 changed lines per agent, at most 12 tickets per run: every ticket is a cold start of 60–100K tokens or more, and a fine cut buys spend, not safety. Binnacle has 220 tickets over 19 epics, each a fresh session; usage by Task can show what a cold start costs here.
4. **A short return contract with a red proof.** An agent reports in at most 25 lines: status, files, tests, interfaces, concerns, and `REDPROOF`, how each new test failed before the code, which shows it could fail at all. It fits `/binnacle:task run`'s report.
5. **A list of excuses and red flags** (`skills/autopilot/phases/rationalizations.md`), read on a failed gate and before the report: "the agent could not, I will finish it myself" and the like, each with why it fails.
6. **A depth checklist for a spec.** First run, empty, wrong input, failure, interruption, growth, permissions, aftermath. Material for *Binnacle's own planning skills* below.
7. **"Waiting for you" as a state.** Their dashboard's header changes colour when the run waits for the owner, and working time excludes the wait. Binnacle has `pendingDecisions`; the dashboard and the mod below could show it this way.
8. **Autopilot reads no full diff.** Their orchestrator sees only `--stat`, since a diff read on one ticket stays in its context for the rest of the run. `/binnacle:autopilot`'s step 9 reads `git diff main...<branch>`; scope and dependencies could be checked from `--name-only` and the lockfile alone.

Not to take: rounds of questions (the owner grills one question at a time), parallel agents in one working tree (a worktree each is safer), and a run the owner never watches (ADR-0022).

## A Binnacle mod for Claude Code (2026-10-11)

**Planned as epic 21 on 2026-10-22.**

**Decided by the owner on 2026-10-11: after the release**, in the roadmap's *Later*; kept here for its grilling.

Claude Code's mods (plugins of function hooks, 2.1.295) can draw a pane, a band above the prompt, the status line and toasts, add slash commands, and call the `binnacle` MCP server's tools themselves. The owner wants an optional Binnacle mod, off by default and switched on and off by the user, **after the release**:

- the status line per chat: the session's Task and role, its tokens and context;
- a *Waiting for you* band, shown only when there is something: unanswered questions, `main`'s CI failing, a stale Next action;
- a pane with a compact snapshot and buttons that put a command (`/binnacle:answer`, `/binnacle:autopilot`, `/binnacle:checkpoint`) in the prompt for the human to send;
- toasts on a change: CI failed, a question answered, context pressure.

Read-only and silent without the daemon; Claude Code only, beside the skills (ADR-0039); likely inside the `binnacle` plugin (ADR-0023, ADR-0027). A new surface, so an ADR first.

## Binnacle's own planning skills (2026-10-11)

**Planned as epic 23 on 2026-10-22.**

Planning runs on Matt Pocock Skills today: `/grill-with-docs`, `/to-spec` and `/to-tickets`, which `binn init` installs and the workflow depends on (ADR-0035). They are good and maintained, but the owner hears from developers that not all of them like these skills. After the release, Binnacle could ship its own skills for the same chain, written for its formats: grilling against the Project Brain, a spec, tickets with `Roles:`, dependencies and criteria, and whatever else planning needs. Not now: Matt Pocock Skills stay for v1. The owner, 2026-10-12, grilling epic 19: Binnacle should not ask its users to run someone else's skills for its own work. The ticket command comes first, `/binnacle:task run` in epic 19; planning follows after the release.

The course "Один как команда" already tells participants that planning uses Matt Pocock Skills for now and that Binnacle's own skills will come later, without a date. Its prompts and templates do not depend on either, so the switch would not break it.

## A smarter conflict risk (2026-10-12)

**Planned into epic 23 on 2026-10-22**, where `/to-tickets` is replaced.

The conflict risk beside the parallel limit reads a ready Task's modules only from the file names its ticket writes (`conflictRisk`, `packages/core/src/impact.ts`). Epic 19's tickets name commands and behaviour, not files, so every pair came out `unknown` and autopilot ran them one after the other. A new project gets the opposite: with no graph `impact` is unavailable, the number alone decides, and every ready ticket runs side by side whatever it touches. Neither is right.

Ways to weigh:

- `/to-tickets` writes the modules a ticket expects to touch;
- a ticket's commands and terms are matched to modules through the graph's labels, not only file names (`binn audit` → `apps/cli/src/audit.ts`);
- before the run, an agent estimates the touched modules, as a calculated reading;
- without a graph, a cautious fallback instead of a full parallel run.

## Stricter autopilot and review (2026-10-15)

**Planned on 2026-10-22:** ideas 1, 7 and 8 into epic 23; ideas 2, 3, 6, 9 and 12 into epic 22. Ideas 4, 5, 10 and 11 wait here.

Ideas to weigh, most useful first:

1. **A tests-first run before the developer.** A separate agent writes the ticket's acceptance tests from the ticket alone and proves they fail for the expected reason, a recorded expected-red, before any production code exists; the developer's run then makes them pass. Today tests-first lives inside the developer's own session, which can bend a test to fit its code.
2. **Hard stops for autopilot.** Binnacle shows runs per Task and the rework share but stops nothing. Past a threshold of rework runs, a ticket could stop under *Waiting for the owner* with its reason instead of another correction run; review iterations could have a cap, and every CI job one retry budget across runs.
3. **Classes of a red CI.** An infrastructure failure (runner lost, registry or network) is retried within the budget; a failed test is never retried, since a green rerun on the same commit is flaky evidence, not a pass; an unknown cause is treated as the change's. Binnacle reads a Task's CI; what autopilot does on red is not written down.
4. **A complexity gate in review.** A complexity reading of the touched code is recorded before development, and review checks it did not grow. A calculated reading that sits well beside Ponytail.
5. **Tests on the instructions themselves.** Checks over Binnacle's own skills and instruction files: a length budget for each skill description and for all of them together, a size limit for a router entrypoint, every reference file named with the condition that loads it, no procedure copied into two places. They would catch drift and duplication without a reviewer.
6. **Machine-readable markers.** `### Question` and `### Answer` are already parsed. A parsable first line for a Review's verdict, a stop and a rework, such as `REVIEW:<task>:<run>:<iteration>:<verdict>`, would make first-pass review acceptance and stop reasons exact, counted without a model.
7. **Delivery signals at slicing.** `/to-tickets` could ask whether a ticket changes a schema, stored data, an API or consumer contract, or background processing; such a ticket carries a rollout step.
8. **A check belongs to a role that can perform it.** Each check in a ticket names the role that performs it, and grilling asks whether that role can: a "before" screenshot can only be taken where the old version still runs, test accounts on a stage only by whoever administers it. A check handed to a role that cannot do it stalls the ticket.
9. **Do not rerun what is stale.** Autopilot already rebases a branch before merging. The same rule could cover any rerun: an artifact older than a threshold, or a branch behind `main`, is rebuilt first, and a failure of an old artifact is not reported as an unavailable environment.
10. **An external cause re-checks itself.** An item under *Waiting for the owner* with an external cause carries a checkable condition (the stage answers, `main`'s CI is green) that the daemon reads, and clears itself when it holds.
11. **Autonomy counts people, not only stops.** A Task finished without a stop can still have needed a person at several steps. An autonomy reading would count human interventions per Task.
12. **Stop reasons from facts.** An agent's explanation of why it stopped is often not the root. Stop reasons should come from what Binnacle reads (CI, runs, markers), and the agent's text stays text.

Not to take: running without a human by default, which ADR-0022 rules out; and a fixed pipeline of roles for every Task, since roles are recommended per Task.

## Derived roadmap state without a yes (2026-10-16)

**Planned into epic 20 on 2026-10-22.**

The owner leans towards it, but wants the options weighed first. Today a Product session, a checkpoint or autopilot's end writes the roadmap only on the owner's yes (`docs/roadmap.md`, *Keeping this current*). After autopilot merged epic 12's tickets 01 to 10, the owner was asked to confirm an epic's status and the *Done* line, which follow from the tickets' statuses alone, beside the `Next action:`, which is a real choice of course.

Options to weigh:

1. **Write the derived part without a yes.** Autopilot and checkpoint set an epic's status (`tickets` → `in progress` → `done`) and the *Done* line from the tickets; the focus's prose and the `Next action:` stay on the owner's yes.
2. **Stop writing the derived part at all.** The snapshot and the dashboard already derive progress from the tickets; the table's status could be read the same way, leaving only `not started` and `spec` for the owner to write.
3. **Keep the rule.** One yes for the whole roadmap commit stays the cheapest check that nothing wrong reaches the text every fresh session reads first.

To decide: which statuses are truly derived (a `tickets` epic with one ticket merged; an epic whose last ticket is `ready-for-human`), and whether a commit to `main` with no yes fits the rule that a decision reaches the repository only once the owner confirms it.

## A shared sanitizer for manifest text in output (2026-10-16)

**Planned into epic 20 on 2026-10-22.**

From `audit-completed/05`'s Review (5): a manifest's `tracker.host` is quoted back through `JSON.stringify`, which leaves C1 controls and bidi overrides in, and the tracker check already prints it the same way. One sanitizer for manifest values printed to a terminal would cover both. Low risk: the manifest is the user's own file.

## A session named so a person knows it (2026-10-21)

**Planned into epic 20 on 2026-10-22.**

The `context.pressure` item names a session by its UUID only. On 2026-10-21 the owner read "the Product session 13401315-… read 212007 tokens" as being about the session they were in, which had 121,781; the 212k one was another, started at 12:17. Naming the session by its start time and its latest activity, and saying when it is not the caller's own, would tell them apart. Epic 13's short reports may cover it; check there first.

## Wording left after epic 13 (2026-10-22)

**Planned into epic 20 on 2026-10-22.**

Found in epic 13's exit demonstration (`specs/human-output/issues/11-human-output-exit-demonstration.md`):

- `/binnacle:product`'s Russian report wrote "3 запуска… Две из них" (for "Два из них") and "по pull request'ам", an English term in a Russian line.
- The context-pressure attention item names the manifest key `telemetry.context_pressure.tokens`, which reads as technical in a Russian line; it also still names the session by its UUID only (*A session named so a person knows it*, above: epic 13 did not cover it).
- Reasons with no code reach a Russian vault in English, marked `(англ.)` as story 27 allows: the snapshot's alternative "Epic N (…) has Tasks ready to start…" (`packages/core/src/roadmap.ts`) and the graph's "graphify is not on the daemon's PATH…" (`apps/daemon/src/graph.ts`), whose `kind` core already words under `graph.unavailable`.

## TypeScript 7 (2026-10-22)

**Planned into epic 20 on 2026-10-22**, if its grilling keeps it there.

Dependabot's pull request #4 moves `typescript` from 5.9.3 to 7.0.2, the compiler rewritten natively. Its `check` failed on 2026-10-20, on a `main` since moved on: the typecheck passed, and one test failed, `apps/cli/test/autostart.test.ts:569`, "Windows: with autostart on, start and stop go through schtasks", which expected `/End /TN binnacle` among the calls and got none. Whether that is the new compiler emitting something differently or a timing flake is not known. A major compiler change is a decision of its own, not a dependency bump: rebuild the pull request on the current `main`, find the test's cause, and weigh what else changes, such as the dashboard's own `typescript` (`^5.9.0`), which `vue-tsc` runs on, and the build speed it promises. Until then the pull request stays open.

## The daemon's own version (2026-10-22)

**Planned into epic 20 on 2026-10-22.**

`binn daemon status` on the owner's machine, after the reboot of 2026-10-22, gave the daemon's version as 0.1.0 while 0.3.0 is released: the daemon reads `apps/daemon/package.json`, still 0.1.0, and only `apps/cli/package.json` carries 0.3.0. Whether the daemon installed from npm says the same is not checked.
