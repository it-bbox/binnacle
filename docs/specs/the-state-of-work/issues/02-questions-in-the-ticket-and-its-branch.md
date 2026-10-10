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
