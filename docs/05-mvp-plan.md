# MVP Implementation Plan

## Guiding rule

Build only enough to validate the central claim:

> Externalized project state + fresh snapshots + task isolation + telemetry improves controllability and can reduce waste compared with long chat-centric workflows.

What a phase below lists is its floor. Planning an epic may add to it and never cuts it (the owner, 2026-09-26, while grilling epic 5).

## Phase 1 — Core and persistence

Implement:

- monorepo skeleton;
- local daemon as a user process;
- `node:sqlite` store, one database per machine under `~/.binnacle/`;
- project registry;
- event model;
- `Project`, `Task`, `AgentRun`, `Review` entities;
- `.binnacle/project.yaml` parser;
- basic Git adapter.

Exit criterion: one local project can be registered and queried.

## Phase 2 — MCP + Product Snapshot

Implement:

- MCP server, stdio first, on the official SDK (ADR-0021);
- project detect/status, including linked worktrees;
- the Task-reading half of the tracker contract, and the local Markdown tracker as its first adapter;
- Product Snapshot generator;
- daily delta;
- checkpoint prepare/record workflow (ADR-0020);
- minimal client skill wrappers for the first supported harness.

The MCP server is registered by hand in this epic: this repository commits a project-scoped `.mcp.json`. `binn init` does it for other projects in phase 3.

Exit criterion: a brand-new Product chat can run `/product` + `/daily` and understand project state without old conversation history.

## Phase 3 — Tracker + Matt Pocock integration

Implement:

- GitHub and GitLab adapters behind the Task-reading contract from phase 2, both read-only (ADR-0013). Each reads the ticket header from the issue body (ADR-0024), from a repository and host declared in the manifest, on every call;
- the daily delta's Task transitions on a remote tracker, from the Task states recorded with each `daily` and `checkpoint` event;
- the compact task brief, `task_get` and `/binnacle:task`, including the branch name that maps to the Task (ADR-0018);
- `binn init`, which shows one plan of every write and writes only after one confirmation (ADR-0026, ADR-0034): manifest generation, harness detection, MCP registration from one config template per known harness and a generic snippet for any other, the `binnacle` plugin from the npm package (ADR-0027), detection of the Matt Pocock layout with an offer to add the ticket-header convention to `docs/agents/issue-tracker.md`, and reading a repository's agent instructions as one set (a `CLAUDE.md` that imports `AGENTS.md` is one, not two).

The roadmap stays in `docs/roadmap.md` on every tracker (ADR-0025). Parent and subtask relations are not part of the tracker contract. The former `.scratch` materialization item is dropped: the task brief arrives over MCP, and `.scratch` hygiene is checked by the audit in phase 6.

Tracker credentials use read-only scope: a fine-grained token with Issues read access on GitHub, `read_api` on GitLab. They are taken from the environment or from `~/.binnacle/credentials.json` with `0600` permissions, one per host. Tokens from `gh` or `glab` are not imported, because they can usually write.

Adapters are tested live, against GitHub and GitLab test projects holding fixed issues, by a separate `pnpm test:live` that needs read-only tokens. `pnpm test` stays offline.

Exit criterion: remote issue task can be represented as a Binnacle Task and compact task brief.

## Phase 4 — Telemetry

Implement:

- normalized usage schema;
- session-artifact readers, Claude Code first, then Codex (ADR-0011);
- historical import driven by a question `binn init` gains in this phase;
- run-to-task correlation from `cwd` and the branch — the checkout's `git reflog`, and no branch where it has no answer (ADR-0018, ADR-0029, ADR-0030);
- provenance tagging.

OpenTelemetry, the optional live path (ADR-0011), is deferred to phase 10 (ADR-0038).

Exit criterion: the Product Snapshot and MCP attribute usage to runs and Tasks for supported paths, and each harness reports the support level it actually reached (ADR-0014). The dashboard that draws this is phase 5. Specified in `specs/telemetry/spec.md`.

## Phase 5 — Minimal Dashboard

Nuxt pages, read-only, served by the daemon at its own address (ADR-0031):

- Overview — the main screen. It answers where each project stands and what to type next: its roadmap position, the Next action with its command, Binnacle's Suggested step beside it (ADR-0032), what is running now, the Tasks ready to start with the command that starts each, attention, and usage today and this week;
- Projects;
- Project detail, with a mini kanban of its Tasks: Backlog, Ready, In progress, Done. In progress includes a `READY` Task with AgentRuns attributed to it, and each card names who works on it: harness, model, role and latest activity;
- Task detail, with its Review, read from the ticket's `### Review` section;
- Usage, with derived metrics labelled as Binnacle's calculations: tokens per completed Task, runs per Task, weekly trend;
- Attention/current activity.

