# Spec: Hygiene after 0.7

Status: READY
Triage: ready-for-agent

Epic 25, from its grilling's brief, `docs/specs/hygiene-after-0-7/brief.md` (2026-11-02), and the product inbox's entries planned into it: *Left after epic 21's tickets*, *Left after epic 22's tickets*, *Left after epic 23's tickets* and *The autostart unit ignores `BINNACLE_PORT`*. Exit criterion: a daemon started by autostart binds the port, address and allowed hosts the environment of the latest `binn daemon start` or `binn daemon autostart on` gave, on Linux, macOS and Windows; the board, `/binnacle:daily` and the dashboard's Task page read a Task in progress from activity as the snapshot does; `binn daemon start` never reports another daemon as its own; `binn init` from the chat offers the mod, and words a step that cannot apply as a skip with its reason; a skipped autostart's notice is one line; `/binnacle:answer` names a ticket's path; a new Claude Code session's Task reaches the mod's status line within seconds; and 0.8.0 is installed from the registry into a clean container. The owner confirmed the test seams on 2026-11-02, recorded under *Further Notes*.

## Problem Statement

0.7 left debts that break a promise or cost the owner attention.

The README, the site and the container guide say the daemon's port moves with `BINNACLE_PORT`. With autostart on, which `binn init` turns on by default, `binn daemon start` goes through the service, whose definition carries only `BINNACLE_HOME` and `PATH`: the daemon binds `7717` whatever the variable says, silently. `BINNACLE_HOST` and `BINNACLE_ALLOWED_HOSTS`, which epic 23 added for containers, are lost the same way.

Since epic 21 the snapshot drops a run that started before its Task's branch was merged, but the board, `/binnacle:daily`'s delta and the dashboard's Task page still read a merged `READY` Task with runs as in progress. `/binnacle:product` and `/binnacle:daily` then disagree on what waits for the owner.

With a dev container publishing `127.0.0.1:7717`, the host's service failed to bind, and `binn daemon start` printed the container's daemon, its version and address, as the one it had started.

`binn init` asks about the mod at a terminal, but `--plan --json` has no question for it and the init skill passes no `--mod`, so a chat never offers it. Every run reports an error for a harness the skills CLI finds with no global skills, and plans `code --add-mcp` where VS Code is missing, as in a container, where the item fails. A skipped autostart in a container prints `systemctl`'s notice over four lines of the Summary.

`/binnacle:answer` passes its argument to `task_get`, which takes a ticket's path, but its text names only the Task id forms.

A new Claude Code session's Task reaches the mod's status line about a minute after its first turn: the adapter holds a file's last message until the file has gone a minute unwritten, so a session with one message has no run until then.

## Solution

The service definition carries `BINNACLE_PORT`, `BINNACLE_HOST` and `BINNACLE_ALLOWED_HOSTS` as the environment of the `binn daemon start` or `binn daemon autostart on` that writes it gives them, on every platform; a variable absent there is absent from the definition, so the daemon takes its default. `binn daemon start` already rewrites a definition that differs and reloads the service, so a changed variable takes effect at the next start, and the address it prints shows the port bound.

The board, `/binnacle:daily` and the Task page read a Task in progress from activity through the same rule as the snapshot: runs that started before the latest merge of the Task's branch do not count.

`binn daemon start` confirms the daemon that answers is the one it or its service started, by its pid, and says the port is held by another daemon otherwise.

`binn init --plan --json` asks about the mod as it asks about autostart, and the init skill and its copy put the question to the person and pass the answer. A harness with no global skills and a missing VS Code are skips with their reasons. A skipped autostart's notice is cut to its first line.

`/binnacle:answer` names a ticket's path beside the Task id forms.

A Claude Code session's run is known from its file at once, with its session, checkout, branch, role and Task; its last message's tokens still wait for the file to settle. 0.8.0 is released with all of it.

## User Stories

