# Telemetry and Dashboard

## Purpose

Measure AI-development behavior without pretending all providers expose identical data.

## Primary source

Local session artifacts written by each harness are the primary telemetry source; OpenTelemetry is an addition where a harness exports it (ADR-0011, ADR-0038). Artifacts exist without any configuration by the user and cover work already done, which is why they come first. The daemon also accepts OTLP logs as JSON over HTTP at its own address, which `binn init` points Claude Code, Codex and Gemini CLI at: an event becomes a record with the same fields as an artifact's, never its content, shows a running session as it runs, and a call seen both ways is counted once, as its artifact's record. Each harness, its level and how it is reached are listed in `03-mcp-and-skills.md`, *Harnesses and their levels*.

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

## Run roles

A run's role is read from the runs, Git and the forge, never from what an agent wrote, and is labelled as Binnacle's calculation:

- `product` — on the default branch;
- `implementation` — on a Task's branch, unless one of the two below applies;
- `review` — a subagent run on a Task's branch that starts after the branch's first commit changing anything but its ticket. The branch's commits are read from its tip while it exists, the commit that first adds a `### Review` heading to the ticket and the commit on the default branch that set it `DONE`, leaving out those authored before the Task's first record on its branch and those the default branch held, by its reflog, before it took the branch: its own commits, and other branches merged there, that the branch started from or was rebased onto;
- `rework` — the other work on a Task's branch after its first review run ends, whenever the Review was committed. Review runs started before the first one ended, as reviewers started side by side are, end it together, with the last record of any of them. A Task with no review run keeps the commit that first adds `### Review` to its ticket as the boundary. On GitHub or GitLab, which keep no Review in a ticket, it is the work after the first review on the Task's pull or merge request that requested changes, read with the tracker's token. A forge's review leaves no subagent run, so no run there is a review run, and where its requests cannot be read — no token, no request, a forge that refused — the Task says why in `reworkUnread`;
- `unknown` — any other branch.

A run whose records cross such a point is split there, as a run is split where its branch changes. Roles are computed whenever usage is read, so a change of this rule reads every past Task by it, with nothing stored to migrate. The rework share and first-pass review acceptance below follow from these roles; a Task counts as reviewed for the latter when its ticket records a Review.

## The dashboard is read-only in v1

It shows what is happening. Decisions are made in conversation with an agent, which is the product's whole thesis. Actions can be added later to a read-only design; removing them is harder.

Its only action is copying a command, which the human types. Every view element below appears. One with no source yet says so and why, as the Product Snapshot does, and is never filled in (ADR-0007). Epic 5 builds these views (`specs/minimal-dashboard/spec.md`), and epic 6 rebuilds them with Nuxt UI, in English and Russian (`specs/dashboard-design-and-languages/spec.md`, ADR-0033).

## Opening it

`binn dashboard` opens the daemon's address in the default browser with the token in its fragment, which the page moves into the browser's storage (ADR-0031), and prints the address without the token. A skill's shell output reaches the model's provider, and the token authorises the daemon's local API, so `/binnacle:dashboard` runs `binn dashboard` and shows only that token-free address. When no browser can be opened, `binn dashboard` says to run `binn dashboard --print` at a terminal: `--print` prints the address with its token and opens nothing, for a human to open by hand or in another browser. With the daemon stopped, both give `daemon.unreachable`, and the skill names `/binnacle:daemon start`.

## The shell and its languages

Every view opens in one shell. A rail holds one icon per registered project, with a dot when it has running runs or attention items, and a "+" that shows `binn project register` to copy. A sidebar holds the selected project's name and current Epic, the menu and how long ago the data was read. The menu has the selected project's Overview, Project and Usage, then, under a divider, the general pages: Projects, Attention with a count of every project's attention items, and Settings. The selected project is the address's `project` query, the first registered project without one. While the daemon does not answer, the shell says so, with `binn daemon start` to copy, and polls on until it does.

