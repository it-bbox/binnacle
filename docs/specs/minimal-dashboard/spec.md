# Spec: Minimal Dashboard

Status: READY
Triage: ready-for-agent

Epic 5 of v1, as defined in `docs/05-mvp-plan.md` phase 5. Exit criterion, as the owner set it while grilling: on the owner's running daemon, the owner takes the next step from the dashboard alone, without asking an agent what to type. The Task it starts moves to In progress, naming who works on it, and then to Done. The Usage page's figures equal `usage_get`'s for the same window, and every element without a source says why.

## Problem Statement

On 2026-09-26, closing epic 4, the owner reported that the process was hard to follow. Two moments made it concrete. `/binnacle:task` showed a ticket's brief but did not start it, and the command that does start it, `/mattpocock-skills:implement <ticket path>`, appeared nowhere. And the roadmap's next action was written as a paragraph, which left the owner asking what to type.

Everything Binnacle knows is reachable only from inside a session: the snapshot, the daily, a Task's brief, the usage. To learn where a project stands, the owner starts a session and asks. The scope promises more than that: the user should always know what is running, what is waiting, what requires attention and how much it consumed (`docs/00-scope.md`, *Workflow observability*). `apps/dashboard` is an empty directory.

Two things cannot be seen even from inside a session:

- **Which ticket is being worked on, and by whom.** A ticket's `Status:` reads `READY` for as long as a session works on it, because the implementation session sets `DONE` in its last commit, on its own branch.
- **Whether the focus still tells the truth.** A roadmap focus that lags behind the work gives no sign that it does.

## Solution

A read-only dashboard in the browser, served by the daemon at its own address (ADR-0031). `binn dashboard` opens it, already authorised, and the plain address works as a bookmark afterwards.

Its main screen answers where each registered project stands and what to type next:

- the roadmap position;
- the **Next action**, from the current focus, with its command and a copy button;
- beside it, Binnacle's **Suggested step**, computed from the Tasks, their runs and the roadmap, and labelled as Binnacle's calculation (ADR-0032);
- what is running now, and who runs it;
- the Tasks ready to start, each with the command that starts it;
- attention;
- a line of usage.

A focus that ends without a command, or whose command names finished work, is an attention item.

There are six pages, as the plan lists them: Overview, Projects, Project, Task, Usage, Attention/current activity. On the Project page, a mini kanban shows each epic's Tasks in four columns: Backlog, Ready, In progress, Done. A `READY` Task with AgentRuns attributed to it stands In progress, marked as read from runs, and its card names who works on it. The ticket is never changed.

The Task page shows the brief, the start command, the runs and the Task's **Review**, which Binnacle reads from the ticket's `### Review` section. A `DONE` Task without a Review is an attention item. The Usage page adds derived metrics, each labelled as a calculation: tokens per completed Task, runs per Task and a weekly trend. Every view element in `docs/04-telemetry-dashboard.md` appears, and an element with no source yet says so and why: review and rework usage, questions and answers.

The dashboard's only action is copying a command. The human types it.

The daemon computes everything once. The Product Snapshot therefore carries the same Next action, Suggested step and running runs, and `/binnacle:product` ends with them. `/binnacle:task` ends with the Task's start command, the one the dashboard shows.

## User Stories

### Knowing what to type next

1. As the owner, I want the dashboard's main screen to show, for each registered project, where it stands on its roadmap, so that I do not have to open a session to find out.
2. As the owner, I want the main screen to show the roadmap's Next action with its command, so that I copy the command instead of working it out.
3. As the owner, I want a copy button beside every command the dashboard shows, so that I paste exactly what to type.
4. As the owner, I want Binnacle's Suggested step beside the Next action, labelled as Binnacle's calculation, so that I still know what to do when the focus lags.
5. As the owner, I want an attention item when the current focus ends without a command, so that a paragraph-shaped next action is caught before it leaves me guessing.
6. As the owner, I want an attention item when the Next action's command names a Task already `DONE` or `CANCELLED`, so that a stale focus is visible.
7. As the owner, I want the Suggested step to say that a Task is being worked on, and which, while an implementation run is active, so that I wait instead of starting something on top of it.
8. As the owner, I want the Suggested step to name a Task that is in progress but idle, with the command that resumes it, so that abandoned work is picked up.
9. As the owner, I want the Suggested step to offer `/binnacle:autopilot` when the current epic has Tasks ready to start and nothing is in progress, so that one command runs a planned epic.
10. As the owner, I want the Suggested step to name the planning command the current epic needs next — grilling, the spec or the tickets — so that planning is as easy to follow as building.
11. As the owner, I want the Suggested step to say when every Task of the current epic is finished but the epic is not marked done, so that closing an epic is not forgotten.
12. As the owner, I want the Suggested step to say when no Task can start because every ready one waits on an Unmet dependency, so that a stuck epic does not look idle.
13. As the owner, I want the main screen to list the Tasks ready to start, each with the command that starts it, so that I can start one by hand instead of running autopilot.
14. As the owner, I want the main screen to show what is running now — which Task, harness, model and role, and when it was last active — so that I know who is busy with what.
15. As the owner, I want the main screen to show today's and this week's usage in one line, with a way to the Usage page, so that the burn is visible without being the headline.
16. As a Product Steward, I want the Product Snapshot to carry the same Next action, Suggested step and running runs, so that `/binnacle:product` also ends with the command to type.

