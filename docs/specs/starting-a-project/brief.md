# Starting a project: what the grilling decided

Epic 19's material is `docs/product-inbox.md`, *Starting with Binnacle: a new project and an existing one* (2026-10-12): seven gaps and the planning chain's three points. This brief is what `/to-spec` starts from.

## The problem

Neither start is a clear sequence. A new project goes through a vision file, `git init`, `binn init`, `/setup-matt-pocock-skills`, `/binnacle:product` and the grilling of "the first epic", and an existing one through `binn audit`, `binn init` and the same grilling, but nothing turns a vision or a half-built project into a roadmap, nothing takes stock of the knowledge an existing project already holds, and the process rules this repository keeps by hand reach no user's project. The course "Один как команда" has to explain both starts.

## The outcome wanted

A user starting a new project, or adopting an existing one, goes from an idea or a repository to a roadmap of epics and a Next action that grills the first epic not done, by commands Binnacle names, and works each ticket by Binnacle's own command, which carries the process rules. In the owner's words: Binnacle should not ask its users to run "someone else's" skills to do its own work; planning moves off Matt Pocock Skills after the release.

## Who it concerns

The owner, the course's participants, and anyone who installs Binnacle after the release on 2026-10-13: a developer starting from an idea, and one bringing a project that already has code, docs and plans in its own shape.

## The systems it touches

- the `binnacle` plugin's skills: a new roadmap skill, `/binnacle:task`, `/binnacle:autopilot` and `/binnacle:product`;
- `binn audit` and `binn init`;
- the daemon's start command (`startCommand`), which the dashboard, `task_get` and `/binnacle:task` show, and the snapshot's attention;
- the README and `README.ru.md`, `docs/operations/01-new-project.md` and `02-existing-project-adopt.md`, `docs/agents/`.

## Decided in the grilling, 2026-10-12

- **From vision to roadmap: a skill of Binnacle's own**, in the `binnacle` plugin, with two entries. A new project's vision is `docs/vision.md`; when there is none, the skill asks the owner a few questions, one at a time (what, for whom, what is out), writes `docs/vision.md` in the owner's words, and on their yes proposes the epics in dependency order with a line of scope each. An existing project's entry reads the code, `git log`, the old docs and specs and the audit's findings, and proposes epics `done`, `in progress` or `not started`. On the owner's yes it fills the roadmap's table and points the Next action at the grilling of the first epic not done. Not a fork of Matt Pocock Skills, which Later rules out; the roadmap's format is Binnacle's (ADR-0025).
- **Stranded knowledge: the audit finds, the skill places.** `binn audit` lists, read-only and deterministically, the documents it finds outside Binnacle's places: specs in odd places, old plans, TODO files, a roadmap not in Binnacle's format. The roadmap skill's existing-project entry proposes where each goes (a spec, an ADR, `CONTEXT.md`, the product inbox, the roadmap, or stale) and moves them only on the owner's yes. Facts from code, judgement from the agent.
- **A ticket is worked by `/binnacle:task run <ticket path>`.** The owner wants Binnacle's own command rather than `/mattpocock-skills:implement`. The rules of a ticket live in it: a branch `feat/<slug>` from an up-to-date `main`, test-first, the full suite, a review recorded under the ticket's `### Review`, every criterion that holds ticked, `Status: DONE` the last commit, the roadmap untouched; it neither merges nor pushes. The start command the daemon gives, and the dashboard, `task_get` and `/binnacle:task` show, becomes `/binnacle:task run <ticket>`, offered whatever `workflow.provider` is, since the command is Binnacle's. Autopilot's agents follow the same process instead of a copy of the rules in its prompt. This narrows ADR-0035, so the spec proposes an ADR.
- **Planning stays on Matt Pocock Skills for v1.** `/grill-with-docs`, `/to-spec` and `/to-tickets` move to Binnacle's own skills after the release (*Binnacle's own planning skills*, the product inbox). This epic takes only the ticket command and the roadmap step.
- **The plan's three questions are autopilot's first step.** While the owner is still there, autopilot answers what this epic can break, which step is the riskiest, and what was dropped and why, from the spec and the tickets, shows them to the owner, writes them to the spec under *Risks*, and starts on the owner's yes.

Defaults, from the docs and the inbox, not put to the owner:

- **A brief is the grilling's standard output**: `docs/specs/<epic>/brief.md`, as this one, in five parts and in the owner's words, by a convention in `docs/agents/` that Matt Pocock Skills read, as they read `issue-tracker.md`. The owner reads it whole before `/to-spec`.
- **Contested points in the spec**: `/to-spec` lists apart where requirements conflict or a choice was close, by the same kind of convention, if the skill does not already.
- **Setup before init**: the README and `binn init`'s Summary put `/setup-matt-pocock-skills` before `binn init`; when `docs/agents/issue-tracker.md` is missing, init says to run it again after the setup.
- **Roadmap rows**: the roadmap skill creates them; a Product session moves an epic to `spec` and `tickets`, as now. A spec no roadmap row links to is an attention item, a deterministic check.
- **The README's short paths** follow the new order, `git init` included, in both READMEs.

## Constraints and open questions

- The release is on the evening of 2026-10-13; what does not fit continues after it, in open source (the roadmap's current focus).
- Binnacle stays optional: every step has a way through without the daemon (`AGENTS.md`, principle 3).
- Open: whether `/to-spec` already lists contested points; whether `/binnacle:product` needs the roadmap skill's rules or only points to it; how `/binnacle:task run` behaves in a harness without skills, through `binn call`.
