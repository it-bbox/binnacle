# 01: Every Task starts with /binnacle:task run

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/starting-a-project/spec.md`
Roles: Developer, Reviewer, Architect

**What to build:** Binnacle offers its own command to start a ticket, whatever the project's workflow (spec, *The start command*, *ADR-0042*). The start command of every Task neither `DONE` nor `CANCELLED` is `/binnacle:task run <ticket>`, under `matt-pocock`, another `workflow.provider` or none; the snapshot, `task.get`, the board and `/binnacle:task`'s brief carry it. In the Suggested step only the commands of Matt Pocock Skills, the `plan` alternative's grilling, stay gated on `matt-pocock`; Binnacle's own — a ticket's run, `/binnacle:autopilot`, `/binnacle:roadmap` — are offered under any. When the roadmap's table lists no epic, the `plan` alternative names `/binnacle:roadmap` instead of the grilling. ADR-0042, *Binnacle's Own Commands for Its Own Work*, is written as the spec states it, and `docs/03-mcp-and-skills.md` says the new rule.

- [ ] Through `project.snapshot` and `task.get`: the start command is `/binnacle:task run <ticket>` under `matt-pocock`, another provider and none; none for `DONE` and `CANCELLED`.
- [ ] Through the snapshot's `next.alternatives`: the autopilot and by-hand alternatives carry their commands under any provider; the grilling's only under `matt-pocock`.
- [ ] With a roadmap whose table lists no epic, the `plan` alternative names `/binnacle:roadmap`.
- [ ] The board's Tasks carry the same command; checked in a browser.
- [ ] ADR-0042 is written; `docs/03-mcp-and-skills.md` and `/binnacle:task`'s step on a null start no longer tie the command to Matt Pocock's workflow.
