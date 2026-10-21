# Spec: Human output

Status: READY
Triage: ready-for-agent

Epic 13 of v1, the last, from its grilling's brief, `docs/specs/human-output/brief.md` (2026-10-21), and ADR-0045. It has no phase in `docs/05-mvp-plan.md`. Released as 0.3.0. Exit criterion: `/binnacle:product` in a Russian chat on this repository opens with three to six Russian lines, with no attention code and no English domain term, and the files it would write stay English; `binn audit` with `LANG=ru_RU.UTF-8` speaks Russian and leads with its plan; the dashboard in Russian shows Russian terms; on a fixture documented in Russian, `binn init` proposes Russian, and writes its templates in it and projects the vault in it, with every marker Binnacle parses still English and read back without a gap; and the owner publishes 0.3.0 by `CONTRIBUTING.md`'s *Releasing*. The owner confirmed the test seams on 2026-10-21, recorded under *Testing Decisions*, and settled two points the brief left open, under *Contested points*.

## Problem Statement

Binnacle talks to a person in a format made for an agent. `/binnacle:product` lists twelve sections in a row, so the answer to "what do I do next?" is lost among them, and after a snapshot the owner had to ask again what to do now. Its text carries internal codes such as `next_action.stale`, provenance phrases and English terms inside Russian sentences. `binn` prints English whatever the person's language. The dashboard speaks Russian but keeps Task, Epic, Next action and the other terms English, which makes it read as written for an agent.

And the files Binnacle writes into a repository, `binn init`'s templates and the vault, are English in every project, so a project documented in Russian gets English files beside its own.

## Solution

A person reads Binnacle in their own language, short and plain. Every skill's report opens with three to six lines: where the project stands, what waits for the person, what is broken, and the next command. A section with nothing in it is not shown, and the rest comes when the person asks. `binn` speaks the system locale's language, Russian or English, and puts its summary and next step before its details. The dashboard's Russian translates the domain's terms. No attention code reaches a person's text; codes stay in `--json` and MCP.

The project manifest states the repository's documentation language, and `binn init` proposes it: from the README in an existing project, from the person's language in a new one. `binn init`'s templates, the vault's own words, and the roadmaps and tickets Binnacle's skills write are in that language, while the markers Binnacle parses stay English in every one. This repository, documented in English with an owner who speaks Russian, keeps English files and gets Russian answers.

## User Stories

### The person's language

1. As a Russian-speaking owner, I want Binnacle's skills to answer me in the language of our conversation, so that I do not read English reports in a Russian chat.
2. As a Russian-speaking user at a terminal, I want `binn` to speak Russian when my locale is Russian, so that the CLI reads like the rest of my system.
3. As a user, I want `binn` to read the locale from `LC_ALL`, then `LANG`, Russian for any `ru` value and English otherwise, so that the rule is the one my other tools follow.
4. As a user whose locale is `C` or unset, I want English, so that a server or a container gets the output it always had.
5. As a user, I want no new Binnacle setting for my language, so that there is nothing to configure.
6. As a dashboard user, I want the dashboard to keep starting in my browser's language and keep the Settings page's choice, so that nothing I chose before changes.
7. As a user, I want `binn --help` in my language too, so that the first thing I read is not the exception.

### Short first

8. As an owner opening `/binnacle:product`, I want three to six lines first: where the project stands, what waits for me, what is broken and what to do next with its command, so that the answer to "what now?" is the first thing I read.
9. As an owner, I want the next command alone in a fenced block, so that I copy it in one click.
10. As an owner, I want a section with nothing in it, or with nothing wrong, not shown, so that "none" is not repeated ten times.
11. As an owner, I want the short report to end with one line on what else it can show, so that I know what to ask for.
12. As an owner, I want the rest, every Task, the roadmap, conflict risk, the graph, CI by pull request, usage and decisions, when I ask for it in the chat, so that nothing is lost, only folded away.
13. As an owner, I want the dashboard pointed at for the full picture, so that I know where every detail is.
14. As an owner running `/binnacle:daily`, I want what changed in one line first, then what waits for me, what is broken and what can start next, so that the daily reads as a summary, not a log.
15. As an owner running `/binnacle:daily` when nothing changed, I want that said in one line, with what still waits for me, so that a quiet day reads quiet.
16. As an owner running `/binnacle:status`, I want the project, its tracker and the checkout in two or three lines, with what is wrong only when something is, so that a status check is a glance.
17. As an owner running `/binnacle:task` for a Task, I want the Task, what it waits on, what is broken and the command that starts it first, so that I can act on it without reading its whole brief.
18. As an owner, I want the Task's ticket, roles, Review and branch when I ask, so that the brief is still there.
19. As an owner running `/binnacle:audit`, I want a line of totals first, then the plan, then the findings by area, so that the audit leads with what to do.
20. As an owner, I want every other skill, init, checkpoint, autopilot, answer, roadmap, register, daemon, dashboard and help, to report in my language and as briefly, so that no skill is the old format.
21. As a user of `binn audit`, I want the totals and the plan before the findings, so that the terminal leads with what to do as the chat does.
22. As a user of `binn init`, I want its summary to open with the command to run next, then what was written, so that the end of a long run says what to do first.
23. As a user, I want no new flag for the short or the full form in `binn`, so that the commands stay as they are.

