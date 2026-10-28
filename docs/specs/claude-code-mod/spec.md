# Spec: A Binnacle mod for Claude Code

Status: READY
Triage: ready-for-agent

Epic 22, from its grilling's brief, `docs/specs/claude-code-mod/brief.md` (2026-10-28), ADR-0047, and the product inbox's entries planned into it: *A Binnacle mod for Claude Code* (2026-10-11) and idea 7 of *Session start, agent configuration and traps*, "Waiting for you" as a state. Exit criterion: with `binnacle-mod` installed by `binn init`'s yes, a Claude Code session of a registered project shows, in the terminal and the desktop app, a status line with the session's Task, role, tokens, context and usage limits; a *Waiting for you* band only while something waits; a pane opened and closed by its command, whose buttons put a command in the prompt box; a toast for a project's change once per machine and for context pressure in its own session; and two or three lines in the context of a session off a Task's branch, none on a ticket's branch. Without the daemon or in an unregistered project it shows nothing. Without the yes there is no mod. 0.6.0 is installed from the registry into a clean container. The owner confirmed the test seams on 2026-10-28, recorded under *Further Notes*.

## Problem Statement

Binnacle's state reaches a person only when they ask for it. `/binnacle:product` and `binn status` answer once, and the dashboard is a browser tab away from the chat. While the owner works in a Claude Code session, they do not see that a question waits for them, that `main`'s CI went red, which Task this session is on, or how close its context is to the warning, until they look somewhere else.

A session also starts knowing nothing of the project's position. A Product session learns it only by running `/binnacle:product`, and a plain chat on `main` never learns it.

Claude Code's mods can pin a status line, draw a band and a pane, show toasts, fill the prompt box, add context at a session's start, and call the `binnacle` MCP server with the session's own connection. Binnacle has no mod.

## Solution

An optional Claude Code plugin, `binnacle-mod`, ships in the same marketplace as `binnacle`, at the same version (ADR-0047). `binn init` asks whether to install it. The answer is "no" by default, and the question is asked only where a Claude Code that loads mods is found. Without a yes there is no mod.

Installed, the mod reads the Product Snapshot through the `binnacle` MCP server: at the session's start, after each turn, and once a minute. It reads the session's context fill and rate-limit windows from Claude Code. From these it shows:

- **a status line**: the session's Task and role, its tokens, its context and its usage limits;
- **a *Waiting for you* band**: what waits for the owner, a failing `main`, and a stale Next action, only while there is something;
- **a pane**: opened and closed by its own command, with a compact snapshot and buttons that put a command in the prompt box for the person to send;
- **toasts**: CI failing and a question answered, shown once per machine; context pressure, shown in the session it concerns;
- **session-start lines**: two or three lines from the snapshot in the context of a session whose branch maps to no Task.

It writes nothing. Its text is in the person's language. Without the daemon, or in a project that is not registered, it shows nothing. 0.6.0 is released with it.

## User Stories

