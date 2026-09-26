# 03: What's next: the Next action and Binnacle's alternatives

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** the Overview opens on "What's next". The roadmap's Next action leads, and under "or" come Binnacle's alternatives, each with a title and a reason in the chosen language. An alternative that agrees with the Next action is left out. The Suggested step becomes a list of alternatives in the snapshot, and `/binnacle:product` offers the same choice. Decided in the spec, under *The Suggested step becomes alternatives*, and in ADR-0032.

- [x] The Suggested step's pure function keeps its eight rules and their order, and returns up to three alternatives. Each has `kind` (`wait`, `parallel`, `resume`, `autopilot`, `byHand`, `blocked`, `close`, `plan` or `finished`), `tasks`, `command` or none, an English `description`, and provenance `calculated`.
- [x] Rule 1 gives `wait`, followed by `parallel` when `tasks.parallel.free` is at least one and Ready to start is not empty. Rule 3 gives `autopilot` and `byHand`. The other rules give one alternative each.
- [x] `parallel` and `byHand` carry the Task's start command when exactly one Task is ready. With several, they name them and carry no command.
- [x] An alternative whose command equals the Next action's is left out. Without a Next action, none is left out.
- [x] Under any `workflow.provider` but `matt-pocock`, no alternative has a command.
- [x] The snapshot's `next.suggested` is replaced by `next.alternatives`, a list, or `available: false` with the tracker's reason.
- [x] Tests through the daemon seam cover:
  - each rule;
  - `wait` with and without `parallel`;
  - one ready Task and several;
  - `autopilot` beside `byHand`;
  - the agreement filter, with and without a Next action;
  - another workflow;
  - at most three alternatives.
- [x] The Overview's "What's next" block shows the Next action, labelled "From the roadmap", with its command and a copy button. A warning sits inside the block when `next_action.missing` or `next_action.stale` is raised.
- [x] Under "or", labelled "Binnacle's calculation", each alternative has a title and a reason written by the page from `kind` and `tasks` in the current language, and its command with a copy button when it has one.
- [x] With no alternatives left, only the Next action shows.
- [x] The `product` skill ends with the Next action and its command, then each alternative, labelled as Binnacle's.
- [x] `docs/03-mcp-and-skills.md` describes `next.alternatives`, and `CONTEXT.md`'s *Suggested step* agrees with it.

## Comments

- **Where it lives.** `suggestedStep(epics, tasks, runs, { workflow, free, next })` in `packages/core/src/roadmap.ts` returns `Alternative[]`. A private `byRule` holds the eight rules in their order. `suggestedStep` then leaves out an alternative whose command is the Next action's, and cuts the list at three. `apps/daemon/src/snapshot.ts` computes `tasks.parallel` before the alternatives and passes its `free`. `next.suggested` is gone, and a snapshot whose rules give nothing has `next.alternatives: []`, where epic 5's `suggested` was `null`. The Overview's What's next is in `apps/dashboard/app/pages/index.vue`. Titles and reasons are under `alternatives` in `app/i18n/en.ts` and `ru.ts`, one function per `kind`, taking the Task ids joined by `Intl.ListFormat` (`formatList`, and `list` in `useLanguage()`) and their count. The tests are in `apps/daemon/test/next.test.ts`. Every one of them asserts that there are at most three alternatives and that each is `calculated`.
- **Rebased onto `main`** after ticket 04 merged. There were no conflicts, and the typecheck, the dashboard's typecheck, the full suite (378 tests) and `pnpm dashboard:generate` pass.
- **Decided here, where the spec is silent:**
  - **`parallel` reads Ready to start as the snapshot lists it,** across the whole project. That means `READY`, no Unmet dependency and no attributed run, so the alternative names the Tasks the Overview lists under Ready to start. `byHand` reads the current epic's `READY` Tasks with no Unmet dependency, the ones that made rule 3 apply.
  - **`tasks`** names these Tasks:
    - `wait`: every Task being worked on, latest activity first;
    - `parallel` and `byHand`: the ready Tasks;
    - `resume`: the idle Task;
    - `blocked`: the waiting `READY` Tasks.
    `autopilot`, `close`, `plan` and `finished` name none.
  - **The page's `plan` reason is the same for grilling, spec and tickets.** `kind` and `tasks` cannot tell them apart, and the command does, when there is one. Telling them apart would need a field the ticket does not list.
  - **The page's `blocked` reason names the waiting Tasks,** but not what each waits on. Ready to start, just below it, shows each one with "waits on NN".
  - **The warnings.** `next_action.missing` and `next_action.stale` each show as a warning inside the block, in the page's language, with their code. "The roadmap gives no Next action" is now the missing one's text, and "Binnacle has no suggestion" is gone: with no alternatives, only the Next action shows.
  - **Each kind has a Lucide icon,** as the mockup gives one per alternative. They are written out in `ICONS` so that the build bundles them.
- **Verified in a browser.** The generated dashboard ran against a test daemon on a temporary home and port. Two projects were registered:
  - **This repository.** Its Next action is `/binnacle:autopilot`, so `autopilot` was left out, and only "Take one Task by hand" showed, naming 03, 04 and 05 with no command. This was checked in English and Russian.
  - **A fixture.** It showed `autopilot` and `byHand` with one ready Task and its command, once under a stale Next action and once under a missing one, each warning with its code.

  Only the dark theme was seen, at the pane's width. `wait` and `parallel` were not seen live, since the test daemon reads no harness sessions. The exit demonstration (ticket 06) covers both themes and 1024 px.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Findings, all judgement calls:

1. **Rule 1 recomputes Ready to start**, which the snapshot's `sections` already hold, and rule 3 has its own "ready" set. **Kept**: the sections are cut at ten, and the pure function stays whole for any caller. The two sets differ by design, as *Decided here* says.
2. **`runs: Parameters<typeof suggestedStep>[2]`** hid the run's type. **Fixed**: it is now `RunReading`.
3. **The nine kinds are repeated** in core, `projects.ts`, both dictionaries and `ICONS`. **Kept**: this is the dashboard's existing convention of mirroring the daemon's types, and `Record<Alternative['kind'], …>` together with the Russian dictionary's type make a missing kind fail the typecheck.
4. **`tasks && sections`** has a redundant `tasks`. **Kept**: it narrows both for the typecheck.
5. **Any other `next_action.*` code reads as missing.** **Kept**: core raises only those two.
6. **An alternative's title and reason were written twice per row.** **Fixed**: a computed list writes them once.
7. **The ticket was not yet closed.** **Fixed** by the commit that marks it `DONE`.

**Spec: every criterion holds.** Findings:

8. **The three-item cap is unreachable,** since no rule gives more than two. **Kept**: the spec states the cap, the slice enforces it, and every test asserts it.
9. **The README is unchanged.** **Kept**: it describes neither the Suggested step nor the Overview's block.
10. **The icons and `formatList`** follow from the mockup and the brief. **Kept.**
11. **`plan`'s reason is generic.** **Kept**, as *Decided here* says.
12. **`blocked`'s reason does not say what the Tasks wait on.** **Kept**, as *Decided here* says.
