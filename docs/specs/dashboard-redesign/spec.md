# Spec: Dashboard redesign

Status: READY
Triage: ready-for-agent

Epic 16 of v1, as defined in `docs/05-mvp-plan.md` phase 16. Exit criterion, restated while specifying: the owner goes through every page of the dashboard on their own screen at 100% zoom and reads it without strain; every element of `docs/04-telemetry-dashboard.md` is reachable, in a widget's *Brief* or *Full*; a Parallel limit set on the Settings page is the one the snapshot gives and autopilot reads; the commands in a Binnacle skill's output copy with the Claude desktop app's button. The phase was grilled on 2026-10-11; the owner confirmed this spec's test seams the same day, recorded under *Further Notes*.

## Problem Statement

The owner finds the dashboard hard to read. Its body text is 13 px, and over a hundred labels, badges and figures are 10 to 12 px. Every widget shows everything it has at once, so a page is a wall of small text. The Task page shows its Review as one long block of monospace text. The usage page cuts Task ids short (`the-state…`), so a row does not say which Task it is. On the board, the Russian `по runs` reads as English "no runs" on a card that has runs, and "7 сек. назад" is the time since the run's latest activity, where Claude Code shows how long the agent has been working.

The usage page's rework share and first-pass acceptance list ten Tasks and a remainder, so the Tasks of one epic cannot be seen together. Epic 18's effect is to be measured on epic 16's run against epic 11, epic by epic.

How many agents autopilot runs at once is a line in each project's manifest, though it depends on the machine and the subscription, not on the repository. Changing it means editing a file, and nothing says how many agents the subscription has really carried before it hit a usage limit.

In the chat, every Binnacle skill gives the command to type next inline, in backticks, so the owner selects it by hand to copy it.

## Solution

The dashboard keeps its shell, its six pages and what they show, and becomes larger and calmer. Body text is 16 px, secondary text 14 px, and nothing is smaller than 13 px. Each widget shows its essentials by default and switches to everything it has with one control in its header, *Brief* or *Full*, remembered per widget in the browser; long lists and texts fold in place. "What's next" is always shown in full. Nothing is taken away: every element of `docs/04-telemetry-dashboard.md` stays reachable.

The Task page renders the ticket's body and its Review as Markdown. Task ids are never cut. The board card says plainly that it is In progress from its runs, and shows both how long its run has been going and how long ago it was last active.

The usage page and `usage_get` filter by epic: every Task of it, with its rework share and first-pass acceptance, and the epic's averages.

The Parallel limit moves to the machine's settings. The Settings page edits it, a number or *auto*, and shows beside it how many runs have been active at once, and how many were active each time Claude Code hit a usage limit. A project's manifest may still set its own, and the page says when it does. Autopilot reads the limit from the snapshot.

Every Binnacle skill gives each command it offers the human on its own, in a fenced block, which the Claude desktop app copies with one click.

## User Stories

