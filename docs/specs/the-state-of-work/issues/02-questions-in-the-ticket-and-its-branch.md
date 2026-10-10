# 02: Questions and answers read from the ticket and its branch

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, Architect

**What to build:** on the local tracker, a Task's questions and answers are read from its ticket, `### Question` and `### Answer` under `## Comments`, at the tip of its branch while that branch is unmerged, and from the caller's checkout otherwise (ADR-0040; spec, *Questions and answers, parsed once* and *Read from the branch*). `task_get` gives them, `/binnacle:task` presents them, and the Task page shows them in place of its *Not available* row. The header, the state and the Review are still read from the caller's checkout.

- [ ] The parser that reads the Review reads each Question with its Answer or null, with the same heading and code-fence rules; an Answer before any Question is ignored.
- [ ] Daemon tests against a Git repository: a Task with no branch, one whose unmerged branch adds a Question, then an Answer, and one whose branch is merged into the default branch, each giving the right questions through `task_get`.
- [ ] The default branch is the one usage reads (`origin/HEAD`'s, or else `main`); a repository without either reads from the checkout only.
- [ ] On a remote tracker `task_get`'s questions are unavailable with a reason until ticket 05.
- [ ] `/binnacle:task` (plugin and `binnacle-task` copy) presents each question with its answer or as unanswered.
- [ ] The Task page shows the questions and answers; new strings in English and Russian, `i18n.test.ts` passing; checked in a browser.

## Comments

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Authorship, the documentation's language, the Git adapter's read-only rules and ADR-0007's unavailable-with-a-reason hold. Findings:

1. **An empty `### Answer` answers its Question.** Its text is `''`, not null, so the Question counts as answered and a later Answer before the next Question is ignored, where an empty Review is null. Both reviewers found it. **To fix**: an empty Answer is no answer, as an empty Review is none.
2. **The questions are not cut at the body limit**, where the body and the Review are. **Kept**: the spec gives each question its text and its answer's text, a question and its answer are short by the convention ticket 06 writes, and a cut would change the shape ticket 04 and 05 build on. Cut them if a ticket ever holds a long exchange.
3. **A Git that cannot say falls back to the checkout silently.** **Kept**: ADR-0040 reads the checkout "otherwise", and the brief names where the questions were read from, `branch` null for the checkout.
4. **Primitive Obsession: the parser's `section.kind` is a string.** **Kept**: `SECTION` admits only the three headings, each compared literally beside it.
5. **`task.ts` takes `defaultCommit` from `graph.ts`.** **Kept**: reusing the default branch usage and the graph already read is what the ticket asks, and a move would be a refactor of its own.

**Spec: every criterion is implemented, with no scope creep.** Findings:

6. The empty Answer, as 1.
7. **`taskQuestions` reads the default branch's commit on every call.** **Kept**: one Task per `task_get`; ticket 04, which reads every Task's questions for the snapshot, should read it once.