### Starting a Task

17. As the owner, I want `/binnacle:task` to end with the exact command that starts the Task in a fresh session, so that reading a brief leads straight to starting it.
18. As the owner, I want that command to be the same one the dashboard shows for the Task, so that there is one way to start a Task.
19. As the owner, I want no start command for a Task that is `DONE` or `CANCELLED`, so that finished work is not restarted by accident.
20. As a user of a project with another workflow, I want no Matt Pocock command offered, so that the dashboard does not tell me to type commands my project does not have.

### The board

21. As the owner, I want a mini kanban of a project's Tasks on the Project page — Backlog, Ready, In progress, Done — so that I see at a glance where each ticket is.
22. As the owner, I want the board to open on the current epic and switch to any other, so that finished epics do not crowd the current one.
23. As the owner, I want a `READY` Task with AgentRuns attributed to it shown In progress, marked as read from runs, so that a ticket being worked on does not sit in Ready.
24. As the owner, I want each In progress card to name who works on it — harness, model, role and latest activity — and whether it is running now, so that I see who is busy with what.
25. As the owner, I want a card's Unmet dependencies shown on it, so that I see why a ready-looking ticket cannot start.
26. As the owner, I want `BLOCKED` and the review states shown on their cards, so that the In progress column does not hide a Task that waits.
27. As the owner, I want Done to show how many Tasks are finished and the latest of them, so that the board stays small.
28. As a maintainer, I want the board to leave every ticket untouched, so that a reading never becomes a write (ADR-0032).

### Task detail

29. As the owner, I want a Task page with its brief — state, triage, dependencies, spec, ticket and body — so that I can read a ticket without opening a session.
30. As the owner, I want the Task page to show its branch and its start command, so that starting it from there is one copy.
31. As the owner, I want the Task page to show the Task's Review as the ticket records it, so that I see what the review found and what was fixed or kept.
32. As the owner, I want the Task's AgentRun timeline — each run's harness, model, role, branch, checkout, start, latest activity and tokens — so that I see how the Task was built.
33. As the owner, I want the Task's implementation usage, so that I see what it cost.
34. As the owner, I want review usage, rework usage, and questions and answers shown as not available, with the reason, so that I know they are missing rather than zero.

### Usage

35. As the owner, I want the Usage page to show today's and the last seven days' tokens, field by field, so that I see the burn per kind of token.
36. As the owner, I want usage by model and by provider, with a provider no artifact states shown as not reported, so that I see where the tokens went.
37. As the owner, I want usage by Task, unassigned and by role over the window, so that I see what the work cost and how much of it went to Product sessions.
38. As the owner, I want tokens per completed Task, labelled as Binnacle's calculation, so that I can compare the cost of finished work.
39. As the owner, I want runs per Task, labelled, so that I see which Tasks took several runs.
40. As the owner, I want a weekly trend over the window, labelled, so that I see whether the burn goes up or down.
41. As the owner, I want each harness's support level on the Usage page, so that I know how far each is seen.

### Attention and current activity

42. As the owner, I want one page with every attention item of every project and its code, so that nothing that needs me hides in a project I did not open.
43. As the owner, I want a `DONE` Task without a Review to be an attention item, so that a skipped review is visible.
44. As the owner, I want that page to list the runs active now and the most recent ones, so that I see what happened while I was away.

### Projects

45. As the owner, I want a Projects page with every registered project, its position, its registered checkout's branch and state, and its latest activity, so that I see all my projects at once.
46. As the owner, I want a project whose path is unavailable shown with the reason, so that a moved repository is visible.

### Opening the dashboard