1. As the owner, I want body text at 16 px on every page, so that I read the dashboard without leaning in.
2. As the owner, I want secondary text at 14 px, so that labels and captions stay readable beside the body.
3. As the owner, I want nothing on any page smaller than 13 px, badges and figures included, so that no detail needs a zoom.
4. As the owner, I want each widget to show its essentials by default, so that a page shows what I came for first.
5. As the owner, I want a *Brief* / *Full* control in each widget's header, so that I open the full detail of one widget without opening every other.
6. As the owner, I want each widget to remember my choice in this browser, so that a widget I keep in *Full* stays in *Full*.
7. As the owner, I want long lists and long texts to fold in place with a clear way to unfold them, so that one long item does not push the page down.
8. As the owner, I want "What's next" always in full, so that the Next action, its command and the alternatives are never one click away.
9. As the owner, I want every element of the dashboard's documented views still reachable, so that the redesign removes no information.
10. As the owner, I want the *Brief* of each widget to follow this spec, so that what counts as essential is decided once and checked at the demonstration.
11. As the owner, I want the Overview's epic progress in *Brief* to show the current epic and its Tasks done out of all, so that the stepper of every epic waits for *Full*.
12. As the owner, I want Ready to start in *Brief* to show each Task's id, title and command, so that the conflict risk detail and the Tasks waiting on an Unmet dependency wait for *Full*.
13. As the owner, I want Running now in *Brief* to show each run's Task or role and its time, so that harness, model and branch wait for *Full*.
14. As the owner, I want attention in *Brief* to show how many items there are and the first few messages, so that every item with its code waits for *Full*.
15. As the owner, I want the Projects table in *Brief* to show each project's name, current epic, Next action on one line, runs running and attention count, so that path, Git state and latest activity wait for *Full*.
16. As the owner, I want *Waiting for the owner* in *Brief* to show how many questions, approvals and Tasks to start there are, with the first of each, so that the full lists wait for *Full*.
17. As the owner, I want a board card in *Brief* to show its id, title, who works on it and its time, with a mark when it is BLOCKED, waits on an Unmet dependency or has unanswered questions, so that the details behind each mark wait for *Full*.
18. As the owner, I want the Project page's checkout, graph, decisions and CI each in one line in *Brief*, so that their details wait for *Full*.
19. As the owner, I want the Task page's AgentRun timeline in *Brief* to show its latest runs, so that the whole timeline waits for *Full*.
20. As the owner, I want the Task page's questions in *Brief* to show the unanswered ones first, so that the answered ones wait for *Full*.
21. As the owner, I want the Usage page's tokens by kind in *Brief* to show output and input for today and the last seven days, so that every kind and the import window's line wait for *Full*.
22. As the owner, I want each Usage breakdown, by model, provider, Task and role, in *Brief* to show its largest rows, so that every row waits for *Full*.
23. As the owner, I want the derived metrics in *Brief* to show their headline figures, so that the per-Task lists, the weekly trend and context growth wait for *Full*.
24. As the owner, I want each harness's support level in *Brief* by name and level, so that the reasons wait for *Full*.
25. As the owner, I want the Task's Review rendered as Markdown, with its headings, lists and paragraphs, so that I read it as a document, not a block of code.
26. As the owner, I want the Task's ticket body rendered as Markdown too, so that both read the same way.
27. As the owner, I want no raw HTML from a ticket rendered, so that a ticket cannot inject anything into the page.
28. As the owner, I want every Task id shown in full everywhere, so that every row says which Task it is.
29. As the owner, I want the board card's mark for a Task In progress from its runs to read plainly in both languages, so that it never reads as "no runs".
30. As the owner, I want a running card to show how long its run has been going and how long ago it was last active, such as "идёт 15 мин · активность 7 с назад", so that I see both the work's length and whether it is alive.
31. As the owner, I want to pick an epic on the usage page, so that I see every Task of that epic together.
32. As the owner, I want an epic's rework share and first-pass acceptance listed for every one of its Tasks, with the epic's averages, so that I compare epics as a whole.
33. As a Product session, I want `usage_get` to take an epic, so that I read epic 18's effect on epic 16's run against epic 11 in one call.
34. As the owner, I want the epic averages labelled as Binnacle's calculation, so that I never take them for a reported figure.
35. As the owner, I want the Parallel limit kept in this machine's settings, so that one change applies to every project on it.
36. As the owner, I want the Settings page to edit the Parallel limit, so that I change it without editing a file.
37. As the owner, I want to set the Parallel limit to a number or to *auto*, so that I choose between a fixed number and as many as low conflict risk allows.
38. As the owner, I want *auto* capped at four agents, so that it never starts more than a subscription is likely to carry.
39. As the owner, I want *auto* to run one Task at a time when the conflict risk cannot be assessed, so that *auto* never runs blind.
40. As the owner, I want the Parallel limit to be 2 when nothing sets it, so that a fresh machine behaves as today.
41. As the owner, I want a project's manifest that sets the limit to win for that project, and the Settings page to say so, so that I know which value autopilot uses.
42. As the owner, I want a value the page cannot accept refused with a reason, so that no broken setting reaches autopilot.
43. As the owner, I want the write to leave the machine's other settings as they were, so that changing the limit never loses the vault's path.
44. As the owner, I want only the Settings page's Parallel limit to write anything, so that the rest of the dashboard stays read-only.
45. As autopilot, I want the Parallel limit, its mode and its source in the snapshot, so that I start agents by the value the owner set.
46. As autopilot, I want the manifest's value, or two, when Binnacle is not used, so that I still run without the daemon.
47. As the owner, I want to see how many runs have been active at once, so that I know what this machine has carried.
48. As the owner, I want to see, for each time Claude Code hit a usage limit, when it was and how many runs were active then, so that I see what my subscription sustains.
49. As the owner, I want a harness that records no usage limit shown as not reporting it, never as zero, so that the informer is honest.
50. As the owner, I want the informer labelled as Binnacle's calculation, so that I never take it for a figure Claude Code reported.
51. As the owner, I want every command a Binnacle skill offers me in its own fenced block, so that the Claude desktop app copies it with one click.
52. As the owner, I want a shell command such as `binn daemon start` in a `bash` block, so that the app also offers to run it.
53. As the owner, I want a slash command such as the Next action's in a plain block, so that it copies without a Run button that would send it to a shell.
54. As the owner, I want the dashboard in English and Russian as before, every new string in both, so that the redesign changes no language.
55. As the owner, I want both themes kept, so that the redesign looks right in light and dark.
56. As the owner, I want the page to reach nothing but the daemon, as before, so that the redesign adds no network call.

