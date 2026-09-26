# 05: The Next action and the Suggested step

Status: DONE
Triage: ready-for-agent
Blocked by: 02, 04
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** the main screen answers what to type next. It shows the roadmap's Next action with its command, and beside it Binnacle's Suggested step, labelled as Binnacle's calculation. A focus that ends without a command, or names finished work, is an attention item, and `/binnacle:product` ends with both. Decided in the spec, under *The Next action* and *The Suggested step*, and in ADR-0032.

- [x] The roadmap parser reads the Next action from the focus's last paragraph, when that paragraph starts with `Next action:` and ends with an inline code span. The code span is the command, and the text before it is the description.
- [x] `next_action.missing` is raised when there is no focus, or when its last paragraph is not shaped that way.
- [x] `next_action.stale` is raised when the command names a `DONE` or `CANCELLED` Task, by ticket path, id, issue URL or `#number`.
- [x] `packages/core` gives the Suggested step by the spec's eight rules, in order, with provenance `calculated`.
- [x] A Product session's active run never triggers the first rule.
- [x] Under any other `workflow.provider`, the Suggested step gives no command.
- [x] The snapshot gains `next`: the Next action or `null`, and the Suggested step.
- [x] The Overview shows each project's Next action with its command and a copy button. Beside it is the Suggested step, labelled as Binnacle's calculation, with its command and a copy button when it has one.
- [ ] The `product` skill ends with the Next action and its command, then the Suggested step, labelled.
- [x] Tests through the daemon seam cover the parser's cases, both attention items, and each rule on a fixture where exactly that rule applies.

## Comments

- **What exists.**
  - `nextAction(focus)`, `nextActionAttention(roadmap, tasks)` and `suggestedStep(epics, tasks, runs, workflow)` are in `packages/core/src/roadmap.ts`, beside `roadmapAttention`. `suggestedStep` reuses `boardColumn` and `startCommand` from `tracker.ts`.
  - `readState` in `apps/daemon/src/snapshot.ts` adds the two attention items after `roadmapAttention`, so the daily's attention carries them too.
  - The snapshot's `next` is `{ action, suggested }`. `action` is `{ description, command }` or `null`. `suggested` is `{ rule, description, command, task, provenance: 'calculated' }`, or `null` when no rule applies, or `Unavailable` with the tracker's reason. The runs come from `usageAndActivity` in `apps/daemon/src/usage.ts`, which now also returns every observed run it grouped.
  - The Overview shows both in `apps/dashboard/app/pages/index.vue`, the label is `SUGGESTED_READING` in `app/composables/projects.ts`, and the copy button is `CopyCommand`.
  - `/binnacle:product` ends with both, in step 5 of `.claude/skills/binnacle/skills/product/SKILL.md`. `project_snapshot`'s description names them.
  - The tests are `apps/daemon/test/next.test.ts`, plus one GitHub test in `github.test.ts` for a stale `#number` and issue URL.
- **Decided while building, within the spec.**
  - **`next_action.missing` needs a roadmap that was read.** With no roadmap, `roadmap.missing` or `tracker.unavailable` already says why, and saying it twice makes attention noisier, as `readRoadmap` already reasons.
  - **The description is the paragraph's text between `Next action:` and the command, its line breaks joined by spaces.** The command is one inline code span of single backticks, trimmed. Anything after it, a full stop included, makes the paragraph not shaped so.
  - **A Task is named when a whole word of the command is its id or its ticket.** On a remote tracker the id is `#<number>` and the ticket the issue URL, so that covers all four forms. A `ponytail:` comment names the ceiling: quotes, `./` or trailing punctuation are not matched.
  - **Rule 1 names every Task with an active implementation run**, the latest first, and `task` is that first one. Only runs with a Task can be implementation runs, and a Product session's run is on the default branch, so it never counts.
  - **Rule 2 takes the first In progress Task in tracker order, from any epic.** In progress is `boardColumn`'s, so a `READY` Task with any attributed run counts, as on the board. The spec's words make a `BLOCKED` or review-state Task "resume" too.
  - **Rules 3 to 7 read the current epic**, the first roadmap row not `done`, as the board does. With no roadmap and nothing in progress, no rule applies and `suggested` is `null`: rule 8 needs epics to say every one is done.
  - **The Suggested step is unavailable when the tracker cannot be read**, with the tracker's reason, as `activity` is. Its rules cannot be told without the Tasks.
  - **`rule` is in the answer**, beside what the spec lists, so a reader and the tests can see which rule gave the step. The dashboard does not show it.
  - **Other `workflow.provider`**: every rule keeps its description and gives no command, the start command included.
