# Spec: Dashboard Design and Languages

Status: READY
Triage: ready-for-agent

Epic 6 of v1, grilled on 2026-09-26 (`design-brief.md`, beside this spec) and built to the mockup in `design/`. Exit criterion: on the owner's running daemon, the owner reads the Overview in Russian and in English, takes the next step from its "What's next" block, and finds on it, without asking an agent, which Tasks can run in parallel and that Ready to start implies no order.

## Problem Statement

Epic 5's dashboard answered "what do I type next", but the owner found it hard to follow (`specs/minimal-dashboard/issues/09-dashboard-exit-demonstration.md`, *Comments*):

- It is in English only.
- It is one long sheet of text, with no design.
- The Next action and the Suggested step disagreed, one naming ticket 11, the other `/binnacle:autopilot`, and nothing said the screen was offering a choice between two valid ways to work.
- *Ready to start* read as a queue: the owner took 10 before 11 for the order to work in.
- Nothing said which Tasks can run in parallel, though 10 and 11 blocked neither.

## Solution

The dashboard is rebuilt with Nuxt UI (ADR-0033) to the mockup: Paperclip's shell, a project rail and a sidebar, and a dense tool's tone. It speaks English and Russian.

The Overview leads with **What's next**. The roadmap's Next action comes first, labelled "From the roadmap". Below it, "or", labelled "Binnacle's calculation", come zero to three alternatives from the Suggested step, each with a title, a reason and, when it has one, a command to copy:

- take one Task by hand;
- run the whole epic with `/binnacle:autopilot`;
- start a second Task beside the one in progress;
- wait for a Task being worked on.

An alternative whose command is the Next action's is left out, so when the two agree only the Next action shows. A missing or stale Next action shows as a warning inside the block.

Below it sit the epic's progress, what is running, Ready to start (a set, "in any order", with how many can run in parallel), attention and a line of usage. The six pages stay, with details on their own pages.

## User Stories

### What's next

1. As the owner, I want the Overview to open on a "What's next" block, so that the step to take is the first thing I see.
2. As the owner, I want the roadmap's Next action first in that block, labelled as the roadmap's, so that the planned course leads.
3. As the owner, I want Binnacle's alternatives below it under "or", labelled as Binnacle's calculation, so that I see them as a choice, not a contradiction.
4. As the owner, I want each alternative to have a short title and a one-line reason, so that I know why it is offered.
5. As the owner, I want an alternative to run the whole epic with `/binnacle:autopilot` when Tasks are ready, so that I can hand the epic over in one command.
6. As the owner, I want an alternative to take one Task by hand beside the autopilot one, so that working one ticket at a time is shown as equally valid.
7. As the owner, I want an alternative to wait while a Task is being worked on, with no command, so that I do not start something on top of it.
8. As the owner, I want an alternative to start a second Task beside the one in progress when the parallel limit allows it, so that I use the capacity I have.
9. As the owner, I want only the Next action shown when Binnacle agrees with it, so that the block is not noisy.
10. As the owner, I want a warning inside the block when the Next action is missing or names finished work, so that I check the roadmap before copying.
11. As the owner, I want every command in the block to have a copy button, so that I paste exactly what to type.

### The Overview's state

12. As the owner, I want the roadmap's epics as a compact stepper, with the current epic's Tasks done out of all, so that I see the position at a glance.
13. As the owner, I want Running now to list each run with its Task or role, harness, model, branch and latest activity, and to say that "running" is Binnacle's reading, so that I know who is busy.
14. As the owner, I want Ready to start labelled "in any order", so that I do not read it as a queue.
15. As the owner, I want Ready to start to say how many of its Tasks can run in parallel, so that I know what can go side by side.
16. As the owner, I want the current epic's `READY` Tasks that wait on an Unmet dependency shown dimmed with "waits on NN", so that I see why they cannot start.
17. As the owner, I want attention items with their codes and a line of usage on the Overview, so that neither needs a separate visit.

### Languages

18. As the owner, I want the interface in English and in Russian, so that I can read it in my own language.
19. As the owner, I want the language to follow my browser at first, so that it starts in the right one.
20. As the owner, I want to switch the language in the sidebar and have the browser remember it, so that my choice survives a reload.
21. As the owner, I want Task, Epic, Next action, Suggested step, Backlog, Ready, In progress, Done, Review and Unmet dependency kept in English in both languages, so that the dashboard speaks the same terms as the docs and the agents.
22. As the owner, I want commands, ids, branches, models and repository text never translated, so that what I copy and read is what the repository says.
23. As the owner, I want the What's next alternatives' titles and reasons in my language, so that the centre of the screen is readable.
24. As the owner, I want Russian plurals and numbers formatted correctly, so that the Russian interface does not read as machine-made.

### The shell

