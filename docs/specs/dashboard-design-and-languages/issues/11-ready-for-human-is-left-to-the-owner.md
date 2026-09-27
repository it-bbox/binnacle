# 11: A ready-for-human ticket is left to the owner

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** found while autopilot ran tickets 07 to 10 on 2026-09-27: when the only ready ticket was the owner's exit demonstration (`Triage: ready-for-human`), the Overview still offered `/binnacle:autopilot` and `/mattpocock-skills:implement` for it, and autopilot's step 5 would have started an agent on it. A ticket triaged `ready-for-human` is the owner's to do, so neither the alternatives nor autopilot hand it to an agent.

- [x] The Suggested step's alternatives leave out `ready-for-human` Tasks when they count Tasks ready to start for `autopilot`, `byHand` and `parallel`; when every ready Task of the current epic is `ready-for-human`, they offer one alternative that names it as the owner's, with no command.
- [x] Autopilot's step 5 starts no agent for a `ready-for-human` ticket, and its report lists such a ticket under *Waiting for the owner*.
- [x] A Task whose tracker gives no triage is treated as today.
- [x] Tests through the daemon seam cover a ready-for-human Task alone, beside a ready-for-agent one, and a Task with no triage.
- [x] `docs/03-mcp-and-skills.md` and the autopilot skill say so.

## Comments

- **Where it lives.** `byRule` in `packages/core/src/roadmap.ts` reads a Task as an agent's unless its `triage` is `ready-for-human` (`forAgent`), so a Task with no triage, or any other role, counts as before. Rule 1's `parallel` counts only such Tasks. Rule 3 still applies when the current epic has a `READY` Task with no Unmet dependency; its `autopilot` and `byHand` read only the agent's ones (`agentReady`), and with none, it gives one alternative of a new kind, `owner`, naming every such Task, with no command. The dashboard mirrors the kind in `composables/projects.ts`, writes its title and reason in `app/i18n/en.ts` and `ru.ts`, and gives it `i-lucide-user` in `pages/index.vue`. The tests are in `apps/daemon/test/next.test.ts`.
- **Decided here, where the spec is silent:**
  - **A kind of its own.** The dashboard writes an alternative's title and reason from `kind`, so no existing kind can say "yours to do": `byHand` would read "Take it by hand" and `blocked` "Nothing can start yet". The spec's kind list and rule 3 now say so.
  - **Rule 1 does not offer `owner`.** While a Task is being worked on, `wait` leads, and `parallel` leaves a `ready-for-human` Task out; with only such Tasks ready, `wait` stands alone. The criterion speaks of the current epic's ready Tasks, which is rule 3's reading, and Ready to start still lists the Task on the Overview.
  - **Autopilot reads the ticket's `Triage:` line,** as it already reads `Status:` and `Blocked by:` for a remainder, so the snapshot's sections are unchanged. Its run ends with no agent running and nothing left to start but `ready-for-human` tickets, so it does not wait on one.
- **Not seen in a browser.** The `owner` row's text is typechecked in both dictionaries and `pnpm dashboard:generate` passes. To see it: on a project whose current epic's only Task ready to start has `Triage: ready-for-human`, open the Overview; "or" shows one row with a user icon, "<id> is yours to do", and no command, in English and, switched, in Russian.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Findings, all judgement calls:

1. **Shotgun Surgery**: the new kind touches core, `projects.ts`, both dictionaries and `ICONS`. **Kept**: the dashboard's existing convention of mirroring the daemon's kinds, which the typecheck holds together.
2. **Duplicated Code**: the `is`/`it` pair and the joined names repeat the `wait` branch and `take`. **Kept**: a helper would be as long as the lines it replaces.
3. **Primitive Obsession**: `task.triage !== 'ready-for-human'` compares a string. **Kept**: `triage` is `string | null` on every tracker, as before this ticket.
4. **Mysterious Name**: `agents` held Tasks. **Fixed**: it is `agentReady`.
5. **Local convention**: the `owner` entry repeated `count === 1` for its title and its reason. **Fixed**: it follows `byHand`'s shape in both dictionaries.

**Spec: every criterion holds, with no scope creep.** Findings:

6. **Rule 1 never offers `owner`.** **Kept**, as *Decided here* says.
7. **The epic spec's kind list left out `owner`.** **Fixed**: it lists it, and says when rule 3 gives it.
8. **Autopilot reads the `Triage:` line**, since the snapshot's sections carry no triage. **Kept**, as *Decided here* says.