47. As the owner, I want `binn dashboard` to open the dashboard in my browser, already authorised, so that opening it is one command.
48. As the owner, I want the plain address to work as a bookmark afterwards, so that I do not need the command every time.
49. As the owner, I want the dashboard to refresh itself while I look at it, so that what is running stays current without a reload.
50. As the owner, I want a page naming the command that builds the dashboard when it has not been built, so that a fresh checkout does not show a blank page.
51. As the owner, I want a page telling me to run `binn dashboard` when the browser holds no valid token, so that a stale bookmark says what to do.
52. As a user on a machine without a browser, I want `binn dashboard --print` to print the address without opening anything, so that I can open it elsewhere on the same machine.

### Truthfulness and guarantees

53. As the owner, I want every view element of the plan present, and those without a source saying so and why, so that nothing is silently dropped or invented (ADR-0007).
54. As the owner, I want every derived number and every reading labelled as Binnacle's calculation, so that I never take it for a reported fact.
55. As a developer, I want the dashboard read-only, with copying as its only action, so that decisions stay in conversation with an agent (`docs/04-telemetry-dashboard.md`).
56. As a developer, I want the page to reach only the daemon, so that project data goes nowhere else.
57. As a developer, I want repository text rendered as text, never as HTML, so that a ticket cannot run a script in the page that holds the token (ADR-0031).
58. As a developer, I want the daemon never to serve a file outside the dashboard's generated directory, so that the static route cannot read my disk.
59. As a developer, I want the daemon's authentication unchanged, so that the dashboard adds no way in.
60. As a developer, I want the daemon still to write nothing into my repository with the dashboard in use (ADR-0020).
61. As a developer, I want my project developable as before when the daemon or the dashboard is not running (`AGENTS.md` §3).
62. As a maintainer, I want all logic in the daemon and the pages only rendering its answers, so that one seam tests everything.
63. As a maintainer, I want the exit criterion demonstrated by the owner on their own daemon, so that "easy to follow" is judged by the person who found it hard.

## Implementation Decisions

### Workspace

- `apps/dashboard` becomes `@binnacle/dashboard`: a Nuxt 4 application in client-side-only mode (`ssr: false`), generated to static files with `nuxt generate`. Nuxt is a build-time dependency of this package only. Nothing of it runs in the daemon, and the daemon, the CLI and the MCP server gain no dependency. The package's TypeScript is checked by Nuxt's own typecheck, which the root typecheck does not reach. The workspace gains one script that generates the dashboard.
- `packages/core` gains the pure rules: the Next action, read by the roadmap parser; the Suggested step; a Task's board column; and the start command. None of them does I/O.
- `packages/telemetry`'s observed run gains its checkout: the root of the checkout its records' `cwd` lies in.
- `packages/adapters`' local tracker reads a ticket's Review.
- The daemon gains:
  - the static route;
  - the `task.list` operation;
  - the snapshot's `next` and `activity` sections and `usage.byProvider`;
  - `review` and `start` in the Task brief;
  - derived metrics in `usage.get`.
- `apps/cli` gains `binn dashboard`.
- The `binnacle` plugin's `task` and `product` skills learn the new fields.
- `packages/mcp` gains no tool. `project_snapshot`, `task_get` and `usage_get` carry the new fields, because each maps one-to-one onto its operation.

### Serving the dashboard (ADR-0031)

- The daemon tries its routes in order: `/health`, then `/ops/`, then the static route for every other path. The static route takes `GET` and `HEAD`; any other method is `request.method_not_allowed`.
- The static route serves from the dashboard package's generated directory, which the daemon finds from its own location in the workspace. `DaemonOptions` accepts another directory, so tests point it at a temporary one.
- `/` serves `index.html`. A path naming a file in the directory serves that file. Any other path serves the client-side routing fallback, `200.html`.
- No path is served whose resolution leaves the directory. `..` and its percent-encoded forms, backslashes and absolute paths all answer `request.not_found`.
- Content types come from a fixed extension map, and anything else is `application/octet-stream`.
- Every static response carries:
  - a `Content-Security-Policy` that lets the page load from and connect to its own origin only;
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: no-referrer`.

  HTML is not cached.
- The `Host` check runs first, as on every route. The static route needs no token and serves no project data.
- When the dashboard has not been generated, every static path answers a short HTML page naming the command that generates it.

### Opening it: `binn dashboard`

- The command reads the runtime file and the token as every command does. With no daemon answering, it gives `daemon.unreachable` and the fix, `binn daemon start`.
- It prints `http://<host>:<port>/#token=<token>` and opens that address in the default browser through the platform's opener. `--print` prints without opening.
- The page moves the token from the fragment to the browser's local storage and drops the fragment from the address by replacing the history entry.
- Without a stored token, and on `auth.missing` or `auth.invalid`, the page shows one line: run `binn dashboard`.

