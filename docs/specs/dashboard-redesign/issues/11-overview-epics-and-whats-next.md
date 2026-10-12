# 11: The Overview's epics and "What's next", compact

Status: DONE
Triage: ready-for-agent
Blocked by: 10
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** found by the owner at the exit demonstration (09, 2026-10-12), replacing stories 8 and 11 where they differ.

- **Epic progress.** *Brief* shows the roadmap's stepper, every epic as a step with the current one marked, with the current Epic's name and its Tasks done out of all of them. Today the stepper waits for *Full* and shows no names when it opens. *Full* shows every epic as a list: its number, its name, its status and its Tasks done out of all of them, `CANCELLED` left out, and none for an epic without a spec. The counts come from the daemon in one read, not one call per epic; where they come from is this ticket's choice, documented in `docs/03-mcp-and-skills.md` if the snapshot changes.
- **"What's next"** stays always in full, with no control, and holds the same things, but takes the room its content needs: today it is the largest block on the page for a line, one command and its alternatives. Its padding, headings and spacing come down to the page's other widgets'.

Done to the spec's scale and density with the Impeccable and UI UX Pro Max skills, as the epic's other tickets were.

- [x] *Brief* shows the stepper with the current Epic marked, its name and its count.
- [x] *Full* lists every epic with its number, name, status and Tasks done out of all.
- [x] "What's next" is no taller than its content needs, at the same type scale.
- [x] `docs/04-telemetry-dashboard.md`, *Overview*, says so.
- [x] New strings are in both dictionaries; the dictionaries' and the type scale's tests pass.
- [x] Checked in a browser: both levels, light and dark, English and Russian.

## Comments

The snapshot's `roadmap.epics` and `roadmap.current` carry each epic's `progress`, its Tasks `done` out of `all`, `CANCELLED` left out, `null` without a spec or when the Tasks cannot be read (`apps/daemon/src/snapshot.ts`, `docs/03-mcp-and-skills.md`). The Overview reads its counts there and polls the board only for the Tasks waiting on an Unmet dependency. *Brief*: a stepper of numbered steps, the current one marked, each name in its tooltip, then the current Epic's name, bar and count. *Full*: a table like the Project page's, # / Epic / Status / Tasks, the current row highlighted. "What's next" takes the widgets' padding, a `text-base` heading and body-size text. Checked in a browser against a temporary daemon on this repository: both levels, light and dark, English and Russian; epic 16 is current, 9 of 13.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground.

**Standards.** No hard violation. Kept:

1. What's next repeats the widgets' classes rather than sharing `Widget.vue`'s `panel`: its padding is the widgets' content padding, not their frame's, and it has no header.
2. The count's `null` / none / `tasksDone` branch written in both levels, and the `step` class chains: *Brief* also tells the tracker from a missing spec and draws a bar; the chains are as before.
3. `own` in `snapshot.ts`: the name `roadmapAttention` uses for the same set.
4. `roadmap && epics &&`: TypeScript needs `roadmap` narrowed for the spread.
5. `noTasks` true for a current epic without a spec: as before, when its board was empty.

**Spec.** To fix:

6. **Full showed "—" for every epic when the tracker cannot be read**, alike with an epic without a spec (`apps/dashboard/app/pages/index.vue`). **Fixed** in ccd36f9: the table says "not available · tracker unreadable" above it.

Kept:

7. The *Brief* stepper names only the current epic, the others in their tooltips: the ticket asks for the current Epic's name; *Full* names every one.
8. "Tasks" header over "1 of 2 Tasks done": the cell reads alone, in both languages.