1. As a user who set `BINNACLE_PORT=7800` and runs `binn daemon start` with autostart on, I want the daemon on 7800, so that the guides' promise holds.
2. As that user, I want the daemon after my next login on 7800 too, so that a reboot does not move it back.
3. As a user who removed `BINNACLE_PORT` from my shell, I want the next `binn daemon start` to bind 7717 again, so that a removed variable stops acting.
4. As a user running Binnacle in a dev container with `BINNACLE_HOST=0.0.0.0` and `BINNACLE_ALLOWED_HOSTS`, I want autostart, where the container has a service manager, to keep both, so that the published port still answers.
5. As a user on macOS, I want the launchd agent to carry the same variables, so that the behaviour does not depend on the platform.
6. As a user on Windows, I want the scheduled task to carry them too, so that the same holds there.
7. As a user, I want `binn daemon start` to say it rewrote the definition when a variable changed, so that I know why the service reloaded.
8. As a user, I want `binn daemon autostart on` to write the variables it sees, so that turning autostart on keeps the port I use.
9. As a user who set `BINNACLE_PORT` to an invalid value, I want `binn daemon start` to refuse it with the rule, as the daemon does, so that the service is not rewritten to fail at every login.
10. As the owner, I want the board to leave a merged `READY` Task out of the Tasks in progress, so that it agrees with the snapshot.
11. As the owner, I want `/binnacle:daily`'s delta to leave it out too, so that `/binnacle:product` and `/binnacle:daily` say the same about what waits for me.
12. As the owner, I want the dashboard's Task page to stop calling a merged `READY` Task in progress and offering to resume it, so that the page agrees with the board.
13. As the owner, I want a run started on the branch after its merge to count again everywhere, so that reopened work is still seen.
14. As the owner, I want usage by Task to keep every run, so that what a Task cost is unchanged.
15. As a user whose port is taken by a container's daemon, I want `binn daemon start` to say another daemon holds the port, so that I do not believe my daemon started.
16. As that user, I want it to exit non-zero then, so that a script sees the failure.
17. As a user whose daemon really started, I want `binn daemon start` to report it as today, so that nothing changes on the normal path.
18. As a user running `/binnacle:init` in a chat, I want to be asked whether to install the mod, so that the chat offers what the terminal does.
19. As that user, I want the question to default to no, so that the mod stays off unless I say yes (ADR-0047).
20. As a user whose Claude Code already lists the mod, I want no question, so that init does not ask twice.
21. As a user with a harness that has no global skills, I want init's skills step to skip it with its reason in my language, so that a run that did its work does not read as an error.
22. As a user in a container without VS Code, I want init to skip VS Code's MCP item with its reason, so that the plan holds no item bound to fail.
23. As a user in a container where autostart is skipped, I want one line saying why, so that the Summary stays readable.
24. As the owner, I want `/binnacle:answer` to say it takes a ticket's path, so that I use the form the Next action gives.
25. As the owner, I want a new session's Task and role on the mod's status line within seconds of its first turn, so that the line is right while I look at it.
26. As the owner, I want that session's tokens to stay "no data" until its message settles, so that a partly written message is never counted.
27. As the owner, I want the snapshot's Tasks in progress from activity to see a new session at once too, so that autopilot and the Suggested step read it.
28. As a user, I want 0.8.0 on npm with all of it, so that I get the fixes without building Binnacle.

## Implementation Decisions

