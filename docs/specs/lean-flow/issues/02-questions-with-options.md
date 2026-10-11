# 02: A question offers its options

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/lean-flow/spec.md`

**What to build:** a question an agent records carries its options, so the owner chooses rather than composes (spec, *Questions with options*, *The answer's date line*). After its text, a `### Question` lists its options, each with its cost, the recommended one first and marked "(recommended)"; the options are part of the question's text for the parser. `docs/agents/issue-tracker.md` and the issue-tracker section `binn init` offers a project describe it, on the local tracker and in issue comments alike. `/binnacle:answer` shows the question and its options in the owner's language, explains them when the owner asks, never picks one, and writes the owner's choice or own words as today. The ticket parser leaves a first answer line that is a date alone, `YYYY-MM-DD`, out of the answer's text; `/binnacle:answer` keeps writing it. ADR-0040 holds: the asker writes the options, only the owner answers.

- [ ] Through the snapshot's questions and `task.get`, on a ticket on a Task branch: an answer with a date line reads without it; one without reads as written; one starting with a date followed by more words keeps it.
- [ ] A question with options reads whole, its options in its text, on the local tracker and from an issue comment.
- [ ] `docs/agents/issue-tracker.md` and `binn init`'s issue-tracker section describe the options; `binn init`'s test sees them in the section.
- [ ] `/binnacle:answer`, in the plugin and the skills copy, shows the options in the owner's language, explains them on request and never chooses; the package build's test checks its text, and the copy matches the plugin.