1. As the owner, I want `binn init` to ask whether to install the Binnacle mod, so that I can turn it on without learning Claude Code's plugin commands.
2. As the owner, I want that question to default to "no", so that pressing Enter through `binn init` never installs a surface I did not choose.
3. As a user without Claude Code, or with one too old to load mods, I want `binn init` not to ask, so that I am not offered something that cannot run.
4. As the owner, I want a second `binn init` not to ask again once the mod is installed, so that it stays quiet about what is done.
5. As a scripted user, I want `binn init --mod yes` or `--mod no`, so that `--plan` and `--apply` can decide without a question.
6. As a user who declined, I want the README to give the one command that installs the mod, so that I can change my mind later.
7. As a user, I want to remove or disable the mod with Claude Code's own commands, so that turning it off needs nothing from Binnacle.
8. As a user who never installed the mod, I want the `binnacle` plugin and its skills to behave exactly as before, so that the mod costs me nothing.
9. As the owner, I want a status line under the prompt naming this session's Task and role, so that I know what a session is doing at a glance.
10. As the owner, I want the status line to show the session's tokens as Binnacle counts them, so that I see what the session has spent.
11. As the owner, I want the status line to show the context fill as Claude Code reports it, so that I see how close the session is to compacting.
12. As the owner on a subscription, I want the status line to show the five-hour and seven-day windows' use, so that I see a limit coming before it stops a run.
13. As a user off a subscription, I want the limits left out rather than shown as zero, so that the line never claims what Claude Code did not report.
14. As a user with my own `statusLine`, I want the mod's line beside mine, so that installing the mod does not replace or edit my settings.
15. As the owner, I want a session with no Task to show its role, or nothing, so that the line never invents a Task.
16. As the owner, I want a *Waiting for you* band above the prompt when a question waits, so that I answer it without opening the dashboard.
17. As the owner, I want the band to count the approvals waiting for me and the `ready-for-human` Tasks I should start, so that everything only I can move is in one place.
18. As the owner, I want the band to say when `main`'s CI is failing, so that I do not build on a red default branch.
19. As the owner, I want the band to say when the Next action names work already done, so that I run a Product session before following a stale course.
20. As the owner, I want the band gone when nothing waits, so that it never takes space to say "nothing".
21. As the owner, I want the band in every session of the project, so that whichever session I am in, I see it.
22. As the owner, I want a command that opens the pane and closes it again, so that the pane is there only when I ask for it.
23. As the owner, I want the pane to show the current epic with its progress, what waits for me, the Tasks in flight, CI and the Next action, so that I have the snapshot's opening without running a skill.
24. As the owner, I want a button that puts the Next action's command in the prompt box, so that I take the roadmap's course with one click and one Enter.
25. As the owner, I want a button for Binnacle's Suggested step when its command differs from the Next action's, so that the alternative is as close at hand.
26. As the owner, I want a button for `/binnacle:answer` while a question is unanswered, so that answering starts from the pane.
27. As the owner, I want a button for `/binnacle:checkpoint` in a session off a Task's branch, so that I close a Product session properly.
28. As the owner, I want a button never to send anything, so that every command still waits for my Enter.
29. As a user in a narrow terminal, I want the pane to open when I ask even below the width Claude Code places unasked panes at, so that the command always works.
30. As the owner, I want a toast when `main`'s CI starts failing, so that I notice it while working.
31. As the owner, I want a toast when a question I was asked is answered, so that the session that waits on it can go on.
32. As the owner with three sessions open, I want a project's change to toast once on the machine, not once per session, so that one event is one interruption.
33. As the owner, I want a context-pressure toast only in the session whose context is full, so that other sessions are not interrupted for it.
34. As the owner, I want the context-pressure toast at the threshold Binnacle uses for the session's model, so that the toast and the snapshot's attention item agree.
35. As the owner opening a Product session on `main`, I want two or three lines on the project's position in the agent's context, so that the agent starts knowing the current epic, what waits for me and the Next action.
36. As the owner, I want no such lines in a session on a ticket's branch, autopilot's agents included, so that an agent on a Task is not drawn away from its brief.
37. As the owner, I want those lines to stay two or three, so that a session's start costs few tokens (principle 6).
38. As a Russian-speaking user, I want the mod's text in Russian, worded as `binn` and the dashboard word the same items, so that Binnacle reads as one product.
39. As a user, I want the mod's language to follow my locale the way `binn`'s does, so that I set it in one place.
40. As a user whose daemon is stopped, I want the mod to show nothing and say nothing, so that a stopped daemon does not fill my chat with errors (principle 3).
41. As a user in a project that is not registered, I want the mod silent, so that it does not nag in repositories I never gave Binnacle.
42. As a user whose daemon starts later, I want the mod to appear at its next refresh, so that I need not restart the session.
43. As a user of the desktop app, I want the same status line, band, pane and toasts as in the terminal, so that the mod works wherever I use Claude Code.
44. As the owner, I want the mod to write no file, ticket or setting, so that it cannot change my project behind my back (ADR-0020).
45. As the owner, I want refreshes to cost no model tokens, so that the mod adds nothing to my usage.
46. As the owner with several sessions open, I want the refreshes not to multiply calls to the forge, so that the daemon's forge cache keeps GitHub's rate limit safe.
47. As a user updating `@it-bbox/binnacle`, I want `claude plugin update` to refresh the mod when it changed, so that the mod always matches the `binn` that serves its data.
48. As a user of a Claude Code whose mod API moved, I want a mod that does not load to break nothing else, so that the project is still developed as before.
49. As a maintainer, I want what the mod shows decided by one pure function, so that it is tested without Claude Code.
50. As a maintainer, I want `claude plugin validate` and `claude plugin test` run on the built mod wherever `claude` is installed, so that an API change is caught before a release.
51. As a maintainer, I want the package's test to check that the mod ships with its marketplace entry and loads as one module with no dynamic import, so that a build cannot ship a mod Claude Code refuses.
52. As an agent calling `project_snapshot`, I want an optional `session` argument that names my harness session, so that the snapshot can say which run is mine.
53. As the mod, I want the snapshot to give this session's run, with its Task, role and tokens, so that the status line comes from one call.
54. As the mod, I want the snapshot to give the Task the checkout's branch maps to, so that the session-start lines know a ticket's branch before the session has any run.
55. As a reader of `/binnacle:product`, I want the stale Next action worded the same as on the band, so that both say the same thing.