### Plain words

24. As an owner, I want no attention code in a person's text, in the chat, the terminal or the dashboard, so that I read what is wrong, not an identifier.
25. As a script author, I want the codes kept in `--json`, MCP and `binn call`, so that my scripts keep branching on them.
26. As an owner, I want each attention item worded in my language with the Task ids, paths and numbers it names, so that a Russian sentence still points to the exact thing.
27. As an owner, I want a message Binnacle has no wording for shown as the daemon wrote it, marked English, so that nothing is hidden for want of a translation.
28. As an owner, I want a value Binnacle calculated marked by one word beside it, "(оценка)" or "(estimate)", so that a calculation is told from a fact without a paragraph of provenance.
29. As an owner, I want a reading from activity marked "(по активности)" or "(from activity)", so that "running" and "in progress from its runs" are told from a state the harness reports.
30. As an owner, I want an unknown value said as "нет данных" or "no data", never zero, so that missing telemetry is not mistaken for none.
31. As an owner, I want `binn`'s errors in my language without their code, with the exit code unchanged, so that a person reads the cause and a script still sees it.

### Russian terms

32. As a Russian-speaking owner, I want Task, Epic, Next action, In progress and the other domain terms in Russian in Russian output, so that a sentence is in one language.
33. As an owner, I want the same Russian word for a term in the chat, the terminal and the dashboard, so that I learn each term once.
34. As an owner, I want the dashboard's Russian to translate the terms epic 6 kept English, so that it no longer mixes languages.
35. As an owner, I want commands, paths, Task ids, branch names and model names never translated, so that I can copy and search them.
36. As an owner, I want a file's own marker quoted as written, such as `Status: DONE`, so that what I search the repository for is what I see.
37. As a contributor, I want the Russian word for each term recorded in `CONTEXT.md` beside the term, so that the list of terms and their words is one list.
38. As a user, I want names, Binnacle, Graphify, Obsidian, Serena and the harnesses, never translated, so that a name stays a name.

### The repository's language

39. As a user documenting my project in Russian, I want Binnacle to write Russian files into it, so that its files match mine.
40. As the owner of this repository, documented in English, I want its files to stay English while the chat answers me in Russian, so that `AGENTS.md`'s rule holds.
41. As a user, I want the repository's language stated in the manifest, so that it is a fact anyone can read and change, not a guess made each time.
42. As a user, I want a manifest with no language read as English, so that every existing project keeps today's behaviour.
43. As a user on a newer manifest, I want an unknown language value to be a warning, read as English, so that an older Binnacle still reads the manifest.
44. As a user adopting an existing project, I want `binn init` to propose the language of its README, so that the proposal matches the documents already there.
45. As a user starting a new project with no README, I want `binn init` to propose my language, so that my first documents are in the language I speak.
46. As a user, I want `binn init` to ask me the language once, with its proposal as the default, so that I can correct a wrong guess before anything is written.
47. As a user of `binn init --plan` and `--apply`, I want a flag that answers the language, so that the chat path asks nothing of `binn` itself.
48. As a user setting up from the chat, I want `/binnacle:init` to show the proposal and ask me, and pass my answer, so that the chat asks what the terminal asks.
49. As a user, I want the plan to show the language line of a new manifest, so that I confirm it with the rest.
50. As a user with an existing manifest that states no language, I want `binn init` to print the line to add when its proposal is not English, never write it, so that my manifest is never rewritten.
51. As a user, I want the plan's id unchanged by my locale, so that a plan shown in a Russian chat and applied from an English shell is still the same plan.

