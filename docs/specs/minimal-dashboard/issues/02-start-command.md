# 02: The start command, from the brief to the dashboard

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** every Task that can be started carries the one command that starts it:

- `/binnacle:task` ends with it;
- the main screen lists the Tasks ready to start, each with it;
- the Task page shows the brief with it.

Decided in the spec, under *The start command*.

- [x] `packages/core` gives a Task's start command. When `workflow.provider` is `matt-pocock` and the Task is neither `DONE` nor `CANCELLED`, it is `/mattpocock-skills:implement <ticket>`, with the Task's ticket path or URL. Otherwise there is none.
- [x] `task.get`'s brief carries it as `start`, and so do the snapshot's Tasks in flight and ready to start.
- [x] The `task` skill ends with "To start it, in a fresh session:" followed by the command.
- [x] When the Task has no start command, the `task` skill says why: the Task is `DONE` or `CANCELLED`, or the project's workflow is another one.
- [x] The Overview lists each project's Tasks ready to start, each with its start command and a copy button.
- [x] The Task page shows:
  - the brief: state, triage, dependencies with their states, spec, ticket, and the body as text;
  - its branch;
  - its start command, with a copy button.
- [x] Copy buttons use the Clipboard API.
- [x] Tests through the daemon seam cover `READY`, `DONE` and `CANCELLED` Tasks, another `workflow.provider`, and a remote Task's URL.

## Comments

- **What exists.**
  - `startCommand(task, workflow)` is in `packages/core/src/tracker.ts`, beside `taskBranch`. It takes the Task's `state` and `ticket` and the manifest's `workflow.provider`.
  - The brief's `start` is set in `apps/daemon/src/task.ts`.
  - The snapshot adds `start` in `withStart` in `apps/daemon/src/snapshot.ts`, and its sections are typed `SectionWithStart`. `taskSections` still returns the bare sections, so the daily's `readyToStart` and `newTickets` carry no `start`: the ticket asks for the snapshot only.
  - The `task_get` and `project_snapshot` tool descriptions in `packages/mcp/src/index.ts` mention the command, and so does `docs/03-mcp-and-skills.md`.
  - The skill is step 5 of `.claude/skills/binnacle/skills/task/SKILL.md`.
  - The copy button is `apps/dashboard/app/components/CopyCommand.vue`, which Nuxt auto-imports. It calls `navigator.clipboard.writeText` and then shows `Copied`, or a line saying to copy the command by hand.
  - The Overview lists each project's `tasks.readyToStart`, with its remainder.
  - The Task page is `apps/dashboard/app/pages/task.vue`, at `/task?project=<registered path>&id=<task id>`. It has no link in the navigation because it needs both values. The Overview links each ready Task's id to it, and ticket 04's board cards can link to it the same way. Without both values it makes no call and says so.
- **Decided while building, within the spec.**
  - **Every state but `DONE` and `CANCELLED` has a start command**, including `MERGED`, `BACKLOG` and an unknown state, as the spec words the rule. The Suggested step (ticket 05) uses it only to resume a Task In progress.
  - **The command is not quoted.** A ticket path with spaces reaches the skill whole, as `$ARGUMENTS`.
  - **The Task page says only "No start command for this Task."** The ticket asks the skill to say why. The page shows the state beside it and computes nothing beyond formatting.
- **For the next tickets.**
  - `CopyCommand` is the copy button for every command: the Next action, the Suggested step and the board's cards.
  - The Task page is where tickets 03 and 06 add the runs and the Review.
- **Checked by hand on 2026-09-26.** A daemon ran on a temporary `BINNACLE_HOME` and an ephemeral port, with this worktree registered and the dashboard generated. In the built-in browser:
  - The Overview listed `minimal-dashboard/02` and `/03` under *Ready to start*, each with `/mattpocock-skills:implement docs/specs/minimal-dashboard/issues/0N-….md` and a Copy button.
  - Clicking Copy called `navigator.clipboard.writeText` with exactly that command. The pane refuses clipboard writes, so the button showed its failure line there.
  - The id's link opened the Task page with the command, the state, the triage role, the branch `feat/start-command`, the spec, the ticket, the dependency `minimal-dashboard/01 … (DONE, met)` and the body as plain text.
  - `/task?…&id=minimal-dashboard/01`, loaded directly, showed `No start command for this Task.`
  - `/task` alone showed that the address names no Task, and made no call.
- **To see it yourself.** This checks the one thing the pane could not, a real copy:
  1. In the main checkout, once this branch is merged, run `pnpm dashboard:generate`, then `binn daemon stop` and `binn daemon start`.
  2. Run `binn dashboard`. Under *Ready to start*, each Task has its `/mattpocock-skills:implement …` command.
  3. Click Copy beside one. The button says `Copied`. Paste into a terminal: it is exactly the command shown.
  4. Click the Task's id. The Task page shows the same command with a Copy button, and the brief below it.
  5. In a session, run `/binnacle:task minimal-dashboard/04`. It ends with "To start it, in a fresh session:" and the same command. `/binnacle:task minimal-dashboard/01` says there is none, because the Task is `DONE`.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violations.** Findings:

1. **A doc comment lost a space**: `` `taskBranch`:the one Task ``. **Fixed**.
2. **`StartableSection` misnamed the in-flight section**, whose Tasks are already started. **Fixed**: it is `SectionWithStart`.
3. **`withStart` re-wraps what `taskSections` returns.** **Kept**: the daily reuses `taskSections` and gains no field the ticket does not ask for.
4. **`manifest?.workflow.provider ?? null` appears twice**, in the brief and the snapshot. **Kept**: `startCommand` takes the provider, as the spec states the rule, and stays independent of the manifest's shape.
5. **`workflow: string | null` compared with `'matt-pocock'`.** **Kept**: the manifest types `workflow.provider` that way.
6. **`task.vue` declares its own `Brief` type, and `'(untitled)'` appears on two pages.** **Left**: each has one use so far. Move them into a composable when a later page repeats them.
7. **The Task page has no navigation link**, although ticket 01's notes say new pages get one. **Kept**: it needs a project and an id, as recorded above.
8. **A nested ternary for the copy status** in `CopyCommand.vue`. **Left**: it is three states of UI text.

**Spec: every criterion holds.** Findings:

1. **`docs/03-mcp-and-skills.md` did not say that the snapshot's Tasks carry `start`.** **Fixed**.
2. **The Task page gives no reason when there is no command.** **Kept**: the ticket asks that of the skill, as recorded above.
3. **The Overview's links to the Task page and the copy status.** **Kept**: the links are the only way to reach the page, and the status is how the button reports a refused clipboard.
4. **A `MERGED` Task gets a start command.** **Kept**: the spec says "neither `DONE` nor `CANCELLED`", and a `MERGED` Task reaches `DONE` in the same step as the merge on this repository. Whether a merged Task should keep one is the owner's call.
5. **The daily carries no `start`.** **Kept**: the spec does not ask for it there.
