# Design Brief: Dashboard Design and Languages

Epic 6 of v1. Grilled on 2026-09-26 from the owner's findings on epic 5's dashboard (`specs/minimal-dashboard/issues/09-dashboard-exit-demonstration.md`, *Comments*): English only, one long sheet, two suggestions that disagree, a list read as a queue, nothing on what can run in parallel.

The order of work: the owner gives the prompt below to an AI design tool, the mockup it returns is saved in `design/` beside this brief, and `/mattpocock-skills:to-spec` specifies the epic from both. The dashboard is then built to the mockup.

## Decided while grilling, 2026-09-26

- **The main screen is a hybrid.** A "What's next" block on top; below it, a compact state — the epic's progress, what is running, attention. Details live on their own pages.
- **"What's next" puts the course first.** The roadmap's Next action leads, labelled as the roadmap's. Below it, "or": Binnacle's Suggested step offers the other ways to go on, each labelled as Binnacle's calculation and with its reason — one Task by hand, the whole epic with `/binnacle:autopilot`, a second Task beside one in progress, or wait. When they agree, only the Next action shows; when the Next action is stale or has no command, the block says so. `CONTEXT.md`, *Suggested step*.
- **English and Russian.** The interface is translated; the domain terms stay English in both — Task, Epic, Next action, Suggested step, Backlog, Ready, In progress, Done, Review, Unmet dependency. Commands, ids, branches, models and text from the repository are never translated.
- **The designer is an AI design tool that returns code.**
- **Nuxt UI** (ADR-0033). No chart library.
- **The shell is Paperclip's:** a narrow rail at the far left with one icon per registered project and a "+" at its foot, then a sidebar with the selected project's menu. The six pages of the plan stay.
- **The tone is a dense tool,** like Linear or Paperclip.
- **Epic 6**, before Audit and adopt, which becomes epic 7.

## Decided from the docs

- **Tasks that can run in parallel** are the Tasks ready to start, none with an Unmet dependency and none blocking another — the rule autopilot starts agents by — up to the manifest's `automation.max_parallel_development_tasks`.
- **Ready to start is a set,** shown in no implied order.
- **"+" shows the command** `binn project register`, to run in the project's folder. The dashboard stays read-only: its only action is copying a command (`specs/minimal-dashboard/spec.md`).
- **The language** follows the browser, can be switched in the shell, and is remembered in the browser.
- **Light and dark themes,** following the system.
- **Desktop first:** the layout holds down to 1024 px; there is no phone layout.
- **The mockup covers every page and its states:** loading, the daemon unreachable, a project without a roadmap, no Tasks, nothing running, elements not available.

## The prompt for the designer

Everything below the line is the prompt, as given to the design tool.

---

Design a web dashboard for **Binnacle**, a local tool that shows a solo developer where each of their software projects stands and **what command to type next** into their AI coding agent (Claude Code, Codex). Work is organised as a roadmap of **Epics**, each sliced into **Tasks** (tickets); agent sessions working on Tasks are **runs**.

The dashboard is **read-only**. Its only action is **copying a command** to the clipboard; the person pastes it into an agent session. Every command shown has a copy button.

### Output

- A clickable prototype of every page below, in **Vue 3 with Nuxt UI v4** components (Tailwind CSS v4). If your tool cannot produce Vue, produce HTML with Tailwind classes and name, for each element, the Nuxt UI component it stands for (`UButton`, `UBadge`, `UCard`, `UTable`, `UNavigationMenu`, `UProgress`, `UTooltip`, `UModal`, …).
- No other UI or chart library. Charts are plain CSS or inline SVG. Icons are Lucide.
- Light and dark themes, following the system.
- Desktop first, 1280–1600 px wide; nothing may break at 1024 px. No phone layout.

### Tone

A dense professional tool, like **Linear** or **Paperclip**. A restrained palette with one accent colour. Monospace for commands, ids, branches, paths and model names. Compact everywhere, except for generous space around the "What's next" block, which is the visual centre of the product.

### Languages

English and Russian, switched in the shell. Show the Overview in both, to prove the layout holds Russian's longer strings.

- Interface text is translated. Examples: What's next / Что дальше; From the roadmap / По плану; or, Binnacle's calculation / или — расчёт Binnacle; Copy / Скопировать; Running now / Идёт сейчас; Ready to start, in any order / Можно начинать, в любом порядке; Can run in parallel / Можно параллельно; Attention / Внимание; Usage / Расход; Not available / Недоступно; updated 5 s ago / обновлено 5 с назад.
- These domain terms stay English in both languages: **Task, Epic, Next action, Suggested step, Backlog, Ready, In progress, Done, Review, Unmet dependency.**
- Commands, ids, branches, model names, and text taken from the project's repository (ticket titles, ticket bodies, roadmap text) are never translated: they appear in English inside the Russian interface.

### Honesty rules

- A figure with no source says **"Not available"** with its reason. Never show 0 or an empty chart for missing data.
- A figure Binnacle calculated, rather than read, is labelled as a calculation. A partial total is marked partial.
- The data refreshes by polling every few seconds. Show freshness quietly (a small "updated 5 s ago").
- Text from the repository is plain text with its line breaks kept, never rendered as rich HTML.

### Shell