### Templates and written files

52. As a user of a Russian repository, I want `binn init`'s roadmap skeleton in Russian, so that my roadmap starts in my language.
53. As a user, I want the planning conventions `binn init` writes, the issue tracker's file, the triage labels, the domain file and the *Agent skills* block, in the repository's language, so that the files agents read are in it.
54. As a user, I want the *Agent skills* block to state the repository's language when it is not English, so that any agent, Matt Pocock's skills included, writes its specs and tickets in it.
55. As a user, I want the markers Binnacle parses, the roadmap table's header, its statuses, `## Current focus`, `Next action:`, the ticket header's fields, the triage labels, `## Ticket header` and `## Agent skills`, kept English in a Russian template, so that Binnacle and `binn audit` read the file back.
56. As a user, I want a Russian roadmap skeleton read by Binnacle with no diagnostic, so that the template is valid from its first commit.
57. As a user, I want `/binnacle:roadmap`, `/binnacle:checkpoint` and `/binnacle:autopilot` to write the roadmap, tickets and reviews in the repository's language, so that the files my session writes match the rest.
58. As a user, I want those skills to read the language from the manifest before they write, so that one field decides it.
59. As a user, I want my own answer written by `/binnacle:answer` in my words, untranslated, so that the answer is mine.

### The vault

60. As a user of a Russian repository, I want the vault's own words, its headings and the lines Binnacle generates, in Russian, so that the vault reads like the repository it projects.
61. As a user, I want the content the vault copies from the repository kept as committed, so that a note is its source.
62. As a user, I want the generated marker of a note unchanged, so that the vault still tells its own notes from mine and never touches mine.
63. As the owner of this repository, I want its vault to stay English, so that it follows the repository, not my chat.

### Machine output

64. As a script author, I want MCP tools, `--json` and `binn call` unchanged in language, so that a Russian locale never breaks a script.
65. As a script author, I want each attention item and error to gain only an optional field of its values, so that an existing consumer reads what it read before.
66. As an agent, I want the skills' instructions to stay English, so that every harness reads them as before.
67. As an agent, I want the daemon's messages to stay English, with their codes, so that my reasoning reads one language.

### The release

68. As the owner, I want the epic to end with an exit demonstration in a Russian chat, a Russian terminal, the Russian dashboard and a fixture documented in Russian, so that I see every surface before I release.
69. As the owner, I want 0.3.0 released by *Releasing*, published by me, so that v1 ends with this epic.
70. As a Russian-speaking reader of the guides, I want the user guides and their twins to say how Binnacle picks its languages and where the repository's is stated, so that the guide tells me before I meet it.

## Implementation Decisions

