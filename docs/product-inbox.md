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
