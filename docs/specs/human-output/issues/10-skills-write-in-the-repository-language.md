# 10: Every other skill in the person's language, writing in the repository's

Status: READY
Triage: ready-for-agent
Blocked by: 01, 09
Spec: `docs/specs/human-output/spec.md`

**What to build:** the skills that write into a repository write in its language, and every skill speaks the person's (spec, *The skills read the repository language from the manifest*). `/binnacle:roadmap`, `/binnacle:checkpoint`, `/binnacle:autopilot` and `/binnacle:task run` read `knowledge.language` from the manifest before they write a roadmap, a promoted decision, a ticket's status or a Review, English when it is absent, and keep every marker English. `/binnacle:answer` writes the owner's words as given, and it, `register`, `daemon`, `dashboard`, `help` and `init` report in the person's language, briefly, with no code in their text.

- [ ] Each writing skill names where it reads the repository language and that markers stay English.
- [ ] No skill asks the model to show a code to a person.
- [ ] Checked in review, and in the exit demonstration.
