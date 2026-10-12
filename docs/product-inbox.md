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

## A repository Antigravity cannot open (2026-10-08)

Antigravity's agent did not answer in this repository because its Git library refuses `extensions.worktreeconfig`, which some worktree tool had set with no `config.worktree` using it; unsetting it fixed it (ticket 06 of epic 10). `binn audit` could report the extension when no `config.worktree` exists, and say which harness it breaks.

## Ideas from nick-vels/skills (2026-10-09)

[nick-vels/skills](https://github.com/nick-vels/skills) is a single `/autopilot` skill that builds a project from a brief: rounds of questions at the brief's forks, a spec, tasks built by parallel agents, an offline HTML dashboard, and a final acceptance. It aims at an owner who reads neither the spec nor the code; Binnacle keeps the human in control of a long-lived project (ADR-0022). Two of its ideas could close a gap here, where a spec's link to its brief and its tickets is prose:

1. **Requirements traced end to end.** The brief is split into numbered requirements, recorded word for word. Every requirement has a section of the spec and a task, every task a requirement, which catches work nobody asked for, and only the owner can drop a requirement. Here a story of a spec could carry a number that its tickets and their criteria name, and the snapshot or `binn audit` could report a story with no ticket and a ticket with no story.
2. **Blind acceptance.** At the end, a separate agent checks the result against the owner's original words only, without the spec, so that what was lost on the way from brief to spec to tickets shows. Here an epic's exit demonstration could start from such a check against the grilling's record.

## A daemon that does not come back after a reboot (2026-10-09)

**Decided by the owner on 2026-10-09: v1, right after epics 10 and 14's demonstrations, set up automatically, not a documented manual step.** It left *Later* in the roadmap. What is still open is how, below, and an ADR narrowing ADR-0016's "autostart is a documented manual step".

After a reboot the owner found the daemon down: nothing starts it. ADR-0016 makes autostart "a documented manual step in v1", but no document describes it; the README and `docs/` say nothing. On the owner's machine it now runs as a systemd user unit, `~/.config/systemd/user/binnacle.service`, which starts `apps/daemon/src/bin.ts` with Node at login, with `BINNACLE_HOME` and a `PATH` that reaches `git`, `graphify` and `npx`, and restarts it on failure. Three things to weigh:

1. **The documented step ADR-0016 promises**: a unit for systemd, an agent for launchd, a Task Scheduler entry for Windows, each a few lines.
2. **`binn init` asking for it**, as it asks for the import window, so that a new user is not left with the same gap.
3. **Who restarts it**: `binn daemon stop` then `binn daemon start`, as autopilot runs after a merge that changes the daemon, leaves a daemon outside the service manager; `systemctl --user restart binnacle` is the restart there. Node's path is pinned to one nvm version and breaks when Node is upgraded.

## A scratchpad project in the owner's daemon (2026-10-10)

The owner's daemon had a project registered at `/tmp/claude-1000/…/aeb63b29-…/scratchpad/demo-init`, a session's scratchpad, shown on every page as unavailable once the directory was gone; the owner had it unregistered on 2026-10-10. Some session ran `binn init` or `binn project register` there against the owner's `BINNACLE_HOME` rather than a temporary one, which `dashboard-design-and-languages/12` asks of agents. Two things to weigh: whether skills and briefs that try a CLI on a throwaway repository say to use a temporary home, and whether a registration whose directory is gone should drop out of the dashboard or be offered for removal rather than shown on every page.

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
