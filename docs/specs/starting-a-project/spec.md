# Spec: Starting a project: new and existing

Status: READY
Triage: ready-for-agent

Epic 19 of v1, from its grilling's brief, `docs/specs/starting-a-project/brief.md` (2026-10-12), and the product inbox's *Starting with Binnacle: a new project and an existing one*. Exit criterion: in a fresh directory a user goes from an idea to a vision, a roadmap of epics and a Next action that grills the first epic, by the commands the README names in order, with no `/setup-matt-pocock-skills` and one `binn init`; on an existing repository with old plans and a TODO file, `binn audit` lists those documents, and the roadmap skill proposes the epics with their statuses and a place for each document, writing nothing without the owner's yes; a ticket is started with the command the dashboard shows, `/binnacle:task run <ticket>`, which carries the ticket's process with no Matt Pocock skill involved; and autopilot answers the plan's three questions before it starts. The owner confirmed the test seams on 2026-10-12, recorded under *Further Notes*.

## Problem Statement

Neither start is a clear sequence. A user starting a new project goes through a vision file nobody reads, `git init`, `binn init`, `/setup-matt-pocock-skills`, `/binnacle:product`, and a Next action that tells them to grill "the first epic" of a roadmap that lists none. Nothing turns a vision into epics: `binn init` leaves an empty roadmap, and epics appear one at a time, by hand. Binnacle's own were written by hand in a plan document.

A user bringing an existing project fares worse. The empty roadmap `binn init` writes says nothing is planned on a project half built. The project's knowledge — specs in odd places, old plans, TODO files, a roadmap in its own shape — is seen by nothing: `binn audit` only names a roadmap not in Binnacle's format, and `binn init` never rewrites one.

`binn init` adds the ticket-header section only when `docs/agents/issue-tracker.md` exists, which on a new project it does not until `/setup-matt-pocock-skills` has run; init skips the step without saying to run it again, and `/to-tickets` then writes tickets with no `Status:` line, which Binnacle cannot read.

The process a ticket follows — a branch per ticket, test first, the Review in the ticket, `DONE` as the last commit, the roadmap left alone — lives by hand in this repository's instruction files and in a copy inside autopilot's prompt. A user's project has none of it, and the command Binnacle offers to start a ticket is someone else's, `/mattpocock-skills:implement`, offered only when the project's workflow is Matt Pocock's.

And a spec written by `/to-spec` appears in no roadmap row unless a Product session adds it by hand, which a new user is never told.

## Solution

A user starting a new project runs `git init` and `binn init`, then `/binnacle:roadmap`. With no vision yet, the skill asks a few questions, one at a time — what, for whom, what is out — and writes `docs/vision.md` in the user's words; on their yes it proposes the epics in dependency order, each with a line of scope, fills the roadmap and points the Next action at the grilling of the first epic.

A user adopting an existing project runs `binn audit`, which now also lists, read-only, the documents it finds outside Binnacle's places, then `binn init` and `/binnacle:roadmap`. The skill reads the code, the history, the old docs and the audit's findings, proposes the epics as `done`, `in progress` or `not started`, and proposes where each stranded document goes — a spec, an ADR, the context file, the product inbox, the roadmap, or left as stale. It moves nothing and writes nothing until the user says yes.

`binn init` writes the conventions the planning skills read itself — the issue tracker it already detects, with the ticket header, the triage labels, the domain docs, and the *Agent skills* block that points to them — in the one plan it shows, so that no user runs `/setup-matt-pocock-skills` or `binn init` twice. The README's short paths, in both languages, give both starts in their real order.

Each ticket is worked by Binnacle's own command, `/binnacle:task run <ticket>`, which carries the whole per-ticket process. The dashboard, `task_get`, the snapshot and `/binnacle:task` offer it whatever the project's workflow, and autopilot's agents follow the same process instead of a copy of its rules. Planning — grilling, the spec and the tickets — stays on Matt Pocock Skills for v1.

