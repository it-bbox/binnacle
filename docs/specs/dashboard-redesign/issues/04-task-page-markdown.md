# 04: The Task page in Markdown, brief or full

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** the Task page renders the ticket's body and its Review as Markdown (spec, *Markdown on the Task page*): headings, paragraphs, lists, emphasis, inline code, code blocks and links, by one small bundled renderer with raw HTML off, so a ticket injects nothing. The daemon's cut notices stay. Its widgets go into the shared frame, the AgentRun timeline showing its latest runs and the questions their unanswered ones first in *Brief* (stories 19, 20).

- [ ] A Review with headings, lists and code reads as a document, not one block of monospace text.
- [ ] Raw HTML in a ticket is shown as text, never rendered.
- [ ] The timeline and the questions have the control, *Brief* as the stories say.
- [ ] Task ids are shown in full.
- [ ] `docs/04-telemetry-dashboard.md` says the body and Review are rendered as Markdown.
- [ ] Checked in a browser: a Task with a long Review, in light and dark, English and Russian.
