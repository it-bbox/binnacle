# Spec: Hygiene after 0.4.0

Status: READY
Triage: ready-for-agent

Epic 21, from its grilling's brief, `docs/specs/hygiene-after-0-4-0/brief.md` (2026-10-28), and the product inbox's entries planned into it: *The ticket brief takes a ticket's path*, *A context-pressure threshold per model, set from the dashboard*, the Russian wording, the context-pressure item's start, `binn mcp` across `/clear` and `--resume` and runs after a merge from *Left after epic 20's tickets*, and idea 3 of *Session start, agent configuration and traps*. Exit criterion: `/binnacle:task <ticket path>` gives the Task's brief; a Task whose branch is merged into the default branch is not kept in progress by runs on it, and the Suggested step does not wait for them; the context-pressure item names the session's own start and warns at the threshold for the session's model, which the Settings page sets; the Russian vault and `/binnacle:product` carry no `(англ.)` and one spelling of "пулл-реквест"; whether `binn mcp` keeps the session's id across `/clear` and `--resume` is written down, and the item says "this" only where it is true; `/binnacle:checkpoint` can promote a trap; and 0.5.0 is installed from the registry into a clean container. The owner confirmed the test seams on 2026-10-28, recorded under *Further Notes*.

## Problem Statement

0.4.0 left small debts that each cost the owner attention.

`/binnacle:task docs/specs/<slug>/issues/NN-<name>.md` fails with "no Task", while the same path works with `run`. The owner met it twice, the second time from a `Next action:` a checkpoint had written with a path.

On 2026-10-28 the snapshot read ticket hygiene-after-v1/09 in flight and its Suggested step said to wait for its runs. The branch was already merged into `main`, and the runs were the owner's own sessions on it: every run ever attributed to a `READY` Task keeps it in progress.

The context-pressure item gives the latest run's start as the session's, so a session open for days reads as started this morning. It warns at one number per project, 150 000 by default, close to the edge of a 200K window and early for a much larger one, and changing it means editing the manifest; this repository's sets 250 000.

The Russian vault still marks two reasons `(англ.)`, a pair's conflict-risk reason and a failed Graphify run's output, and spells "пул-реквесты" where `/binnacle:product` says "пулл-реквест". Whether `binn mcp`, which reads the caller's session once at start, still names the right session after `/clear` or `--resume` is not known. And `/binnacle:checkpoint` has no place for a non-obvious fact that already cost time, such as a command that must run before another.

## Solution

`task.get` reads a ticket's path as its Task id, so `/binnacle:task` takes a path with or without `run`.

The default branch's reflog says when a Task's branch was merged there; a run that started before that merge no longer keeps its Task in progress, and the Suggested step reads the same.

The context-pressure item gives the session's start, the earliest of its runs, with its date when that is another day. It warns at the threshold for the session's model: a number the owner set for that model on the dashboard's Settings page, kept in the machine's settings, or else the machine's default, 150 000; a project manifest's number still wins for its project. This repository's manifest drops its 250 000.

Every reason the vault prints in Russian is worded from a code; the Graphify run's own output is quoted as the tool's, not marked. One spelling, "пулл-реквест". The ticket on `binn mcp` checks `/clear` and `--resume` in Claude Code and writes the finding down; where the id the server holds can be stale, the item stops saying "this" or "another" for that route. `/binnacle:checkpoint` gains a sixth target, a trap, written as one line in the project's instruction file on the owner's yes. 0.5.0 is released with all of it.

## User Stories