A grilling ends with an Epic brief and a spec lists its contested points apart, by conventions the planning skills read. A spec no roadmap row links to is an attention item. And autopilot, while the owner is still there, answers what the epic can break, which step is the riskiest and what was dropped, writes it to the spec, and starts on the owner's yes.

## User Stories

1. As a developer starting from an idea, I want one command that turns my idea into a roadmap of epics, so that I do not invent the epics one at a time.
2. As a developer with no vision written yet, I want the roadmap skill to ask me what the project is, for whom, and what it leaves out, one question at a time, so that answering is easy.
3. As a developer, I want the vision written to `docs/vision.md` in my own words, so that it reads as mine and every later session finds it in one place.
4. As a developer who already wrote a vision, I want the roadmap skill to read `docs/vision.md` and ask nothing it answers, so that I am not asked twice.
5. As a developer, I want the epics proposed in dependency order with a line of scope each, so that I can judge the plan before anything is written.
6. As a developer, I want to change, drop, merge or add epics before I say yes, so that the roadmap is mine and not the agent's.
7. As a developer, I want nothing written until I say yes, so that a proposal I reject leaves my repository as it was.
8. As a developer, I want each epic's line of scope kept in the roadmap, so that the grilling of an epic starts from what I agreed.
9. As a developer, I want the roadmap's Next action pointed at the grilling of the first epic not done, so that `/binnacle:product` tells me what to do next.
10. As a developer adopting a project half built, I want the roadmap skill to read the code, the history, the old docs and specs, so that the roadmap starts from where the project is.
11. As a developer adopting a project, I want the proposed epics marked `done`, `in progress` or `not started`, so that the roadmap does not say nothing is planned on a project half built.
12. As a developer adopting a project, I want an existing spec linked from its epic's row, so that its progress is counted from its tickets.
13. As a developer adopting a project, I want `binn audit` to list the documents it finds outside Binnacle's places, so that plans, TODO files and old specs are not forgotten.
14. As a developer, I want that list deterministic and read-only, so that running the audit twice gives the same answer and changes nothing.
15. As a developer, I want the roadmap skill to propose a place for each stranded document — a spec, an ADR, the context file, the product inbox, the roadmap, or stale — so that the project's knowledge ends up where agents read it.
16. As a developer, I want each document moved only on my yes, and the ones I call stale left where they are unless I say to delete them, so that nothing I wrote disappears behind my back.
17. As a developer whose roadmap is in its own shape, I want the roadmap skill to bring it into Binnacle's format, keeping its content, on my yes, so that Binnacle can read it.
18. As a developer, I want the roadmap skill to work without the daemon, so that Binnacle stays optional.
19. As a developer whose vision changed, I want to run the roadmap skill again and see what it would add or reorder, so that the roadmap follows the vision.
20. As a developer, I want a second run never to change a `done` epic or remove a row that links a spec, so that history stays true.
21. As a developer, I want the roadmap skill to commit only the files it wrote, on my yes, without pushing, so that I review and push as with any Product change.
22. As a new user, I want the roadmap `binn init` creates to point its Next action at `/binnacle:roadmap`, so that my first `/binnacle:product` sends me to the right step.
23. As a user whose roadmap lists no epic, I want Binnacle's suggestion to name `/binnacle:roadmap`, so that an old empty roadmap leads there too.
24. As a new user, I want `binn init` to write the issue-tracker conventions with the ticket header itself, for the tracker it detected, so that my tickets get the header Binnacle reads without another skill or a second run.
25. As a new user, I want `binn init` to write the triage labels and the domain docs' layout with their defaults, and the *Agent skills* block in my instruction file that points to them, so that the planning skills find their conventions.
26. As a user whose project already has those files or that block, I want `binn init` to leave them as they are and only add the ticket header where it is missing, so that my own conventions win.
27. As a user, I want all of it in the one plan `binn init` shows and asks once about, so that nothing is written without my yes.
28. As a new user, I want the README's new-project path to list `git init`, `binn init`, the roadmap skill and `/binnacle:product` in that order, so that I follow it top to bottom.
29. As a user adopting a project, I want the README's existing-project path to list `binn audit`, `binn init`, the roadmap skill and `/binnacle:product`, so that adoption is as clear as a new start.
30. As a Russian-speaking user, I want `README.ru.md` to say the same, so that both readers follow the same steps.
31. As a developer, I want to start a ticket with `/binnacle:task run <ticket>`, so that I work it with Binnacle's own command.
32. As a developer, I want that command to create the branch `feat/<slug>` from an up-to-date `main`, so that every ticket has its own branch.
33. As a developer, I want it to resume a ticket whose branch already exists unmerged, rebasing it onto `main`, so that a stopped ticket is not started afresh.
34. As a developer, I want it to refuse a ticket that is `DONE`, `CANCELLED` or waits on an Unmet dependency, saying why, so that I never redo or jump ahead.
35. As a developer, I want it to implement test-first, typecheck and run the full suite, so that the ticket is checked before it is called done.
36. As a developer, I want it to run a review of the branch against `main`, in a sub-agent where the harness can start one, so that Binnacle tells review from implementation.
37. As a developer, I want the review to cover each role the ticket's `Roles:` line names beyond the Developer and the Reviewer, under a heading of its own, so that the ticket's roles are honoured.
38. As a developer, I want the Review recorded short under the ticket's `### Review`, each finding fixed, kept or left with its reason, so that the record is the ticket.
39. As a developer, I want every criterion that holds ticked, and one only a human can check left with a script, so that the ticket says what was checked.
40. As a developer, I want `Status: DONE` as the last commit and the roadmap untouched, so that tickets never conflict over the roadmap.
41. As a developer, I want the command never to merge, push or touch `main`, so that merging stays mine or autopilot's.
42. As a developer working the ticket myself, I want a question only I can answer asked in the chat, so that I answer it there and then.
43. As the owner, I want a question an unattended agent cannot settle recorded in the ticket with its options, as today, so that I answer it with `/binnacle:answer`.
44. As a developer, I want the command to work from the ticket file when the daemon is down, so that Binnacle stays optional.
45. As a user whose project does not use Matt Pocock's workflow, I want the start command offered anyway, so that Binnacle's own command is not gated on someone else's skills.
46. As a user of the dashboard, I want each Task's start command to read `/binnacle:task run <ticket>`, so that I copy one command into a fresh session.
47. As a user of `/binnacle:task`, I want the brief to end with the same command, so that every place agrees.
48. As the owner, I want Binnacle's own commands — a ticket's run, autopilot, the roadmap skill — offered in its suggestions under any workflow, and only the planning commands of Matt Pocock Skills gated on it, so that a project's workflow hides nothing of Binnacle's.
49. As the owner, I want autopilot's agents to follow `/binnacle:task run`'s process rather than a copy of its rules, so that a change to the process reaches both at once.
50. As the owner, I want autopilot's brief to keep only what being unattended adds — no one answers, questions go to the ticket, a temporary Binnacle home, the report — so that the two never drift apart.
51. As the owner, I want autopilot to answer, before it starts, what the epic can break, which step is the riskiest, and what was dropped and why, so that I see the risks while I am still there.
52. As the owner, I want those answers written under the spec's `## Risks` and committed on my yes, so that the next session reads them from the spec.
53. As the owner, I want autopilot to start nothing until I say yes to them, so that a risk I disagree with stops the run before it costs anything.
54. As the owner, I want an autopilot run resumed on an epic whose spec already has `## Risks` to show them and ask whether to go on, rather than write them again, so that a second run does not rewrite them.
55. As a user who just grilled an epic, I want the grilling to end with `docs/specs/<epic>/brief.md` in five parts and in my words, so that `/to-spec` starts from what I decided.
56. As a user reading a spec, I want its contested points listed apart, so that I settle close choices before the tickets rather than a ticket finding them.
57. As a user of any project, I want the issue-tracker conventions `binn init` offers to describe the Epic brief and the contested points, so that the planning skills in my project write them too.
58. As a user, I want a spec no roadmap row links to reported as an attention item, so that I notice a spec the roadmap forgot.
59. As a fresh Product session, I want that check deterministic and silent when every spec is linked, so that this repository stays without false attention.
60. As a user running `/binnacle:help`, I want the roadmap skill and `/binnacle:task run` listed, so that I find them.
61. As a user of another harness, I want the roadmap skill as `binnacle-roadmap` and the ticket's run in `binnacle-task`, so that both starts work outside Claude Code.
62. As the owner, I want the decision that a ticket is worked by Binnacle's own command recorded as an ADR, so that the next session does not move it back to Matt Pocock's.
63. As a fresh session, I want `CONTEXT.md` to define the vision and a stranded document, so that the words mean one thing.