## Implementation Decisions

- **One plugin of its own** (ADR-0047). `binnacle-mod` is a hooks module bundled with its manifest, built into the package beside `plugin/` and listed in the package's marketplace manifest next to `binnacle`. Its manifest's version is drawn from its files, as `preparePlugin` draws `binnacle`'s, so `claude plugin update` refreshes it when it changes. The source lives in the CLI app beside the plugin: a hooks module, and a pure view module that the hooks call. The build bundles them, with `@binnacle/core`'s wording, into one ES module with no dynamic `import()`, which Claude Code refuses. The mod has no Node: it reaches the daemon only through `$.mcp.call` on the `binnacle` server.
- **`binn init`'s mod step**, asked before the plan as the autostart question is. It runs only where Claude Code is detected, `claude --version` is at least the minimum version the mod was validated on (one constant beside the mod, raised with it), and `claude plugin list --json`, read once already, does not list `binnacle-mod`. The question reads "[y/N]": Enter, an empty answer or the end of input declines. `--mod yes|no` answers it, and `--plan` and `--apply` without the flag decline it. A yes adds a plan item that runs `claude plugin install binnacle-mod@binnacle --scope user`, after adding the package's marketplace when the plugin step did not, through `planClaude`. Init never edits Claude Code's settings. Each skip is recorded with its reason in the Summary, in both languages.
- **The snapshot names this session.** `project_snapshot` gains an optional `session` argument, a harness session's id. The daemon's `project.snapshot` already takes `session` in its body and uses it for the context-pressure item's `own`. With `session` given, `activity` gains `own`: this session's latest run, with its Task id and title or null, its role, and its tokens summed over the session's runs, or null when Binnacle has stored no run of it yet. Without `session`, nothing changes. `binn mcp` still sends no session of its own; the mod passes `$.session.id()` explicitly, which survives `/clear` as `binn mcp`'s environment does not.
- **The snapshot names the checkout's Task.** `checkout` gains `taskId`: the Task whose branch name maps to the checkout's current branch, by the rule that attributes runs to Tasks, or null. The session-start lines and the checkpoint button read it.
- **The stale Next action already exists.** `next_action.stale` is raised when the Next action's command names a `DONE` or `CANCELLED` Task, or runs autopilot on an epic with nothing left for an agent. This is the owner's definition, work already done, read from facts. The band shows it as it is, worded by its code. No new item is added.
- **The view.** One pure function takes the snapshot, Claude Code's session figures (`context`, `rateLimits`), the language, the session's surface width and the previous state the mod keeps. It returns the status line's text, the band's items or none, the pane's content and buttons, the session-start lines or none, and the toasts to show with the new state. The hooks only fetch, call it and draw. A section the snapshot marks `available: false` is left out of what it draws, never shown as zero (principle 5).
- **The status line**: `$.ui.status`, the plugin's own pinned line under the prompt, beside the person's `statusLine`. It shows the Task id, or the role alone when the session has no Task; the session's tokens from `activity.own`, marked as Binnacle's count; the context percentage; and each rate-limit window's `percentUsed`. Each part is left out when there is no data for it.
- **The band**: a `ui.render` hook on `AbovePrompt`. It shows the counts of unanswered questions, approvals and the owner's `ready-for-human` Tasks, each with the first one's Task id; `main`'s CI failing; and `next_action.stale`. It passes to `next(e)`, drawing nothing, when none is there.
- **The pane**: one command, `binnacle-pane`, registered at `session.start`, opens the pane, or closes it when it is open. The pane is drawn by a `ui.render` hook on `Pane`. It shows the current epic with its progress, the band's items, the Tasks in flight, CI's state and the Next action. Its buttons call `$.prompt.fill` with `mode: "replace"`, and none sends:
  - the Next action's command;
  - the first Suggested step's command, when it differs;
  - `/binnacle:answer`, while a question is unanswered;
  - `/binnacle:checkpoint`, when `checkout.taskId` is null.
