# 14: The documentation of telemetry for any harness

Status: DONE
Triage: ready-for-agent
Blocked by: 03, 04, 05, 07, 08, 09, 16
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** `docs/04-telemetry-dashboard.md` drops its "not available" lines for review and rework and describes the roles and context pressure; `docs/03-mcp-and-skills.md`, the README and `README.ru.md` list each harness, its level and how it is reached; `CONTEXT.md` defines review run, rework run and context pressure where it does not yet (spec, *Documentation*).

- [x] The four documents say the above, the two READMEs alike.
- [x] No document still says review or rework usage is not available.

## Comments

### Decisions

- **Where the list lives.** `docs/03-mcp-and-skills.md` gains *Harnesses and their levels*: each harness, the highest level it reaches, and how — its artifact root with the variable that moves it, and for Claude Code, Codex and Gemini CLI the event and the settings `binn init` writes. The READMEs carry a shorter table of the same and point to it. `docs/04-telemetry-dashboard.md`'s *Primary source* points there too, rather than listing them a third time.
- **The level in the table is the highest reachable**, as the spec's table has it; a project's actual level, and the reason a harness stays below the next one, are `usage.get`'s and the usage page's. Level 4 is said to hold while events arrive, ten minutes, as `ACTIVE_WITHIN_MS`.
- **Not verified** is written beside Gemini CLI and Antigravity, as the owner decided while recording ticket 06, and opencode's format is said to wait on the exit demonstration, as ticket 05 says.
- **Run roles** is a section of its own in `docs/04-telemetry-dashboard.md`, with the forge's case and `reworkUnread` from ticket 10. The Task view lists usage by role in place of the two "not available" lines. Questions and answers stays not available, as ticket 09 left it.
- **Context pressure** is described as built (ticket 12): the latest call's context, not the cumulative input the documents said before, and the compactions with their provenance; pi's compactions are outside it (ticket 16). `CONTEXT.md`'s entry says the same, and its *AgentRun* entry no longer says a ticket's branch is always implementation.
- **Two stale lines outside the four documents**, found by the second criterion's search: `docs/05-mvp-plan.md` said review and rework usage was "today" not available, and that OpenTelemetry was deferred to the roadmap's Later list. Both now say what happened.

### Review

`mattpocock-skills:code-review` against `main`, both axes.

- **Fixed:** *Run roles* said the Review commit adds the heading under `## Comments`. The code matches it anywhere in the ticket, which ticket 09's review kept, so the document now says "to the ticket".
- **Fixed:** the READMEs said opencode has no export. The daemon's reason and `docs/03` say it documents none, and both READMEs now do.
- **Fixed:** "pi writes its compactions with no trigger, and gives no marker" read as a contradiction. It now says pi's compactions are not part of the signal, and why.
- **Fixed:** `usage.get`'s description in `docs/03` had grown into one clause of five; it is split into sentences.
- **Fixed:** the Gemini CLI row now says its events, waiting in no project, still make it live in every project's level (ticket 02's `ponytail:`).
- **Kept:** the harness table is in `docs/03` and, shorter, in both READMEs, and the roles in `CONTEXT.md` and `docs/04`. The ticket asks for each, and the READMEs and `docs/04` point to `docs/03`.
- **Kept:** `CONTEXT.md`'s *Context pressure* names the attention item in one sentence, as *Suggested step* names its own behaviour; the rule in full is `docs/04`'s.
- **Kept:** the two lines of `docs/05-mvp-plan.md`, and the README's GLM and in-scope lines: outside the four documents, but stale against what epic 10 built.