### The Next action (ADR-0032)

- The roadmap parser reads it from the current focus. The focus must end with a paragraph that starts with `Next action:` and ends with an inline code span. That final code span is the command. The text between `Next action:` and it is the description, and code spans inside the description stay text.
- **Missing.** No focus, or a focus whose last paragraph is not shaped so, gives `next_action.missing`.
- **Stale.** A command that names a Task — by its ticket path, id, issue URL or `#number` — whose state is `DONE` or `CANCELLED` gives `next_action.stale`.
- Both are attention items in the snapshot's `attention`, and both are deterministic.

### The Suggested step (ADR-0032)

- It is a pure function of the roadmap's epics, the Tasks, the project's observed runs and the manifest's `workflow.provider`. It returns a description, a command or none, and the Task it names if it names one. Its provenance is `calculated`.
- The current epic is the first row whose status is not `done`. The first rule that applies wins:
  1. An implementation run of a Task the board places In progress is active: that Task is being worked on. No command. A Task `DONE`, `MERGED` or `CANCELLED` is not waited on, whatever its runs.
  2. A Task is In progress with no active run: resume it, with its start command.
  3. The current epic is `tickets` or `in progress`, and one of its `READY` Tasks has no Unmet dependency: `/binnacle:autopilot`.
  4. The current epic has `READY` Tasks, and every one of them waits on an Unmet dependency: nothing can start, and it says which Tasks they wait on. No command.
  5. The current epic has Tasks, and all of them are `DONE` or `CANCELLED`: close the epic in a Product session, `/binnacle:product`.
  6. The current epic is `not started`: `/mattpocock-skills:grill-with-docs`.
  7. The current epic is `spec` without a spec link: `/mattpocock-skills:to-spec`. It is `spec` with one, or `tickets` without Tasks: `/mattpocock-skills:to-tickets`.
  8. Every epic is `done`: it says so. No command.
- Only implementation runs count for rule 1. A Product session's own run never turns the step into waiting.
- The commands belong to the Matt Pocock chain and the `binnacle` plugin. With any other `workflow.provider`, the step comes with its description and no command.

### The start command

- It is `/mattpocock-skills:implement <ticket>`, where `<ticket>` is the Task's ticket path or URL. It exists when `workflow.provider` is `matt-pocock` and the Task is neither `DONE` nor `CANCELLED`, and is none otherwise.
- The brief carries it as `start`, `task.list` carries it for each Task, and the Suggested step uses it.
- The `task` skill ends with it: "To start it, in a fresh session:", followed by the command.

### The snapshot

- `next`: the Next action (description and command, or `null`) and the Suggested step.
- `activity`:
  - `running`: the project's runs active now, with the section limit and a remainder;
  - `recent`: its latest other runs, up to the section limit.

  Each run appears as `usage.get` gives it, plus its Task's title and its checkout.
- `usage.byProvider`: the last seven days per provider, with the runs whose artifacts state no provider in a row of their own.
- New attention codes: `next_action.missing`, `next_action.stale` and `review.missing`.
- The `product` skill shows `activity.running` beside the Tasks in flight. It ends with `next`: the Next action and its command, then the Suggested step, labelled as Binnacle's.

### The board: `task.list`

- Input: the caller's path and an optional spec slug. Without a slug, it answers for the current epic. Remote-tracker Tasks that carry no spec form a group of their own.
- Output: the epic's Tasks. Each carries its id, title, state, column and the column's source (`state` or `runs`), its Unmet dependencies and ticket, whether a Review is recorded (`null` where that is unavailable), its start command, and its latest run (harness, model, role, latest activity, active) or none. Each column has the section limit and a remainder; Done lists its latest Tasks by id.
- Columns:
  - **Backlog**: `BACKLOG`.
  - **Ready**: `READY` with no attributed run.
  - **In progress**: `ACTIVE`, `BLOCKED`, `READY_FOR_REVIEW`, `APPROVED` and `MERGE_READY` by state, plus `READY` with an attributed run, whose source is `runs`.
  - **Done**: `MERGED` and `DONE`.

  `CANCELLED` is counted but not listed. A Task whose state is unknown is listed apart, with its diagnostic.

### The Review

