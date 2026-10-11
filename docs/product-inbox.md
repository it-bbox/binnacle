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

## For epic 16: the parallel limit, and two labels on the board (2026-10-11)

The owner decided during epic 11's autopilot run that the parallel agent limit (`automation.max_parallel_development_tasks`, 2 in `.binnacle/project.yaml`) belongs to epic 16:

- it moves from the project manifest to the machine's settings (`~/.binnacle/settings.json`), since it depends on the machine and the subscription, not the repository; the manifest may stay as a per-project override;
- the dashboard's Settings page edits it: a number, or *auto*, where autopilot runs as many agents as low conflict risk allows, under a ceiling such as 4;
- beside it, an informer from telemetry: how many agents the subscription really sustains, from runs that hit usage limits;
- a machine setting the dashboard writes needs an ADR beside ADR-0020's read-only dashboard.

On the board's card, the Russian `fromRuns: 'по runs'` reads as English "no runs" on a card that has runs; and "7 сек. назад" is the time since the run's latest activity, where Claude Code shows the agent's elapsed time: show both, such as "идёт 15 мин · активность 7 с назад".

## Binnacle's own planning skills (2026-10-11)

Planning runs on Matt Pocock Skills today: `/grill-with-docs`, `/to-spec` and `/to-tickets`, which `binn init` installs and the workflow depends on (ADR-0035). They are good and maintained, but the owner hears from developers that not all of them like these skills. After the release, Binnacle could ship its own skills for the same chain, written for its formats: grilling against the Project Brain, a spec, tickets with `Roles:`, dependencies and criteria, and whatever else planning needs. Not now: Matt Pocock Skills stay for v1.

The course "Один как команда" already tells participants that planning uses Matt Pocock Skills for now and that Binnacle's own skills will come later, without a date. Its prompts and templates do not depend on either, so the switch would not break it.