- **The toasts**: `$.ui.toast`. A project's change is CI's state on the default branch's commit turning `failing`, or a question leaving the unanswered list. It toasts in the first session that sees it. `$.store`, kept across sessions, holds the last change shown per project, and a session that finds it already there stays quiet. Context pressure toasts when the snapshot's `context.pressure` item for this session (`own`) first appears, in that session alone, at Binnacle's threshold for its model (ADR-0046). The first refresh of a session records the state and toasts nothing, so opening a session does not replay old events.
- **The session-start lines**: a `prompt.context` hook adds one context block when `checkout.taskId` is null and the snapshot answered, and nothing otherwise. The block has at most three lines: the current epic with its status and progress, what waits for the owner as counts, and the Next action with its command.
- **Refresh**: at `session.start`, after each turn (`session.measure`), and on a `$.clock` timer every 60 seconds, the forge cache's own period, so sessions add no forge calls beyond the daemon's cache. A call to the daemon uses no model.
- **Silence**: an MCP error, a missing `binnacle` server, `daemon.unreachable` or `project.not_registered` clears the status line and draws no band, pane content or toast. The next refresh tries again, so a daemon started later appears without a restart.
- **Language**: the locale rule `binn` uses, `LC_ALL` then `LANG` read through `$.env.get`. Attention items and diagnostics are worded by `wordMessage` from their codes, and the mod's own labels sit in a small table in both languages, using the terms in `CONTEXT.md`'s *Russian words*.
- **Surfaces**: one tree per element, resolved through `$.ui.resolve(e)`, so the terminal and the desktop app draw the same mod.
- **Docs**: the README and the installation checklist, each with its Russian twin, give the install line, `claude plugin install binnacle-mod@binnacle`, and how to disable or remove the mod. `docs/03-mcp-and-skills.md` describes the mod and `project_snapshot`'s `session` argument. `CONTEXT.md` has the term (*Mod*).
- **The release**: the CLI package's version becomes 0.6.0 in the exit demonstration's ticket, which the owner publishes.

## Testing Decisions

A good test exercises behaviour through the seam a caller uses, never an internal function's shape. This epic adds one seam, the mod's view function; the hooks around it are thin.

- **The view**, through the pure function with `node:test`, in the CLI app's tests, with snapshots built as the daemon returns them. Cases:
  - a Task's session gives its Task id and role on the status line, and a session with no Task gives its role;
  - no rate-limit windows leave the limits out;
  - the band is absent with nothing waiting, and shows questions, approvals, owner's Tasks, a failing `main` and `next_action.stale`, each worded in both languages;
  - the pane's buttons appear by their rules;
  - the session-start lines are at most three, and none when `checkout.taskId` is set;
  - a first refresh toasts nothing;
  - a CI turn to `failing` toasts once and, given a store that already holds it, not again;
  - a question leaving the list toasts;
  - context pressure toasts only for `own`;
  - a section marked `available: false` is left out.
