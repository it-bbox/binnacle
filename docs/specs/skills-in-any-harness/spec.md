# Spec: Skills in any harness

Status: READY
Triage: ready-for-agent

Epic 14 of v1, as defined in `docs/05-mvp-plan.md` phase 14, and ADR-0039. Exit criterion, restated while specifying: on a Mac with Codex, Antigravity and ZCode installed, the owner runs `binn init` on a repository, confirms once, and runs `binnacle-product` in each of the three and gets the Product Snapshot, in one of them through `binn call` rather than MCP; Claude Code, installed afterwards, gets the `binnacle` plugin and no second copy from one more `binn init`. The phase was grilled on 2026-10-06; the owner confirmed this spec's test seams on 2026-10-06, recorded under *Further Notes*.

## Problem Statement

The owner works in one project from several harnesses — on a Mac, Codex, Antigravity and ZCode — and the people expected to use Binnacle work from Pi, DeepSeek's harness and others. Binnacle's skills reach only Claude Code: `binn init` installs them as the `binnacle` plugin through `claude plugin`, and for every other harness its Summary prints a prompt that points an agent at a `SKILL.md` file by path. Matt Pocock Skills and Ponytail are the same: installed into Claude Code, printed as a link for the rest.

Even placed by hand, the skills are written for Claude Code. They call each other `/binnacle:daemon`, autopilot names Claude Code's agent tool, its worktrees under `.claude/worktrees` and its push notification, and `/binnacle:init` tells the human to approve a server "when Claude Code asks". On 2026-10-06 the owner linked the skills into `~/.codex/skills` by hand, and Codex ran them only because it also had Binnacle's MCP server.

That is the third gap. Every skill that reads the project — product, daily, task, status, checkpoint, autopilot — calls Binnacle's MCP tools. `binn init` registers the MCP server with four harnesses; Antigravity and ZCode are not among them, and Pi has no MCP at all.

## Solution

**One install for every harness.** `binn init`'s plan installs Binnacle's skills into every harness the `skills` CLI (skills.sh) detects, by running `npx skills add <the package's skills> -g -y`, and then removes them from Claude Code with `npx skills remove -g -a claude-code`, because Claude Code keeps the `binnacle` plugin (ADR-0023, ADR-0027). Outside Claude Code a skill is named `binnacle-<action>`: `binnacle-product`, `binnacle-daily`, `binnacle-init`. Matt Pocock Skills and Ponytail go the same way in the same plan, from their repositories. The Summary names the harnesses the CLI installed into. Running `binn init` again after installing another harness adds it.

**One neutral text per skill.** The skills say what to do, not with which harness's tool: ask the human, start a background agent in a worktree of its own, open a new session. What depends on the harness, such as which file it reads its MCP servers from or whether it reads them only when a session starts, comes from `binn`'s own output. The package builds the copy for the `skills` CLI from the plugin's skills, renaming each and rewriting `/binnacle:<action>` to `binnacle-<action>`.

**Binnacle from any shell.** `binn call <tool> [json]` calls one of the daemon's MCP tools for the working directory and prints the same JSON the tool returns. Each skill that calls a tool uses it where the harness has Binnacle's MCP server, and `binn call` in the shell where it does not.

**Autopilot everywhere, refusing where it cannot run.** Autopilot ships with the rest. Where the harness cannot start a background agent in a worktree of its own, it stops at its first step, changes nothing, and says the epic's tickets are run by hand. It sends a push notification only where the harness can.

**Stale skills are visible.** Each skill in the copy carries the package's skills version. `binn audit` reports installed `binnacle-*` skills whose version differs from the package's, and `binn init`'s plan reinstalls them. Nothing else writes into a harness's directories.

## User Stories

### Installing