Every page is built from Nuxt UI's components and Tailwind's utilities, to the mockup in `specs/dashboard-design-and-languages/design/`; epic 5's plain CSS is gone. The page reaches nothing but the daemon: its fonts are the system's, its Lucide icons are bundled at build time, and it writes no inline `<style>`, which the daemon's Content-Security-Policy refuses.

It speaks English and Russian, one dictionary of the dashboard's own for each. It starts in the browser's first language when it has a dictionary for it, and in English otherwise; the Settings page's choice is kept in the browser. Adding a language is adding a dictionary, which the Settings page then lists. The page's own text is translated, and so are the daemon's reasons the page knows: a conflict risk's reason, which in another language than English it writes from the pair's risk and its Tasks' modules, and the reasons with no part of their own, such as "There is no graph.", which it matches by their text. File and module names in them stay as they are, and a reason the page has no translation for is shown as the daemon wrote it, marked English. Task, Epic, Next action, Suggested step, Backlog, Ready, In progress, Done, Review and Unmet dependency stay English in both languages, and commands, ids, branches, models, repository text and the daemon's other messages are never translated.

## Main dashboard views for v1

### Overview

The main screen, for the selected project. It answers where the project stands and what to type next.

- What's next: the Next action, labelled as the roadmap's, with its command to copy, and a warning inside the block when `next_action.missing` or `next_action.stale` is raised; under "or", labelled as Binnacle's calculation (ADR-0032), the snapshot's `next.alternatives`, each with a title and a reason the page writes in its language from the alternative's `kind` and `tasks`, and its command to copy when it has one. An alternative that agrees with the Next action is already left out, so when they agree only the Next action shows;
- the roadmap's epics as a compact stepper, and the current epic's Tasks done out of all of them, `CANCELLED` left out;
- Ready to start, in any order, each Task with the command that starts it; a Task In progress is not one of them. It says how many can run in parallel, from the snapshot's `tasks.parallel`, when at least one place is free and either two Tasks are ready or one is in progress. Beside it, labelled as Binnacle's calculation, the conflict risk from `tasks.parallel.impact`: each Task in flight and ready to start with the modules it touches, read from its branch or its ticket, and each pair's risk and its reason, both in the page's language; without a graph, not available, with the reason. The current epic's `READY` Tasks that wait on an Unmet dependency follow, dimmed, with what they wait on;
- Running now: each run with its Task or role, harness, model, branch and latest activity, "running" being Binnacle's reading of recent activity;
- attention items, each with its code;
- output tokens today and over the last seven days, linking to Usage.

A roadmap that cannot be read, and a project or epic with no Tasks, each show their state with the attention items that say why.

### Projects

- every registered project in one table: its name, path and registered checkout's Git state; its current Epic and that Epic's status; its Next action, cut to two lines; how many runs run now, and the latest activity; and how many attention items it has;
- a project whose path is unavailable, or whose snapshot failed, says so with the daemon's reason; one whose roadmap cannot be read says that.

### Project

- the roadmap's epics, with their status and spec;
- *Waiting for the owner*, the snapshot's `pendingDecisions`: the unanswered questions, each with its Task, its text and the branch it was read from; the Tasks waiting for an approval, in `READY_FOR_REVIEW`; and the `ready-for-human` Tasks ready to start; or not available, with the tracker's reason;
- tasks, on a mini kanban for one epic, the current one unless another is picked: Backlog, Ready, In progress, Done. A card shows its Unmet dependencies, `BLOCKED` and how many of its questions are unanswered. A `READY` Task with AgentRuns attributed to it stands In progress, marked as read from runs, and a card names who works on it, with a live dot while its run is active. Done shows its count and its latest cards until opened;
- reviews: whether a `DONE` Task's ticket records a Review, and never a review state the ticket does not;
- usage by role;
- the registered checkout; the graph, from the snapshot's `graph` section: the commit it was built from and when, whether the default branch has moved past it, and the last run's outcome, commit, time and Graphify's reason when it failed, or why there is no graph; recent decisions; and CI, from the snapshot's `ci` section, as the forge reports it: the default branch with its state, its commit linked to the forge and when, then the open pull requests, each with its number linked, its title, whether it is a draft, its branch, the Task it maps to linked to its page, and its state; or not available, with the reason.

