# Telemetry and Dashboard

## Purpose

Measure AI-development behavior without pretending all providers expose identical data.

## Primary source

Local session artifacts written by each harness are the primary telemetry source; OpenTelemetry is an optional addition where a harness supports it (ADR-0011). Artifacts exist without any configuration by the user and cover work already done, which is why they come first.

Aggregation semantics differ between harnesses and belong to the adapter contract: some report per-message deltas, others running totals. Adding them the same way double-counts.

## Canonical identity dimensions

Every known AgentRun should identify where possible:

- project;
- task;
- run;
- role;
- harness (`claude-code`, `codex`, `gemini-cli`, etc.);
- provider (`anthropic`, `openai`, `zai`, `google`, `local`, etc.);
- model;
- profile/account category;
- branch/worktree;
- start/end time.

A harness and provider are separate concepts. Example: Claude Code may be used with a non-Anthropic backend/profile.

## Usage fields

Nullable by design:

- input tokens;
- cached input/read tokens;
- cache creation tokens where provider reports them;
- output tokens;
- reasoning/thought tokens where available;
- provider-reported cost;
- tool calls;
- MCP calls;
- subagent activity;
- compaction events;
- duration.

Each metric should carry provenance where relevant:

- `measured`;
- `provider_reported`;
- `calculated`;
- `estimated`.

Do not invent unavailable fields.

## The dashboard is read-only in v1

It shows what is happening. Decisions are made in conversation with an agent, which is the product's whole thesis. Actions can be added later to a read-only design; removing them is harder.

Its only action is copying a command, which the human types. Every view element below appears. One with no source yet says so and why, as the Product Snapshot does, and is never filled in (ADR-0007). Epic 5 builds these views (`specs/minimal-dashboard/spec.md`), and epic 6 rebuilds them with Nuxt UI, in English and Russian (`specs/dashboard-design-and-languages/spec.md`, ADR-0033).

## The shell and its languages

Every view opens in one shell. A rail holds one icon per registered project, with a dot when it has running runs or attention items, and a "+" that shows `binn project register` to copy. A sidebar holds the selected project's name and current Epic, the menu with Attention's count and Settings, and how long ago the data was read. The selected project is the address's `project` query, the first registered project without one. While the daemon does not answer, the shell says so, with `binn daemon start` to copy, and polls on until it does.

Every page is built from Nuxt UI's components and Tailwind's utilities, to the mockup in `specs/dashboard-design-and-languages/design/`; epic 5's plain CSS is gone. The page reaches nothing but the daemon: its fonts are the system's, its Lucide icons are bundled at build time, and it writes no inline `<style>`, which the daemon's Content-Security-Policy refuses.

It speaks English and Russian, one dictionary of the dashboard's own for each. It starts in the browser's first language when it has a dictionary for it, and in English otherwise; the Settings page's choice is kept in the browser. Adding a language is adding a dictionary, which the Settings page then lists. Only the page's own text is translated. Task, Epic, Next action, Suggested step, Backlog, Ready, In progress, Done, Review and Unmet dependency stay English in both languages, and commands, ids, branches, models, repository text and the daemon's messages are never translated.

## Main dashboard views for v1

### Overview

The main screen, for the selected project. It answers where the project stands and what to type next.

- What's next: the Next action, labelled as the roadmap's, with its command to copy, and a warning inside the block when `next_action.missing` or `next_action.stale` is raised; under "or", labelled as Binnacle's calculation (ADR-0032), the snapshot's `next.alternatives`, each with a title and a reason the page writes in its language from the alternative's `kind` and `tasks`, and its command to copy when it has one. An alternative that agrees with the Next action is already left out, so when they agree only the Next action shows;
- the roadmap's epics as a compact stepper, and the current epic's Tasks done out of all of them, `CANCELLED` left out;
- Ready to start, in any order, each Task with the command that starts it; a Task In progress is not one of them. It says how many can run in parallel, from the snapshot's `tasks.parallel`, when at least one place is free and either two Tasks are ready or one is in progress. The current epic's `READY` Tasks that wait on an Unmet dependency follow, dimmed, with what they wait on;
- Running now: each run with its Task or role, harness, model, branch and latest activity, "running" being Binnacle's reading of recent activity;
- attention items, each with its code;
- output tokens today and over the last seven days, linking to Usage.

A roadmap that cannot be read, and a project or epic with no Tasks, each show their state with the attention items that say why.

### Projects