25. As the owner, I want a narrow project rail with one icon per registered project, so that I switch projects in one click.
26. As the owner, I want a dot on a project's icon when something runs in it or it needs attention, so that I see it without opening it.
27. As the owner, I want a "+" at the rail's foot that shows `binn project register` to copy, so that I know how to add a project, while the page registers nothing.
28. As the owner, I want a sidebar with the project's name, current epic and menu (Overview, Project, Usage, Attention with a count, and Projects), so that each page is one click away.
29. As the owner, I want a quiet "updated N s ago" in the sidebar, so that I know the data is fresh.

### Pages and states

30. As the owner, I want the Projects, Project, Task, Usage and Attention pages rebuilt to the mockup with everything epic 5 showed, so that nothing is lost in the redesign.
31. As the owner, I want a Task In progress from its runs to offer its start command to resume it, so that its page never says it is Done when the ticket says `READY`.
32. As the owner, I want the Task page to show a Review as the ticket's text, or "no Review yet", so that no invented review state appears.
33. As the owner, I want the Usage page to list harnesses by their support levels, Context, Attribution, Usage and Live, so that the legend matches `CONTEXT.md`.
34. As the owner, I want a loading state, a daemon-unreachable state with `binn daemon start` to copy, a project whose roadmap cannot be read, a project with no Tasks, and "nothing" when nothing runs, so that every state says what it is.
35. As the owner, I want light and dark themes that follow the system, so that the dashboard matches my desktop.
36. As the owner, I want the layout to hold down to 1024 px, so that a narrow window still works.

### Guarantees

37. As a Product Steward, I want the snapshot to carry the alternatives and the parallel figures, so that `/binnacle:product` offers the same choice the dashboard does.
38. As a developer, I want the page to load nothing from the network, with fonts and icons bundled or from the system, so that project data and the token stay on loopback (ADR-0033).
39. As a developer, I want the dashboard still read-only, with copying as its only action.
40. As a maintainer, I want all the logic in the daemon and the pages only rendering and translating its answers, so that one seam tests it.

## Implementation Decisions

### The Suggested step becomes alternatives (ADR-0032)

- The pure function in `packages/core` keeps its eight rules and its order, but returns a list of alternatives, not one step. Each alternative has:
  - `kind`: one of `wait`, `parallel`, `resume`, `autopilot`, `byHand`, `blocked`, `close`, `plan` or `finished`;
  - `tasks`: the Task ids it names;
  - `command`: a command, or none;
  - `description`: English, for the skills and MCP;
  - `provenance`: `calculated`.
- Rule 1, a Task being worked on, gives `wait`. It is followed by `parallel` when the free parallel capacity (below) is at least one and Ready to start is not empty. `parallel` carries the Task's start command when exactly one Task is ready. With several, it names them and carries no command, pointing to Ready to start, so that no order is implied.
- Rule 3 gives `autopilot` and `byHand`. `byHand` follows the same rule as `parallel`: one Task means its command, several mean no command.
- Rules 2 and 4 to 8 give one alternative each, as they give one step today: `resume`, `blocked`, `close`, `plan` (grilling, spec or tickets, with its command) and `finished`.
- At most three alternatives are returned. The existing rule that commands exist only under `workflow.provider: matt-pocock` holds for every alternative.
- **Agreement.** An alternative whose command equals the Next action's command is left out. With no Next action, none is left out. This filter is part of the same pure function, which therefore takes the Next action.
- The snapshot's `next.suggested` becomes `next.alternatives`, a list, or `available: false` as before. The `product` skill ends with the Next action and then each alternative, labelled as Binnacle's.

### Parallel capacity

- The snapshot's `tasks` gains `parallel`, labelled `calculated`:
  - `limit`: the manifest's `automation.max_parallel_development_tasks`, or 2 where it writes none, as autopilot reads it;
  - `inProgress`: the Tasks in flight;
  - `free`: `limit` less `inProgress`, never below zero.
- Every Task in Ready to start has no Unmet dependency and no attributed run, so none blocks another. The Overview says "up to {free} can run in parallel" when `free` is at least one and either Ready to start holds two or more Tasks or a Task is in progress.

### Languages

- The strings are our own dictionary, one object per language, with no i18n module (ADR-0033). The Russian dictionary is typed against the English one, so a missing key fails the typecheck. Plurals use `Intl.PluralRules`; numbers and times use `Intl.NumberFormat` and `Intl.RelativeTimeFormat` in the current language. Nuxt UI's own locale follows the language.
- The starting language is Russian when the browser's preferred language is Russian, and English otherwise. The sidebar's switch stores the choice in local storage, and the `lang` attribute follows it.
- The page translates only its own interface text and the What's next alternatives, which it writes from `kind` and `tasks`. Attention messages, not-available reasons and every other text the daemon writes stay in English, shown with their codes, as diagnostics. Repository text, commands, ids, branches and model names are never translated.
- The domain terms listed in the brief stay English in both dictionaries.

### Look and build

