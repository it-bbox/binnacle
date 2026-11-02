# Hygiene after 0.7: what the grilling decided

Epic 25's material is `docs/product-inbox.md`: *Left after epic 21's tickets* (2026-10-28), *Left after epic 22's tickets* (2026-10-29), *Left after epic 23's tickets* (2026-10-30) and *The autostart unit ignores `BINNACLE_PORT`* (2026-10-31); and the roadmap's line for epic 25. This brief is what `/to-spec` starts from.

## The problem

0.7 left debts that break a promise or cost the owner attention. With autostart on, the daemon binds `7717` whatever `BINNACLE_PORT` says, though the README, the site and the container guide promise the port can be moved; the unit carries only `BINNACLE_HOME` and `PATH`, so `BINNACLE_HOST` and `BINNACLE_ALLOWED_HOSTS` are lost the same way. The snapshot drops runs on a Task's branch after its merge, but the board, `/binnacle:daily`'s delta and the dashboard's Task page do not, so `/binnacle:product` and `/binnacle:daily` disagree on what waits for the owner. `binn daemon start` reported a dev container's daemon as the one it started, while its own service had failed on the taken port. `binn init` from the chat never offers the mod; it reports an error for a harness with no global skills and for `code --add-mcp` where VS Code is missing; and a skipped autostart prints `systemctl`'s notice over four lines. `/binnacle:answer` takes a ticket's path but says only the Task id forms. And a new session's Task reaches the mod's status line about a minute after its first turn.

## The outcome wanted

The daemon started by autostart binds the port, address and allowed hosts the environment of the latest `binn daemon start` or `binn daemon autostart on` gave. Every surface reads a Task in progress from activity as the snapshot does. `binn daemon start` never reports another daemon as its own. `binn init` from the chat offers the mod as the terminal does, and words a step that cannot apply as a skip with its reason. A skipped autostart's notice is one line. `/binnacle:answer` names a ticket's path. A new session's Task reaches the mod's line within seconds. 0.8.0 is released with all of it.

## Who it concerns

The owner, who runs Product sessions and autopilot on this repository daily with the mod on; anyone who installed `@it-bbox/binnacle`, moved its port or runs it in a container, or runs `binn init` from a chat.

## The systems it touches

- the service definitions in `apps/daemon/src/service.ts` (systemd unit, launchd plist, Task Scheduler task) and `start` and `autostart` in `apps/cli/src/daemon-commands.ts`;
- `latestRuns` in `apps/daemon/src/usage.ts`, read by `apps/daemon/src/board.ts`; `readAttributed` in `apps/daemon/src/operations.ts`; `fromRuns` in `apps/dashboard/app/pages/task.vue`;
- `waitForStart` and the report in `apps/cli/src/daemon-commands.ts`;
- `binn init`'s plan and apply (`apps/cli/src/init.ts`, `init-text.ts`), the init skill and its copy;
- `/binnacle:answer`'s skill text;
- the session importer, and the mod's status line that reads the snapshot.

## Decided in the grilling, 2026-11-02

- **The unit follows the environment.** `binn daemon start` already rewrites the service definition with the current paths; it now writes `BINNACLE_PORT`, `BINNACLE_HOST` and `BINNACLE_ALLOWED_HOSTS` too, as the environment of that `binn daemon start` or `binn daemon autostart on` gives them, on every platform. A variable absent there is absent from the definition, so the daemon takes its default. Not taken: a value that sticks once set, since a removed variable would go on acting; and the port in `~/.binnacle/settings.json`, a further setting ADR-0046's rule would need a decision for. The address `binn daemon start` prints shows a port that was not meant.
- **The epic ends with its exit demonstration and 0.8.0.** The last ticket is the exit demonstration, `ready-for-human`, with the owner's manual checks, and 0.8.0 installed from the registry into a clean container. The owner publishes, as before.

Defaults, from the docs, the code and the inbox, not put to the owner:

- **One reading of a Task in progress from activity.** `sinceMerge` is applied in `latestRuns`, before the latest run is chosen, so the board and `/binnacle:daily`'s delta follow the snapshot with usage untouched; the dashboard's Task page reads the same.
- **`binn daemon start` tells another daemon from its own.** It compares the pid of the daemon that answers with the one it or its service started, and when they differ says the port is held by another daemon instead of reporting a start.
- **`binn init` from the chat offers the mod.** `binn init --plan --json` gains `mod: { ask }` beside `autostart`, and the init skill and its copy a step that asks, declined by default as the terminal's `[y/N]`.
- **A step that cannot apply is a skip with its reason**: a harness the skills CLI finds with no global skills, and `code --add-mcp` where VS Code is missing.
- **A skipped autostart's notice is its first line.**
- **`/binnacle:answer` names a ticket's path** beside the Task id forms, which `task_get` already takes.
- **A new session's Task within seconds.** A new session's file reaches the snapshot only at the importer's next pass, about a minute (claude-code-mod/07's run measured 66 s). How it is read sooner is the spec's to settle.
- **No ADR**, and no new term in `CONTEXT.md`.

## Constraints and open questions

- Small enough for autopilot, one ticket after another, the exit demonstration last.
- Binnacle stays optional: a project without the daemon is developed the normal way (principle 3).
- Left out: Dependabot's `typescript` rule holding the root's 7.x updates, taken by hand until `vue-tsc` runs on 7.
- Open: how the importer picks up a new session's file sooner, by watching the directory or by a pass the snapshot triggers; what launchd and Task Scheduler need to carry the variables, each checked on its platform.
