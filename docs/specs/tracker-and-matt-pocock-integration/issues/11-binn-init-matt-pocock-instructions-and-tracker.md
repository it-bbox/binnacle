# 11: `binn init` — Matt Pocock layout, agent instructions and the tracker check

Status: READY
Triage: ready-for-agent
Blocked by: 08, 03
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** `binn init` teaches `/to-tickets` the ticket header by offering a section for `docs/agents/issue-tracker.md`, reports the repository's agent instructions as one set when one file imports the other, and checks that a remote tracker can be read. Decided in the spec, under *`binn init`*, steps 5 to 7, and ADR-0024.

- [ ] The Matt Pocock layout is detected by `docs/agents/issue-tracker.md` and its sibling convention files.
- [ ] When the tracker file lacks the ticket-header section, recognised by its heading, the section is offered as an append: the `Status:`, `Blocked by:` and `Spec:` lines and their values; on a remote tracker, that `Blocked by:` lists issue numbers and that closing outranks `Status:`. A second run offers nothing.
- [ ] Without the layout, init says that `/setup-matt-pocock-skills` sets it up, and runs nothing.
- [ ] `AGENTS.md` and `CLAUDE.md` are read by a pure function, and a `CLAUDE.md` importing `@AGENTS.md` is reported as one instruction set. Nothing is written to either.
- [ ] On a remote tracker, one read through the adapter reports readable, or the failure code with how to create a read-only token for that provider and where to put it. Init never asks for, stores or prints a token.
- [ ] Subprocess tests: the section appended once and not twice, the layout missing, one and two instruction sets, a readable and an unreadable tracker against the loopback stand-in.
