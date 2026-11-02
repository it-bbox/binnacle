# 05: `binn init` from the chat: the mod offered, and skips with reasons

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-0-7/spec.md`
Roles: Developer, Reviewer

**What to build:** `/binnacle:init` in a chat offers the mod as the terminal does, and `binn init` words a step that cannot apply as a skip with its reason (spec, *The mod from the chat*, *Skips with their reasons*, *The autostart notice*, *`/binnacle:answer`'s text*; product inbox, *Left after epic 22's tickets*, *Left after epic 23's tickets*, *Left after epic 21's tickets*). `binn init --plan --json` gains `mod: { ask }` beside `autostart`, true when the interactive form would ask; the init skill asks the person then, defaulting to no, and passes `--mod` or `--no-mod` to `--apply`. A harness the skills CLI refuses global installation for is skipped with a coded reason, other failures stay errors; VS Code's MCP item is planned only when `code` is on `PATH`, else listed as skipped with its reason. A skipped autostart's reason is cut to its first non-empty line. `/binnacle:answer`'s text names a ticket's path beside the Task id forms.

- [ ] Through `binn init --plan --json`: `mod.ask` is true when Claude Code is found and the mod is not listed, false when it is listed, when Claude Code is missing, and when `--mod` or `--no-mod` is given.
- [ ] `--apply` with `--mod` installs the mod and with `--no-mod` records it declined, as the terminal's answers do.
- [ ] The init skill and `/binnacle:answer`, through the package build's test: the skill asks about the mod only when `mod.ask` is true, defaulting to no, and passes the answer; `/binnacle:answer` names `docs/specs/<slug>/issues/NN-<name>.md`.
- [ ] A skills CLI that refuses global installation for one harness gives a skip of that harness with its reason in the Summary, in both languages, and the step's other harnesses as before.
- [ ] With no `code` on `PATH`, the plan has no `code --add-mcp` item and lists VS Code as skipped with its reason.
- [ ] A skipped autostart whose reason spans several lines prints its first non-empty line, in the plan and the Summary.
- [ ] Every new code is worded in English and Russian.

## Comments
