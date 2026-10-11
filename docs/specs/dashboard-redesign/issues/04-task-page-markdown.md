# 04: The Task page in Markdown, brief or full

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** the Task page renders the ticket's body and its Review as Markdown (spec, *Markdown on the Task page*): headings, paragraphs, lists, emphasis, inline code, code blocks and links, by one small bundled renderer with raw HTML off, so a ticket injects nothing. The daemon's cut notices stay. Its widgets go into the shared frame, the AgentRun timeline showing its latest runs and the questions their unanswered ones first in *Brief* (stories 19, 20).

- [x] A Review with headings, lists and code reads as a document, not one block of monospace text.
- [x] Raw HTML in a ticket is shown as text, never rendered.
- [x] The timeline and the questions have the control, *Brief* as the stories say.
- [x] Task ids are shown in full.
- [x] `docs/04-telemetry-dashboard.md` says the body and Review are rendered as Markdown.
- [x] Checked in a browser: a Task with a long Review, in light and dark, English and Russian.

## Comments

The renderer is `app/markdown.ts`, Nuxt-free and tested, over `marked` 17.0.6: zero dependencies of its own, already in the lockfile through Nuxt UI's editor, now the dashboard's direct dependency and bundled into its static build. Its HTML renderer escapes raw HTML, block and inline; a link stays a link only to `http`, `https` or `mailto`, and opens in a new tab; an image is its alt text, so that the page loads nothing but the daemon. The page gives the result to `v-html`, and `.markdown` in `main.css` styles it at the type scale and the prose measure. The daemon's cut notices stay below each text.

Readings taken where the stories leave room: the timeline's *Brief* shows the latest three runs, unfolding in place, each with its harness, model, role, latest activity and tokens, its branch, checkout and start waiting for *Full*; the questions' *Brief* shows the unanswered ones and how many are answered, *Full* every question in the ticket's order; GFM stays on, so a ticket's task lists and tables read as such; the body and the Review do not fold, being the page's documents rather than a widget's text. Task ids on this page were already whole.

Checked in a browser at 1024 px against a temporary daemon, with a fixture ticket holding a long Review, raw HTML, a `javascript:` link, an image, task lists, a code block, three questions, one answered, and eight runs: light and dark, English and Russian, *Brief* and *Full*. No `script`, `img`, `b` or `onclick` reaches the DOM, the one link left is the web one, body text reads at 16 px and code at 14 px, a level survives a reload, and nothing scrolls sideways.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground. The ticket names no role beyond the Developer and the Reviewer.

**Standards: no hard violation.** The Markdown path was tried with hostile input: raw HTML in a link or table, reference links, autolinks, `www.` links, `vbscript:`, `data:` and `//` URLs, quotes in a URL, link titles, entities, fence info strings; nothing injects. To fix:

1. **Questions keyed by their text** **Fixed** in 42ece8a. (`pages/task.vue`, the questions' `FoldedList`): two questions reading the same would share a key. Fix: keyed by their place in the ticket, which only grows.
2. **The unavailable check spelled twice** **Fixed** in 42ece8a. (`pages/task.vue`, `unanswered` and `answered`): Fix: one `questions` list, the answered count taken from it in the template.
3. **`renderer` held a `Marked`** **Fixed** in 42ece8a. (`markdown.ts`): Fix: named `parser`.

Kept:

4. An image's alt text is not parsed, so `![**a**](x)` shows its asterisks: cosmetic, and an image is rare in a ticket.

**Spec: nothing missing.** To fix: none. Kept:

5. The body and the Review do not fold (story 7): they are what the page is read for, and the ticket puts only the timeline and the questions in the frame.
6. GFM's tables, task lists and the quote and rule styles beyond the spec's list: tickets write their criteria as task lists, which would otherwise read `[ ]`; none renders raw HTML.
7. *Full* lists questions in the ticket's order (story 20): each answer follows its question as the ticket records it; *Brief* already puts the unanswered ones first.
8. The timeline's line runs from the last shown run into the row that unfolds the rest: it leads to the runs still folded.