- **The service's environment.** `serviceInputs` gains the three variables from the environment it is given, each only when set, after the same validation the daemon applies at start, so an invalid value is refused before anything is written. Each platform's renderer writes them where it writes `BINNACLE_HOME` and `PATH`: `Environment=` lines in the systemd unit, keys under `EnvironmentVariables` in the launchd plist, and `set` commands in the Task Scheduler action's `cmd` line, with the same quoting each already applies. Reading a definition back ignores them, as it ignores `PATH`; whether a definition is ours and which home it names are unchanged. `binn daemon start` and `binn daemon autostart on` write the definition from their own environment, so `rewriteDefinition`'s comparison of the rendered text picks up a changed or removed variable with no new rule. The guides that promise the port, the README, the site and the container guide with their Russian twins, say that autostart takes the variables of the latest `binn daemon start`.
- **One reading of runs after a merge.** The rule the snapshot applies, `sinceMerge`, moves to where `latestRuns` reads the stored runs, before each Task's latest run is chosen, so the board and `/binnacle:daily`'s `readAttributed` follow it with no change of their own; the snapshot uses the same function rather than its own copy. Usage, a Task's runs by role and `task.get`'s run list keep every attributed run. `task.get`'s brief gains whether the Task is in progress from activity, by that reading, and the Task page shows "in progress" and the resume command from it instead of from the presence of runs.
- **Another daemon on the port.** After the runtime file names a live pid and something answers `/health`, `binn daemon start` asks `daemon.status` with the home's token and accepts the start only when the pid it answers is the runtime file's. A refused token or another pid is "the port is held by another daemon", worded in both languages with the address, and exit 1 after the start's timeout, with the log's tail as today. `/health` stays unauthenticated and unchanged.
- **The mod from the chat.** `--plan --json` gains `mod: { ask }` beside `autostart`, true when the interactive form would ask: Claude Code is found, the mod is not listed, and no `--mod` was given. The init skill, `.claude/skills/binnacle/skills/init`, asks the person when it is true, defaulting to no, and passes `--mod` or `--no-mod` to `--apply`, as it does for autostart; `apps/cli/plugin/` is its built copy.
- **Skips with their reasons.** In the skills step, the skills CLI's refusal of global installation for a harness is a skip of that harness, with a coded reason worded in both languages; other failures stay errors. VS Code's MCP item is planned only when `code` is on `PATH`; otherwise the plan lists it as skipped with its reason, as other harnesses not found are.
- **The autostart notice.** A skipped autostart's reason from the service manager is cut to its first non-empty line in the Summary and the plan.
- **`/binnacle:answer`'s text** names `docs/specs/<slug>/issues/NN-<name>.md` beside `<spec-slug>/NN` and `#<number>`.
- **A new session's run at once.** The Claude Code adapter's reading of an unsettled file still holds back its last message's token counts, but no longer hides the session: a file whose only messages are unsettled yields the session's run, its session id, working directory, branch and timestamps, with token counts null, which the ingest stores and replaces when the message settles. A run with null counts is in progress from activity and attributed to its Task like any other; totals read null as no data, never zero (principle 5). `SETTLED_AFTER_MS` is unchanged.
- **The release**: the CLI package's version becomes 0.8.0 in the exit demonstration's ticket, which the owner publishes.

## Testing Decisions

A good test exercises behaviour through the seam a caller uses, never an internal function's shape. This epic adds no seam.

- **The service's environment**, through `binn daemon start` and `binn daemon autostart on` with the fake service managers, as `apps/cli/test/autostart.test.ts` does: with `BINNACLE_PORT`, `BINNACLE_HOST` and `BINNACLE_ALLOWED_HOSTS` set, the systemd unit, the plist and the task carry them; a second start with the port changed rewrites and reloads; a start without it drops it; an invalid value is refused and the definition untouched. On the real managers, in CI's `autostart-live` on Linux, macOS and Windows: a daemon started through the service with `BINNACLE_PORT` set answers on that port.
- **Runs after a merge**, through the board's and `daily`'s operations on a fixture with a real Git repository and a real `git merge`, as `apps/daemon/test/board.test.ts`, `daily.test.ts` and `next.test.ts` build them: a `READY` Task with a run on its branch is in progress; after the merge it is not, in the board, in the delta and in `task.get`'s brief; a run after the merge brings it back; usage by Task is unchanged. The Task page, checked in a browser.
- **Another daemon**, through `binn daemon start` against a listener on the home's port that is not its daemon, as `apps/cli/test/autostart.test.ts` and `apps/daemon/test/daemon.test.ts` start daemons: the start fails with the worded message and exit 1; a normal start reports as before.
- **init**, through `binn init --plan --json` and its Summary, as `apps/cli/test/init.test.ts` does: `mod.ask` true and false in its three cases; `--apply` with `--mod` and `--no-mod`; a skills CLI refusing global installation gives a skip with its reason; no `code` on `PATH` gives VS Code skipped; a multi-line autostart reason prints its first line.
- **The skills' texts**, the init skill's question and `/binnacle:answer`'s path, through the package build's test, `apps/cli/test/pack.test.ts`.
- **A new session's run**, through `project.snapshot` and `usage.get` with a Claude Code session file written just now, as `apps/daemon/test/usage.test.ts` and `snapshot.test.ts` do: its run is in progress from activity with its Task and role and null tokens; once the file is older than the settling time, its tokens are counted once.
- **Wording**, every new code worded in both languages, through `apps/daemon/test/codes.test.ts` and the CLI's text tables.
- **What only a person sees**, the mod's line within seconds, init from a chat offering the mod, and the port across a login, is the exit demonstration's.

## Contested points