- every registered project in one table: its name, path and registered checkout's Git state; its current Epic and that Epic's status; its Next action, cut to two lines; how many runs run now, and the latest activity; and how many attention items it has;
- a project whose path is unavailable, or whose snapshot failed, says so with the daemon's reason; one whose roadmap cannot be read says that.

### Project

- the roadmap's epics, with their status and spec;
- tasks, on a mini kanban for one epic, the current one unless another is picked: Backlog, Ready, In progress, Done. A card shows its Unmet dependencies and `BLOCKED`. A `READY` Task with AgentRuns attributed to it stands In progress, marked as read from runs, and a card names who works on it, with a live dot while its run is active. Done shows its count and its latest cards until opened;
- reviews: whether a `DONE` Task's ticket records a Review, and never a review state the ticket does not;
- usage by role;
- the registered checkout, recent decisions, and pending decisions and CI, not available.

### Task

- the brief, the branch and the command that starts the Task; for a Task In progress from its runs, the same command, labelled as resuming it, and none for a `DONE` or `CANCELLED` one;
- the ticket's body and its Review, as plain text, or "no Review yet";
- AgentRun timeline;
- implementation usage;
- review usage — not available: review runs are not told apart from implementation runs;
- correction/rework usage — not available, for the same reason;
- questions/answers — not available: they are not yet explicit artifacts;
- branch/worktree.

### Usage

- tokens by kind today and over the last seven days: input, cached input, cache creation, output, and reasoning as the part of output it is. A kind no record reports is "not reported", never zero, and a partial, calculated or estimated total is marked. One line under them gives the import window's totals, marked the same way, and how many records each period counts;
- by model and by provider over the last seven days, a provider no artifact states being "not reported"; by Task, the largest Tasks, with the unassigned total; and by role, over the import window. Each is a bar of one kind of token, output unless another is picked: kinds are never added together. A row is one line, its name, its bar and its figure, with its record count, and a Task's title, in its tooltip;
- the derived metrics below that have a source, labelled as Binnacle's calculation: tokens per completed Task, runs per Task, and the weekly trend as CSS bars;
- each harness with its support level, named as in `CONTEXT.md` (Context, Attribution, Usage, Live), or the daemon's reason for none;
- cost, not available, with the reason.

### Attention/current activity

- every project's attention items with their codes, grouped by project, beside the runs running now and the recent runs of every project.

### Settings

Settings are shown, never written (ADR-0020): each says where it is changed.

- the language, a choice among the dashboard's dictionaries, kept in the browser;
- the selected project's settings from `project.status`'s manifest: tracker, workflow, capabilities, automation with `max_parallel_development_tasks` (where the manifest writes none, the limit the snapshot uses) and telemetry, under the keys `.binnacle/project.yaml` spells them with. The page names that file as the one to edit, and says the daemon reads a change on its next refresh. The status's diagnostics follow with their codes. A project whose manifest cannot be read says so with the daemon's reason, and `binn init` to copy;
- the daemon's version and address, from `daemon.status`, with `binn daemon stop` and `binn daemon start` to copy; its port is `BINNACLE_PORT`, read when it starts.

## High-value derived metrics

Derived metrics must be labeled as Binnacle calculations.

- tokens per completed task;
- runs per task;
- rework share;
- first-pass review acceptance;
- context growth;
- usage before first edit (context acquisition proxy);
- usage by role/provider/model;
- weekly burn trend.

Never optimize a single metric in isolation. Token reduction that increases rework/regressions is not a win.

## Product session health

Harnesses signal context exhaustion in incompatible ways. Claude Code emits an explicit compaction boundary carrying an `auto` or `manual` trigger; Codex emits no such event and instead rotates a context-window identifier; a newer agent may expose nothing at all.

Binnacle normalises these into one signal, **context pressure**: cumulative input over the session plus explicit compaction markers where they exist, each carrying its provenance per ADR-0007. Where a harness reveals nothing, the signal is absent rather than guessed.

It surfaces as an attention item suggesting `/checkpoint`. Thresholds are configuration, not universal truths.

## Historical import

Session archives are large — hundreds of megabytes per harness is normal. `binn init` reports how many sessions each harness has in the repository and how far back they go, reading only the start of each, then asks how much to import, before it shows its plan: a number of days, 90 by default, or `all`. The answer is `telemetry.import.window_days` in the manifest the plan creates, or a line printed for an existing one.

Records whose task attribution cannot be proven are kept at project level as `unassigned` rather than guessed.