1. As the owner on a Mac with Codex, Antigravity and ZCode, I want one `binn init` to give all three Binnacle's skills, so that I do not install them per harness.
2. As a user of Pi or another harness the `skills` CLI knows, I want `binn init` to install Binnacle's skills into it, so that Binnacle is not a Claude Code product.
3. As a user, I want the skills installed at user scope, so that every project on the machine has them and nothing is written into the repository (ADR-0020).
4. As a user, I want the install shown in `binn init`'s plan and run only after my one yes, so that nothing changes on my machine without it (ADR-0026, ADR-0034).
5. As a user confirming from the chat, I want the same plan through `binn init --plan --json` and `--apply <id>`, so that installing into my harnesses works from a chat too (ADR-0037).
6. As a user, I want the Summary to name the harnesses the skills went into, so that I know where to run them.
7. As a Claude Code user, I want `/binnacle:product` from the plugin and no `/binnacle-product` beside it, so that each skill appears once.
8. As a user who installs another harness later, I want running `binn init` again to give it the skills, so that adding a harness needs no new command.
9. As a user, I want a harness left out of the install with `--skip-harness <id>`, so that I keep Binnacle's skills out of one I do not use it in.
10. As a user whose machine has no harness `binn` recognises, I want the skills step skipped and said so, so that the `skills` CLI does not install into every harness it knows.
11. As a user without `npx` or without network access, I want `binn init` to print the commands instead of failing, so that I can run them later.
12. As a user, I want a failed `npx skills` call reported with its output and the rest of the plan to go on, so that one harness's problem does not undo the setup.

### Matt Pocock Skills and Ponytail

13. As a user, I want Matt Pocock Skills installed into the same harnesses as Binnacle's skills, so that `/grill-with-docs` and the rest of the chain run wherever Binnacle's skills do.
14. As a user, I want Ponytail installed into the same harnesses, so that its rules apply in every harness I work from.
15. As a Claude Code user, I want Matt Pocock Skills and Ponytail to stay plugins there, without a second copy from the `skills` CLI.
16. As a user whose manifest declares one of them false, I want it left out of every harness, as it is left out of Claude Code today.

### Names and text

17. As a user of any harness, I want Binnacle's skills named `binnacle-<action>`, so that they do not collide with built-in `init`, `help` or `status`, or with my own skills.
18. As a user reading a skill's answer, I want other skills named the way my harness names them, so that I can type what it suggests: `binnacle-daemon` outside Claude Code, `/binnacle:daemon` in it.
19. As a user of a harness without a question tool, I want a skill that asks me something to ask in the chat, so that it works without Claude Code's question tool.
20. As a user of any harness, I want `binnacle-init` to tell me to open a new session when my harness reads MCP servers only at the start of one, from `binn init`'s own output, so that the advice fits my harness.
21. As a user of any harness, I want `binnacle-autopilot` to be started only by me, so that the rule of ADR-0022 holds where the harness has no way to forbid a model from invoking a skill.

### Binnacle without MCP

22. As a Pi user, I want `binnacle-product` to show the Product Snapshot through `binn call`, so that a harness without MCP is supported.
23. As a user whose harness has MCP but no `binnacle` server registered, I want the skills to fall back to `binn call`, so that they work before I register it.
24. As a user, I want `binn call` to print the same JSON the MCP tool returns, so that a skill reads one shape whichever way it called.
25. As a user, I want `binn call` with a stopped daemon to fail as the MCP tool does, with `daemon.unreachable`, so that the skill names the same fix.
26. As a user, I want `binn call` to resolve the project from the working directory, as `binn mcp` does, so that it answers for the checkout I am in.
27. As a user, I want `binn call` to reject an unknown tool or arguments that are not JSON with a plain message and a non-zero exit, so that a typo does not look like an empty answer.
28. As a user, I want `binn call --help` to list the tools and their arguments, so that I can call one by hand.

### Autopilot outside Claude Code

29. As a user of a harness with background agents in worktrees of their own, I want `binnacle-autopilot` to run an epic there as it does in Claude Code, so that autopilot is not Claude Code's alone.
30. As a user of a harness without them, I want `binnacle-autopilot` to refuse at once, change nothing, and tell me to run the tickets by hand, so that it never runs them half-isolated.
31. As a user of a harness that cannot send a push notification, I want autopilot's final report in the chat alone, so that it does not fail at its last step.
32. As the owner, I want autopilot's refusal in a linked worktree to describe a worktree in general rather than Claude Code's `.claude/worktrees`, so that it is right in any harness.

### Keeping skills current

33. As a user who updated `binn`, I want `binn audit` to report Binnacle's skills installed in my harnesses as stale, so that I know to refresh them.
34. As a user, I want `binn init`'s plan to reinstall stale skills, so that refreshing is the same one confirmation as installing.
35. As a user whose skills are current, I want `binn init` to say so and plan nothing for them, so that a second run changes nothing.
36. As the owner on this repository, I want autopilot to refresh the `skills` CLI's copy after a merge that changed the skills, as it already refreshes the plugin, so that every harness runs the merged skills.
37. As the owner merging by hand, I want the development workflow to name the same refresh, so that it is not autopilot's secret.

