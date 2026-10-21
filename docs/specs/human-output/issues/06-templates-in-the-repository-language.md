# 06: binn init's templates in the repository language

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/human-output/spec.md`
Roles: Developer, Reviewer, QA

**What to build:** the files `binn init` writes are in the repository language (spec, *Templates in the repository language*). The roadmap skeleton, the issue tracker's file with its ticket-header section, the triage labels' file, the domain file, the *Agent skills* block and a new `AGENTS.md`'s heading each have an English and a Russian text, chosen by the language the plan carries (ticket 01). The markers stay English in both: the roadmap's `| # | Epic | Status | Spec |`, its statuses, `## Current focus`, `Next action:`, the ticket header's field names and state values, the triage label strings, `## Ticket header` and `## Agent skills`. The *Agent skills* block gains one line stating the documentation language when it is not English, so that any agent writes its specs and tickets in it.

- [x] Through the `binn` process: a Russian repository's plan holds the Russian templates, an English one's the English templates as today.
- [x] On a fixture `binn init` wrote in Russian, `binn audit` finds no gap in the roadmap and the ticket-header section, and the roadmap parser gives no diagnostic.
- [x] The *Agent skills* block names Russian on a Russian repository and says nothing of language on an English one.

## Comments

### Decisions

- **The Russian texts are `apps/cli/src/conventions-ru.ts`**, beside the English ones in `conventions.ts`, which are byte-for-byte as before; `ticketHeaderSection`, `conventionFiles` and `agentSkillsBlock` take the language, and `agentsFile` writes a new `AGENTS.md` with its heading. The roadmap skeleton is `ROADMAP_SKELETON[language]` in `apps/cli/src/layout.ts`.
- **The language is the one the plan carries**: `languageStep`'s result, so the manifest's when it declares one, and otherwise the answer or the proposal, even for an existing manifest without the line, whose templates follow the answer while init prints the line to add.
- **More markers than the ticket lists stay English**, because Binnacle or a skill reads them: the role names, `## Comments`, `### Question`, `### Answer`, `"(recommended)"`, `## Contested points`, `Triage:`, the wayfinding `## Answer`, `Type:` and its values, and the flags `**PRs as a request surface: no.**` and `**MRs as a request surface: no.**` that `/triage` reads. The skills' own phrases quoted in headings stay English too: `## Когда скилл говорит "publish to the issue tracker"`.
- **The Agent skills block's language line** is in the Russian block only: it says the documentation is in Russian and that the markers Binnacle reads stay English.
- **The guides**: `docs/operations/01-new-project.md`, `02-existing-project-adopt.md` and their twins say the templates follow the documentation language, with the markers English.

### For the next tickets

- Ticket 10 (skills write in the repository language): the list above is the set of markers a skill keeps English when it writes a Russian roadmap, ticket or Review.
- `apps/cli/test/init.test.ts` holds the guard: on a fixture `binn init` wrote in Russian, `binn audit` and `parseRoadmap` read the roadmap and the ticket header with no gap; a translated marker fails it.

### Review

A Reviewer sub-agent ran against `main` on both axes and QA. Typecheck is clean; every English template is byte-for-byte as on `main`; no new dependency, nothing outside the ticket.

**Standards:** nothing to fix.

**Spec:**

1. **The adopt guide said the templates follow "the language you answer"**, wrong when the manifest declares one and nothing is asked. **Fixed**: "the documentation language" in `docs/operations/02-existing-project-adopt.md` and its twin.
2. **«следующий шаг, который грилит эпик»** read as jargon. **Fixed** in `conventions-ru.ts`: «ведущий к грилингу эпика».
3. **English role names in a Russian sentence** («без неё задаче нужны Developer и Reviewer»). **Kept**: they are the values the `Roles:` line holds.
4. **«Существующий roadmap»** in the adopt guide's Russian twin. **Left**: it predates this ticket.

#### QA

1. **The marker test looked only at the ticket-header section**, so a translated `/triage` flag, `## Contested points`, `## Comments` or `Triage:` would pass. **Fixed**: the test checks them in the tracker file before the section, per tracker.
2. **No test showed a declared language deciding the templates over the README**, nor an existing manifest without one taking the answer. **Fixed**: a test plans both, English templates for `language: en` with a Russian README, and Russian ones, with the manifest untouched, for none.
3. **A translated `## Current focus`** in the Russian skeleton was tried by hand: the read-back test fails on it. Nothing to fix.

Typecheck is clean, and the full suite passes: 882 of 882.