- The local tracker reads a ticket's Review: the text under its `### Review` heading inside `## Comments`, up to the next heading of the same level or above. The brief carries it as text, cut at the body limit, with `truncated`.
- On GitHub and GitLab the Review is unavailable, because Binnacle reads the issue body and never its comments. `review.missing` does not run there.
- `review.missing` fires for a `DONE` Task on the local tracker that has no Review.

### Derived metrics in `usage.get`

`usage.get` without a Task gains `derived`, and each part is labelled `calculated`:

- **Per completed Task**: each `DONE` Task's totals and run count over the window, largest totals first, with the section limit and a remainder. Their mean, per field. And how many `DONE` Tasks have no attributed runs, which the mean leaves out.
- **Runs per Task**: for each Task with runs, how many there are and how many of them were subagents', and the mean.
- **Weekly**: totals per calendar week over the window, weeks starting on Monday, in the daemon's time zone.

Fields are never added to one another. A mean follows the totals' rules for `null` and `partial`.

### The pages

- There are six pages: Overview, Projects, Project with its board, Task, Usage, and Attention/current activity. Each renders the daemon's answers and computes nothing beyond formatting.
- The pages call `project.list`, `project.snapshot`, `task.list`, `task.get` and `usage.get`, with `POST /ops/…` and the Bearer token, and call nothing else.
- A visible page refreshes its data every 15 seconds. A hidden one does not.
- Every command has a copy button, through the Clipboard API. Loopback is a secure context.
- Repository text — a ticket body, a Review, the focus — is rendered as text, never as HTML.
- Every reading carries its label where it is shown: the Suggested step, an In progress card read from runs, a derived metric.
- Every element without a source says "not available" and gives the reason. That covers review usage, rework usage, questions and answers, pending decisions, CI and cost.
- The UI is in English. There is no UI kit and no chart library: bars are drawn in CSS.

### Documents this epic changes

- `docs/01-architecture.md`, *Security boundary*: the static route, and how the token reaches the page (ADR-0031).
- `docs/03-mcp-and-skills.md`:
  - the snapshot's `next` and `activity`;
  - the brief's `review` and `start`;
  - `usage_get`'s derived metrics;
  - the new attention codes;
  - `task.list`.
- `docs/04-telemetry-dashboard.md`: the views as built — the main screen's role, the board, and what is not available.
- `docs/workflow/02-development-workflow.md`: the start command comes from `/binnacle:task` or the dashboard.
- `README.md` and `README.ru.md`: `binn dashboard`, and the command that generates the dashboard.
- Already updated while grilling: `CONTEXT.md`, `docs/05-mvp-plan.md` phase 5 and `docs/roadmap.md`.

### Standing guarantees this epic must not break

- No model invocation (ADR-0012).
- No writes into the repository by the daemon, the MCP server or the dashboard (ADR-0020). The tracker stays read-only (ADR-0013).
- No network traffic added. The page talks to loopback only.
- Binnacle is not a required runtime (`AGENTS.md` §3).
- Same state, same answer. The clock enters only through `active` and the calendar windows, as before.

## Testing Decisions

### What a good test is here

As in epics 1 to 4, a test states an externally observable fact: an operation's answer, an attention item, a served file, a refused path, a line `binn dashboard` printed. It does not assert which function ran.

### Seam 1: the daemon's HTTP API, offline

This is the main seam, through the existing in-process test daemon. As before, it runs over real fixture repositories with real branches, worktrees and tickets, and over session artifacts cut from real ones. Through it:

- **The Next action:** a focus ending in a command, and its description; a focus without one, and one ending in prose, each giving `next_action.missing`; a command that names a `DONE` Task by path, and one that names it by id, giving `next_action.stale`.
- **The Suggested step:** each rule, in order, on fixtures that make exactly one rule apply. A Product session's active run does not trigger rule 1. Another `workflow.provider` gives no commands.
- **The start command:** present for a `READY` Task, absent for `DONE` and `CANCELLED`, and absent under another workflow.
- **`task.list`:** every column; `READY` with a run standing In progress with source `runs`; `CANCELLED` counted but not listed; a Task with an unknown state listed apart; the section limit; and the current epic when no slug is given.
- **The Review:** found under `## Comments`, cut at the body limit; absent, which gives `review.missing` for a `DONE` Task; and unavailable on a remote tracker.
- **The snapshot's `activity`,** running and recent, with checkouts; and `usage.byProvider`, with the row for no stated provider.
- **Derived metrics:** per completed Task with its mean, and the `DONE` Tasks without runs left out; runs per Task, with subagents; weekly totals; `null` and `partial` carried through.
- **The static route:**
  - `index.html`, an asset with its content type, and the fallback for a client-side path;
  - the security headers;
  - `..`, encoded `..` and backslash paths refused;
  - a foreign `Host` refused;
  - a method other than `GET` or `HEAD` refused;
  - the not-generated page, when the directory is missing;
  - `/ops/` still requiring the token.