### Documentation

38. As a reader of `docs/03-mcp-and-skills.md`, I want it to say how the skills reach every harness and what `binn call` is, instead of saying no skill format exists for another harness.
39. As a new user, I want the README to say that one `binn init` sets up every harness, with the names the skills have outside Claude Code, so that setup is the same whatever I use.
40. As a reader of `binnacle-help`, I want the guide in the names of the harness I run it in.

## Implementation Decisions

- **The skills copy.** The package build, which already copies the `binnacle` plugin into the package with a version drawn from its files, also writes a second directory: one folder per skill named `binnacle-<action>`, its `SKILL.md` with `name: binnacle-<action>`, every `/binnacle:<action>` in the text rewritten to `binnacle-<action>`, and the plugin's version under `metadata` (Agent Skills' string map). Frontmatter fields only Claude Code knows — `disable-model-invocation`, `argument-hint` — are dropped from the copy; autopilot's text carries its human-only rule itself. The plugin directory stays the source of both.
- **The skills' text** is rewritten once, in the plugin, to name no harness's mechanism: no agent tool by name, no question tool, no `claude plugin`, no `.claude/` path, no "Claude Code asks". A skill that needs a harness-specific fact takes it from `binn`'s output. Autopilot asks for a background agent in a worktree of its own, through whatever the harness offers, and refuses at its first step when there is none.
- **The MCP fallback**, written once in each skill that calls a tool: call the `binnacle` MCP tool; if the session has no such tool, run `binn call <tool>` with the same arguments in the shell and read its JSON.
- **`binn call <tool> [json]`** uses the same tool table and the same daemon call as `binn mcp`, so a tool exists in both or in neither. It prints the tool's result as JSON on stdout and exits 0; the daemon's error envelope, as JSON on stdout with a non-zero exit; an unknown tool or invalid JSON, a message on stderr with the usage exit code. The working directory is the project path, as for `binn mcp`. The daemon not running is the exit code `binn` already uses for it.
- **`binn init`'s skills step**, after the plugin step:
  - Runs only when `binn` detected at least one harness; otherwise it says why it skips.
  - Plans, for each skill set — Binnacle's from the package's copy, Matt Pocock Skills, Ponytail, minus any the manifest declares false — `npx skills add <source> -g -y`, then `npx skills remove -g -a claude-code [--skip-harness ids] -s <its skills> -y`.
  - Shows those commands in the plan and runs them, in that order, only after the confirmation.
  - Without `npx` on PATH, prints them instead, as other steps print what they cannot run.
  - Names in the Summary the harnesses from the `skills` CLI's output; records a failed call with its output and goes on.
- **`--skip-harness <id>`** takes an id of the `skills` CLI, may be repeated, and adds that harness to every removal. It is an option of the interactive run and of `--plan --json`, so the plan's identifier covers it.
- **Freshness.** Installed skills are read from the user-scope directory the `skills` CLI installs canonical copies into, `~/.agents/skills/binnacle-*`. A `binnacle-*` skill whose `metadata` version differs from the package copy's, or that is missing while others are present, is stale. `binn audit` reports it as one finding with a code under the tools' or harnesses' group; `binn init` plans the add whether the set is stale or current, and says which: the canonical copy alone cannot tell whether a harness installed since has the skills, and the add is idempotent, so a current set reaching a new harness needs no command of its own (story 8). Matt Pocock Skills and Ponytail are not versioned by Binnacle and are not checked for freshness.
- **The Summary's per-harness next step** for a harness other than Claude Code stops pointing at a `SKILL.md` path and says to run `binnacle-product` there.
- **MCP templates** stay for Claude Code, Codex, opencode and VS Code (ADR-0039). Every other harness reaches the tools through `binn call`.
- **Autopilot's refresh** on this repository, after a merge that changed the plugin's skills, adds the `skills` CLI's add of the package's copy to the plugin refresh epic 9 introduced. `docs/workflow/02-development-workflow.md` names it beside the plugin refresh.
- **Documentation**: `docs/03-mcp-and-skills.md` states both channels, the names outside Claude Code and `binn call`; the README and `README.ru.md` say that one `binn init` covers every harness; `binnacle-help` lists skills by their names in the harness reading it.

