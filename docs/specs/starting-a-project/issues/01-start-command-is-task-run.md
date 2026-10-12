# 01: Every Task starts with /binnacle:task run

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/starting-a-project/spec.md`
Roles: Developer, Reviewer, Architect

**What to build:** Binnacle offers its own command to start a ticket, whatever the project's workflow (spec, *The start command*, *ADR-0042*). The start command of every Task neither `DONE` nor `CANCELLED` is `/binnacle:task run <ticket>`, under `matt-pocock`, another `workflow.provider` or none; the snapshot, `task.get`, the board and `/binnacle:task`'s brief carry it. In the Suggested step only the commands of Matt Pocock Skills, the `plan` alternative's grilling, stay gated on `matt-pocock`; Binnacle's own — a ticket's run, `/binnacle:autopilot`, `/binnacle:roadmap` — are offered under any. When the roadmap's table lists no epic, the `plan` alternative names `/binnacle:roadmap` instead of the grilling. ADR-0042, *Binnacle's Own Commands for Its Own Work*, is written as the spec states it, and `docs/03-mcp-and-skills.md` says the new rule.

- [x] Through `project.snapshot` and `task.get`: the start command is `/binnacle:task run <ticket>` under `matt-pocock`, another provider and none; none for `DONE` and `CANCELLED`.
- [x] Through the snapshot's `next.alternatives`: the autopilot and by-hand alternatives carry their commands under any provider; the grilling's only under `matt-pocock`.
- [x] With a roadmap whose table lists no epic, the `plan` alternative names `/binnacle:roadmap`.
- [x] The board's Tasks carry the same command; checked in a browser.
- [x] ADR-0042 is written; `docs/03-mcp-and-skills.md` and `/binnacle:task`'s step on a null start no longer tie the command to Matt Pocock's workflow.

## Comments

- `startCommand(task)` lost its `workflow` parameter; `suggestedStep` takes `epics: Epic[] | null`, null without a roadmap, which still gives no alternative. Matt Pocock Skills' commands are gated where the `plan` alternative names them, through `mattPocock(...)` in `byRule`.
- The dashboard's `plan` text is now generic ("Plan the work"), since it also stands for an empty roadmap.
- Checked in a browser on 2026-10-12, against a temporary daemon serving a fresh `nuxt generate`: the Overview's *Ready to start* and the Task page opened from epic 19's board both show `/binnacle:task run docs/specs/starting-a-project/issues/0N-….md`. The board's cards render no command, as before; `task.list` carries it (`board.test.ts`).
- Until ticket 02 lands, the command offered names a `run` the task skill does not have yet: merge 02 with or right after this one.

### Review

Against `main`, on the standards and the spec, with the Architect's concerns.

1. **Matt Pocock commands recognised by the `/mattpocock-skills:` prefix** in `alternative()` (`packages/core/src/roadmap.ts`): a gated command spelled otherwise would slip through. **Fixed**: the three `plan` calls pass `mattPocock('/mattpocock-skills:…')`, null under any other workflow, and `alternative()` gates nothing.
2. **A stale test name** in `apps/daemon/test/github.test.ts`, "under the Matt Pocock workflow the implement command", whose manifest still set the workflow. **Fixed**: renamed to "the run command", the workflow dropped from its manifest.
3. **An overlong doc-comment line** above `suggestedStep`. **Fixed**: rewrapped.
4. **Kept**: README and `README.ru.md` name no start command, so nothing there contradicts the rule; their paths are tickets 04 and 06's.
5. **Kept**: *Per ticket* in `docs/workflow/02-development-workflow.md` still names `/mattpocock-skills:implement`, and the task skill has no `run` yet: ticket 02's criteria.
6. **Kept**: `close` offers `/binnacle:product` under any workflow; it is Binnacle's own command, as the spec's rule says.

#### Architect

7. **ADR-0042 did not name ADR-0032**, whose consequence says the Suggested step's rules follow the Matt Pocock chain. **Fixed**: its Status line narrows that consequence too.
8. **Kept**: the start command stays a pure function in `packages/core`; the daemon only stopped passing `workflow`, and the dashboard changed in its texts alone.