- **Project rail**, far left, about 56 px: one rounded square per registered project (initials or a letter), the selected one highlighted, a small dot when something is running or needs attention. At its foot, a **"+"** that opens a modal, "Add a project": run `binn project register` in the project's folder, with a copy button. Nothing is registered from the page.
- **Sidebar**, about 220 px: the project's name and current Epic; the menu — Overview, Project, Usage, Attention (with a count badge); under a divider, Projects (all). The language switch and the freshness line at its foot.

### Pages

**1. Overview** — the main screen, for the selected project.

- **What's next**, on top. First the **Next action**, labelled "From the roadmap": its sentence (English, from the roadmap) and its command with a copy button. Then **"or"**, labelled "Binnacle's calculation": zero to three alternatives, each with a short title, a one-line reason and, when it has one, a command with a copy button. The kinds of alternative: take one Task by hand; run the whole Epic with `/binnacle:autopilot`; start a second Task in parallel with the one in progress; wait, because a Task is being worked on (no command). When Binnacle agrees with the roadmap, only the Next action shows. When the Next action names work already done, or has no command, a warning sits inside the block.
- **Epic progress**: the roadmap's Epics as a compact stepper (done, in progress, not started); for the current Epic, a progress bar of Tasks done out of all.
- **Running now**: each run with its Task (id and title) or, without one, its role (for example "product"); harness, model, branch and last activity. A note that "running" is Binnacle's reading of recent activity.
- **Ready to start**: the Tasks that can start, as a set — say "in any order". Each: id, title and its start command with a copy button. Mark the ones that can run in parallel. Tasks waiting on an Unmet dependency appear dimmed, with "waits on 03".
- **Attention**: each item's message and its code.
- **Usage** in one line: today's and the last seven days' output tokens, linking to the Usage page.

**2. Projects** — every registered project: name, path, current Epic and its status, Next action in short, runs running now, attention count.

**3. Project** — the roadmap's Epics with their status and spec link; a **mini kanban** for one Epic, the current one by default, with a switcher: Backlog, Ready, In progress, Done. A card: id, title, its Unmet dependencies, and `BLOCKED` or a review state when it has one. An In progress card read from runs, not from the ticket, is marked "from runs" and names harness, model, role and last activity, with a live dot while it runs. Done is collapsed to its count and its latest few cards.

**4. Task** — id, title, state badge, triage, Blocked by, spec and ticket paths, branch. The **start command** with a copy button; none for a Task that is Done or Cancelled. The ticket's body as plain text. Its **Review**, as plain text from the ticket, or "no Review yet" as an attention mark. The **runs** as a timeline: harness, model, role, branch, checkout, start, last activity, tokens. Its implementation usage; review usage, rework usage, and questions and answers shown as "Not available", with the reason.

**5. Usage** — today and the last seven days by kind of token: input, cached input, cache creation, output, and reasoning as the part of output it is. By model; by provider (shown as "not reported" when unknown); by Task, the largest few with the unassigned total; by role. Derived metrics, each labelled as Binnacle's calculation: tokens per completed Task, runs per Task, and a weekly trend as simple bars. Each harness with its support level, 1 to 4, or the reason it has none. Cost: "Not available", no source reports it.

**6. Attention** — every attention item, grouped by project, beside the runs running now and the recent runs.

### States to design

Loading; the daemon unreachable, with `binn daemon start` to copy; a project whose roadmap cannot be read; a project with no Tasks; nothing running ("nothing"); elements not available, each with its reason.

### Sample data

Use this data, so the design meets real lengths.

- **Project:** Binnacle, `/home/owner/Projects/binnacle`. A second project, "Shop API", with nothing running.
- **Epics:** 1 Core and persistence — done; 2 MCP and Product Snapshot — done; 3 Tracker and Matt Pocock integration — done; 4 Telemetry — done; 5 Minimal dashboard — in progress, 9 of 11 Tasks done; 6 Dashboard design and languages — not started; 7 Audit and adopt — not started.
- **Next action:** "ticket 11, the defect from the exit demonstration; ticket 10 is ready beside it." Command: `/mattpocock-skills:implement docs/specs/minimal-dashboard/issues/11-ready-to-start-leaves-out-tasks-in-progress.md`
- **Binnacle's alternative:** "Run the whole Epic" — "Tasks 10 and 11 are ready and neither blocks the other." Command: `/binnacle:autopilot`
- **Ready to start:** `minimal-dashboard/10` "Autopilot chooses a sliced epic and regenerates a merged dashboard"; `minimal-dashboard/11` "Ready to start leaves out a Task the board shows In progress". Both can run in parallel.
- **Running now:** `minimal-dashboard/09` "The exit demonstration" — claude-code, claude-opus-5-5, implementation, `feat/dashboard-exit-demonstration`, 2 min ago. A product session — claude-code, claude-opus-5-5, `main`, just now.
- **Attention:** `review.missing` — "mcp-and-product-snapshot/01 is DONE without a Review." `next_action.stale` — "The Next action names a Task already DONE."
- **Usage, last 7 days:** input 12,466; cached input 956,450,757; cache creation 27,750,835; output 5,306,279, of which reasoning 2,199,628 (partial). Models: claude-opus-5-5 (4,935,174 output), claude-opus-5 (371,105 output). Harnesses: claude-code, level 3; codex, none — "No Codex session of this project was found."