## Implementation Decisions

- **Scale and density only.** The shell, the six pages and what each shows stay as epics 5 and 6 decided; so do Nuxt UI, no chart library, system fonts and bundled icons (ADR-0033), the palette and its test, both themes and both languages. The redesign is done by autopilot's agents with the Impeccable and UI UX Pro Max skills, to this spec; the owner judges it at the exit demonstration.
- **The type scale** is set once for the whole dashboard and every page uses it: body 16 px, secondary 14 px, a floor of 13 px for every text, Nuxt UI's components included. Spacing grows with it; a page fills the width as epic 6 decided, prose keeping its measure of about 70 characters.
- **A widget with two levels.** One shared widget frame, a panel with a title and the *Brief* / *Full* control in its header, wraps every widget the stories above name. Its level is kept in the browser's storage per widget and page, *Brief* when nothing is stored or storage is unavailable. A list folds after a fixed number of rows and a text after a fixed height, each with a control to unfold it in place. "What's next" has no control.
- **Markdown on the Task page.** The ticket's body and its Review are rendered by one small Markdown renderer with raw HTML disabled, bundled, no other dependency: headings, paragraphs, lists, emphasis, inline code and code blocks, links. The cut notices the page shows when the daemon truncates a text stay.
- **Ids in full.** No Task id is truncated; a row wraps or the column grows instead.
- **The board card** keeps the reading from runs (ADR-0032) with a clearer label in both dictionaries, and shows its active run's elapsed time, from the run's start, beside its latest activity.
- **Usage by epic.** `usage.get` and `usage_get` take an optional epic, by number as the roadmap gives it; its Tasks are those of the spec the roadmap names for it. With an epic, the per-Task derived metrics list every Task of it, without a remainder, with the epic's averages: tokens per completed Task, rework share and first-pass acceptance, each `calculated`. An epic with no spec, or one the roadmap does not list, is an error with its reason. The usage page offers the roadmap's epics with a spec and shows the same figures.
- **The Parallel limit on the machine** (ADR-0041). The machine's settings file gains the limit, a positive integer or `auto`, read by the daemon on every snapshot. The snapshot's `tasks.parallel` gains the limit's mode, `number` or `auto`, and its source, `manifest`, `machine` or `default`; with `auto` its limit is the ceiling, 4. The manifest's `automation.max_parallel_development_tasks` still wins for its project.
- **One write, through the daemon.** Two operations over the daemon's authenticated API: one returns the machine's Parallel limit with its source and the informer, one sets the limit. The set accepts a positive integer up to a bound or `auto`, rewrites only that key of the settings file and keeps every other, and refuses anything else with a reason. No MCP tool writes it.
- **The informer.** Claude Code writes a synthetic record with `"error":"rate_limit"` when it hits a usage limit; the adapter that today drops synthetic records reads that one as a usage-limit marker, as it reads compaction markers, and the store keeps it. Over the import window and every registered project, the informer gives the most runs active at once, active by telemetry's existing recency rule, and each usage-limit marker's time with how many runs were active then; both `calculated`. A harness that records no usage limit is listed as not reporting it.
- **Autopilot** reads the Parallel limit from the snapshot's `tasks.parallel`, not from the manifest. With `auto` it starts every ready Task whose pairs with every Task in flight are at low conflict risk, up to the ceiling, and one at a time when the risk is not assessed. Without Binnacle it falls back to the manifest's value, or two.
- **Commands in the skills.** Every Binnacle skill that ends with, or offers, a command for the human to run says to give it alone in a fenced block: a slash command in a plain fence, a shell command in a `bash` fence. `/binnacle:product`'s Next action and alternatives, `/binnacle:daily`, `/binnacle:checkpoint`, `/binnacle:task`, `/binnacle:status`, `/binnacle:answer`, `/binnacle:daemon`, `/binnacle:register`, `/binnacle:init`, `/binnacle:audit`, `/binnacle:autopilot`'s report and `/binnacle:help` among them. The roadmap's `Next action:` paragraph keeps its one command in backticks: it is the snapshot's contract, and the skill fences it when it shows it.
- **Documentation** moves with the code: `docs/04-telemetry-dashboard.md` for the type scale, the two levels, the Markdown, usage by epic and a Settings page that writes the Parallel limit; `docs/03-mcp-and-skills.md` for `usage_get`'s epic and the snapshot's `tasks.parallel`.