- `@nuxt/ui` 4 becomes the dashboard's dependency, with Tailwind through it. There is still no chart library: the stepper, the progress bars and the weekly trend are Nuxt UI components or CSS.
- The mockup gives the layout, the components each element names (`data-nuxt`), the tokens and the strings. Its data and codes are not taken. The brief lists where Binnacle's truth wins: attention codes, commands, support levels, Review states and the in-progress Task's start command.
- **Nothing is fetched from the network.** Fonts are the system's sans and monospace stacks, and Nuxt UI's font module fetches nothing. The Lucide icons come from a locally installed collection, bundled into the client at build time, with no Iconify API call. The daemon's existing Content-Security-Policy, which allows its own origin only, stays unchanged. Any inline script the build emits is hashed into it, as today.
- The theme follows the system, light or dark. There is no theme switch.
- The layout holds down to 1024 px, and there is no phone layout.

### The shell and pages

- **Rail:** one icon per project from `project.list`, with initials, a dot when its snapshot has running runs or attention items, and "+" opening a modal with `binn project register` to copy.
- **Sidebar:** the menu, a count badge on Attention, the language switch and the freshness line.
- The selected project stays in the URL's `project` query, as today. Without one, the first registered project is shown.
- **Overview:** the Next action and alternatives come from the snapshot. The current epic's progress and its waiting `READY` Tasks come from `task.list` for the current epic, whose Ready column already carries Unmet dependencies. Progress is Done over all the epic's Tasks, leaving out `CANCELLED`.
- **Task:** a Task In progress from runs shows its start command, labelled as resuming it. `DONE` and `CANCELLED` show none. The Review is the ticket's text, or "no Review yet".
- **Usage:** as epic 5, with the harness legend using the support levels from `CONTEXT.md`.
- **Attention:** every project's items grouped by project, beside the running and recent runs.
- **States:**
  - loading, as skeletons;
  - the daemon unreachable after the page loaded, with `binn daemon start` to copy, while polling goes on;
  - no roadmap, the snapshot's `roadmap` null with its attention item;
  - no Tasks;
  - nothing running;
  - every not-available element with its reason.
- Polling stays at 15 seconds for a visible page. Repository text stays plain text with its line breaks.

### Documents this epic changes

- `docs/03-mcp-and-skills.md`: `next.alternatives` replacing `next.suggested`, and `tasks.parallel`.
- `docs/04-telemetry-dashboard.md`: the views as rebuilt, and the languages.
- `CONTEXT.md`, *Suggested step*: it is a list of alternatives. It already reads so.
- The `product` skill's step 5.
- `README.md` and `README.ru.md`, if the dashboard's description or setup changes.

### Standing guarantees

Read-only, loopback only, no model invocation (ADR-0012), no writes into the repository (ADR-0020), Binnacle not required (`AGENTS.md` §3), and the same answer for the same state.

## Testing Decisions

- **A good test** states an observable fact: an operation's answer, never which function ran. The seams are epic 5's (decided while specifying, 2026-09-27).
- **Seam 1: the daemon's HTTP API, offline**, over fixture repositories:
  - the alternatives for each rule;
  - `wait` followed by `parallel` when capacity is free, and without it when `free` is zero;
  - `parallel` and `byHand` with one ready Task, carrying its command, and with several, carrying none;
  - `autopilot` beside `byHand`;
  - an alternative dropped when its command equals the Next action's, and none dropped without a Next action;
  - no commands under another `workflow.provider`;
  - at most three alternatives;
  - `tasks.parallel` with the manifest's limit and with the default.
- **Seam 2: the MCP smoke test.** Unchanged and still one test.
- **Not automated:** the pages and the dictionary. The typecheck catches a missing Russian key, and the exit demonstration verifies the pages in both languages, both themes and at 1024 px.
- **Prior art:** `apps/daemon/test/snapshot.test.ts` for the Suggested step's rules today, `packages/mcp/test/smoke.test.ts`.

## Out of Scope

- Languages other than English and Russian, and translating the daemon's attention messages and reasons.
- A phone layout, and a theme switch.
- Any action beyond copying a command, including registering a project from "+".
- Faster refresh or push updates, since polling stays.
- Cost, CI, pending decisions and the other not-available elements, which stay not available.

## Further Notes

- **Decided while grilling, 2026-09-26:** everything under *Decided while grilling* in `design-brief.md`.
- **Decided while specifying, 2026-09-27, by the owner:** the seams above, and the scope of translation: only the What's next alternatives among the daemon's text.
- **Decided by Claude from the docs and the brief:**
  - agreement means an equal command;
  - one ready Task means a command, and several mean no command, so that no order is implied;
  - the parallel figures follow autopilot's rule and default of 2;
  - system fonts, and no theme switch;
  - the resume command for a Task In progress from runs.
- **Exit demonstration.** On the owner's running daemon, after `pnpm dashboard:generate`:
  1. The Overview opens in the browser's language.
  2. Switched to the other language, it keeps the choice across a reload.
  3. The What's next block shows the Next action and Binnacle's alternatives, each labelled.
  4. The owner takes a step from it in a fresh session.
  5. Ready to start says "in any order" and how many can run in parallel.
  6. Every page holds at 1024 px, in light and dark.
  7. The browser's network log shows requests to the daemon only.

  Defects are filed as tickets.