- **Two languages, English and Russian, in dictionaries of our own** with no i18n module, as the dashboard's (ADR-0033). `Intl` covers plurals and numbers. A third language is a dictionary, never a code change.
- **The person's language**: in the chat, the conversation's, worded by the model; in `binn`, `LC_ALL`, then `LANG`, Russian when the value starts with `ru`, English otherwise, `C` and unset included; on the dashboard, as today. One function in the CLI decides it, read once per run.
- **The repository language is the manifest's `knowledge.language`**, `en` or `ru`. It is validated as the other fields are, comes back null when unwritten, and is read as English at the point of use. Any other value is a warning, not a problem, and reads as English, so that a manifest written for a later language still loads. `project.yaml.example` documents it.
- **`binn init` proposes the language** and puts it in the plan: from the root `README.md` when there is one, Russian when Cyrillic letters outnumber Latin letters outside code blocks and inline code, English otherwise; with no README, the person's language. The interactive form asks once, the proposal as its default, as it asks the window. `--language <en|ru>` answers it for every form, as `--window` does; `--plan --json` reports the proposal, where it came from and whether the manifest declares one. A new manifest gets the line; an existing manifest with none gets it printed, never written (ADR-0026), and only when the answer is not English. `/binnacle:init` shows the proposal in the chat, asks, and passes `--language` to `--plan` and `--apply`.
- **The plan's id ignores the person's language**: the plan's headings in `--plan --json`, and in the id's hash, are English; only the interactive form shows them translated. Its bodies, the templates, follow the repository language, which is part of the plan.
- **Templates in the repository language**: the roadmap skeleton, the issue tracker's file with its ticket-header section, the triage labels' file, the domain file, the *Agent skills* block, and a new `AGENTS.md`'s heading. Each template has an English and a Russian text; the markers in them stay English: the roadmap's table header `| # | Epic | Status | Spec |`, its statuses, `## Current focus`, `Next action:`, the ticket header's field names and state values, the triage label strings, `## Ticket header` and `## Agent skills`. The *Agent skills* block gains one line stating the documentation language when it is not English.
- **The skills read the repository language from the manifest** before they write into the repository: `/binnacle:roadmap` its roadmap, `/binnacle:checkpoint` the decisions it promotes, `/binnacle:autopilot` its tickets' statuses and Reviews, `/binnacle:task run` its ticket's Review. A manifest with none is English. `/binnacle:answer` writes the owner's words as given.
- **The vault's own words in the repository language**: the daemon reads `knowledge.language` from the manifest it already reads, and writes the snapshot's and the daily's notes, their headings and generated lines, in it. Notes copied from the repository are unchanged, and the generated marker, `generated-by: binnacle`, stays as it is. The autostart service's environment does not change.
- **Attention items and errors carry their values.** A diagnostic, `{ code, message }`, gains an optional `params`: the values its English message is written from, Task ids, paths, numbers and names, as strings and numbers. An error envelope, and each of its details, gains the same. Every message that reaches a person's surface has a code. The field is additive: MCP tools, `--json` and `binn call` keep every field they have, in English.
- **One Russian wording of the daemon's codes**, in `@binnacle/core`, as pure functions from `params` to a sentence, beside the list of codes it knows; English is the daemon's own message. `binn` and the dashboard both use it, and the dashboard's text-matched daemon reasons move into it. A code it does not know, or `params` it cannot use, gives the daemon's message, marked English. In the chat, the model words the message from its code, message and params.
- **`binn`'s own text**: every command's text output, its help, its warnings and its errors are worded from a CLI dictionary by the person's language: `init`, `audit`, `daemon`, `project`, `dashboard` and the usage. `binn mcp` and `binn call` print machine output and are not touched. An error prints its sentence without its code; the exit code is unchanged.
- **`binn audit`'s findings carry their values**, and the text output words them by the person's language, while `--json` keeps today's English reasons and recommendations. The text opens with one line of totals, then the migration plan, its steps naming their areas rather than codes, then the gaps and unknowns by area, then the `ok` findings, one line each.
- **`binn init`'s Summary** opens with the command to run next, then what was written, skipped, printed or declined. The rest of init's dialogue keeps its order: the questions come before the plan they shape.
- **The skills' short report**: each opens with three to six lines in the person's language, leaves out a section with nothing in it, ends with one line on what else it can show, and gives the rest when asked. The skills' instructions stay English. In order:
  - `/binnacle:product`: where the project stands (the current epic, its status, its Tasks done of all, and a linked worktree when it is one); what waits for the owner (questions, approvals, to start, counted, with the first of each); what is broken (a failing default branch, the attention items in words); what is running, only when something is; the Next action with its command, and Binnacle's first alternative in a line when there is one.
  - `/binnacle:daily`: what changed (the range in words, the commits, and what moved: transitions, new tickets, roadmap changes, decisions), or that nothing did; what waits for the owner; what is broken; what can start next, with its command.
  - `/binnacle:status`: the project and its tracker; the checkout with its branch, short commit and clean or dirty state, and a linked worktree when it is one; what is wrong, only when something is.
  - `/binnacle:task`, without `run`: the Task with its state and epic; what it waits on (unanswered questions, Unmet dependencies, an approval); what is broken (its pull request's CI, a missing Review); the command that starts it.
  - `/binnacle:audit`: the totals, the plan, then the gaps and unknowns by area.
  - The other skills report what they did, in the person's language, as briefly.
- **The Russian terms**, the same in the chat, `binn` and the dashboard, recorded in `CONTEXT.md` beside each term, in core's wording and the dashboard's dictionary, and listed in each reporting skill for the model: Task — задача; Epic — эпик; Current Epic — текущий эпик; Next action — следующий шаг; Suggested step — предложенный шаг; Product Snapshot — снимок проекта; Product session — продуктовая сессия; Product Steward — продуктовый агент; roadmap — роадмап; Spec — спецификация; Ticket — тикет; Epic brief — бриф эпика; Task brief — бриф задачи; Vision — видение; Backlog — бэклог; Ready — готова к старту; In progress — в работе; BLOCKED — заблокирована; Review — ревью; Done — готово; Unmet dependency — невыполненная зависимость; Question — вопрос; Answer — ответ; Waiting for the owner — ждёт владельца; Conflict risk — риск конфликта; Parallel limit — лимит параллельной работы; Checkout — рабочая копия; Harness — клиент агента; Provider — провайдер; AgentRun — запуск; Review run — запуск ревью; Rework run — доработка; Unassigned — без задачи; Roles — роли (разработчик, ревьюер, архитектор, тестировщик, безопасность, DevOps, аналитик); CI state — состояние CI; Audit — аудит; Finding — находка; Migration plan — план перехода; Stranded document — бесхозный документ; Checkpoint — чекпойнт; Autopilot — автопилот; Autostart — автозапуск; Vault projection — проекция в Obsidian; Context pressure — заполненность контекста; Session artifact — файл сессии; Harness support level — уровень поддержки; Project registry — реестр проектов; Project Brain — знания проекта. The roadmap's statuses read не начат, спецификация, тикеты, в работе, готов; a Task's states read бэклог, готова, в работе, заблокирована, на ревью, одобрена, готова к слиянию, слита, готово, отменена; CI reads проходит, падает, идёт, нет проверок; a finding reads в порядке, пробел, неизвестно. Git's words take their usual Russian, ветка and коммит; `worktree` stays.
- **Marks of calculation**: one word in brackets beside the value, "(оценка)" / "(estimate)" for Binnacle's calculations, conflict risk, cost and derived metrics, and "(по активности)" / "(from activity)" for readings from runs; an unknown is "нет данных" / "no data". The dashboard's longer provenance notes give way to them.
- **The dashboard**: its Russian dictionary translates every term above, its attention items and reasons come from core's wording, and no code is shown, *Full* included. A message with no wording keeps its English mark. Epic 6's rule in `docs/04-telemetry-dashboard.md` is replaced by ADR-0045's.
- **Documentation is updated with the code**: `CONTEXT.md`'s Russian words; `docs/04-telemetry-dashboard.md`'s language paragraph; `docs/03-mcp-and-skills.md` on the short report, `params` and the repository language; the manifest's field where the guides describe the manifest, `docs/operations/02-existing-project-adopt.md`, `01-new-project.md` and their twins; `project.yaml.example`.
- **No new ADR.** ADR-0045 records the durable decision; `params`, one wording in core and the README's count are reversible.

## Testing Decisions

Confirmed by the owner on 2026-10-21: four existing seams, and review with the exit demonstration for the skills.

- **The `binn` process** on temporary Git repositories with `LANG` and `LC_ALL` set, as `apps/cli/test/init.test.ts`, `audit.test.ts`, `project.test.ts` and `autostart.test.ts` do. It covers: Russian output with `ru_RU.UTF-8`, English with `C`, unset or `en_US.UTF-8`, and `LC_ALL` over `LANG`; no attention or error code in the text, the exit codes unchanged; `--json` byte-for-byte the same under either locale; `binn audit`'s new order; `binn init`'s Summary opening with the next command; the language proposal from an English README, a Russian README, a README that is mostly code, and no README; `--language` in every form; the plan's id the same under either locale; a new manifest with the line, an existing one with the line printed and the file unchanged; Russian templates on a Russian repository and English on an English one. A good test checks what a person running the command could see: stdout, stderr, the exit code, the JSON and the files on disk.
- **Templates read back**: on a fixture `binn init` wrote in Russian, `binn audit` finds no gap in the roadmap and the ticket-header section, and the daemon parses the roadmap with no diagnostic, so that a translated marker fails the suite.
- **The daemon**: the manifest's `knowledge.language` through `apps/daemon/test/manifest.test.ts`, `en`, `ru`, absent and an unknown value as a warning; the vault through `vault.test.ts`, a Russian repository's snapshot and daily notes in Russian, an English one's unchanged, the generated marker the same and a human's note untouched; `params` on attention items and errors through the existing snapshot and HTTP tests, every other field as before.
- **Core's wording**: a test over the daemon's and core's sources, as `apps/dashboard/test/type-scale.test.ts` reads the dashboard's, finds every code they emit and fails when core's Russian has no wording for one; each wording is checked with its `params`, and an unknown code falls back to the English message.
- **The dashboard's dictionaries** through `apps/dashboard/test/i18n.test.ts`: the Russian dictionary holds none of the terms epic 6 kept English, the marks of calculation are one word, an attention item is worded from its code and `params`. The pages are checked in a browser, in Russian and in English.
- **Checked in review and in the exit demonstration, not by a test**: each skill's short report and its order, the Russian terms in the skills, `/binnacle:init`'s language question, the skills that write in the repository language, and the guides and their twins beyond the existing twin and link test.

## Contested points

- **The vault's language**: the brief's decision and ADR-0045 put the vault on the repository's side, while a default of the brief gave its own words the daemon's locale, with `LANG` passed to the autostart service. The owner took the repository's language (2026-10-21): the vault follows the manifest, the daemon needs no locale, and the service's environment is unchanged. This repository's vault stays English.
- **How a daemon message is worded in Russian**: by an optional `params` on each diagnostic and error, which the brief's "machine output does not change" bends by one additive field, rather than by matching the English message with a pattern per code, which leaves the output untouched but shows English, silently, whenever the daemon's wording changes. The owner took `params` (2026-10-21).
- **One wording for binn and the dashboard**: in `@binnacle/core`, which the dashboard then imports, rather than a copy in each, which ADR-0033's "dictionaries of our own" would allow; two copies of every Russian sentence would drift. The dashboard's page text stays in its own dictionary.
- **The README's language** is told by counting letters, not by a language-detection module: two languages need no model, and the answer is only the plan's proposal, which the person confirms.
- **The audit's plan names areas, not codes, in text**: epic 12 had each step name its findings by code; codes now leave a person's text, and `--json` keeps them on each step.

## Out of Scope

- Any language beside English and Russian.
- Translating MCP output, `--json`, `binn call`, the daemon's own messages or the skills' instructions.
- Translating a file already in a repository, or rewriting one `binn init` did not create.
- Translating the markers Binnacle parses, or reading them in another language.
- Matt Pocock's skills, beyond the line the *Agent skills* block gives them.
- A setting for the person's language, and a flag for a short or full form in `binn`.
- The autostart service's environment.
- Anything after v1: 0.3.0 is epic 13 and nothing else.

## Further Notes

- Vocabulary: *Person's language* and *Repository language* are in `CONTEXT.md` (2026-10-21); each term gains its Russian word there.
- The tickets' order: the manifest field and `params` with core's wording first; then `binn`'s dictionary and the commands, the templates and `binn init`'s proposal, the vault, and the dashboard, independent of each other; the skills after the field and the wording; the guides with the code each describes; the exit demonstration and release last.
- The dashboard's daemon reasons matched by text today (`daemonReasons`) become codes with `params`; their test that "the page knows the texts the daemon writes" becomes the test over the sources.

## Risks

- **What it can break:** the shape of every attention item and error in MCP, `--json` and the daemon's HTTP, which gain `params`; the plan's id, which a translated heading would change between `--plan` and `--apply`; the markers in a Russian template, which, if translated, make Binnacle and `binn audit` read a fresh roadmap or issue tracker as broken; the vault's own notes, if the generated marker changes, which would stop the vault telling its notes from the human's; and every `binn` test that reads English text, which now depends on the locale the test runs under.
- **The riskiest step:** the templates. A Russian roadmap skeleton or ticket-header section with one translated marker is a project broken from its first commit; the test that runs `binn audit` and the roadmap parser on a fixture `binn init` wrote in Russian is the guard.
- **What was dropped, and why:** languages beyond two (no user asks for one); an i18n module (two dictionaries need none, ADR-0033); translating machine output and the skills' instructions (agents and scripts read them); passing `LANG` to the autostart service (the vault follows the manifest, so the daemon needs no locale); a language setting and a short-or-full flag (the locale and the chat decide, and details follow the summary).