## Testing Decisions

- A good test drives the system from outside and checks what a caller sees: the daemon's HTTP API, a dashboard dictionary, the dashboard's sources as files. None reaches into a module's internals.
- **The daemon's HTTP API**, through the test daemon, as `context-pressure.test.ts`, `usage.test.ts` and `snapshot.test.ts` do: the Parallel limit read with its source from a temporary home's settings, a manifest's value winning, `auto` with its ceiling, the set operation keeping the vault's path and refusing a bad value; the snapshot's `tasks.parallel` with mode and source; `usage.get` by epic against a Git repository with tickets and session artifacts, every Task listed and the averages, and an unknown epic refused; the informer from Claude Code session fixtures holding `rate_limit` records beside ordinary calls, and a harness with none not reporting.
- **The dashboard's sources**, as `palette.test.ts` holds the palette: a test that no text size below 13 px is written anywhere in the dashboard.
- **The dictionaries**, as `i18n.test.ts` does: every new string in both, the board card's labels included.
- **In a browser**, for every ticket that changes `apps/dashboard`: the pages in both themes and both languages, *Brief* and *Full*, and the Settings page's write.
- The skills' fenced commands are checked by review, with no test.

## Out of Scope

- A new information architecture: new pages, a new shell, a new main screen. Scale and density only (the owner, 2026-10-11).
- A new mockup from a design tool, and a new palette.
- One dashboard-wide *Brief* / *Full* setting; the control is per widget.
- Any other setting written from the dashboard; ADR-0041 opens the page to the Parallel limit alone.
- A usage-limit marker from a harness other than Claude Code, until one records it.
- A phone layout.
- Rewriting the skills' output beyond fencing their commands: that is epic 13.

## Further Notes

- **Decisions taken while grilling, by the owner on 2026-10-11**, recorded in `docs/05-mvp-plan.md` phase 16 and ADR-0041: scale and density rather than a new structure; autopilot straight after the tickets, the owner judging at the demonstration; the Parallel limit in this epic, with *auto* and the informer; body 16 px, secondary 14 px, a floor of 13 px; a *Brief* / *Full* control in each widget; usage by epic; commands in the chat in fenced blocks, in this epic rather than epic 13.
- **Test seams confirmed by the owner on 2026-10-11**: the daemon's HTTP API, as context pressure is tested; a static test of the type scale beside the palette's; the dictionaries' test; a browser check; no test over the skills' texts.
- **Defaults taken from the docs and Ponytail, not asked**: nothing removed from the documented views; "What's next" always in full; each widget's *Brief* as the stories list it, the owner confirming it at the demonstration; Markdown with raw HTML off; the limit 2 by default, a manifest's value winning, *auto* capped at 4 and one at a time without a risk assessment; the informer machine-wide, over the import window, from Claude Code's `rate_limit` records; no MCP tool for the setting; the roadmap's Next action paragraph unchanged.
- **The measurement of epic 18**, rework share and tokens per completed Task against epic 11, is read by a Product session with `usage_get` by epic after this epic's autopilot run.