- **The snapshot's session**, through `project.snapshot` on a fixture, as `apps/daemon/test/snapshot.test.ts` and `context-pressure.test.ts` build them:
  - `session` naming a stored session gives `activity.own` with its Task, role and summed tokens;
  - an unknown session gives null;
  - no `session` leaves the snapshot as before;
  - `checkout.taskId` is the Task of a ticket's branch and null on `main`.
- **The MCP tool**, through `toolRequest` in `packages/mcp/test/smoke.test.ts`: `project_snapshot` takes `session` and passes it on, and takes no argument as before.
- **`binn init`'s mod step**, through `apps/cli/test/init.test.ts` with its fake `claude`:
  - asked and declined by Enter;
  - a yes plans and runs the install;
  - `--mod yes` and `--mod no`;
  - `--plan` without the flag declines;
  - not asked with no Claude Code, with a version below the minimum, or with `binnacle-mod` already listed;
  - each skip in the Summary in both languages.
- **The package**, through `apps/cli/test/pack.test.ts`:
  - the built package holds the mod with its manifest and version;
  - the marketplace lists `binnacle-mod`;
  - its hooks module is one file with no dynamic `import()`.
- **Claude Code's own checks**, in a live test that runs only where `claude` is on PATH, as `apps/cli/test/autostart.live.ts` runs only on a real machine: `claude plugin validate` on the built mod reports nothing the engine would refuse, and `claude plugin test` runs the hooks' test, which drives `session.start`, a `ui.render` of the band and the pane, and the command. CI does not install Claude Code.
- **What a person sees**: the status line, the band, the pane, its buttons, the toasts and the session-start lines in the terminal and the desktop app, and silence with the daemon stopped. These are checked by hand in the exit demonstration.

## Contested points

- **A plugin of its own or a switch inside `binnacle`.** A switch needs no install, but loads an early-access module for every user of the skills. Taken in the grilling: a plugin of its own (ADR-0047).
- **The session-start lines everywhere.** They would give an agent on a ticket the project's position too, but it has its Task brief, and the lines could draw it off its Task. Taken in the grilling: only off a Task's branch.
- **A new stale Next action item.** The grilling chose "names work already done" as the definition, and `next_action.stale` already reads exactly that from the command. Taken: reuse it. A Next action whose prose, not its command, names a finished epic is not read; prose names done epics legitimately.
- **Toasts per session.** Simpler, but three sessions mean three toasts for one red CI. Taken in the grilling: once per machine for a project's change, kept in `$.store`. Two sessions refreshing in the same instant may both toast (ponytail: no lock in `$.store`; a compare-and-set if it shows in practice).
- **The session's id from the mod, not from `binn mcp`.** `binn mcp`'s environment can name the wrong session after `/clear` (epic 21). Taken: the mod passes `$.session.id()`, which Claude Code gives the hook in the session it serves.
- **A fixed `/binnacle:autopilot` button.** Autopilot's argument is an epic, and the Next action or the Suggested step already names it when it is the course. Taken: no fixed button; the Next action's and the Suggested step's buttons carry it.
- **Claude Code in CI.** It would catch a moved mod API on every push, but would bring another vendor's CLI into CI and break the build on each of its releases. Taken by the owner: a live test where `claude` is installed, and the exit demonstration.

## Out of Scope

- A mod for any harness other than Claude Code (ADR-0039).
- Any write from the mod: answering, approving, changing a `Status:`, starting autopilot, or sending a prompt.
- System notifications (`$.ui.notify`) and sounds; autopilot's push notification stays as it is (ADR-0022).
- Turning the mod on or off from the dashboard, or a `userConfig` switch inside it.
- A stale Next action read from the Next action's prose.
- Opening the pane by itself, at any width.
- The other entries of the product inbox, planned into epics 23 to 27, or not planned.

## Further Notes