- **For the next tickets.**
  - Ticket 09's exit demonstration copies the Next action's or the Suggested step's command from the Overview.
  - The Overview's Suggested step shows its description as one line of text. A Product session can decide whether rule 1's and rule 4's lists want links to the Task page.
- **Checked by hand on 2026-09-26.** A daemon ran on a temporary `BINNACLE_HOME` and an ephemeral port, reading this machine's Claude Code artifacts, with this worktree registered and the dashboard generated. `project.snapshot` gave the roadmap's Next action, `run epic 5's tickets, from a Product session in the registered checkout.` with `/binnacle:autopilot`, and rule 1 naming `minimal-dashboard/05` (this session) and `minimal-dashboard/07` (a parallel session) as being worked on, with no command. Attention held no `next_action` item. In the built-in browser the Overview showed the Next action with its Copy button and, beside it, the Suggested step with its label and no command. The console showed no errors.
- **Rebased onto ticket 07** after it merged. The one conflict was the Overview's imports: ticket 07's usage line stands below the Next action and the Suggested step. The runs the Suggested step reads come from `usageAndActivity` beside ticket 07's `byProvider`, unchanged. With 07 `DONE`, the snapshot of this worktree gave rule 1 naming only `minimal-dashboard/05`, and `minimal-dashboard/06` and `/08` ready to start. Once this branch merges and its session goes idle, rule 3 offers `/binnacle:autopilot` for them.
- **To check `/binnacle:product` yourself**, the one criterion left unticked:
  1. Once this branch is merged, run `binn daemon stop`, then `binn daemon start`, in the main checkout.
  2. Start a fresh session in the main checkout with `/binnacle:product`.
  3. It ends with **Next action**: the focus's description, then `/binnacle:autopilot` on its own line. Then **Suggested step**, labelled as Binnacle's calculation, with its description, and its command when it has one.
  4. Tick the `product` criterion above if it does.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violations.** Judgement calls:

1. **Rule 2 builds its set of Tasks with runs from every run, while rule 1 counts only implementation runs.** **Kept**: a run with a Task is always an implementation run, since a Product session's is on the default branch and has none. That rule 2 tells a `BLOCKED` or review-state Task to resume is the spec's wording.
2. **"The current focus does not end with a Next action" was also shown when the roadmap cannot be read.** **Fixed**: the Overview and `/binnacle:product` give both reasons.
3. **Whole-word matching for stale is a ceiling without a `ponytail:` comment.** **Fixed**: the comment names it.
4. **The Next action is parsed twice**, for `next` and for attention. **Kept**: a pure parse of one paragraph. Threading it through `State` would change the daily's and the board's shared reading for no gain.
5. **`DONE` or `CANCELLED` is tested in three places.** **Left**: `startCommand`, `roadmapAttention` and the new code each say it once. Extract it when a fourth appears.
6. **`usageAndActivity`'s `runs` carries each run's records.** **Kept**: they are the runs it already grouped, typed as `ObservedRun`, and the snapshot does not serialise them.
7. **A needless array copy in rule 1.** **Fixed**.

**Spec: no missing or wrong behaviour.** Findings:

1. **No `next_action.missing` without a roadmap.** **Kept**, recorded above.
2. **Stale by issue URL and `#number` was not tested.** **Fixed**: a GitHub test covers both, and an open issue that is not stale. **Left**: rule 1 with two Tasks is not tested, since it needs two checkouts on two branches at once. The hand check above saw it.
3. **`rule` is extra public surface.** **Kept**, recorded above.
4. **`suggested` can be `null` or unavailable.** **Kept**, recorded above.
5. **Whole-word matching misses a path written differently.** **Kept**, with its `ponytail:` comment.