- **The unit follows the environment, or a set value sticks.** Sticking guards against a start from an environment without the variable, but a removed variable would go on acting. Taken in the grilling: the environment, as `PATH` already is, with the address printed at every start.
- **The port in the machine's settings.** It would survive any environment, but it is a further setting ADR-0046's rule needs a decision for, and a second source beside the variable. Taken in the grilling: not added.
- **Telling another daemon by `/health`.** Adding the pid to `/health` would avoid the token, but makes the one unauthenticated endpoint say more. Taken: `daemon.status` with the home's token, which another home's daemon refuses.
- **A new session's run at once, or a shorter settling time.** A shorter time risks counting a message still being written. Taken: the run at once with null tokens, the settling time unchanged.

## Out of Scope

- The other entries of the product inbox, planned into epics 26 to 30, or not planned.
- Dependabot's `typescript` rule for the root's 7.x updates, taken by hand until `vue-tsc` runs on 7.
- The port, address or allowed hosts as a setting in `~/.binnacle/settings.json` or on the dashboard.
- Reading merges from the forge's closed pull or merge requests.
- Any change to `/health`.
- Other harnesses' settling rules.

## Further Notes

- **Decided in the grilling, by the owner on 2026-11-02** (`brief.md`): the service definition follows the environment of the latest `binn daemon start` or `binn daemon autostart on`, a variable absent there absent from it; the epic ends with its exit demonstration and 0.8.0.
- **Test seams confirmed by the owner on 2026-11-02**: `binn daemon start` and `binn daemon autostart on` with the fake service managers, and CI's `autostart-live` on the three platforms; the board's and `daily`'s operations and `task.get` on a fixture with real Git, the Task page in a browser; `binn daemon start` against a foreign listener; `binn init --plan --json` and its Summary; the package build's test for the skills' texts; `project.snapshot` and `usage.get` with a fresh Claude Code file; the rest in the exit demonstration.
- **Defaults taken from the brief, the docs and Ponytail, not asked**: the variables validated as the daemon validates them; `sinceMerge` moved, not copied; `daemon.status` with the token for the pid; `mod.ask` by the interactive form's rule; skips worded from codes; the reason's first non-empty line; null tokens for an unsettled session's run.
- **Checked while specifying**: `serviceInputs` carries `node`, `entry`, `home` and `PATH` only, and the three renderers write `BINNACLE_HOME` and `PATH` alone; `rewriteDefinition` rewrites when the rendered text differs; `latestRuns` takes every attributed run, and the board and `readAttributed` read it; the Task page's `fromRuns` is `READY` with any run; `waitForStart` accepts any `binnacle` answering `/health` while the runtime file's pid lives; `binn init` has `--mod` and `modStep`, but `--plan --json` has no `mod`; `readMessages` drops a file's last message until `SETTLED_AFTER_MS` has passed since its last write, so a session with one message yields no record. claude-code-mod/07's run measured the Task 66 s after the first turn.
- **Order**: the service's environment first, the promise the guides break; then runs after a merge, another daemon, a new session's run and init with its skips, which touch separate modules; `/binnacle:answer`'s text; the exit demonstration last.
- **The exit demonstration**, with the owner: `BINNACLE_PORT=7800 binn daemon start` with autostart on, then a login, the daemon on 7800, then the variable removed and 7717 again; a merged `READY` Task out of the board, `/binnacle:daily` and the Task page; a container's daemon on the port and `binn daemon start` saying so; `/binnacle:init` in a chat asking about the mod; a new session's Task on the mod's line within seconds; and 0.8.0 installed from the registry into a clean container.

## Risks

- **What the epic can break.** The service's definition is what starts the daemon at every login on three platforms: a variable quoted wrongly, or `cmd`'s `%` expansion in a Windows value, can leave a daemon that never starts, with no terminal to see it. Moving `sinceMerge` changes which Tasks the board reads in progress, and autopilot starts Tasks from that reading. A run with null tokens is a new shape for every reader of runs: the dashboard, the vault, usage by role and the mod.
- **The riskiest step.** The service's environment on Windows and macOS, which only `autostart-live` exercises on the real managers; it is first, so the rest of the epic runs on it.
- **What was dropped, and why.** A port that sticks and the port in settings: the grilling chose the environment. The pid on `/health`: the token already tells one home's daemon from another's. A shorter settling time: it would count partial messages.