1. As the owner, I want `/binnacle:task docs/specs/<slug>/issues/NN-<name>.md` to give that Task's brief, so that a path copied from a `Next action:` works.
2. As the owner, I want the same path to keep working with `run`, so that both forms of the skill take what the other takes.
3. As a caller of `task_get` through MCP or `binn call`, I want a ticket's path accepted wherever a Task id is, so that every route agrees.
4. As the owner, I want a path to a ticket the tracker does not hold to fail as "no Task" with the path named, so that a wrong path is clear.
5. As a user of a remote tracker, I want `#<number>` and `<number>` read as before, so that nothing that works today breaks.
6. As the owner, I want a Task whose branch I merged into `main` no longer read as in progress because of runs before the merge, so that the snapshot shows what is really being worked on.
7. As the owner, I want the Suggested step not to tell me to wait for runs that ended with a merge, so that it points at work that can start.
8. As the owner, I want a run that starts on the branch after its merge to count again, so that rework after a merge is still seen.
9. As the owner, I want a `ready-for-human` Task whose branch is merged to appear again among the Tasks for me to start, so that the exit demonstration waiting for me is visible.
10. As the owner, I want a Task's usage by role to keep every run attributed to it, merged or not, so that the cost of the Task is unchanged.
11. As a user whose branches reach the default branch by a squash on the forge, I want Binnacle to keep reading the Task as now, so that it never guesses a merge it cannot see.
12. As the owner, I want the context-pressure item to give when the session started, not when its latest run did, so that a long session is not mistaken for a fresh one.
13. As the owner, I want the session's start dated when it was another day than its latest activity, so that a session open for days reads as such.
14. As the owner, I want the warning to follow the session's model, so that a large window is not warned about at a small window's number.
15. As the owner, I want to set a number for a model by its name on the Settings page, so that I change it without editing a file.
16. As the owner, I want the Settings page to offer the models my runs used recently, so that I type no model name by hand when it is known.
17. As the owner, I want to set a name the page does not offer, so that a model I am about to use can be set first.
18. As the owner, I want to remove a model's number, so that it falls back to the default.
19. As the owner, I want to set the default, so that every model I have not named warns where I choose.
20. As a user who never opens the Settings page, I want the default to stay 150 000, so that the smallest windows are still warned in time.
21. As a user whose project manifest sets `telemetry.context_pressure.tokens`, I want that number to keep winning for the project, so that nothing changes without my edit.
22. As the owner, I want the Settings page to say which registered projects' manifests override the machine's thresholds, so that I know why a number I set has no effect there.
23. As the owner, I want a refused value named with its rule, so that I know what the page accepts.
24. As the owner, I want a settings file that cannot be read left untouched, so that a write never loses what it holds.
25. As the owner, I want this repository's manifest without its 250 000, so that the Settings page governs here as on any other project.
26. As a script reading the snapshot, I want the item's `params` to name the threshold and the model it was chosen for, so that the warning can be explained.
27. As a Russian-speaking owner, I want a pair's conflict-risk reason in Russian in the vault, so that the line has no `(англ.)`.
28. As a Russian-speaking owner, I want a failed Graphify run named in Russian, with the tool's own output quoted as it is, so that what is Binnacle's is Russian and what is the tool's is not passed off as a translation.
29. As a Russian-speaking owner, I want one spelling, "пулл-реквест", in the vault as in `/binnacle:product`, so that the two read alike.
30. As a Russian-speaking owner, I want a reason after a dash to start in lower case, so that the sentence reads as one.
31. As a script reading the snapshot, I want each pair's English `reason` kept, with its `kind` and `params` beside it, so that nothing that reads it breaks.
32. As the owner in Claude Code, I want to know whether a session's id survives `/clear` and `--resume` for the MCP server, so that "this session" is never wrong.
33. As the owner, I want the item to say neither "this" nor "another" on a route whose id may be stale, so that Binnacle never guesses.
34. As the owner, I want `/binnacle:checkpoint` to propose a trap, a non-obvious fact that already cost time, so that the next session does not pay for it again.
35. As the owner, I want a trap written as one line in the project's instruction file, `AGENTS.md` here, so that every agent reads it.
36. As the owner, I want a trap written only on my yes, like every promotion, so that the instruction file holds only what I confirmed.
37. As a user of a project with no instruction file, I want the trap shown and said to have no place, so that it is not lost silently.
38. As the owner, I want the epic to end with its exit demonstration and 0.5.0 installed from the registry into a clean container, so that what ships is checked.

## Implementation Decisions