- **Decided in the grilling, by the owner on 2026-10-28** (`brief.md`):
  - a plugin of its own;
  - `binn init` offers it, "no" by default;
  - the session-start lines only off a Task's branch;
  - a stale Next action is one naming work already done;
  - the pane opens by its command;
  - a project's change toasts once per machine, a session's own in that session.
- **Test seams confirmed by the owner on 2026-10-28**:
  - the mod's pure view function with `node:test`;
  - `project.snapshot` with `session`, as `snapshot.test.ts` builds it;
  - `toolRequest` in the MCP smoke test;
  - `init.test.ts` with its fake `claude`;
  - `pack.test.ts`;
  - `claude plugin validate` and `claude plugin test` where `claude` is installed, not in CI;
  - the drawing by hand in the exit demonstration.
- **Defaults taken from the brief, the docs and Ponytail, not asked**:
  - the mod reads through `$.mcp.call` only;
  - the band's items are `pendingDecisions`, a failing `main` and `next_action.stale`;
  - the status line sits beside the person's own;
  - context pressure at Binnacle's threshold for the model;
  - the buttons' rules above;
  - refresh at start, after each turn and every 60 seconds;
  - the locale rule `binn` uses;
  - one tree for both surfaces;
  - silence without the daemon;
  - the question asked before the plan, as autostart's is, with `--mod`;
  - the minimum Claude Code version as one constant beside the mod.
- **Checked while specifying**:
  - `next_action.stale` in `@binnacle/core`'s roadmap module already covers a command naming a finished Task, or autopilot on an epic with nothing left for an agent;
  - `project.snapshot` already reads `session` from its body;
  - `serveStdio` passes no `session`, and `toolRequest` keeps only a tool's schema fields, so `project_snapshot` needs `session` in its schema;
  - `wording.ts` imports only a type, so it bundles into the mod;
  - the forge's answers are cached for 60 seconds;
  - Claude Code's mod API (2.1.308) gives `$.mcp.call`, `$.session.id()`, `$.session.usage()` with `context` and `rateLimits`, `session.measure`, `prompt.context`, `$.prompt.fill`, `$.ui.status`, `$.ui.toast`, `$.ui.open`, `$.store` and `$.clock`, and refuses a module holding `import()`;
  - a pane asked for is placed at any width.
- **Order**:
  1. the snapshot's `session`, `activity.own` and `checkout.taskId` with the tool's argument, since everything reads them;
  2. the view function with its tests, then the plugin's build, package and marketplace entry with the hooks that draw it, the status line, band, pane, toasts and session-start lines, split as `/to-tickets` sees fit;
  3. `binn init`'s step, once the package holds the mod;
  4. the guides in both languages;
  5. the exit demonstration last.
- **The exit demonstration**, with the owner:
  - `binn init` asking, and installing on a yes;
  - in the terminal and the desktop app: the status line on a ticket's branch and on `main`, the band with a question waiting, the pane with its buttons filling the prompt, a toast for a failing CI in one of two sessions, and the session-start lines on `main` but not on a ticket's branch;
  - silence with the daemon stopped;
  - `claude plugin validate` clean;
  - 0.6.0 installed from the registry into a clean container.

## Risks

- **What the epic can break.**
  - The snapshot gains `activity.own` and `checkout.taskId`, shapes the dashboard and the skills read. Both are additive, and `own` exists only with `session`.
  - `binn init` gains a question, and a wrong default would install a surface nobody chose. The tests pin "no".
  - The package's marketplace gains a second plugin, and a broken entry could stop `binnacle` installing. `pack.test.ts` checks both entries.
- **The riskiest step.** The hooks module against an early-access API that moves between Claude Code releases: a release can refuse a module that loaded the day before. The minimum version, `claude plugin validate` in the live test and the exit demonstration are the guard. A mod that does not load breaks nothing else.
- **What was dropped, and why.**
  - A new stale-Next-action item: the existing one is the owner's definition.
  - Claude Code in CI: the owner chose not to depend on it.
  - System notifications: not asked for, and autopilot already has its own.
