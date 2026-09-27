# 11: A ready-for-human ticket is left to the owner

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** found while autopilot ran tickets 07 to 10 on 2026-09-27: when the only ready ticket was the owner's exit demonstration (`Triage: ready-for-human`), the Overview still offered `/binnacle:autopilot` and `/mattpocock-skills:implement` for it, and autopilot's step 5 would have started an agent on it. A ticket triaged `ready-for-human` is the owner's to do, so neither the alternatives nor autopilot hand it to an agent.

- [ ] The Suggested step's alternatives leave out `ready-for-human` Tasks when they count Tasks ready to start for `autopilot`, `byHand` and `parallel`; when every ready Task of the current epic is `ready-for-human`, they offer one alternative that names it as the owner's, with no command.
- [ ] Autopilot's step 5 starts no agent for a `ready-for-human` ticket, and its report lists such a ticket under *Waiting for the owner*.
- [ ] A Task whose tracker gives no triage is treated as today.
- [ ] Tests through the daemon seam cover a ready-for-human Task alone, beside a ready-for-agent one, and a Task with no triage.
- [ ] `docs/03-mcp-and-skills.md` and the autopilot skill say so.