## Testing Decisions

- A good test drives `binn` as a process, or the package's build as a function, and checks what a user sees: the commands planned and run, the files written, the JSON printed, the findings reported. It does not reach into `binn init`'s steps.
- **`binn init` as a process** with fake executables first on PATH, as `init.test.ts` does with its fake `claude`: a fake `npx` records each call's arguments. Cases: add before remove for each skill set; the removal names `claude-code` and every `--skip-harness`; Matt Pocock Skills and Ponytail planned beside Binnacle's, and left out when declared false; no harness detected skips the step; no `npx` prints the commands; a declined plan runs no `npx`; a failed call is reported and the rest goes on; a current copy and a stale one both plan the add, and the step says which; the `--plan --json` and `--apply` pair carries the same commands.
- **`binn call` as a process** against a running daemon, as `project.test.ts` and the MCP smoke test start one: its output for `project_snapshot` and `task_get` equals the MCP tool's; a stopped daemon gives `daemon.unreachable` and the exit code; an unknown tool and bad JSON exit non-zero with a message.
- **The package build**, as `pack.test.ts` tests it: the copy has one `binnacle-<action>` folder per plugin skill, matching names, no `/binnacle:` left in any text, the plugin's version in each `metadata`, and no Claude-only frontmatter. One check over the plugin's skill texts rejects the harness-specific mechanisms listed above.
- **`binn audit`**, as `audit.test.ts` sets up a home: a stale or partly missing `binnacle-*` set is reported, a current one is not.
- Not tested: an agent running a skill, and autopilot's refusal; both belong to the exit demonstration.

## Out of Scope

- MCP templates for harnesses beyond the four; `binn call` covers them.
- Binnacle's own list of harnesses or skill directories; the `skills` CLI keeps it.
- Telemetry from the new harnesses; epic 10.
- Translating skills' output; epic 13.
- Freshness of Matt Pocock Skills and Ponytail; their own tools update them.
- A project-scope install of the skills; user scope only, so the repository is not written.
- Porting Claude Code's plugin refresh mechanism to other harnesses; `binn init` reinstalls.

## Further Notes

- **Decisions taken while grilling, by the owner on 2026-10-06**, recorded in ADR-0039: the plugin stays for Claude Code; every other harness through the `skills` CLI; the `binnacle-<action>` names; one neutral text; autopilot everywhere with a refusal; `binn call`; adding a harness by running `binn init` again.
- **Decision taken while specifying, by the owner on 2026-10-06**: the `skills` CLI keeps its detection to itself and has no option to exclude a harness, so `binn init` adds into every harness it detects and then removes from Claude Code, the Summary rather than the plan naming the harnesses. ADR-0039 and phase 14 were amended to say so, and `--harness` became `--skip-harness`.
- **Decision taken after implementation, by the owner on 2026-10-07**: *Freshness* first said `binn init` plans nothing for a current set, which kept a harness installed since from getting the skills, against story 8 and ADR-0039 (ticket 06's question). `binn init` now plans the add for a current set too; freshness only says which, and drives `binn audit`'s finding. Ticket 09 carries it.
- **Test seams confirmed by the owner on 2026-10-06**: the `binn init` process, the `binn call` process, the package build, and `binn audit`, with the exit demonstration for what an agent does.
- **Found while specifying**: with `-y` and no harness detected, the `skills` CLI installs into every harness it knows; hence the skip when `binn` detects none. Ponytail's repository holds its skills under `skills/*/SKILL.md`, which the `skills` CLI reads.
- **Defaults taken from the docs and Ponytail, not asked**: the copy built from the plugin rather than a second source; the version in `metadata` rather than a lock file of our own; freshness read from `~/.agents/skills` alone, where the `skills` CLI keeps canonical copies; `binn call`'s output identical to the tool's rather than a new format.
- **The exit demonstration**: on the owner's Mac with Codex, Antigravity and ZCode, `binn init` with one yes; `binnacle-product` in each of the three, one of them without the `binnacle` MCP server so that it goes through `binn call`; `binnacle-autopilot` in a harness without background agents refuses and changes nothing; Claude Code installed afterwards, `binn init` again, and Claude Code lists `/binnacle:product` once.