## Implementation Decisions

- **The roadmap skill, `/binnacle:roadmap`**, a new skill in the `binnacle` plugin, in its copy as `binnacle-roadmap`, and in `/binnacle:help`. It writes files and commits them only on the owner's yes in the chat, as `/binnacle:checkpoint` does: the files it wrote, on the current branch, never pushed. It needs no daemon: it reads files, Git and `binn audit --json`. Its entry is chosen from what it finds — the repository's history beyond `binn init`'s files and its source files make an existing project, otherwise a new one — and it says which, so that the owner can switch.
  - *New project*: it reads `<knowledge.docs>/vision.md`; when there is none, it asks what the project is, for whom, and what it leaves out, one question at a time, and writes the vision in the owner's words on their yes. It then proposes the epics in dependency order, each with a line of scope.
  - *Existing project*: it reads the code (through Serena and Graphify where installed), `git log`, the docs and specs, and `binn audit --json`'s findings, and proposes the epics with their statuses, `done`, `in progress` or `not started`, linking an existing spec from its epic's row. For each stranded document the audit lists it proposes a destination — a spec, an ADR, `CONTEXT.md`, the product inbox, the roadmap, or stale — and on the owner's yes moves it with `git mv` or folds its content into its destination; a stale document stays in place unless the owner says to delete it. A roadmap not in Binnacle's format is rewritten into it, keeping its content, on the owner's yes.
  - *Writing*: the table's rows, with statuses and Spec links; a `## Epics` section under the table with each epic's line of scope; and a current focus whose Next action grills the first epic not done, `/grill-with-docs` with the epic named. The roadmap stays in ADR-0025's format, which `roadmapGaps` checks before writing.
  - *Again*: on a roadmap that already lists epics, it proposes what to add or reorder among the epics not started; it never changes a `done` epic, nor removes a row that links a spec.
