# Product inbox

Ideas the owner wants a Product session to weigh. None is decided: each goes to `/grill-with-docs` before it becomes a spec, a ticket, a *Later* item in `docs/roadmap.md` or a rejection, and is removed from here when it does (`docs/workflow/01-product-workflow.md`).

## Embeddings over the documentation (2026-10-07)

A sceptic proposed a vector store and RAG in place of Git and Markdown. Exact state stays in Git: a vector search returns a decision and the one that superseded it as equally similar. Search by meaning could still help in three places:

- **"Was this decided already?"** With 39 ADRs and over a hundred tickets, grep misses a decision worded differently.
- **Duplicate tickets.** A defect filed by a demonstration or autopilot could be checked against similar open tickets.
- **Checkpoint.** It must leave out decisions already written down; today that is the model's judgement.

An index over `docs/` would be a rebuildable local projection, which fits the principle that canonical knowledge lives in Markdown, but it adds a dependency, an embedding model, and so needs an ADR. Measure first: how often an agent finds the right ADR, and at what token cost, with and without it. If the difference is small, do not build it.

## Ideas from beads (2026-10-07)

[beads](https://github.com/steveyegge/beads) is an issue tracker for coding agents. A sceptic named it as already solving project state. What Binnacle could take, most useful first:

1. **An explicit claim of a Task.** `bd update <id> --claim` atomically sets the assignee and the in-progress state. Binnacle infers a Task in progress from its runs, so two sessions can take the same ticket despite the rule of one primary agent per Task.
2. **Ticket numbers that cannot collide.** beads uses hash ids such as `bd-a1b2`. Ticket numbers here are sequential, so two agents filing a defect at once both take the next number. A parallel autopilot run makes this real.
3. **Typed links.** beads has `supersedes`, `duplicates`, `relates-to` and discovered-from. Here they are prose: "Extends ADR-0011", "a defect found in epic 8's exit demonstration". Typed, the snapshot and the dashboard could show them.
4. **Summarising what is closed.** beads compacts closed issues into summaries. The roadmap's current focus grows with every epic and reaches a fresh session only up to 2000 characters; a short summary per done epic would keep it compact.
5. **beads as a tracker.** Binnacle reads Tasks from GitHub, GitLab and local Markdown; beads could be a fourth source.

Not to take: Dolt as the source of truth, since canonical knowledge lives in Markdown and Git and the database is a projection; and `bd remember`, an agent storing facts on its own, since here a decision reaches the repository only after the owner confirms it.

A one-command context dump like `bd prime` is already epic 14's `binn call` (`specs/skills-in-any-harness/spec.md`).

## Ideas from nick-vels/skills (2026-10-09)

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

**Decided by the owner on 2026-10-11: after the release**, in the roadmap's *Later*; kept here for its grilling.

Claude Code's mods (plugins of function hooks, 2.1.295) can draw a pane, a band above the prompt, the status line and toasts, add slash commands, and call the `binnacle` MCP server's tools themselves. The owner wants an optional Binnacle mod, off by default and switched on and off by the user, **after the release**:

- the status line per chat: the session's Task and role, its tokens and context;
- a *Waiting for you* band, shown only when there is something: unanswered questions, `main`'s CI failing, a stale Next action;
- a pane with a compact snapshot and buttons that put a command (`/binnacle:answer`, `/binnacle:autopilot`, `/binnacle:checkpoint`) in the prompt for the human to send;
- toasts on a change: CI failed, a question answered, context pressure.

Read-only and silent without the daemon; Claude Code only, beside the skills (ADR-0039); likely inside the `binnacle` plugin (ADR-0023, ADR-0027). A new surface, so an ADR first.

## Binnacle's own planning skills (2026-10-11)

Planning runs on Matt Pocock Skills today: `/grill-with-docs`, `/to-spec` and `/to-tickets`, which `binn init` installs and the workflow depends on (ADR-0035). They are good and maintained, but the owner hears from developers that not all of them like these skills. After the release, Binnacle could ship its own skills for the same chain, written for its formats: grilling against the Project Brain, a spec, tickets with `Roles:`, dependencies and criteria, and whatever else planning needs. Not now: Matt Pocock Skills stay for v1. The owner, 2026-10-12, grilling epic 19: Binnacle should not ask its users to run someone else's skills for its own work. The ticket command comes first, `/binnacle:task run` in epic 19; planning follows after the release.

The course "Один как команда" already tells participants that planning uses Matt Pocock Skills for now and that Binnacle's own skills will come later, without a date. Its prompts and templates do not depend on either, so the switch would not break it.

## Starting with Binnacle: a new project and an existing one (2026-10-12)

**Specified as epic 19 on 2026-10-12** (`docs/specs/starting-a-project/spec.md`). Gap 3 is closed differently from below: `binn init` writes the conventions `/setup-matt-pocock-skills` writes, so neither the setup nor a second init is needed (the owner, 2026-10-12).

**Decided by the owner on 2026-10-12: the next epic after epic 16, the most important of what is left.** The remaining epics follow by importance; what does not fit before the release on 2026-10-13 continues after it, in open source. The Product session that plans this epic adds its row to the roadmap and moves the order there.

The course "Один как команда" has to explain both starts, and today neither is a clear sequence. Traced on 2026-10-12 against `binn init`'s code, `binn audit`'s checks, the README and `docs/operations/`:

- **A new project** goes: a vision file, `git init`, `binn init`, a new session to approve `.mcp.json`, `/setup-matt-pocock-skills`, `/binnacle:product`, whose Next action is to grill "the first epic", then `/grill-with-docs`, `/to-spec`, `/to-tickets`, `/binnacle:task` or `/binnacle:autopilot`, `/binnacle:checkpoint`.
- **An existing project** goes: `binn audit`, `binn init`, `/binnacle:product`, and the same grilling of "the first epic".

### Gaps, most important first

1. **A step from vision to the roadmap, `/to-roadmap`, with two entries.** Nothing turns a project's vision or its present state into a list of epics. `binn init` leaves an empty roadmap whose Next action is `/grill-with-docs`, and epics then appear one at a time; Binnacle's own were written by hand in `docs/05-mvp-plan.md`. On an existing project the empty roadmap is wrong outright: it says nothing is planned on a project half built.
   - *New project:* read the vision, propose the epics in dependency order with a line of scope each.
   - *Existing project:* read the code, `git log`, the old docs and specs and the audit's findings, and propose a roadmap whose epics are `done`, `in progress` or `not started`.

   On the owner's yes it fills the roadmap's table and points the Next action at the grilling of the first epic not done. It runs once at the start and again when the vision changes. Found on 2026-10-11 while planning the course, noted only in the course's handoff, and lost until now. It touches *Binnacle's own planning skills* above, which waits for after the release. Matt Pocock Skills have no such step: the nearest, `/wayfinder`, their on-ramp for a greenfield project too big for one session, charts decision tickets and hands one destination to `/to-spec`; it writes no roadmap and could come before `/to-roadmap` for a foggy vision, not replace it.
2. **Taking stock of stranded knowledge on adoption.** Specs in odd places, old plans, TODO files and decisions buried in notes are seen by nothing. `docs/operations/02-existing-project-adopt.md` promises an audit of docs, ADR and CONTEXT coverage and duplication and a "knowledge normalization" step; no check does it. And a roadmap not in Binnacle's format is only named by the audit, never converted, since `binn init` rewrites nothing. The audit, read-only, could list the documents it finds; a skill, possibly `/to-roadmap`'s existing-project entry, proposes where each goes (a spec, an ADR, `CONTEXT.md`, this inbox, the roadmap, or stale) and moves them only on the owner's yes.
3. **The order of `binn init` and `/setup-matt-pocock-skills`.** Init appends the ticket-header section (`Status:`, `Blocked by:`) to `docs/agents/issue-tracker.md` only when that file exists. On a new project it does not yet, so init skips the step and says to run `/setup-matt-pocock-skills`, without saying to run `binn init` again afterwards; the README puts them in exactly that order. Without the section `/to-tickets` writes tickets with no `Status:` line, which Binnacle cannot read. At least init's Summary and the README should say to run init again after the setup, or put the setup first.
4. **The process rules in the user's project.** A branch per ticket, `DONE` as the last commit, the Review in the ticket, and the roadmap written only by a Product session are written by hand into this repository's `AGENTS.md`, `CLAUDE.md` and `docs/workflow/`. A new project has none of it. Check whether `/binnacle:task` and `/binnacle:autopilot` carry these rules themselves; if not, `binn init` offers a section for `AGENTS.md`, as it already offers one for `issue-tracker.md`.
5. **The roadmap row after `/to-spec`.** `/to-spec` does not know Binnacle's roadmap, so nothing adds the epic's status and spec link; here a Product session does it by hand, and a new user is not told. `/to-roadmap` creates the rows; whoever moves them to `spec` should be named.
6. **A place for the vision.** Nothing says where it lives or reads it. A convention such as `docs/vision.md`, named in the README and read by `/to-roadmap`.
7. **The README's short paths.** The new project's leaves out `git init`, which init requires, and places `/product` after `/to-tickets` while the roadmap's Next action sends the user to it first.

### The planning chain, from Anthropic's AI-native SDLC playbook

Part of the same epic. The playbook, published by Anthropic around 2026-08-21 and known here from a video retelling and secondary write-ups, chains one committed file per stage: `intent.md`, then `spec.md`, then `plan.md`, then code, each stage starting from the previous file, not from the chat. Binnacle already runs the same chain; three gaps to close:

1. **An intent as the grilling's standard output.** `/grill-with-docs` ends with a short `docs/specs/<epic>/brief.md` in five parts: the problem, the outcome wanted, who it concerns, the systems it touches, constraints and open questions. It is written in the owner's words, with no conclusions of the agent's, and whatever the agent is unsure of goes to the open questions. The owner reads it whole and corrects it before `/to-spec`. Today only `audit-and-adopt` has one, and there the decisions of the grilling otherwise dissolve into the spec, ADRs and `CONTEXT.md`.
2. **Contested points in the spec.** The spec lists separately where requirements conflict or a choice was close, so the owner settles them before `/to-tickets` rather than a ticket finding them. Check first whether `/to-spec` already asks for it; `audit-and-adopt/spec.md` has no such section.
3. **Three questions to the plan.** After `/to-tickets`, or before an epic's autopilot: what can this break, which step is the riskiest, and what was dropped and why. The answers go to the spec or the tickets.

Not to take: a `plan.md` per task, which the tickets already are; and an agent checking every change against the intent and stopping, which the spec, the criteria and *Questions and answers* already do.

## A smarter conflict risk (2026-10-12)

The conflict risk beside the parallel limit reads a ready Task's modules only from the file names its ticket writes (`conflictRisk`, `packages/core/src/impact.ts`). Epic 19's tickets name commands and behaviour, not files, so every pair came out `unknown` and autopilot ran them one after the other. A new project gets the opposite: with no graph `impact` is unavailable, the number alone decides, and every ready ticket runs side by side whatever it touches. Neither is right.

Ways to weigh:

- `/to-tickets` writes the modules a ticket expects to touch;
- a ticket's commands and terms are matched to modules through the graph's labels, not only file names (`binn audit` → `apps/cli/src/audit.ts`);
- before the run, an agent estimates the touched modules, as a calculated reading;
- without a graph, a cautious fallback instead of a full parallel run.

## A unit that uses systemd's specifiers (2026-10-13)

Binnacle reads a systemd unit's `Environment=BINNACLE_HOME=` literally. A unit written by hand that says `%h/.binnacle`, as the one an agent session wrote on the owner's machine on 2026-10-09 does, reads as serving `…/%h/.binnacle`, so `binn daemon autostart` calls autostart off for `~/.binnacle`. Harmless: nothing is changed, and `binn daemon autostart on` replaces such a unit with Binnacle's own, written with absolute paths. Expanding `%h` and the other specifiers would fix it for units written by hand, which are rare; likely not worth doing.

## For the next release (2026-10-13)

**Taken into epic 12 on 2026-10-13** (`docs/specs/audit-completed/brief.md`).

Found while publishing 0.1.0 (`specs/release/issues/07-release-exit-demonstration.md`, *Found on the way*); 0.2.0 carries them (the owner, 2026-10-13):

- `CONTRIBUTING.md`'s *Releasing* does not say that npm publishes only from an account with 2FA (`E403` otherwise), that the CLI then asks for the second factor in the browser, that a recovery code puts the account on a 72-hour hold with no publishing, or that a new package shows `0.0.0-stage` as `latest` for a few minutes before its version.
- npm 11.19 warns that `@ast-grep/cli`'s postinstall is not yet covered by `allowScripts` when `binn init` installs it; a later npm that blocks it may break that install.
- `binn project register` without a manifest points to `templates/project/project.yaml.example`, which only a checkout has.
- The plugin's skills still say "*From this repository* until the npm package is published"; the next version can drop the clause.
- The autostart service passes only `BINNACLE_HOME` and `PATH`, so tracker tokens set in the shell never reach it (ticket 06, *For the owner*).

## Stricter autopilot and review (2026-10-15)

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

The owner leans towards it, but wants the options weighed first. Today a Product session, a checkpoint or autopilot's end writes the roadmap only on the owner's yes (`docs/roadmap.md`, *Keeping this current*). After autopilot merged epic 12's tickets 01 to 10, the owner was asked to confirm an epic's status and the *Done* line, which follow from the tickets' statuses alone, beside the `Next action:`, which is a real choice of course.

Options to weigh:

1. **Write the derived part without a yes.** Autopilot and checkpoint set an epic's status (`tickets` → `in progress` → `done`) and the *Done* line from the tickets; the focus's prose and the `Next action:` stay on the owner's yes.
2. **Stop writing the derived part at all.** The snapshot and the dashboard already derive progress from the tickets; the table's status could be read the same way, leaving only `not started` and `spec` for the owner to write.
3. **Keep the rule.** One yes for the whole roadmap commit stays the cheapest check that nothing wrong reaches the text every fresh session reads first.

To decide: which statuses are truly derived (a `tickets` epic with one ticket merged; an epic whose last ticket is `ready-for-human`), and whether a commit to `main` with no yes fits the rule that a decision reaches the repository only once the owner confirms it.

## A shared sanitizer for manifest text in output (2026-10-16)

From `audit-completed/05`'s Review (5): a manifest's `tracker.host` is quoted back through `JSON.stringify`, which leaves C1 controls and bidi overrides in, and the tracker check already prints it the same way. One sanitizer for manifest values printed to a terminal would cover both. Low risk: the manifest is the user's own file.

## A session named so a person knows it (2026-10-21)

The `context.pressure` item names a session by its UUID only. On 2026-10-21 the owner read "the Product session 13401315-… read 212007 tokens" as being about the session they were in, which had 121,781; the 212k one was another, started at 12:17. Naming the session by its start time and its latest activity, and saying when it is not the caller's own, would tell them apart. Epic 13's short reports may cover it; check there first.

## Wording left after epic 13 (2026-10-22)

Found in epic 13's exit demonstration (`specs/human-output/issues/11-human-output-exit-demonstration.md`):

- `/binnacle:product`'s Russian report wrote "3 запуска… Две из них" (for "Два из них") and "по pull request'ам", an English term in a Russian line.
- The context-pressure attention item names the manifest key `telemetry.context_pressure.tokens`, which reads as technical in a Russian line; it also still names the session by its UUID only (*A session named so a person knows it*, above: epic 13 did not cover it).
- Reasons with no code reach a Russian vault in English, marked `(англ.)` as story 27 allows: the snapshot's alternative "Epic N (…) has Tasks ready to start…" (`packages/core/src/roadmap.ts`) and the graph's "graphify is not on the daemon's PATH…" (`apps/daemon/src/graph.ts`), whose `kind` core already words under `graph.unavailable`.
