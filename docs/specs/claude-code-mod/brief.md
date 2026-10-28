# A Binnacle mod for Claude Code: what the grilling decided

Epic 22's material is `docs/product-inbox.md`: *A Binnacle mod for Claude Code* (2026-10-11), and idea 7 of *Session start, agent configuration and traps*, "Waiting for you" as a state; and the roadmap's line for epic 22. This brief is what `/to-spec` starts from.

## The problem

Binnacle's state reaches a person only when they ask: `/binnacle:product`, `binn status` or the dashboard in a browser tab. While they work in a Claude Code chat they do not see that a question waits for them, that `main`'s CI went red, which Task this session is on, or how full its context is, until they look. A session starts knowing nothing of the project's position unless a skill is run. Claude Code's mods can now show such things beside the chat and add context at a session's start, and Binnacle has no mod.

## The outcome wanted

A person who installs `binnacle-mod` sees, in every Claude Code session of a registered project: a status line with the session's Task and role, its tokens and context, and the usage limits' windows where Claude Code has them; a *Waiting for you* band above the prompt, only when something waits; a pane, opened by a command, with a compact snapshot and buttons that put a command in the prompt box; and toasts when something changes. A session that is not on a Task's branch starts with two or three lines from the snapshot in its context. All of it is read-only, silent without the daemon, and absent for anyone who did not install it. 0.6.0 is released with it.

## Who it concerns

The owner, who runs Product sessions and autopilot on this repository every day in Claude Code, in the terminal and the desktop app; anyone who installed `@it-bbox/binnacle` and works in Claude Code. Other harnesses keep the skills as they are.

## The systems it touches

- the npm package's marketplace, which gains a second plugin, `binnacle-mod`, beside `binnacle` (ADR-0027, ADR-0044);
- `binn init`'s plan, which gains an optional step to install it;
- the `binnacle` MCP server's tools, `project_snapshot` first, which the mod calls, and whatever lets it find this session's own run, Task and role by the session's id;
- the snapshot's attention item for a Next action naming work already done, `next_action.stale`, and `/binnacle:product`, which shows it;
- `@binnacle/core`'s wording, which the mod's text comes from (ADR-0045);
- the README and `docs/operations/`, in both languages, for installing and removing the mod;
- ADR-0047.

## Decided in the grilling, 2026-10-28

- **A plugin of its own.** `binnacle-mod` sits in the same marketplace as `binnacle`, at the same version. Off by default means not installed; disabling or removing it is Claude Code's own command. The skills do not depend on it (ADR-0047).
- **`binn init` offers it.** An optional step in its plan, "no" by default, only where it finds a Claude Code that loads mods; a yes runs `claude plugin install binnacle-mod`. Running `binn init` again does not ask once it is installed. The README gives the same command.
- **The session-start lines only off a Task's branch.** Two or three lines from the snapshot, the current epic, what waits for the owner and the Next action, go into the context of a session whose branch maps to no Task, such as a Product session on `main`. A session on a ticket's branch, autopilot's agents included, gets none: it has its Task brief.
- **A stale Next action is one that names work already done**: a Task in `DONE` or `CANCELLED`, or an epic marked `done`. It is an attention item in the snapshot, read from facts, never guessed, and the band and `/binnacle:product` show it alike; `next_action.stale` already reads it from the Next action's command, as the spec found.
- **The pane opens by the mod's command**, and closes by it. It never opens by itself; the status line and the band show without it.
- **A project's change toasts once per machine, a session's own in that session.** CI failing and a question answered are shown in the first session that sees them, with the mod's store across sessions keeping the others quiet; the band still shows everywhere. A context-pressure toast appears only in the session it concerns.

Defaults, from the docs and the inbox, not put to the owner:

- **The mod reads, and writes nothing** (ADR-0047, ADR-0020). Its data comes from the `binnacle` MCP server through Claude Code's own connection, and the session's context and limits from Claude Code. A button fills the prompt box, never sends.
- **The band** shows the unanswered questions, the approvals and the owner's `ready-for-human` Tasks, `main`'s CI failing, and a stale Next action, each counted, and nothing at all when none is there.
- **The status line** is the mod's own line under the prompt, beside the person's own `statusLine`, which it neither replaces nor edits. The Task and role are Binnacle's reading of this session's run, marked as such; a session with no Task shows its role or nothing.
- **Context pressure** in the toast uses Binnacle's threshold for the session's model (ADR-0046); the status line shows the fill as Claude Code reports it.
- **The pane's buttons** fill the prompt with the Next action's command, `/binnacle:answer`, `/binnacle:autopilot` and `/binnacle:checkpoint`, each shown only when it applies.
- **Refresh**: at the session's start, after each turn, and on a timer while the session is open; a call to the daemon costs no tokens. How often the timer fires is the spec's.
- **Language**: the person's, from the daemon's codes, as everywhere (ADR-0045).
- **Both surfaces**: the terminal and the desktop app, from one tree.
- **Silent without the daemon** or in a project that is not registered: no line, no band, no toast, no error.
- **The epic ends with its exit demonstration and 0.6.0.** The last ticket is the exit demonstration, `ready-for-human`, with the owner's manual checks in the terminal and the desktop app, and 0.6.0 installed from the registry into a clean container. The owner publishes, as before.

## Constraints and open questions

- Claude Code only, beside the skills (ADR-0039). The mod API is early access and moves between releases: the mod's code targets the version `binn init` checks for, and a Claude Code that cannot load it has no mod, nothing else breaks (`AGENTS.md`, principle 3).
- Read-only, and progressive disclosure: the session-start lines stay two or three, no more (principle 6).
- Open: how the mod learns this session's run, Task and role from its session's id, whether through `project_snapshot` or a tool of its own; which Claude Code version `binn init` checks for and how; how often the timer refreshes; how the mod is tested in CI, where no Claude Code runs, and what `claude plugin validate` and `claude plugin test` cover in the exit demonstration.