- **The roadmap skeleton** `binn init` writes points its Next action at `/binnacle:roadmap`. The Suggested step's `plan` alternative, when the roadmap's table lists no epic, names `/binnacle:roadmap` instead of the grilling. `/binnacle:product` needs none of the roadmap skill's rules: it points there through the Next action and the suggestion.
- **Stranded documents in the audit**: a new check, `docs.stranded`, in the `docs` area. From `git ls-files`, it lists the Markdown and text files outside Binnacle's places whose name or directory says a plan, a spec, a decision, a TODO, notes, a backlog, a design, an RFC, a PRD or a roadmap — and an ADR directory other than `<knowledge.docs>/adr/`. Binnacle's places are the root's README, licence, changelog, contributing and security files, `AGENTS.md`, `CLAUDE.md` and other instruction files, `CONTEXT.md`, and under `<knowledge.docs>`: `roadmap.md`, `vision.md`, `product-inbox.md`, `specs/`, `adr/` and `agents/`. Its status is `ok` when it finds none, else `unknown` — where each belongs is the agent's judgement, not a fact the files give — with each path in the reason and the recommendation to run `/binnacle:roadmap`. It reads, and writes nothing.
- **`binn init` writes the planning conventions itself**, in place of `/setup-matt-pocock-skills`, as items of the one plan it shows (ADR-0034), each only where it is missing:
  - `docs/agents/issue-tracker.md` for the tracker init detected — local Markdown under `docs/specs/`, GitHub or GitLab issues — with the ticket-header section, the question's options and the conventions below in it; where the file exists, init only adds the ticket-header section, as today;
  - `docs/agents/triage-labels.md` with the five canonical labels, and `docs/agents/domain.md` for a single context, `CONTEXT.md` and `docs/adr/` at the root;
  - the *Agent skills* block pointing to the three, in `AGENTS.md`, or in `CLAUDE.md` when only it exists, creating `AGENTS.md` when neither does; an instruction file that already has the block is left as it is. It is the first text `binn init` writes into an instruction file.

  The files keep the shape `/setup-matt-pocock-skills` writes, so that Matt Pocock Skills read them as their own; a project that ran the setup keeps its files. The init skill and the README no longer send anyone to the setup.