- **A ticket's path as a Task id.** `findTask`'s id normalisation also reads a path ending in `<spec-slug>/issues/NN-<name>.md`, relative or absolute, with or without the specs directory before it, as `<spec-slug>/NN`; the existing forms are unchanged. Every caller of `task.get`, the `/binnacle:task` brief included, takes a path with no change of its own; `/binnacle:task run`'s own conversion of a path stays, and becomes redundant rather than wrong. The snapshot does not flag a `Next action:` whose `/binnacle:task` names no known Task (the brief).
- **Runs after a merge.** A new reader in the Git adapter reads, from the default branch's reflog, the latest time each branch was merged there, from the entries `merge <branch>: …` that `git merge` writes, the reading `readOwnChangeTimes` already uses for the same entries. In the snapshot, the set of Tasks with attributed runs, which `taskSections`, `pendingDecisions` and the Suggested step read, leaves out a run whose start is before the latest merge of its Task's branch. A run that starts after it counts. Usage, a Task's runs by role and `task.get`'s brief keep every attributed run. A branch merged other than by `git merge` in this clone, a squash or a merge on the forge, has no such entry and reads as today (ponytail: the reflog is this clone's, and expires).
- **The session's start.** The context-pressure item's `params.startedAt` and the time in its message are the earliest start among the stored runs of the same harness session, not the latest run's. `sessionTimes` keeps its rule: the start is dated when it is another day than the latest activity.
- **Thresholds per model.** The machine's settings, `~/.binnacle/settings.json`, gain `contextPressure`: `{ tokens: <default>, models: { <model name>: <tokens> } }`, each a whole number of at least 1 000; 150 000 when unset (ADR-0046). The threshold for a session is, in order: the project manifest's `telemetry.context_pressure.tokens`; the number for the model of the session's latest call; the machine's default; 150 000. The manifest's key is unchanged. An unreadable file or a value that is not one gives an attention item, as `parallel_limit.invalid` does, and the item falls back to 150 000. `params` gains `model` and `thresholdSource` (`manifest`, `model`, `machine` or `default`) beside `threshold`.
- **The daemon's endpoint.** `context_pressure.get` returns the machine's default, its numbers per model, the models seen in the machine's runs over the last seven days, and the registered projects whose manifest sets the key; `context_pressure.set` takes the whole `{ tokens, models }` and rewrites that key alone, as `setParallelLimit` rewrites its own: owner-only, through a fresh temporary file, refusing a value with its rule and never overwriting a file it cannot read. The settings module holds both settings; no new module.
- **The Settings page.** A section beside the Parallel limit's: the default, and a row per model with its number, a field to add one with the recent models offered through a native `<datalist>`, and a control to remove a row. It writes through `context_pressure.set` with the token every dashboard call carries, and names the projects whose manifest overrides it. Both languages, from the dashboard's dictionary.
- **This repository's manifest** loses `telemetry.context_pressure` in the ticket that ships the Settings page, once the page can set the number.
- **The Russian wording.** Each pair in `impact.pairs` gains `kind` (`unmapped`, `shared`, `neighbours`, `apart`) and `params` with the values its `reason` names; the English `reason` stays. `wording.ts` words each kind, and the vault words the pair through it, in lower case after its dash. A failed Graphify run gets the code `graph.build_failed` with the tool's output in `params`; Russian names the failure in words and quotes the output as the tool's, with no `(англ.)`. The vault's "пул-реквесты" becomes "пулл-реквесты". `apps/daemon/test/codes.test.ts` keeps every code worded.
- **`binn mcp` across `/clear` and `--resume`.** The ticket starts a Claude Code session, runs `/clear` and then `--resume`, and compares the `session` `binn mcp` sends with the harness session the item names, through MCP and through `binn call` in the shell; it writes what it saw under `## Comments`. Where the server's id can differ from the session it serves, `callerSession` stops sending it for that harness and that route, with a comment saying why, so `own` is absent there; where the id holds, nothing changes.
- **A trap as a checkpoint target.** `PROMOTION_TYPES` gains `trap`. Its target is the project's instruction file at the repository root: `AGENTS.md` when it exists, else `CLAUDE.md`, else null, read through the same set rule `instructionSets` applies, so a `CLAUDE.md` that imports `AGENTS.md` names `AGENTS.md`. `checkpoint.record` accepts it; `/binnacle:checkpoint`'s text describes the kind, one line each, on the owner's yes; the MCP tool's description lists it. `docs/02-project-brain.md`'s promotion rule gains the kind.
- **The release**: the CLI package's version becomes 0.5.0 in the exit demonstration's ticket, which the owner publishes.

## Testing Decisions

A good test exercises behaviour through the seam a caller uses, never an internal function's shape. This epic adds no seam.

- **A ticket's path**, through the daemon's `task.get`, as `apps/daemon/test/task.test.ts` does: a relative path, an absolute one and one without the specs directory give the Task `<spec-slug>/NN`; a path to a ticket the tracker does not hold is `task.not_found`; `#3` on a remote tracker is unchanged.
- **Runs after a merge**, through `project.snapshot` on a fixture with a real Git repository, as `apps/daemon/test/next.test.ts` and `snapshot.test.ts` build them: a `READY` Task with a run on its branch is in flight; after `git merge` of that branch into the default branch it is not, a `ready-for-human` one is among the owner's to start, and the Suggested step does not wait; a run started after the merge puts it in flight again; usage by Task is unchanged; a squash commit leaves the reading as before.
- **The session's start and the threshold**, through `project.snapshot`, as `apps/daemon/test/context-pressure.test.ts` does: two runs of one session give the earlier start, dated when it is another day; a session of a model with its own number warns at it, another model at the machine's default, a manifest's number wins over both; `params` names the model and the source; an invalid settings value gives its attention item and 150 000.
- **The thresholds' endpoint**, through `context_pressure.get` and `context_pressure.set`, as `apps/daemon/test/parallel-limit.test.ts` does: a write keeps the file's other keys and the Parallel limit; a refused value names its rule; an unreadable file is not rewritten; `get` lists the recent models and the overriding projects.
- **The Settings page**, checked in a browser: adding, changing and removing a model's number, the default, a refused value, and the projects whose manifest overrides it, in both languages; `apps/dashboard/test/i18n.test.ts` keeps both dictionaries complete.
- **The Russian wording**, through `wordMessage`, as `packages/core/test/wording.test.ts` does, for each pair's kind and `graph.build_failed`; and through the vault, as `apps/daemon/test/vault.test.ts` does: a Russian vault has no `(англ.)` for a pair or a failed run, and says "пулл-реквесты".
- **The trap target**, through `checkpoint.prepare` and `checkpoint.record`, as `apps/daemon/test/checkpoint.test.ts` does: `AGENTS.md`, `CLAUDE.md` alone, a `CLAUDE.md` importing `AGENTS.md`, and none; and the skill's text in `apps/cli/test/pack.test.ts`.
- **`binn mcp` across `/clear` and `--resume`**, by hand in its ticket and again in the exit demonstration; if `callerSession` changes, `packages/mcp/test/smoke.test.ts` covers the new rule.
- **What agents do**, a checkpoint proposing a trap and `/binnacle:task` taking a path in a real session, is the exit demonstration's.

## Contested points

- **A share of the window instead of a number per model.** Closer to what the owner means, but no harness Binnacle reads reports a window's size. Taken in the grilling: a number per model (ADR-0046).
- **The machine or the project.** The Parallel limit's precedent, against a commit per project. Taken in the grilling: the machine, with a manifest's number still winning.
- **A built-in table of models.** Works with no setup, but follows every provider's releases and a subscription's window. Taken in the grilling: none; only the default.
- **The reflog for merges.** It sees only `git merge` in this clone, not a squash or a merge on the forge, and expires. Taken: it is the reading Binnacle already trusts for the same question, and the forge's merged pull requests would be a second source for one case; a Task whose branch was squashed still reads as today until its ticket is `DONE`.
- **A flag for a `Next action:` naming no Task.** It would show a wrong command before it runs. Taken in the grilling: not added; the path fix removes the case met twice.
- **Dropping "this" where the id may be stale.** It loses the word for the whole route. Taken: a wrong "this" cost the owner before (epic 20's brief), and principle 5 forbids guessing.

## Out of Scope

- The other entries of the product inbox, planned into epics 22 to 27, or not planned.
- A threshold as a share of the model's window, until a harness reports the window.
- Reading merges from the forge's closed pull or merge requests.
- A snapshot item for a `Next action:` naming no known Task.
- A way for the MCP server to learn a new session's id after `/clear` other than the environment.
- Other settings on the dashboard's Settings page.
- Dependabot's `typescript` rule for the root's 7.x patches, which stay by hand until `vue-tsc` runs on 7.

## Further Notes

- **Decided in the grilling, by the owner on 2026-10-28** (`brief.md`): a threshold per model; the machine's settings hold it and the dashboard writes it (ADR-0046); no table of known models, the default 150 000; this repository's manifest drops its 250 000; `findTask` reads a ticket's path, with no flag for a `Next action:` naming no Task.
- **Test seams confirmed by the owner on 2026-10-28**: the daemon's `task.get`; `project.snapshot` on a fixture with real Git, for runs after a merge, the session's start and the threshold per model; the daemon's settings calls, as `parallel.get` and `parallel.set` are tested; `wordMessage` and the vault for the Russian; `checkpoint.prepare` and the package build's test for the skill texts; the Settings page in a browser; `binn mcp` across `/clear` and `--resume` by hand, in its ticket and the exit demonstration.
- **Defaults taken from the brief, the docs and Ponytail, not asked**: the reflog of the default branch for the merge, as `readOwnChangeTimes` reads it; the session's start as the earliest of its runs, dated by `sessionTimes`'s rule; the threshold's order, manifest, model, machine, 150 000; the recent models offered through a native `<datalist>`; a trap's target as the root instruction file by `instructionSets`'s rule; the Russian term "пулл-реквест", as `/binnacle:product` writes it.
- **Checked while specifying**: `normalized` in `apps/daemon/src/task.ts` reads only `<spec-slug>/<NN>` and `#<number>`; the snapshot's attributed set takes every run with a Task id, whatever its branch's state; `pressureAttention` takes `run.startedAt`, the latest run's; `callerSession` reads `CLAUDE_CODE_SESSION_ID` or Codex's `CODEX_THREAD_ID` once, from the environment; the vault's `english()` marks the pair's reason and the failed run's reason; `PROMOTION_TYPES` holds five kinds.
- **Order**: the ticket's path first, the smallest and the one the owner meets; then runs after a merge, the session's start and the Russian wording, which touch separate modules; the thresholds per model with the Settings page and the manifest's line, one ticket as the Parallel limit was, after the session's start, which changes the same warning; `binn mcp` across `/clear` and `--resume`; the trap target; the exit demonstration last.
- **The exit demonstration**, with the owner: `/binnacle:task` with a ticket's path; a Task merged by `git merge` leaving the Tasks in flight; a warning naming the session's own start and the threshold for its model, set on the Settings page; a Russian vault with no `(англ.)`; `binn mcp` after `/clear` and `--resume`; a checkpoint proposing a trap; and 0.5.0 installed from the registry into a clean container.

## Risks

- **What the epic can break.** Ticket 02 changes which Tasks the snapshot, the board and autopilot read as in progress, and autopilot starts Tasks from that reading: a merge read wrongly could start a second agent on a Task still being worked. Ticket 05 gives the daemon a second write to `~/.binnacle/settings.json`, beside the Parallel limit, and a write that loses the other key would reset it. Ticket 04's `kind` and `params` change a shape the dashboard and the vault read.
- **The riskiest step.** Ticket 02, runs after a merge: the reflog is this clone's, a merge entry's wording is Git's, and a branch merged, reopened and merged again must read by its latest merge. The fixture must use real `git merge`, not a hand-written reflog.
- **What was dropped, and why.** A threshold as a share of the window: no harness reports the window. A flag for a `Next action:` naming no Task: the path fix covers the case met. Merges on the forge: a second source for one case. A new way to learn the session after `/clear`: only the environment is known, and none is guessed.