Every view element in `docs/04-telemetry-dashboard.md` appears. An element with no source yet says so, and why, as the snapshot does: questions and answers, and review and rework usage. A page's only action is copying a command; the human types it. A `DONE` ticket without a Review is an attention item. `/binnacle:task` ends with the command that starts its Task, the same one the dashboard shows.

No decorative enterprise functionality.

Exit criterion: on the owner's running daemon, the owner takes the next step from the dashboard alone, without asking an agent what to type. The Task it starts moves to In progress, naming who works on it, and then to Done. The Usage page's figures equal `usage_get`'s for the same window, and every element without a source says why.

## Phase 6 — Audit/adopt

The code ships in v1. Running it against a large third-party repository is post-v1 activity — see `docs/00-scope.md`.

Implement read-only audit covering:

- Git/tracker;
- docs/ADR/CONTEXT;
- Matt Pocock layout;
- `.scratch` risks: not ignored by Git, or holding the only copy of something durable;
- Serena/Graphify/Context7 availability;
- agent instructions (`AGENTS.md`, `CLAUDE.md`), read as one set when one imports the other;
- basic test/CI/project structure;
- telemetry readiness.

Output migration recommendations, not automatic fixes.

## The baseline phases (epics 8 to 12)

On 2026-10-02 the owner found that epics 1 to 7 delivered only part of `docs/baseline.md`: this plan had moved Graphify and Obsidian to "after real data", and other baseline items to the roadmap's *Later* list. The baseline is the floor for v1 (`docs/00-scope.md`), and the gaps are five epics, in this order. Their decisions were made in one grilling, on 2026-10-02; each epic's `to-spec` starts from its list below.

### Phase 8 — Project Brain: tools, Graphify, Obsidian

- `binn init` installs what is missing of Matt Pocock Skills, Ponytail, Serena, Graphify, Context7 and ast-grep, with their MCP registration for every detected harness, in its one plan (ADR-0034), and runs the installs after the one confirmation, reporting each. A prerequisite it cannot install, such as `uv` for Graphify, is named with its command.
- Graphify and Obsidian are part of the Standard setup and replaceable (ADR-0035). `binn init` builds the first graph and adds its directory to `.gitignore`.
- The daemon updates the graph when `main` moves (ADR-0036). The snapshot shows whether there is a graph and how fresh it is; a failed update is an attention item.
- Parallel worktrees get an impact and conflict analysis from the graph: the modules each ready Task touches, and the risk of running two together, beside the parallel limit.
- The daemon keeps a one-way projection of the Project Brain in an Obsidian vault, at a per-machine path (decision 13): `Projects/<Project>/` with Product (roadmap, snapshot, daily), Specs and tickets, Decisions, Research and `90-Graphify`, linked to each other. The human's own notes there are never touched (ADR-0036).

### Phase 9 — Everything from the chat

- Skills for `binn init`, starting and stopping the daemon, registering a project and opening the dashboard, and `/binnacle:status` over the existing `project_status` tool. They run `binn` through the harness's shell, so they work with the daemon stopped.
- `/binnacle:init` shows init's plan in the chat and runs exactly that plan after the human's yes in the chat (ADR-0037).
- Autopilot refreshes the plugin copy that Claude Code loads when a merge changes the skills, as it regenerates the dashboard: today a changed skill does not reach the owner until someone runs `pnpm install`.

### Phase 10 — Telemetry for any harness

- The daemon receives OpenTelemetry, and `binn init` configures the export in every detected harness that supports it (ADR-0038). Session artifacts stay for history and for harnesses without it; a call seen through both counts once. The spec lists which of the owner's harnesses — Claude Code desktop, Codex CLI and desktop, ZCode (the owner's GLM client, on macOS), Antigravity, Gemini CLI, opencode — export it, and adds artifact readers for the others.
- Review and rework usage, "not available" before this phase: a rework run is implementation work on a Task's branch after its first Review or after changes were requested; a review run is one in the reviewer's role. Context growth per run, and the context-pressure signal and attention item of decision 15. All labelled as calculated.
- Ponytail's effect: tokens per completed Task before and after Ponytail was enabled in a project, labelled as calculated.