- **Two conventions in `issue-tracker.md`**, in what `binn init` writes and in this repository's: a grilling ends with an Epic brief, `docs/specs/<epic>/brief.md`, in five parts and in the owner's words, which `/to-spec` starts from; and a spec lists its contested points under a `## Contested points` heading — where requirements conflict or a choice was close, with the option taken. That file is the one the planning skills read when they publish into the tracker; a Next action that grills an epic names the brief too.
- **A spec no roadmap row links to** is the attention item `roadmap.spec_unlisted`, naming the spec: a `spec.md` under the tracker's specs directory that no row's Spec cell links. It is deterministic and read where `roadmap.spec_missing` is.
- **`/binnacle:task run <ticket>`**: the `task` skill takes `run` followed by a ticket path, URL or Task id; without `run` it gives the brief, as today. The skill becomes model-invocable, so that autopilot's agents can run it; `run` starts only when a human or autopilot's brief asks for it. The process:
  - read the Task through `task_get`, or from the ticket file when the daemon is down; refuse a Task `DONE` or `CANCELLED`, or with an Unmet dependency, saying why;
  - when the Task's branch exists unmerged, check it out and rebase it onto `main`, reading each `### Question` and its `### Answer`; otherwise bring `main` up to date where it fast-forwards, saying so when it cannot be fetched, and branch `feat/<slug>` from it;
  - implement test-first through the seam the spec fixes; typecheck and run the full suite, with the commands the project's instruction files or package manifest name;
  - review the branch against `main` in a sub-agent where the harness can start one, on two axes, the project's standards and the ticket's spec, and each role the ticket's `Roles:` line names beyond the Developer and the Reviewer under a `#### <role>` heading; record it short under `### Review`, each finding fixed, kept or left with its reason;
  - tick every criterion that holds, leave one only a human can check with its script under `## Comments`, and make `Status: DONE` the last commit; leave the roadmap alone; never merge, push or touch `main`;
  - a question only the owner can answer is asked in the chat when the owner is there; unattended, as autopilot's brief says, it is recorded in the ticket with its options (ADR-0040), never answered by the agent;
  - every commit follows the project's instruction files for its message and authorship; a browser check only when the ticket changes a dashboard.
