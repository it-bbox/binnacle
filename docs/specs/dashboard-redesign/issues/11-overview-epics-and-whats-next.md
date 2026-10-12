# 11: The Overview's epics and "What's next", compact

Status: READY
Triage: ready-for-agent
Blocked by: 10
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** found by the owner at the exit demonstration (09, 2026-10-12), replacing stories 8 and 11 where they differ.

- **Epic progress.** *Brief* shows the roadmap's stepper, every epic as a step with the current one marked, with the current Epic's name and its Tasks done out of all of them. Today the stepper waits for *Full* and shows no names when it opens. *Full* shows every epic as a list: its number, its name, its status and its Tasks done out of all of them, `CANCELLED` left out, and none for an epic without a spec. The counts come from the daemon in one read, not one call per epic; where they come from is this ticket's choice, documented in `docs/03-mcp-and-skills.md` if the snapshot changes.
- **"What's next"** stays always in full, with no control, and holds the same things, but takes the room its content needs: today it is the largest block on the page for a line, one command and its alternatives. Its padding, headings and spacing come down to the page's other widgets'.

Done to the spec's scale and density with the Impeccable and UI UX Pro Max skills, as the epic's other tickets were.

- [ ] *Brief* shows the stepper with the current Epic marked, its name and its count.
- [ ] *Full* lists every epic with its number, name, status and Tasks done out of all.
- [ ] "What's next" is no taller than its content needs, at the same type scale.
- [ ] `docs/04-telemetry-dashboard.md`, *Overview*, says so.
- [ ] New strings are in both dictionaries; the dictionaries' and the type scale's tests pass.
- [ ] Checked in a browser: both levels, light and dark, English and Russian.