### Phase 11 — The state of work

- Questions and answers live in the ticket, as the Review does: `### Question` and `### Answer` under `## Comments`, or the issue's comments on a remote tracker. A human approval is a status change the human makes. Binnacle shows what is unanswered or waiting for approval in the snapshot, daily, the dashboard and the Obsidian projection; a skill lets the owner answer from the chat, writing the answer into the ticket.
- Roles: a `Roles:` line in the ticket header, written by `/to-tickets` or the human, with Developer and Reviewer required when it is missing; Binnacle adds its own suggestions beside it, labelled as calculated (Architect when the graph shows many modules touched, Security when secrets or authentication are). Shown in `/task`, the snapshot and the dashboard. Binnacle starts no one.
- CI state and open PRs or MRs, read from GitHub or GitLab with the read-only token, in the snapshot, daily, the dashboard and on the Task. This repository gains a GitHub Actions workflow running the typecheck and the tests.

### Phase 12 — Audit, completed

- Three more areas: Docker (a Dockerfile or compose file, and `.dockerignore`); secrets (a committed `.env`, keys and tokens matched by known patterns in tracked files, given by path and line and never by value); security basics (a lockfile, dependency updates by Dependabot or Renovate, `SECURITY.md`). Read-only and offline, as the rest of the audit.
- A migration plan: the recommendations ordered into steps — `binn init` first, secrets next, then the rest.

### Phase 14 — Skills in any harness

Added on 2026-10-06, after the owner linked Binnacle's skills into `~/.codex/skills` by hand and Codex ran them: the baseline makes Codex, GLM and Gemini equal harnesses, and `binn init` installs the skills, Matt Pocock Skills and Ponytail into Claude Code alone. It comes before epic 10, which reuses its list of harnesses. Grilled on 2026-10-06; ADR-0039 records the decisions and how they narrow ADR-0023 and ADR-0027:

- Claude Code keeps the `binnacle` plugin; every other harness `binn init` detects gets the same skills, named `binnacle-<action>`, through the `skills` CLI (`npx skills add <the package's skills> -g -y`, then `npx skills remove -g -a claude-code`), with the Summary naming the harnesses from the CLI's output and `--skip-harness` leaving one out. Running `binn init` again adds a harness installed since.
- One neutral text per skill, free of one harness's mechanisms; what depends on the harness comes from `binn`'s output.
- `binn call <tool> [json]` calls a daemon MCP tool from the shell, so a harness without MCP, such as Pi, runs every skill.
- Autopilot ships everywhere, and refuses at its first step where the harness cannot start a background agent in its own worktree.
- `binn init` installs Matt Pocock Skills and Ponytail into each detected harness through the same CLI.
- `binn audit` reports installed skills that differ from the package's, and `binn init`'s plan reinstalls them; without `npx` or the network, init prints the command.
- `docs/03-mcp-and-skills.md` no longer says that no skill format exists for another harness.

### Phase 16 — Dashboard redesign

Added on 2026-10-10 for the release video: the dashboard reads too small and too crowded. Grilled on 2026-10-11 from the owner's findings (`specs/lean-flow/issues/05-lean-flow-exit-demonstration.md`, *Found on the way*) and `docs/product-inbox.md`'s points for this epic. Scale and density, not a new structure: the shell, the six pages and what they show stay as epics 5 and 6 decided, and so do Nuxt UI, no chart library, bundled fonts (ADR-0033), the palette, both themes and both languages. Autopilot runs it straight after its tickets; its agents use the Impeccable and UI UX Pro Max skills, and the owner judges at the exit demonstration (the owner, 2026-10-11):

