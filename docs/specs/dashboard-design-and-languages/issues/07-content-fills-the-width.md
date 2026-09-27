# 07: The content fills the window's width

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** found by the owner in the exit demonstration (ticket 06, *Comments*): on a wide screen every page sits in a centred column of 1,120 px with empty margins on both sides. The content area right of the sidebar is fluid and fills the window's width, on every page and in the loading and unreachable states. Decided in the spec, under *Further Notes*, *Found in the exit demonstration*.

- [ ] The content area of every page (Overview, Projects, Project, Task, Usage, Attention and Settings, once it exists) fills the width right of the sidebar, with the same side padding at every width, and no fixed maximum width.
- [ ] Prose stays readable: the Next action's description and ticket bodies keep a measure of about 70 characters, while cards, tables and the board stretch.
- [ ] The loading skeleton and the daemon-unreachable state follow the same layout.
- [ ] At 1024 px nothing scrolls sideways, and at 1920 px and wider the pages' cards and columns use the width instead of leaving margins.
- [ ] Every page reads well at 1024, 1440 and 1920 px, in both themes. A human checks this; the steps are under `## Comments`.