- **The start command** (`startCommand`) is `/binnacle:task run <ticket>` for every Task neither `DONE` nor `CANCELLED`, whatever `workflow.provider` is. The snapshot, `task.get`, the board and `/binnacle:task` carry it. In the Suggested step only the commands of Matt Pocock Skills, the `plan` alternative's grilling, stay gated on `workflow.provider` being `matt-pocock`; Binnacle's own — a ticket's run, `/binnacle:autopilot`, `/binnacle:roadmap` — are offered under any. `docs/03-mcp-and-skills.md`, `docs/workflow/02-development-workflow.md`'s *Per ticket*, the README and `README.ru.md` say so.
- **Autopilot's brief** tells each agent to run `/binnacle:task run <ticket path>`, unattended, and keeps only what that adds: nobody answers questions, so they go to the ticket with their options; a temporary `BINNACLE_HOME` and `BINNACLE_PORT=0` inside its worktree, every daemon it started stopped; nothing outside its worktree; the report's contents; and the resume paragraph. Step 8's verification is unchanged: autopilot checks the branch itself, not the agent's report.
- **Autopilot's three questions**, a new step after the epic is found planned and before the loop: from the spec and the tickets, autopilot drafts what the epic can break, which step is the riskiest, and what was dropped and why, shows them, and on the owner's yes writes them under the spec's `## Risks` and commits the spec alone to `main`, which the run's start then follows. Without a yes it starts nothing. When the spec already has `## Risks`, it shows them and asks whether to go on, writing nothing.
- **ADR-0042, *Binnacle's Own Commands for Its Own Work***, proposed here and written by the ticket that changes the start command: the start command is `/binnacle:task run <ticket>` under any workflow; the per-ticket process lives in that skill, and autopilot's agents follow it; `binn init` writes the planning skills' conventions in place of `/setup-matt-pocock-skills`, and with them the first text it writes into an instruction file; planning stays on Matt Pocock Skills until after the release (*Binnacle's own planning skills*, the product inbox). It narrows the rule in `docs/03-mcp-and-skills.md` that no command is offered under a workflow other than Matt Pocock's.
- **`CONTEXT.md`** gains *Vision* — the project's purpose, audience and limits in the owner's words, `<knowledge.docs>/vision.md`, which the roadmap skill reads — and *Stranded document* — a document the audit finds outside Binnacle's places, which the roadmap skill proposes a place for.
- **The docs**: `docs/operations/01-new-project.md` and `02-existing-project-adopt.md` give the two sequences; the latter's promised "knowledge normalization" becomes the audit's list and the roadmap skill's proposals.

## Testing Decisions

A good test exercises behaviour through the seam a caller uses, never an internal function's shape. This epic adds no seam.

- **The audit**, through `binn audit --json` on fixture repositories, as `apps/cli/test/audit.test.ts` builds them: a repository with a `TODO.md`, a `plans/` directory, a spec outside `docs/specs/` and a `doc/adr/`, each listed; one with only Binnacle's places, `ok`; ignored and untracked files left out; the same answer twice; nothing written.
- **The start command and the suggestions**, through the daemon's `project.snapshot` and `task.get`, as `apps/daemon/test/task.test.ts`, `snapshot.test.ts`, `board.test.ts` and `next.test.ts` do: `/binnacle:task run <ticket>` under `matt-pocock`, another provider and none; none for `DONE` and `CANCELLED`; the autopilot and by-hand alternatives with their commands under any provider, the grilling's only under `matt-pocock`; `/binnacle:roadmap` as the `plan` alternative when the table lists no epic.
- **The unlisted spec**, through `project.snapshot`'s attention: a spec no row links, reported; every spec linked, nothing; a row linking a missing spec still `roadmap.spec_missing`.
- **`binn init`**, through its plan and what it writes, as `apps/cli/test/init.test.ts` does: on a bare repository with a local, a GitHub and a GitLab remote, the plan holds the three `docs/agents/` files for that tracker, the ticket header and both conventions in `issue-tracker.md`, and the *Agent skills* block in a new `AGENTS.md`; with only `CLAUDE.md`, the block goes there; with the files and the block present, only the missing ticket-header section is planned and nothing else is touched; a second run plans none of it; the skeleton's Next action names `/binnacle:roadmap`.
- **The skill texts**, in the package build's test, `apps/cli/test/pack.test.ts`: the roadmap skill is in the plugin and its copy, and in the help; `task` takes `run`, carries the process and is model-invocable; autopilot's brief points to `/binnacle:task run` and holds no copy of the process's rules; autopilot's three questions come before its loop; the copy matches the plugin.
- **What agents do** — the roadmap skill's dialogue and proposals, a ticket worked by `/binnacle:task run`, autopilot's three questions — is the exit demonstration's.

## Contested points