- **Type scale:** body text 16 px, secondary text 14 px, nothing below 13 px, badges and labels included.
- **Widgets brief or full:** each widget's header switches *Brief* and *Full*, *Brief* by default and remembered in the browser per widget. Long lists and texts fold in place. Nothing is removed: every element of `docs/04-telemetry-dashboard.md` stays reachable, in *Brief* or *Full*; the spec says what each widget's *Brief* shows. "What's next" always shows in full.
- **Point fixes:** the Task page renders its Review as Markdown, headings, lists and paragraphs, not one block of text; a Task id is never cut short; the board card's Russian `по runs` no longer reads as "no runs", and its time shows both, such as "идёт 15 мин · активность 7 с назад".
- **Usage by epic:** the usage page and `usage_get` filter by epic, listing every Task of it, its rework share and first-pass acceptance, and the epic's average, labelled as Binnacle's calculation.
- **The parallel limit on the machine** (ADR-0041): `automation.max_parallel_development_tasks` moves to `~/.binnacle/settings.json`, 2 by default; a project manifest that sets it still wins, and the Settings page says so. The Settings page edits it: a number, or *auto*, which starts every ready Task whose pairs are all at low conflict risk, at most 4. Autopilot reads it from the snapshot as today. Beside it, how many agents ran at once without a usage limit, Binnacle's calculation from Claude Code's `rate_limit` records; not reported for a harness that records none.
- **Commands that copy in one click:** every command a Binnacle skill offers the human to run stands alone in a fenced block, a slash command in a plain fence and a shell command in a `bash` fence, since the Claude desktop app gives a fenced block a copy button and inline code none. Epic 13 rewrites the skills' output later and keeps this.

Exit criterion: the owner goes through every page on their own screen at 100% zoom and reads it without strain; every element of `docs/04-telemetry-dashboard.md` is reachable; a limit set on the Settings page is the one autopilot reads; the commands in a skill's output copy with the button. After the run a Product session reads epic 18's measurement against epic 11 (*Phase 18*).

### Phase 18 — Lean flow

Added on 2026-10-11, after epic 11's autopilot run showed where the per-ticket process spends tokens and time for little return. It comes right after epic 11, before the release's other epics, so that their runs are cheaper (the owner, 2026-10-11). Grilled on 2026-10-11, from `docs/product-inbox.md`'s Lean flow points; the per-ticket flow by hand (`docs/workflow/02-development-workflow.md`, *Per ticket*) changes as autopilot's does:

- Tickets no longer edit the roadmap at all, neither its current focus nor an epic's status: the snapshot derives what is done and what can start from the tickets' statuses. At its end autopilot proposes the whole current focus, the epic's status and the Next action, written only on the owner's yes; otherwise a Product session or a checkpoint writes them.
- Autopilot rebases a branch on `main` itself, in the agent's worktree, and runs the checks. A conflict Git reports aborts the rebase and sends the branch back to its agent; checks that fail after a clean rebase are the one return to the agent, with the exact failure.
- The Review's commit order is no longer required, and autopilot no longer checks it. Rework is read from the runs instead (`CONTEXT.md`, *Review run*, *Rework run*; the owner, 2026-10-11): a review run is a subagent on the Task's branch starting after its first commit changing anything but the ticket, and rework is implementation work after the first review run ends; a Task with no review run keeps the commit that first records its Review as the boundary, and a forge's review stays as it is. This replaces the owner's 2026-10-08 decision (`specs/telemetry-for-any-harness/spec.md`, *Further Notes*). Epic 11 is recalculated by the same rule, so that it stays the baseline.
- A short Review: findings to fix in full, findings kept one line each. Short commit messages, for every commit, Product's included: an English subject of at most 72 characters and a body only when needed (`AGENTS.md`).
- Upkeep once per run, at its end: the frozen install, the plugin, the skills copy, the dashboard and the daemon's restart, each only when one of the run's merges touched it, with no exception for the next ticket (the owner, 2026-10-11).
- Browser checks only for tickets that change `apps/dashboard`; `/to-tickets` writes the criterion for those alone.
- A question offers its options (the owner, 2026-10-11): every `### Question` an agent records carries its options, each with its cost, the recommended one first and marked; `/binnacle:answer` shows them in the owner's language and explains them on request. The asker writes them, never the answerer, so ADR-0040's "an agent never answers a question" holds. The answer Binnacle reads no longer includes the date line `/binnacle:answer` writes above it.
- A defect of epic 11's run: `apps/cli/test/audit.test.ts` stops failing now and then beside `pack.test.ts` in a full run, fixed at its cause rather than retried. Its other defect, graphify refusing a graph that shrinks, went back to epic 11 as ticket 14.

Measured with Binnacle itself, rework share and tokens per completed Task, epic 11 as the baseline. The measurement is not epic 18's exit (the owner, 2026-10-11): epic 18 closes on its tickets, and a Product session reads the "after" from `usage_get`, by the Task ids of the next epic run by autopilot (16), and records it in the roadmap.

## Explicit stop conditions

Do not add autonomous agent orchestration, Release/SRE platform, Kubernetes management, multi-user server mode or auto model routing during MVP implementation.
