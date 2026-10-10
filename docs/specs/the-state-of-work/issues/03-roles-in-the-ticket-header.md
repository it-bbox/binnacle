# 03: Roles in the ticket header, with Binnacle's suggestions

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer

**What to build:** a ticket header's `Roles:` line is read on every tracker; a ticket without it needs a Developer and a Reviewer; beside the line Binnacle suggests an Architect or Security, each with its reason, labelled as its calculation (spec, *Roles* and *Suggested roles*). `task_get`, the snapshot's Tasks in flight and ready to start, `/binnacle:task` and the Task page show them. The convention reaches `/to-tickets` through `docs/agents/issue-tracker.md` and the issue-tracker section `binn init` offers.

- [ ] The header parser reads `Roles:` on the local and the remote tracker; roles are matched case-insensitively against the baseline's vocabulary and written in its form; another word is `task.unknown_role` and left out.
- [ ] A Task's roles are `{ required, source: 'ticket' | 'default', suggested }`, `default` being Developer and Reviewer.
- [ ] Architect is suggested at 8 or more touched modules of the graph, naming how many; Security when a touched path or the ticket's text holds one of the spec's words, naming what matched; a role the line names is not suggested; without a graph, only Security from the text. Daemon tests over a graph fixture cover each.
- [ ] `task_get` and the snapshot's Task items carry the roles; `/binnacle:task` and `/binnacle:product` present them, suggestions marked as Binnacle's calculation.
- [ ] The Task page shows the required roles and the suggestions, labelled as calculated; strings in English and Russian; checked in a browser.
- [ ] The issue-tracker section `binn init` offers to add describes `Roles:` and the Question and Answer headings, as `docs/agents/issue-tracker.md` does; `init.test.ts` covers it.
