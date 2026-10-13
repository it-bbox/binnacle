# 08: The exit demonstration of epic 19

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07
Spec: `docs/specs/starting-a-project/spec.md`

**What to build:** epic 19's exit criterion, demonstrated by the owner (spec, *Further Notes*).

- [x] In a fresh directory: `git init`, one `binn init` writing `docs/agents/` and the *Agent skills* block, then `/binnacle:roadmap` asking for the vision, writing it, the epics and a Next action that grills the first epic; no `/setup-matt-pocock-skills`.
- [ ] On a copy of a small existing project with a `TODO.md` and an old plan: `binn audit` lists them, and `/binnacle:roadmap` proposes epics with statuses and a place for each, writing nothing before the owner's yes.
- [ ] A ticket started from the dashboard's command, `/binnacle:task run`, ends on its branch with its Review and `DONE` last, unmerged.
- [x] The three questions shown at the start of the next epic's autopilot run.

## Comments

### Checked before the demonstration, 2026-10-13

By this ticket's agent, with `binn` from this checkout and the `binnacle` plugin whose skills match `apps/cli/plugin/skills/` byte for byte, so nothing needs refreshing first.

- **A fresh directory.** After `git init`, `binn init --plan --json` holds `docs/agents/issue-tracker.md` (with the ticket header, the Epic brief and `## Contested points`), `triage-labels.md`, `domain.md`, a new `AGENTS.md` with the *Agent skills* block, and a roadmap skeleton whose Next action is `/binnacle:roadmap`. Nothing names `/setup-matt-pocock-skills`. The plan was not applied: applying it registers the project, installs skills at user scope and registers MCP servers, which is the owner's run.
- **A small existing project.** A repository with a `README.md`, `src/index.ts`, a `TODO.md` and `notes/plan-2025.md`: `binn audit --json` gives `docs.stranded`, `unknown`, naming `TODO.md, notes/`, with the recommendation to run `/binnacle:roadmap`, and `docs.roadmap` as a gap. A stranded file inside a directory is named by its directory.
- **The start command.** `task_get` for this ticket gives `start` `/binnacle:task run docs/specs/starting-a-project/issues/08-starting-a-project-exit-demonstration.md`, the command the dashboard shows.

### The demonstration, 2026-10-13

- **The three questions, ticked.** The owner, 2026-10-13: `/binnacle:autopilot 15`, the first autopilot run of an epic after this one, showed the plan's three questions, what it can break, the riskiest step and what was dropped, and started on the owner's yes; it wrote them to `docs/specs/daemon-autostart/spec.md`, `## Risks` (`40a8df7`).
- **A ticket from the dashboard's command.** The owner started this ticket with the dashboard's command, and counts this run as the demonstration: it is ticked when this branch ends with its Review and `DONE` last, unmerged.

- **A new project, ticked.** The owner, in `~/demo-new`: `git init`, `binn init` once, then `/binnacle:roadmap`. With no vision, it asked what, for whom and what is out, one at a time, showed `docs/vision.md` whole in the owner's words, proposed two epics in dependency order with a line of scope each, and the roadmap with the Next action `/grill-with-docs epic 1: Shopping list`, naming the brief; it wrote and committed only the vision and the roadmap after the owner's yes. No `/setup-matt-pocock-skills`. Kept, not a defect: the files `binn init` wrote stay uncommitted, as init never commits and the skill commits only its own two.

### Steps for the owner: criteria 1 and 2

1. **A new project.** In a terminal: `mkdir ~/demo-new && cd ~/demo-new && git init`, then `binn init` once, and Enter. Open a new Claude Code session in `~/demo-new` and type `/binnacle:roadmap`. Expect questions one at a time (what, for whom, what is out), then `docs/vision.md` in your words, then on your yes the epics in dependency order in `docs/roadmap.md` and a Next action that grills the first epic. Never run `/setup-matt-pocock-skills`.
2. **An existing project.** Copy a small project of your own that has a `TODO.md` and an old plan (or add them to the copy), e.g. `cp -r ~/Projects/<project> ~/demo-existing`. In it run `binn audit`: expect `docs.stranded` naming them. Then `binn init`, and in a new Claude Code session there `/binnacle:roadmap`. Expect epics with `done`, `in progress` or `not started` and a place for each stranded document, and nothing written or moved before your yes.
3. Tick each criterion that held. For one that did not, one line on what went wrong, to become a ticket.
