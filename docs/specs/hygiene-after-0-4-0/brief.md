# Hygiene after 0.4.0: what the grilling decided

Epic 21's material is `docs/product-inbox.md`: *Session start, agent configuration and traps* (2026-10-23), idea 3; *A context-pressure threshold per model, set from the dashboard* (2026-10-24); *Left after epic 20's tickets* (2026-10-25), its Russian wording, the context-pressure item's start, `binn mcp` across `/clear` and `--resume`, and runs after a merge; *The ticket brief takes a ticket's path* (2026-10-28); and the roadmap's line for epic 21. This brief is what `/to-spec` starts from.

## The problem

0.4.0 left small debts that each cost the owner attention. `/binnacle:task <ticket path>` fails with "no Task", though the same path works with `run`, and the owner met it twice. On 2026-10-28 the snapshot read ticket hygiene-after-v1/09 in flight and said to wait for its runs, which were the owner's own sessions on its branch after the merge. The context-pressure item gives the latest run's start as the session's, with no date, so a session open for days reads as started this morning. Its threshold is one number per project, 150 000 by default, which is near the edge of a 200K window and early for a much larger one, and changing it means editing a file. Two reasons with no code still reach a Russian vault marked `(англ.)`, and the vault and `/binnacle:product` spell "pull request" two ways. Whether `binn mcp` keeps the caller's session across `/clear` and `--resume` is not known. And `/binnacle:checkpoint` has no place for a non-obvious fact that already cost time.

## The outcome wanted

`/binnacle:task` takes a ticket's path wherever it takes a Task id. A Task whose branch is merged is not kept in progress by later runs on that branch, and the Suggested step does not wait for them. The context-pressure item names the session's own start, with its date when that is not today, and warns at a threshold that follows the session's model, set on the dashboard's Settings page. The Russian output has no `(англ.)` left and one spelling of "пулл-реквест". Whether the session's id survives `/clear` and `--resume` is known, and the item says "this one" only where that is true. A checkpoint can promote a trap. 0.5.0 is released with all of it.

## Who it concerns

The owner, who runs autopilot and Product sessions on this repository every day, with models whose context windows differ; anyone who installed `@it-bbox/binnacle`, reads its Russian output or uses `/binnacle:task` and `/binnacle:checkpoint`.

## The systems it touches

- `findTask` in `apps/daemon/src/task.ts`, behind `task_get` and the `/binnacle:task` brief;
- the Tasks in flight from activity and the Suggested step, which read runs on a Task's branch;
- the `context.pressure` attention item in `apps/daemon/src/usage.ts` and its wording in `packages/core/src/wording.ts`;
- the threshold: `telemetry.context_pressure` in `packages/core/src/manifest.ts`, the machine's settings, `~/.binnacle/settings.json`, the daemon's settings endpoint and the dashboard's Settings page;
- this repository's `.binnacle/project.yaml`, which sets `telemetry.context_pressure.tokens: 250000`;
- `binn mcp`, which reads the caller's session once, at start;
- the reasons with no code in a pair's conflict risk and a failed Graphify run's output, and the vault's and `/binnacle:product`'s Russian;
- `/binnacle:checkpoint`'s targets, `checkpoint_prepare`, and the instruction file a trap goes into.

## Decided in the grilling, 2026-10-28

- **A threshold per model.** A default and, beside it, a number for a model by name, such as `claude-opus-5-5`. The run's model, which Binnacle already reads, picks the number, and a model with none takes the default. A share of the model's window is not taken: no adapter reads a window's size today, Codex names its window only by id and Claude Code not at all.
- **The machine's settings hold it, and the dashboard writes it.** The thresholds live in `~/.binnacle/settings.json` beside the Parallel limit, and the Settings page writes them through the daemon. A project manifest that sets `telemetry.context_pressure.tokens` still wins for that project. That is a second setting the dashboard writes, which ADR-0041 leaves to its own decision: ADR-0046.
- **No table of known models.** The default stays 150 000, conservative for the smallest windows, and the numbers for particular models are the owner's, on the Settings page. Binnacle ships no list of models and their windows to keep current, and a model's window can depend on the subscription as well.
- **This repository's manifest drops its 250 000**, so the Settings page governs here as on any other project of the machine. The line goes once the Settings page can set a number per model.
- **`findTask` reads a ticket's path.** `<specs>/<spec-slug>/issues/NN-<name>.md` is read as `<spec-slug>/NN`, with a test, so every caller of `task_get` takes a path. The snapshot does not also flag a `Next action:` whose `/binnacle:task` names no known Task: a wrong id still fails at once when the command runs.

Defaults, from the docs and the inbox, not put to the owner:

- **Runs after a merge are not the Task's.** A run on a Task's branch that starts after that branch is merged into the default branch keeps no Task in progress from activity, and the Suggested step does not wait for it. Which commit marks the merge, and how Binnacle reads it without the forge, is the spec's to settle.
- **The context-pressure item gives the session's start**, the earliest of its runs, not the latest run's, with the date when it is not today.
- **The Russian wording**: the pair's conflict-risk reason and the failed Graphify run's output get a code, worded in `wording.ts` like the rest; "пулл-реквест" is the one spelling, the vault's included, as `/binnacle:product` already writes it; a reason after a dash starts in lower case.
- **`binn mcp` across `/clear` and `--resume`**: a ticket checks whether Claude Code keeps the session's id for the MCP server it started. Where it does not, the item stops calling a session "this one" where the id may be stale, rather than guessing (principle 5).
- **A trap is the checkpoint's sixth target**: a non-obvious fact that already cost time, such as a command that must run before another or a version pin. It goes into the project's instruction file, `AGENTS.md` here, one line each, on the owner's yes like every promotion.
- **ADR-0046, not an amendment of ADR-0041**, since ADR-0041 says any further setting the dashboard writes needs its own decision.
- **The epic ends with its exit demonstration and 0.5.0.** The last ticket is the exit demonstration, `ready-for-human`, with the owner's manual checks, and 0.5.0 installed from the registry into a clean container. The owner publishes, as before.

## Constraints and open questions

- Small enough for autopilot, one ticket after another, the exit demonstration last.
- Binnacle stays optional: without the daemon, a project's manifest threshold and its tickets are still read as files (`AGENTS.md`, principle 3).
- Open: whether Claude Code keeps the session's id across `/clear` and `--resume`; which models the Settings page offers to set, those seen in the machine's runs or any name typed; how a run's start is compared with a branch's merge when the merge is a squash or a rebase.
