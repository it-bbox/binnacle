# 02: A question offers its options

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/lean-flow/spec.md`

**What to build:** a question an agent records carries its options, so the owner chooses rather than composes (spec, *Questions with options*, *The answer's date line*). After its text, a `### Question` lists its options, each with its cost, the recommended one first and marked "(recommended)"; the options are part of the question's text for the parser. `docs/agents/issue-tracker.md` and the issue-tracker section `binn init` offers a project describe it, on the local tracker and in issue comments alike. `/binnacle:answer` shows the question and its options in the owner's language, explains them when the owner asks, never picks one, and writes the owner's choice or own words as today. The ticket parser leaves a first answer line that is a date alone, `YYYY-MM-DD`, out of the answer's text; `/binnacle:answer` keeps writing it. ADR-0040 holds: the asker writes the options, only the owner answers.

- [x] Through the snapshot's questions and `task.get`, on a ticket on a Task branch: an answer with a date line reads without it; one without reads as written; one starting with a date followed by more words keeps it.
- [x] A question with options reads whole, its options in its text, on the local tracker and from an issue comment.
- [x] `docs/agents/issue-tracker.md` and `binn init`'s issue-tracker section describe the options; `binn init`'s test sees them in the section.
- [x] `/binnacle:answer`, in the plugin and the skills copy, shows the options in the owner's language, explains them on request and never chooses; the package build's test checks its text, and the copy matches the plugin.

## Comments

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground. The ticket names no role beyond the Developer and the Reviewer.

**Standards: no hard violation.** To fix, all fixed:

1. **Mysterious Name** **Fixed** in 249a358. (`apps/cli/src/init.ts`): `OPTIONS` reads as the CLI's options, which the same file calls `options`. Fix: `QUESTION_OPTIONS`.
2. **The ticket comments' doc comment** **Fixed** in 249a358. (`packages/adapters/src/local-tracker.ts`, `ticketComments`): the added reference leaves a ragged paragraph. Fix: reflow it.
3. **`DATE_LINE`'s comment** **Fixed** in 249a358. (same file) names only `/binnacle:answer`'s date line, though the rule reads issue comments too. Fix: say it reads every Answer, on every tracker.
4. **`task_get`'s description** **Fixed** in 249a358. (`packages/mcp/src/index.ts`): "or null while unanswered" reads as belonging to the date line. Fix: "its answer, or null while unanswered, read without the date line above it".

**Spec.** To fix, all fixed:

5. **The snapshot never reads an answer without a date line** **Fixed** in efafea7. (`apps/daemon/test/pending.test.ts`): the criterion names three answers through the snapshot and `task.get`, and the snapshot's test has none without one. Fix: one more question, answered without a date line, counted answered.
6. **A date alone answers nothing, undocumented** **Fixed** in efafea7. (`docs/agents/issue-tracker.md`): it follows the rule that an empty Answer answers nothing, but the conventions do not say it. Fix: say it there.
7. **What `/binnacle:answer` writes for a chosen option** **Fixed** in 8cbbdb8. (`answer/SKILL.md`, step 4): "the option as the question words it" leaves open whether its cost and mark go with it. Fix: the option's line as the question words it, without its list marker.

Kept:

8. The options' wording repeats in `init.ts`, the conventions, the workflow and `CONTEXT.md`: `init.ts` writes it into other projects, and each document states it in its own terms, as the repository does for every convention.
9. `CONTEXT.md`, the workflow's *Questions and answers* and `task_get`'s description describe the options though the ticket does not list them: each says how a question is recorded or read, and would otherwise contradict the conventions.

**In all**: seven findings fixed, two kept. The typecheck and the full suite, 711 tests, pass after the fixes; one full run failed once on the audit's test of current skills, the race ticket 03 fixes, and passed on the two runs after it.

### Decisions taken without the owner

- **The date line is read off every Answer, on every tracker**, in the one function both trackers pair questions and answers through: an issue comment never carries one from `/binnacle:answer`, and a first line that is a date alone is not the owner's answer there either.
- **An Answer that is a date alone answers nothing**, as an empty one does: the question stays under *Waiting for the owner* (Review, 6).
- **A chosen option is written as its line**, cost and mark included, without its list marker (Review, 7): it is the owner's choice as the question words it, and nothing is reworded.
- **The question is shown in the owner's language; the answer is written as given.** Translating the question to show it is the ticket's; the answer stays the owner's words or the option's line.

The skill's behaviour with the owner, the options shown in Russian, explained on request and the choice written, is the exit demonstration's (05).