### Task

- the brief, the branch and the command that starts the Task; for a Task In progress from its runs, the same command, labelled as resuming it, and none for a `DONE` or `CANCELLED` one;
- the ticket's body and its Review, as plain text, or "no Review yet";
- AgentRun timeline;
- usage by role: implementation, review and rework side by side, labelled as Binnacle's calculation from the Task branch's runs and commits (*Run roles*), with the reason when the Task's rework cannot be read on GitHub or GitLab;
- questions/answers, each question with its answer or as unanswered, and the branch they were read from;
- the Task's pull or merge request, from `task.get`'s `request`: its number linked to the forge, its title, whether it is a draft, its branch and its CI state as the forge reports it; none when it has no open one, or not available, with the reason;
- branch/worktree.

### Usage

- tokens by kind today and over the last seven days: input, cached input, cache creation, output, and reasoning as the part of output it is. A kind no record reports is "not reported", never zero, and a partial, calculated or estimated total is marked. One line under them gives the import window's totals, marked the same way, and how many records each period counts;
- by model and by provider over the last seven days, a provider no artifact states being "not reported"; by Task, the largest Tasks, with the unassigned total; and by role, over the import window. Each is a bar of one kind of token, output unless another is picked: kinds are never added together. A row is one line, its name, its bar and its figure, with its record count, and a Task's title, in its tooltip;
- the derived metrics below that have a source, labelled as Binnacle's calculation: tokens per completed Task, the same before and after Ponytail, runs per Task, the weekly trend as CSS bars, the rework share of each completed Task (its rework tokens over its implementation and rework tokens) and their mean, first-pass review acceptance (the share of reviewed completed Tasks with no rework run), and each run's context growth (the context — input, cached input and cache creation together — of its first, latest and largest call), a count a harness does not report being "not reported". Ponytail's date is the first commit on the default branch that adds the word to `AGENTS.md` or `CLAUDE.md`, and a Task is before or after it by the commit that set it `DONE`; where a side has no Task, or no commit names Ponytail, the page gives the daemon's reason;
- each harness with its support level, named as in `CONTEXT.md` (Context, Attribution, Usage, Live), with the reason a harness that cannot export stays below Live, or the daemon's reason for none;
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

- tokens per completed task, and the same before and after Ponytail;
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

Binnacle normalises these into one signal per session, **context pressure**, carried by each of its runs, each part with its provenance per ADR-0007:

- the context its latest call read: input, cached input and cache creation together, Binnacle's sum, so `calculated`;
- the compactions seen in it, their count and the latest with its time: Claude Code's boundaries with their trigger, `provider_reported`, and Codex's changes of context window, Binnacle's reading of a compaction, `calculated` and with no trigger.

Where a harness reveals neither, the signal is absent rather than guessed. pi's compactions are not part of the signal: pi writes them with no trigger, so Binnacle reads no marker from them.

An active Product session — a main session on the default branch — raises the attention item `context.pressure` when its latest call read at least the threshold, or when it compacted after the project's last recorded checkpoint, or at all, when none is recorded. The item names the session, its context and its compaction, and suggests `/binnacle:checkpoint`, then a fresh session. A subagent's session raises none. The threshold is `telemetry.context_pressure.tokens` in the manifest, 150 000 where it writes none: configuration, not a universal truth.

## Historical import

Session archives are large — hundreds of megabytes per harness is normal. `binn init` reports how many sessions each harness has in the repository and how far back they go, reading only the start of each, then asks how much to import, before it shows its plan: a number of days, 90 by default, or `all`. `--window <days|all>` answers it without asking, and `binn init --plan --json` asks nothing: it uses `--window`, or else the default, and carries the history and the window in its JSON. `binn init --apply <id>` takes the window the same way, so it is given the `--window` the plan was shown with. The answer is `telemetry.import.window_days` in the manifest the plan creates, or a line printed for an existing one.

Records whose task attribution cannot be proven are kept at project level as `unassigned` rather than guessed.
