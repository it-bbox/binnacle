# ADR-0042: Binnacle's Own Commands for Its Own Work

**Status:** Accepted. Narrows the rule in `docs/03-mcp-and-skills.md` that no command is offered under a workflow other than Matt Pocock's, and ADR-0032's consequence that the Suggested step's rules follow the Matt Pocock chain (`specs/starting-a-project/spec.md`).

## Context

Binnacle offered `/mattpocock-skills:implement <ticket>` to start a Task, and only when `workflow.provider` was `matt-pocock`; under any other workflow the dashboard, `task_get`, the snapshot and `/binnacle:task` showed no command at all, and the Suggested step gave descriptions alone, even for Binnacle's own commands such as `/binnacle:autopilot`. The process a ticket follows — a branch per ticket, test first, the Review in the ticket, `DONE` as the last commit, the roadmap left alone — lived by hand in this repository's instruction files and in a copy inside autopilot's prompt, so a user's project had none of it. The owner wants a ticket started by Binnacle's own command, whatever the project's workflow (`specs/starting-a-project/brief.md`, 2026-10-12).

## Decision

- The start command of every Task neither `DONE` nor `CANCELLED` is `/binnacle:task run <ticket>`, with its ticket path or URL, under any `workflow.provider` or none. The snapshot, `task.get`, the board and `/binnacle:task` carry it.
- The per-ticket process lives in that skill, and autopilot's agents follow it rather than a copy of its rules.
- In the Suggested step, Binnacle's own commands — a ticket's run, `/binnacle:autopilot`, `/binnacle:product`, `/binnacle:roadmap` — are offered under any workflow; only Matt Pocock Skills' commands, the `plan` alternative's grilling, spec or tickets, stay gated on `matt-pocock`. A roadmap whose table lists no epic is planned with `/binnacle:roadmap`.
- `binn init` writes the planning skills' conventions in place of `/setup-matt-pocock-skills`, and with them the first text it writes into an instruction file.
- Planning — grilling, the spec and the tickets — stays on Matt Pocock Skills until after the release (*Binnacle's own planning skills*, the product inbox).

## Considered Options

- **Keep `/mattpocock-skills:implement`, gated on `matt-pocock`.** Rejected: the command is someone else's, carries none of the ticket's process, and a project on another workflow is offered nothing.
- **Offer `/binnacle:task run` only under `matt-pocock`.** Rejected: the command is Binnacle's, so a project's workflow should hide nothing of Binnacle's.
- **Binnacle's own planning skills now.** Deferred: the release is on 2026-10-13, and planning works on Matt Pocock Skills.

## Consequences

- A project on any workflow sees a start command on every open Task, and Binnacle's own commands in its suggestions.
- A harness without skills still sees the start command and follows the project's instruction files by hand.
- A change to the per-ticket process reaches a ticket started by hand and autopilot's agents at once.
