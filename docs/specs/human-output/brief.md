# Human output: what the grilling decided

Epic 13 has no phase in `docs/05-mvp-plan.md`. It was added on 2026-10-05: every command's and skill's output made readable for a person (the owner, after that day's exit demonstrations). Later epics left it the translation of the skills' output (`specs/skills-in-any-harness/spec.md`), rewriting it beyond fencing its commands (`specs/dashboard-redesign/spec.md`), and the vault's notes, all in English (epic 8's exit demonstration). It is the last epic of v1, released as 0.3.0. This brief is what `/to-spec` starts from.

## The problem

Binnacle talks to a person in a format made for an agent. `/binnacle:product` lists twelve sections in a row, so the answer to "what do I do next?" is lost among them. Its text carries internal codes (`next_action.stale`), provenance phrases and terms in English. `binn` prints English only. Binnacle's own files, `binn init`'s templates and the vault, are English in every project. Asked "what do we do now?" after a snapshot, the owner had to ask again (2026-10-21).

## The outcome wanted

A person reads Binnacle in their own language, short and plain: where the project stands, what waits for them, what is broken and the next command, first. Everything else comes when they ask. The files Binnacle writes into a repository are in that repository's documentation language, so a project documented in Russian gets Russian templates, and this repository, documented in English while its owner speaks Russian, keeps English files and Russian answers.

## Who it concerns

Anyone who reads Binnacle: the owner in the chat, in a terminal and on the dashboard; a user documenting their project in Russian; the participants of the course "Один как команда".

## The systems it touches

- every skill of the `binnacle` plugin, `/binnacle:product`, `/binnacle:daily`, `/binnacle:status` and `/binnacle:task` first;
- every `binn` command's text output;
- the dashboard's dictionaries and its kept-English terms;
- `binn init`'s templates, the project manifest and its template, `/binnacle:roadmap`;
- the vault projection;
- the autostart service's environment.

## Decided in the grilling, 2026-10-21

- **All three problems, equally:** length and density, language, internal jargon.
- **A person in their language, a file in the repository's** (ADR-0045). The chat, the terminal and the dashboard speak the person's language; what Binnacle writes into a repository is in its documentation language and is never translated.
- **Where the person's language comes from:** in the chat, the language of the conversation; in `binn`, the system locale, `LC_ALL`, then `LANG`, Russian for `ru`, English otherwise; on the dashboard, as today, the browser's language and the Settings page's choice. No new setting.
- **Short first, details on request.** A skill's report opens with three to six lines: where the project stands, what waits for the person, what is broken, what to do next with its command. An empty section or one with nothing wrong is not shown. The rest, usage, the graph, every Task, CI per pull request, comes when the person asks, in the chat or on the dashboard.
- **Russian terms in Russian output, the dashboard included.** Task, Epic, Next action, In progress and the rest are translated (задача, эпик, следующий шаг, в работе). This replaces epic 6's rule of keeping them English in both languages (`docs/04-telemetry-dashboard.md`). Commands, paths, Task ids and a file's own markers such as `Status: DONE` stay as they are. Attention codes leave the text for a person; they stay in `--json` and MCP.
- **The repository's language is a field of the manifest.** `binn init` puts it in its plan: from the README's language in an existing project, from the person's language in a new one. `binn init`'s templates and the vault are written in it, and the skills read it when they write a roadmap or a ticket. The markers Binnacle parses (`Status:`, `## Current focus`, `Next action:`) stay English in every language.
- **A calculated value is marked by one word beside it**, such as "(estimate)" or "(from activity)", in the person's language. An unknown is "no data", never zero.

Defaults, from the docs and Ponytail, not put to the owner:

- English and Russian only, in dictionaries of our own with no i18n module, as the dashboard's (ADR-0033).
- Machine output does not change: MCP tools, `--json` and `binn call`. The skills' instructions stay English; they are read by agents.
- The daemon keeps writing English messages with their codes. The dashboard and `binn` show them from their dictionary by code; in the chat the model words them in the person's language.
- The vault's own words (headings, generated marks) follow the daemon's locale, and its content is the repository's text. The autostart service passes `LANG` beside `BINNACLE_HOME` and `PATH`.
- In `binn`, the summary and the next step come first and the details after, with no new flag.
- A short report ends with one line on what else it can show.
- A manifest with no language field reads as English, as today.
- The last ticket is the exit demonstration: `/binnacle:product` in a Russian chat on this repository; `binn audit` with `LANG=ru`; the dashboard in Russian with Russian terms; on a fixture documented in Russian, `binn init` proposing Russian and writing its templates and the vault in it. Then 0.3.0 by `CONTRIBUTING.md`'s *Releasing*.

## Constraints and open questions

- 0.3.0 is epic 13 and nothing else (the roadmap's current focus).
- Open for `/to-spec`: the manifest field's name and values; the Russian word for each term, with `CONTEXT.md` as the list of terms; how the README's language is told; the order of the skills' short lines, skill by skill; which `binn` commands' output is reordered.