- **The setup's files written by `binn init`.** The brief's default put `/setup-matt-pocock-skills` before `binn init`; but the first `binn init` on a machine installs the Matt Pocock Skills plugin, so the setup cannot come first, and init cannot run it: it is a chat skill only a human may start. Init, the setup and init again would be three steps. Taken by the owner on 2026-10-12: init writes the setup's files itself, for the tracker it knows. The cost: Binnacle keeps its own copies of those files' shape, compatible with Matt Pocock's, and init writes into an instruction file for the first time, on the plan's one yes.
- **The task skill becomes model-invocable.** Autopilot's agents must run `/binnacle:task run`, which `disable-model-invocation` forbids. The alternative, a second skill for the run alone, adds surface for no gain; the brief part changes nothing, and the run never merges or pushes. Taken: one skill, model-invocable, `run` started only when asked.
- **Where the brief and contested-points conventions live.** `/grill-with-docs` reads no convention file; the planning skills read `docs/agents/issue-tracker.md` when they publish. Taken: that file, and a Next action that grills an epic names the brief.
- **A harness without skills.** `/binnacle:task run` is a skill; `binn call` reaches tools, not a skill's process. Taken: every harness the `skills` CLI detects gets `binnacle-task`; one without skills follows the project's instruction files by hand, as before, and the start command is still shown.
- **A stranded document's status.** `gap` would call a project with old plans broken; `ok` would hide them. Taken: `unknown`, since where a document belongs is judgement, not a fact the files give.
- **New or existing project.** Asking every time costs a question; guessing may be wrong. Taken: the skill picks from the history and the source files, says which, and the owner can switch.

## Out of Scope

- Binnacle's own skills for grilling, specs and tickets, which come after the release (*Binnacle's own planning skills*, the product inbox).
- A section of process rules offered for a project's `AGENTS.md`: `/binnacle:task run` carries them.
- `/wayfinder` and a foggy vision's research before the roadmap skill.
- Converting a remote tracker's issues, or moving any document without the owner's yes.
- The course "Один как команда" and its materials.
- A `plan.md` per task, and an agent checking each change against the vision.

## Further Notes

- **Decided while specifying, by the owner on 2026-10-12**: `binn init` writes the conventions `/setup-matt-pocock-skills` writes, so that neither the setup nor a second init is needed.
- **Decided in the grilling, by the owner on 2026-10-12** (`brief.md`): a roadmap skill of Binnacle's own with two entries; the audit finds stranded documents and the skill places them; a ticket is worked by `/binnacle:task run`, offered whatever the workflow, with autopilot's agents following it, which an ADR records; planning stays on Matt Pocock Skills for v1; autopilot answers the plan's three questions first.
- **Test seams confirmed by the owner on 2026-10-12**: `binn audit --json`, the daemon's `project.snapshot` and `task.get`, `binn init`'s plan and Summary, and the package build's test over the skill texts; what agents do belongs to the exit demonstration.
- **Defaults taken from the brief, the docs and Ponytail, not asked**: the skill named `/binnacle:roadmap`; the vision at `<knowledge.docs>/vision.md`; epics' scope under a `## Epics` section of the roadmap; the audit's list by name and place from `git ls-files`; `roadmap.spec_unlisted` as the attention item's code; ADR-0042's number; the review in a sub-agent where the harness can start one, so that review runs are read as they are now.
- **On this repository** the audit's new check will name `docs/05-mvp-plan.md`, a plan outside Binnacle's places; that is expected, not a false finding.
- **The release** is on the evening of 2026-10-13; what does not fit continues after it, in open source. The start command, the audit's check and init's conventions come first; the roadmap skill next; autopilot's three questions last.
- **The exit demonstration**, with the owner: in a fresh directory, `git init`, `binn init` once, `/binnacle:roadmap` asking for the vision and writing it, the epics and the Next action; on a copy of a small existing project with a `TODO.md` and an old plan, `binn audit` listing them and `/binnacle:roadmap` proposing epics with statuses and a place for each; a ticket started from the dashboard's command, `/binnacle:task run`; and the three questions shown at the start of the next epic's autopilot run.