The existing **write guarantee** now also calls `task.list` and requests static files, and checks that the repository is unchanged.

### Seam 2: `binn dashboard` as a subprocess

As with `binn init`, with `HOME` pointed at a temporary directory. Through it: `--print` prints the address with the running daemon's host, port and token, and with no daemon the command gives `daemon.unreachable` and its fix.

### Seam 3: the MCP smoke test

Unchanged, and still one test. `project_snapshot` carries the new sections because it maps one-to-one onto the operation.

### Not automated

- **The pages** (the owner's decision while specifying). They only render the daemon's answers. The exit demonstration verifies them on the owner's daemon. No browser or component test suite is added.
- **The `task` and `product` skills' presentation**, as before. The exit demonstration verifies it too.

### Prior art

- `apps/daemon/test/snapshot.test.ts`, `task.test.ts`, `usage.test.ts`, `daemon.test.ts` and `write-guarantee.test.ts` for the daemon seam.
- `apps/cli/test/` for the CLI as a subprocess.
- `packages/mcp/test/smoke.test.ts` for the MCP smoke test.

## Out of Scope

- Any action that changes state from the dashboard, including a ticket's `Status:`. That is under *Later* on the roadmap, and needs an ADR narrowing ADR-0020.
- Starting sessions or agents from the dashboard. The human types every command (`CONTEXT.md`, *Manual-first*).
- Questions and answers as an explicit artifact, and splitting usage into review and rework. Both are shown as not available.
- The Review on GitHub and GitLab, where comments are not read.
- Context pressure, cost, CI and OpenTelemetry as a live path. All are under *Later* on the roadmap. The page refreshes by polling.
- Installing the daemon as a service (ADR-0016), and publishing `@binnacle/cli` to npm with the dashboard built into it (*Later*).
- Access from anywhere but loopback, and more than one user.
- Notifications.
- Any UI language but English.

## Further Notes

- **Decided while grilling, 2026-09-26**, starting from the owner's feedback that the process was hard to follow:
  - The main screen answers where each project stands and what to type next.
  - The start command is `/mattpocock-skills:implement <ticket>`. `/binnacle:task` stays a brief and ends with it.
  - The Next action from the roadmap leads, and Binnacle's Suggested step stands beside it, labelled (ADR-0032). The owner asked for the two combined, so that the analysis is there whenever the focus falls short.
  - Nothing from the plan is cut. All six pages stay, and a mini kanban is added.
  - In progress is read from the runs on a ticket's branch.
  - Sources are built for the Review and for the derived metrics. The remaining elements are shown as not available.
  - The exit criterion is the owner taking the next step from the dashboard alone.
- **Decided by Claude from the docs**, and confirmed by the owner in the grilling's summary:
  - the daemon serves a static build, and the token arrives through the URL's fragment (ADR-0031);
  - the page is read-only and refreshes by polling;
  - `active` keeps telemetry's recency of ten minutes;
  - the Suggested step's rules;
  - the Next action contract;
  - English, with no UI kit and no chart library.
- **Decided while specifying, 2026-09-26:** the seams above, with the pages not automated.
- **Day one.** `review.missing` will name `mcp-and-product-snapshot/01`, the one `DONE` ticket without a Review. The owner decides whether to record one or to accept the item.
- **The Next action contract** is written into the roadmap's *Keeping this current*, and the current focus already follows it.
- **The documents listed above** are updated in the Product session that slices this spec, so they agree with it before code lands, as in epic 4. The exception is `README.md` and `README.ru.md`: ticket 01 updates them with the command it ships, so that the setup guide never describes a command that does not exist yet.
- **Exit demonstration.** The closing ticket runs on the owner's running daemon:
  1. `binn dashboard` opens the main screen.
  2. The owner copies the Next action's or the Suggested step's command and takes that step in a fresh session.
  3. The Task it starts appears In progress, naming the harness and model, within one refresh. It moves to Done once merged.
  4. The Usage page's figures equal `usage_get`'s for the same window.
  5. Every not-available element gives its reason.

  Defects are filed as tickets.
